#!/bin/sh
# wifi.cgi — WiFi settings management (dual-band safe)
#
# GET:  status   — hostapd process status (JSON)
# POST: apply    — apply WiFi settings via qcmap_wifi_ctl
#        restart  — restart hostapd (both/primary/guest)
echo "Content-Type: application/json"
echo ""

# No DB path here on purpose: this script performs no database access at all.
# Runtime rows go through core_app via the SetWlanSettings IPC, and the one
# provisioning row (wifi_config.GuestAP) is written by qcmap_wifi_ctl.
WIFI_CTL="/usr/bin/qcmap_wifi_ctl"
MOBILEAP_CFG="/etc/mobileap_cfg.xml"

. /jrd-resource/resource/webrc/www/cgi-bin/lib/cgi-common.sh

# Bounds for qcmap_wifi_ctl. `apply` writes hostapd-wlan1.conf, forks a
# detached watchdog and does one IPC to core_app (5 s internal timeout) —
# it must not sit on the single-threaded server past this. It no longer
# touches mobileap_cfg.xml: qcmap_wifi_ctl 2.0.0 dropped all WLAN mode
# switching, because QCMAP parses that file only at its own start and
# core_app re-asserts the mode at every start regardless.
WIFI_APPLY_TIMEOUT=20
WIFI_RESTART_TIMEOUT=25
WIFI_STATUS_TIMEOUT=5

# Express the requested AP mode as the ApStatus flags core_app expects,
# and fold them into the body BEFORE qcmap_wifi_ctl apply.
#
# This replaces nine direct db_set calls on wifi_info/wifi_config that ran
# AFTER the apply, behind core_app's back. core_app keeps these values in
# memory and rewrites the rows from its own cache, so those writes were
# either lost or clobbered the state core_app believed in — that split
# (settings via IPC, mode via sqlite) was the revert race. Everything now
# reaches core_app through the one SetWlanSettings IPC that
# qcmap_wifi_ctl already makes.
#
# The mapping mirrors what the old writes intended:
#   dual -> 2GAPStatus=1, Guest5GAPStatus=1   (AP-AP: wlan0 2.4G + wlan1 5G)
#   2g   -> 2GAPStatus=1, Guest5GAPStatus=0   (+ an explicit stop-guest below)
# 5g is rejected before reaching here (see the mode validation): it sets
# 5GAPStatus=1, moving wlan0 to 5 GHz while wlan1 is already there.
#
# TWO RULES, both load-bearing:
#  1. An ApStatus already in the body always wins — mode is only the
#     fallback intent, and the caller may be setting the flags itself.
#  2. A sub-object that is NOT in the body is never created. Adding a bare
#     {"ApStatus":1} guest object would make qcmap_wifi_ctl regenerate
#     /etc/hostapd-wlan1.conf from defaults — ssid=EE71_5G with an empty
#     wpa_passphrase — silently destroying the guest AP config. Likewise a
#     bare AP2G would hand core_app an SSID-less AP over IPC.
# The current UI always sends all four sub-objects with explicit ApStatus,
# so in practice this is a no-op; the fix is the removal of the racing
# writes, not the addition of new ones.
#
# Two fields the old code wrote are NOT written from this script any more.
# Settled in docs/plans/guestap-apmode-semantics.md:
#
#   wifi_config.GuestAP — NOT a capability count, and never 2. It is a small
#       integer that ships as 0 and is 1 on this unit because a provisioning
#       script we deleted set it. The earlier claim that it "ships as 2" and
#       that core_app gates AP-AP on GuestAP == 2 is REFUTED: the live device
#       has GuestAP = 1 while core_app asserts AP-AP right now, so a == 2 test
#       could not pass. The 2 came from a field-identity mix-up — the wire name
#       WlanAPMode covers both GetWlanSettings param 2 (runtime band selection,
#       wifi_info.APMode) and GetWlanSupportMode param 96 (a static capability
#       whose value is 2), with qcmap_wlan_mode=2 and wifi_config.Band=2 nearby.
#       It IS load-bearing at 1, and it is provisioning, not runtime state, so
#       qcmap_wifi_ctl writes it next to the IPC — one path for the whole mode
#       change — never this script. It is written one-way (only ever 1), so
#       switching 5 GHz off can never make dual-band unrecoverable.
#
#   wifi_info.APMode    — runtime band state owned by core_app. The stock SPA
#       never writes it (0 occurrences in either build) and neither do we.
apply_mode_ap_status() {
    _mode="$1"
    _body="$2"
    case "$_mode" in
        dual) _s2g=1; _s5g=null; _sguest=1 ;;
        2g)   _s2g=1; _s5g=null; _sguest=0 ;;
        *)    printf '%s' "$_body"; return 0 ;;
    esac
    printf '%s' "$_body" | jq -c \
        --argjson s2g "$_s2g" --argjson s5g "$_s5g" --argjson sg "$_sguest" '
        # fill(key; v): set .[key].ApStatus to v only when the caller sent
        # that sub-object and left ApStatus out. Never creates the object.
        def fill(k; v):
            if v == null or (has(k) | not) or (.[k] | has("ApStatus"))
            then . else .[k] = (.[k] + {ApStatus: v}) end;
        fill("AP2G"; $s2g)
        | fill("AP5G"; $s5g)
        | fill("AP2G_guest"; $sg)
        | fill("AP5G_guest"; $sg)
    ' 2>/dev/null || printf '%s' "$_body"
}

# Validate SSID: 1-32 chars, no control chars
valid_ssid() {
    [ -z "$1" ] && return 1
    [ ${#1} -gt 32 ] && return 1
    return 0
}

# Validate WPA key: 8-63 chars for WPA2
valid_key() {
    [ ${#1} -lt 8 ] && return 1
    [ ${#1} -gt 63 ] && return 1
    return 0
}

current_wlan_mode() {
    sed -n 's:.*<WlanMode>\(.*\)</WlanMode>.*:\1:p' "$MOBILEAP_CFG" 2>/dev/null | head -1
}

normalize_mode() {
    MODE=$(printf '%s' "$BODY" | jq -r '.mode // empty')
    [ -n "$MODE" ] && { echo "$MODE"; return; }

    AP2G_STATUS=$(printf '%s' "$BODY" | jq -r '.AP2G.ApStatus // empty')
    AP5G_STATUS=$(printf '%s' "$BODY" | jq -r '.AP5G.ApStatus // empty')
    GUEST_STATUS=$(printf '%s' "$BODY" | jq -r '.AP5G_guest.ApStatus // .AP2G_guest.ApStatus // empty')

    if [ "$GUEST_STATUS" = "1" ]; then
        echo "dual"
        return
    fi
    if [ "$AP2G_STATUS" = "0" ] && [ "$AP5G_STATUS" = "1" ]; then
        echo "5g"
        return
    fi
    if [ "$AP2G_STATUS" = "1" ]; then
        echo "2g"
        return
    fi

    case "$(current_wlan_mode)" in
        AP-AP) echo "dual" ;;
        *) ;;
    esac
}

# --- Parse action ---
case "$REQUEST_METHOD" in
GET)
    ACTION="${QUERY_STRING%%&*}"
    ACTION="${ACTION#action=}"
    ;;
POST)
    csrf_check
    read -r BODY
    ACTION=$(printf '%s' "$BODY" | jq -r '.action // empty')
    ;;
esac

case "$ACTION" in

status)
    # Return hostapd process status + DB settings summary
    if [ -x "$WIFI_CTL" ]; then
        # Buffer the output: emitting it straight through would risk a
        # partial object followed by an error object on the same stream.
        OUTPUT=$(run_timeout "$WIFI_STATUS_TIMEOUT" "$WIFI_CTL" status 2>/dev/null)
        if [ -n "$OUTPUT" ]; then
            printf '%s\n' "$OUTPUT"
        else
            json_err "qcmap_wifi_ctl status gave no answer within ${WIFI_STATUS_TIMEOUT}s"
        fi
    else
        W0=false; W1=false
        ps w 2>/dev/null | grep 'hostapd.*hostapd\.conf' | grep -qv grep && W0=true
        ps w 2>/dev/null | grep 'hostapd.*hostapd-wlan1' | grep -qv grep && W1=true
        jq -n --argjson wlan0 "$W0" --argjson wlan1 "$W1" \
            '{"wlan0":$wlan0,"wlan1":$wlan1}'
    fi
    ;;

apply)
    if [ ! -x "$WIFI_CTL" ]; then
        echo '{"error":"qcmap_wifi_ctl not installed"}'
        exit 0
    fi

    # Extract the params object from the body (everything after "action":"apply",)
    # The body format: {"action":"apply","AP2G":{...},"AP5G":{...},"AP2G_guest":{...}}
    # We need to pass the full JSON (minus action) to qcmap_wifi_ctl

    # Validate SSIDs from the body
    SSID_2G=$(printf '%s' "$BODY" | jq -r '.AP2G.Ssid // empty')
    SSID_5G=$(printf '%s' "$BODY" | jq -r '.AP5G_guest.Ssid // .AP2G_guest.Ssid // .AP5G.Ssid // empty')
    KEY_2G=$(printf '%s' "$BODY" | jq -r '.AP2G.WpaKey // empty')
    KEY_5G=$(printf '%s' "$BODY" | jq -r '.AP5G_guest.WpaKey // .AP2G_guest.WpaKey // .AP5G.WpaKey // empty')
    SEC_2G=$(printf '%s' "$BODY" | jq -r '.AP2G.SecurityMode // empty')
    SEC_5G=$(printf '%s' "$BODY" | jq -r '.AP5G_guest.SecurityMode // .AP2G_guest.SecurityMode // .AP5G.SecurityMode // empty')

    # Validate SSIDs (if present)
    if [ -n "$SSID_2G" ] && ! valid_ssid "$SSID_2G"; then
        echo '{"error":"Invalid 2.4GHz SSID (1-32 chars)"}'
        exit 0
    fi
    if [ -n "$SSID_5G" ] && ! valid_ssid "$SSID_5G"; then
        echo '{"error":"Invalid 5GHz SSID (1-32 chars)"}'
        exit 0
    fi

    # Validate WPA keys (if WPA2 mode and key present)
    if [ "$SEC_2G" != "0" ] && [ -n "$KEY_2G" ] && ! valid_key "$KEY_2G"; then
        echo '{"error":"2.4GHz password must be 8-63 characters"}'
        exit 0
    fi
    if [ "$SEC_5G" != "0" ] && [ -n "$KEY_5G" ] && ! valid_key "$KEY_5G"; then
        echo '{"error":"5GHz password must be 8-63 characters"}'
        exit 0
    fi

    # Validate mode field (if present).
    #
    # 5g is rejected, not accepted-and-ignored. It means "5GAPStatus=1"
    # (core_app switches wlan0 itself to 5 GHz) while the device is in
    # AP-AP with wlan1 already on 5 GHz — two 5 GHz APs on one QCA6174
    # radio, which does 2.4+5 but not 5+5. One of the two hostapd then
    # fails to come up and QCMAP can take the whole WLAN down with it.
    # A mode that cannot work should fail at the edge, loudly, rather
    # than downstream in the driver.
    MODE=$(normalize_mode)
    if [ -n "$MODE" ]; then
        case "$MODE" in
            2g|dual) ;;
            5g)
                echo '{"error":"mode 5g is not supported: it would put two 5 GHz APs on one radio. The device is always dual-band (AP-AP); use dual, or 2g to switch 5 GHz off."}'
                exit 0
                ;;
            *) echo '{"error":"Invalid mode (use 2g/dual)"}'; exit 0 ;;
        esac
        BODY=$(printf '%s' "$BODY" | jq -c --arg mode "$MODE" '. + {mode:$mode}')
        # Fold the mode's ApStatus flags in so core_app — not this script —
        # owns every wifi_info write for this operation.
        BODY=$(apply_mode_ap_status "$MODE" "$BODY")
    fi

    # Call qcmap_wifi_ctl apply with the full JSON body
    OUTPUT=$(run_timeout "$WIFI_APPLY_TIMEOUT" "$WIFI_CTL" apply "$BODY" 2>&1)
    RET=$?

    if [ "$RET" -eq 0 ]; then
        # qcmap_wifi_ctl prints this marker when it had to flip
        # wifi_config.GuestAP from 0 to 1. QCMAP is running single-AP at that
        # moment (no wlan1 vdev), so 5 GHz cannot come up until core_app
        # re-asserts the mode at its next start. Tell the caller plainly
        # instead of reporting success for something not yet in effect.
        REBOOT_HINT=false
        case "$OUTPUT" in *REBOOT_REQUIRED*) REBOOT_HINT=true ;; esac

        # The settings applied and 5 GHz is up now, but wifi_config.GuestAP
        # could not be written, so the device will not come up dual-band after
        # a reboot. Not an error — but never report a bare success for it.
        WARNING=
        case "$OUTPUT" in
            *GUESTAP_FAILED*)
                WARNING="5 GHz is on now, but the dual-band setting could not be saved; it may not survive a reboot"
                ;;
        esac

        # "5 GHz off" is ours to carry out. The apply above sent the guest
        # section with ApStatus=0, so qcmap_wifi_ctl refreshed
        # hostapd-wlan1.conf but deliberately did not restart wlan1; core_app
        # then killed every hostapd and brought back only wlan0. stop-guest
        # clears whatever survived that (a lingering hostapd_cli, the stale
        # pid and control socket) and is idempotent, so it is safe here even
        # when wlan1 is already down.
        #
        # Note this is a runtime state only: QCMAP starts wlan1 from its own
        # XML at the next boot, so 5 GHz returns after a reboot. Persisting
        # "off" across boots would need a boot script, which is exactly what
        # this cleanup removed — do not add one back.
        STOP_FAILED=false
        if [ "$MODE" = "2g" ]; then
            STOP_OUT=$(run_timeout "$WIFI_RESTART_TIMEOUT" "$WIFI_CTL" stop-guest 2>&1)
            # Do not swallow this: the user asked for 5 GHz off, and a silent
            # failure here would leave it running while we report success.
            [ $? -eq 0 ] || STOP_FAILED=true
            OUTPUT="$OUTPUT
$STOP_OUT"
        fi
        # Flush core_app's DB write to NAND. Bounded: sync can stall on a
        # busy UBIFS and would otherwise hold the whole server.
        run_timeout 5 sync
        if [ "$STOP_FAILED" = true ]; then
            jq -n --arg detail "$OUTPUT" \
                '{"error":"settings applied, but switching 5 GHz off failed","detail":$detail}'
        else
            jq -n --arg detail "$OUTPUT" --argjson reboot "$REBOOT_HINT" \
                --arg warning "$WARNING" \
                '{"ok":true,"reboot_required":$reboot,"detail":$detail}
                 + (if $warning == "" then {} else {warning:$warning} end)'
        fi
    elif [ "$RET" -eq 124 ]; then
        jq -n --arg detail "$OUTPUT" --argjson t "$WIFI_APPLY_TIMEOUT" \
            '{"error":"apply timed out","timeout":$t,"detail":$detail}'
    else
        jq -n --arg detail "$OUTPUT" '{"error":"apply failed","detail":$detail}'
    fi
    ;;

restart)
    if [ ! -x "$WIFI_CTL" ]; then
        echo '{"error":"qcmap_wifi_ctl not installed"}'
        exit 0
    fi

    # guest (wlan1) is the only restartable target. wlan0 belongs to
    # core_app — qcmap_wifi_ctl 2.0.0 dropped restart-both/restart-primary
    # so that we are not a second writer of core_app's hostapd.
    TARGET=$(echo "$BODY" | jq -r '.target // empty')
    TARGET="${TARGET:-guest}"

    case "$TARGET" in
        guest)
            OUTPUT=$(run_timeout "$WIFI_RESTART_TIMEOUT" \
                "$WIFI_CTL" "restart-$TARGET" 2>&1)
            RET=$?
            if [ "$RET" -eq 0 ]; then
                jq -n --arg detail "$OUTPUT" '{"ok":true,"detail":$detail}'
            elif [ "$RET" -eq 124 ]; then
                jq -n --arg detail "$OUTPUT" --argjson t "$WIFI_RESTART_TIMEOUT" \
                    '{"error":"restart timed out","timeout":$t,"detail":$detail}'
            else
                jq -n --arg detail "$OUTPUT" '{"error":"restart failed","detail":$detail}'
            fi
            ;;
        *)
            jq -n --arg target "$TARGET" '{"error":("invalid target: " + $target + " (use guest)")}'
            ;;
    esac
    ;;

*)
    echo '{"error":"unknown action"}'
    ;;
esac
