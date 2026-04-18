#!/bin/sh
# wifi.cgi — WiFi settings management (dual-band safe)
#
# GET:  status   — hostapd process status (JSON)
# POST: apply    — apply WiFi settings via qcmap_wifi_ctl
#        restart  — restart hostapd (both/primary/guest)
echo "Content-Type: application/json"
echo ""

WIFI_CTL="/usr/bin/qcmap_wifi_ctl"
DB="/jrd-resource/resource/sqlite3/user_info.db3"
MOBILEAP_CFG="/etc/mobileap_cfg.xml"

# --- CSRF check for POST ---
csrf_check() {
    if [ "$REQUEST_METHOD" = "POST" ]; then
        case "$CONTENT_TYPE" in
            application/json*) ;;
            *) echo '{"error":"JSON required"}'; exit 0 ;;
        esac
        if [ "$HTTP_X_EE71_REQUEST" != "1" ]; then
            echo '{"error":"Missing X-EE71-Request header"}'; exit 0
        fi
        LAN_IP=$(ifconfig bridge0 2>/dev/null | sed -n 's/.*inet addr:\([^ ]*\).*/\1/p')
        LAN_IP="${LAN_IP:-192.168.1.1}"
        HOSTNAME=$(cat /etc/hostname 2>/dev/null)
        REQ_HOST=$(echo "$HTTP_HOST" | sed 's/:.*//')
        _origin_ok() {
            case "$1" in
                "http://${LAN_IP}"*|"http://${HOSTNAME}"*) return 0 ;;
            esac
            [ -n "$REQ_HOST" ] && case "$1" in
                "http://${REQ_HOST}"*) return 0 ;;
            esac
            return 1
        }
        if [ -n "$HTTP_ORIGIN" ]; then
            _origin_ok "$HTTP_ORIGIN" || { echo '{"error":"Invalid origin"}'; exit 0; }
        elif [ -n "$HTTP_REFERER" ]; then
            _origin_ok "$HTTP_REFERER" || { echo '{"error":"Invalid origin"}'; exit 0; }
        fi
    fi
}

# Read a value from wifi_info table
db_get() {
    sqlite3 "$DB" "SELECT value FROM wifi_info WHERE items='$1';" 2>/dev/null
}

db_set() {
    sqlite3 "$DB" "UPDATE $1 SET value='$3' WHERE items='$2';" 2>/dev/null
}

sync_guest_ap_intent() {
    case "$1" in
        dual)
            db_set wifi_config GuestAP 1
            db_set wifi_info Guest5GAPStatus 1
            db_set wifi_info 2GAPStatus 1
            db_set wifi_info APMode 0
            ;;
        2g)
            db_set wifi_config GuestAP 0
            db_set wifi_info Guest5GAPStatus 0
            db_set wifi_info 2GAPStatus 1
            ;;
        5g)
            db_set wifi_config GuestAP 0
            db_set wifi_info Guest5GAPStatus 0
            db_set wifi_info 2GAPStatus 0
            ;;
    esac
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
        "$WIFI_CTL" status
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

    # Validate mode field (if present)
    MODE=$(normalize_mode)
    if [ -n "$MODE" ]; then
        case "$MODE" in
            2g|5g|dual) ;;
            *) echo '{"error":"Invalid mode (use 2g/5g/dual)"}'; exit 0 ;;
        esac
        BODY=$(printf '%s' "$BODY" | jq -c --arg mode "$MODE" '. + {mode:$mode}')
    fi

    # Call qcmap_wifi_ctl apply with the full JSON body
    OUTPUT=$("$WIFI_CTL" apply "$BODY" 2>&1)
    RET=$?

    if [ $RET -eq 0 ]; then
        sync_guest_ap_intent "$MODE"
        sync
        jq -n --arg detail "$OUTPUT" '{"ok":true,"detail":$detail}'
    else
        jq -n --arg detail "$OUTPUT" '{"error":"apply failed","detail":$detail}'
    fi
    ;;

restart)
    if [ ! -x "$WIFI_CTL" ]; then
        echo '{"error":"qcmap_wifi_ctl not installed"}'
        exit 0
    fi

    TARGET=$(echo "$BODY" | jq -r '.target // empty')
    TARGET="${TARGET:-both}"

    case "$TARGET" in
        both|primary|guest)
            OUTPUT=$("$WIFI_CTL" "restart-$TARGET" 2>&1)
            RET=$?
            if [ $RET -eq 0 ]; then
                jq -n --arg detail "$OUTPUT" '{"ok":true,"detail":$detail}'
            else
                jq -n --arg detail "$OUTPUT" '{"error":"restart failed","detail":$detail}'
            fi
            ;;
        *)
            jq -n --arg target "$TARGET" '{"error":("invalid target: " + $target + " (use both/primary/guest)")}'
            ;;
    esac
    ;;

*)
    echo '{"error":"unknown action"}'
    ;;
esac
