#!/bin/sh
# at.cgi — AT command interface
# GET:  templates (read-only), policy (what the server refuses)
# POST: send (with CSRF check)
#
# Arbitrary AT commands stay allowed by design. Two things make that safe:
#
#  1. Every access to the modem node is bounded. The whole open + write +
#     read runs inside one run_timeout, so a modem that never answers
#     cannot wedge the single-threaded server. (The old code bounded only
#     the read; `exec 3<>` on a stuck node blocks in open() before any
#     timeout applies.)
#  2. A blacklist refuses the command families that can permanently damage
#     the device: NV/EFS writes, IMEI/serial rewrites, factory restore and
#     firmware-download entry. See AT_BLACKLIST below.
#
# The blacklist is a floor, not the whole safety story: the UI is expected
# to confirm any write-form command (see `policy`) before sending it.
echo "Content-Type: application/json"
echo ""

AT_DEV="/dev/smd7"
[ ! -c "$AT_DEV" ] && AT_DEV="/dev/ttyUSB0"

# Seconds to hold the modem node open. The node never signals EOF, so a
# read always ends at this bound — it is a collection window, not a fault.
AT_READ_TIMEOUT=4

. /jrd-resource/resource/webrc/www/cgi-bin/lib/cgi-common.sh

# Command families refused outright. Matched against the command with all
# WHITESPACE removed (not just literal spaces — "AT<tab>&F" must hit the
# AT&F* glob on its own merit, not by accidentally tripping the separate
# charset gate) and upper-cased, so "at &f" and "AT&F" both hit.
# Each entry is "GLOB|reason".
AT_BLACKLIST='
AT&F*|factory defaults
AT&W*|write settings to NVRAM
AT*&W*|write settings to NVRAM
AT+EGMR=*|IMEI / serial rewrite
AT^IMEI*|IMEI rewrite
AT+CGSN=*|IMEI rewrite
AT+GSN=*|IMEI rewrite
AT$QCNV*|Qualcomm NV item access
AT$NV*|NV item access
AT+QNVW*|NV write
AT+QNVFW*|NV file write
AT^NVWR*|NV write
AT+EFS*|EFS filesystem access
AT$QCEFS*|EFS filesystem access
AT+QPRTPARA*|NV partition backup/restore
AT$QCRESTORE*|restore factory NV
AT^RESET*|factory reset
AT+CRST*|reset
AT+QFASTBOOT*|reboot into fastboot
AT$QCDMR*|switch to DIAG/firmware mode
AT^GODLOAD*|firmware download mode
AT+QDOWNLOAD*|firmware download mode
AT+CLCK=*|SIM/facility lock (can hard-lock the SIM)
AT+CPWD=*|change SIM/facility password
AT+CPIN=*|SIM PIN entry (wrong tries burn retries to PUK, then to a dead SIM)
AT+CRSM=*|raw SIM elementary-file access (can overwrite IMSI/ICCID records)
AT+CSIM=*|raw APDU to the SIM card
'
# Deliberately NOT blacklisted — these belong in the UI's confirm tier, not
# behind a server refusal, because they are recoverable and genuinely useful:
#   AT$QCBANDPREF=  band locking. Can strand the device with no service, but
#                   it is reversible over AT and is a wanted mifi tweak. The
#                   read form AT$QCBANDPREF? is in the templates.
#   AT+CFUN=0/1,1   airplane mode / modem reboot. Already in the templates
#                   carrying a `warn`; the confirm dialog is exactly for these.
#   AT^*, AT%*      vendor namespaces. Blocking them wholesale would break
#                   AT^SYSINFO, AT^SPN and AT^CARDMODE, all read-only templates.
#   AT+CMGD=        deletes SMS. Data loss, not device damage, and ordinary
#                   message management — out of the four named categories.

# blacklist_reason <normalised-cmd> — echoes the reason, empty if allowed.
blacklist_reason() {
    _norm="$1"
    printf '%s\n' "$AT_BLACKLIST" | while IFS='|' read -r _pat _reason; do
        [ -n "$_pat" ] || continue
        # shellcheck disable=SC2254 — _pat is an intentional glob
        case "$_norm" in
            $_pat) printf '%s' "$_reason"; break ;;
        esac
    done
}

# Validate command: must start with AT, no shell metacharacters
validate_cmd() {
    CMD="$1"
    if [ -z "$CMD" ]; then
        json_err "cmd required"; exit 0
    fi
    # Must start with AT (case insensitive)
    case "$CMD" in
        AT*|at*) ;;
        *) json_err "command must start with AT"; exit 0 ;;
    esac
    # Max length
    if [ ${#CMD} -gt 200 ]; then
        json_err "command too long"; exit 0
    fi
    # Destructive families are refused regardless of any UI confirmation.
    # This runs BEFORE the character allowlist so that e.g. AT&F is refused
    # as "factory defaults" rather than as "invalid characters" — the
    # allowlist would otherwise reject it for the wrong reason and the user
    # would never learn why. Matching is glob-only; nothing is evaluated.
    NORM=$(printf '%s' "$CMD" | tr -d '[:space:]' | tr 'a-z' 'A-Z')
    REASON=$(blacklist_reason "$NORM")
    if [ -n "$REASON" ]; then
        echo "[ERR] at.cgi refused '$CMD' ($REASON)" >&2
        jq -n --arg cmd "$CMD" --arg reason "$REASON" \
            '{"error":("Refused: " + $reason + ". This command family can permanently damage the device."),
              "refused":true,"reason":$reason,"cmd":$cmd}'
        exit 0
    fi
    # Block shell metacharacters (this is what keeps the command safe to
    # hand to the modem node; the blacklist above is about intent).
    CLEAN=$(printf '%s' "$CMD" | tr -cd 'A-Za-z0-9+^$=,.:?!"_ -')
    if [ "$CLEAN" != "$CMD" ]; then
        json_err "invalid characters in command"; exit 0
    fi
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
    ACTION=$(echo "$BODY" | jq -r '.action // empty')
    ;;
esac

case "$ACTION" in

templates)
    cat <<'TEMPLATES_EOF'
{"templates":[
{"cmd":"ATI","desc":"Device info (model, revision, IMEI)","cat":"info"},
{"cmd":"AT+GMI","desc":"Manufacturer","cat":"info"},
{"cmd":"AT+GMM","desc":"Model","cat":"info"},
{"cmd":"AT+GMR","desc":"Firmware revision","cat":"info"},
{"cmd":"AT+GSN","desc":"IMEI","cat":"info"},
{"cmd":"AT+GCAP","desc":"Capabilities","cat":"info"},
{"cmd":"AT+CIMI","desc":"IMSI","cat":"info"},
{"cmd":"AT+ICCID","desc":"SIM ICCID","cat":"info"},
{"cmd":"AT$QCHWREV","desc":"Hardware revision","cat":"info"},
{"cmd":"AT+CLAC","desc":"List all supported commands","cat":"info"},
{"cmd":"AT+CSQ","desc":"Signal quality (RSSI, BER)","cat":"signal"},
{"cmd":"AT$QCSQ","desc":"Extended signal (RSRP, RSRQ, SNR, SINR, RSSI)","cat":"signal"},
{"cmd":"AT$QCSYSMODE","desc":"Current system mode (LTE/WCDMA/GSM)","cat":"signal"},
{"cmd":"AT$QCRSRP?","desc":"Serving + neighbor cells RSRP","cat":"signal"},
{"cmd":"AT$QCRSRQ?","desc":"Serving + neighbor cells RSRQ","cat":"signal"},
{"cmd":"AT$QCANTE","desc":"Antenna count","cat":"signal"},
{"cmd":"AT$QCRPW","desc":"Received radio power","cat":"signal"},
{"cmd":"AT$CSQ","desc":"Classic signal quality","cat":"signal"},
{"cmd":"AT+COPS?","desc":"Current operator","cat":"network"},
{"cmd":"AT+CEREG?","desc":"LTE registration","cat":"network"},
{"cmd":"AT+CREG?","desc":"2G registration","cat":"network"},
{"cmd":"AT+CGREG?","desc":"3G registration","cat":"network"},
{"cmd":"AT+CGATT?","desc":"PS attach status","cat":"network"},
{"cmd":"AT+CGDCONT?","desc":"PDP contexts (APN)","cat":"network"},
{"cmd":"AT+CGACT?","desc":"PDP activation","cat":"network"},
{"cmd":"AT+CGPADDR","desc":"PDP addresses","cat":"network"},
{"cmd":"AT*CNTI?","desc":"Technology indicator","cat":"network"},
{"cmd":"AT$QCCOPS?","desc":"QC operator info","cat":"network"},
{"cmd":"AT+CPIN?","desc":"SIM status","cat":"status"},
{"cmd":"AT+CFUN?","desc":"Phone functionality mode","cat":"status"},
{"cmd":"AT$QCSIMSTAT?","desc":"QC SIM status","cat":"status"},
{"cmd":"AT$QCSIMT","desc":"SIM type (SIM/USIM)","cat":"status"},
{"cmd":"AT^SYSINFO","desc":"System info (srv, domain, roaming, mode)","cat":"status"},
{"cmd":"AT^SYSCONFIG?","desc":"System config","cat":"status"},
{"cmd":"AT^CARDMODE","desc":"Card mode","cat":"status"},
{"cmd":"AT^SPN","desc":"SIM provider name","cat":"status"},
{"cmd":"AT+CCLK?","desc":"Clock","cat":"status"},
{"cmd":"AT+CPAS","desc":"Phone activity status","cat":"status"},
{"cmd":"AT+CPMS?","desc":"SMS storage","cat":"sms"},
{"cmd":"AT+CSCA?","desc":"SMS center","cat":"sms"},
{"cmd":"AT+CNMI?","desc":"New message indication","cat":"sms"},
{"cmd":"AT$QCPDPP?","desc":"PDP auth settings","cat":"pdp"},
{"cmd":"AT$QCPDPCFGE?","desc":"PDP extended config","cat":"pdp"},
{"cmd":"AT$QCDNSP?","desc":"Primary DNS","cat":"pdp"},
{"cmd":"AT$QCDNSS?","desc":"Secondary DNS","cat":"pdp"},
{"cmd":"AT$QCBANDPREF?","desc":"Band preferences","cat":"pdp"},
{"cmd":"AT+CFUN=1,1","desc":"Reboot modem","cat":"system","warn":"Drops connection for 30-60s"},
{"cmd":"AT+CFUN=0","desc":"Airplane mode","cat":"system","warn":"Kills all connectivity"},
{"cmd":"AT+CFUN=1","desc":"Normal mode","cat":"system"}
]}
TEMPLATES_EOF
    ;;

send)
    CMD=$(echo "$BODY" | jq -r '.cmd // empty')
    validate_cmd "$CMD"

    if [ ! -c "$AT_DEV" ]; then
        json_err "AT device not found ($AT_DEV)"
        exit 0
    fi

    # Open, write and read all inside ONE bounded child. Opening the modem
    # node can itself block when the modem is wedged, so the timeout has to
    # wrap the open — not just the read.
    AT_OUT="/tmp/at_cgi_$$.out"
    # `exec cat` so the reader IS the process timeout signals — otherwise a
    # forked cat outlives the bound and keeps the modem node open.
    run_timeout "$AT_READ_TIMEOUT" sh -c '
        exec 3<>"$1" || exit 1
        printf "%s\r" "$2" >&3
        exec cat <&3
    ' at_read "$AT_DEV" "$CMD" > "$AT_OUT" 2>/dev/null
    OUTPUT=$(head -c 8192 "$AT_OUT" 2>/dev/null | tr -d '\r' | head -50)
    rm -f "$AT_OUT"

    if [ -z "$OUTPUT" ]; then
        json_err "no response from the modem on $AT_DEV within ${AT_READ_TIMEOUT}s"
        exit 0
    fi

    jq -n --arg cmd "$CMD" --arg output "$OUTPUT" \
        --argjson window "$AT_READ_TIMEOUT" \
        '{"ok":true,"cmd":$cmd,"output":$output,"read_window":$window}'
    ;;

policy)
    # Contract for the UI: what the server refuses outright, and which
    # commands the UI is expected to confirm before sending.
    printf '%s\n' "$AT_BLACKLIST" \
        | while IFS='|' read -r PAT REASON; do
            [ -n "$PAT" ] || continue
            jq -n --arg pattern "$PAT" --arg reason "$REASON" \
                '{"pattern":$pattern,"reason":$reason}'
        done \
        | jq -s --argjson window "$AT_READ_TIMEOUT" '{
            "blocked": .,
            "confirm_rule": "A command containing = (other than a trailing =?) writes to the modem; confirm before sending. Everything else is a read/test form.",
            "read_window": $window
        }'
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
