#!/bin/sh
# power.cgi — Power management settings
# GET: status (read-only)
# POST: save (with CSRF check)
echo "Content-Type: application/json"
echo ""

DB="/jrd-resource/resource/sqlite3/user_info.db3"

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
        ALLOWED="http://${LAN_IP}"
        case "$HTTP_ORIGIN" in
            "$ALLOWED"|"http://${HOSTNAME}") ;;
            "") case "$HTTP_REFERER" in
                    ${ALLOWED}/*|http://${HOSTNAME}/*) ;;
                    *) echo '{"error":"Invalid origin"}'; exit 0 ;;
                esac ;;
            *) echo '{"error":"Invalid origin"}'; exit 0 ;;
        esac
    fi
}

# Read a value from wifi_info table
db_get() {
    sqlite3 "$DB" "SELECT value FROM wifi_info WHERE items='$1';" 2>/dev/null
}

# Write a value to wifi_info table
db_set() {
    sqlite3 "$DB" "UPDATE wifi_info SET value='$2' WHERE items='$1';" 2>/dev/null
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
    ACTION=$(echo "$BODY" | sed -n 's/.*"action"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    ;;
esac

case "$ACTION" in

status)
    if [ ! -f "$DB" ]; then
        printf '{"error":"database not found"}'
        exit 0
    fi

    AUTO_OFF=$(db_get "AutoOffEnable")
    AUTO_OFF_TIME=$(db_get "AutoOffTime")
    CONN_OFF=$(db_get "ConnectionOffEnable")
    CONN_OFF_TIME=$(db_get "ConnectionOffTime")
    LED_OFF=$(db_get "LedOffWithNoClient")

    printf '{"auto_off_enable":%s,"auto_off_time":%s,"wifi_off_enable":%s,"wifi_off_time":%s,"led_off_no_client":%s}' \
        "${AUTO_OFF:-0}" "${AUTO_OFF_TIME:-1800}" \
        "${CONN_OFF:-0}" "${CONN_OFF_TIME:-600}" \
        "${LED_OFF:-0}"
    ;;

save)
    if [ ! -f "$DB" ]; then
        printf '{"error":"database not found"}'
        exit 0
    fi

    # Extract values from JSON body
    AUTO_OFF=$(echo "$BODY" | sed -n 's/.*"auto_off_enable"[[:space:]]*:[[:space:]]*\([01]\).*/\1/p')
    AUTO_OFF_TIME=$(echo "$BODY" | sed -n 's/.*"auto_off_time"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p')
    CONN_OFF=$(echo "$BODY" | sed -n 's/.*"wifi_off_enable"[[:space:]]*:[[:space:]]*\([01]\).*/\1/p')
    CONN_OFF_TIME=$(echo "$BODY" | sed -n 's/.*"wifi_off_time"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p')
    LED_OFF=$(echo "$BODY" | sed -n 's/.*"led_off_no_client"[[:space:]]*:[[:space:]]*\([01]\).*/\1/p')

    # Validate timeouts: 60-7200 seconds
    if [ -n "$AUTO_OFF_TIME" ]; then
        [ "$AUTO_OFF_TIME" -lt 60 ] 2>/dev/null && AUTO_OFF_TIME=60
        [ "$AUTO_OFF_TIME" -gt 7200 ] 2>/dev/null && AUTO_OFF_TIME=7200
    fi
    if [ -n "$CONN_OFF_TIME" ]; then
        [ "$CONN_OFF_TIME" -lt 60 ] 2>/dev/null && CONN_OFF_TIME=60
        [ "$CONN_OFF_TIME" -gt 7200 ] 2>/dev/null && CONN_OFF_TIME=7200
    fi

    [ -n "$AUTO_OFF" ] && db_set "AutoOffEnable" "$AUTO_OFF"
    [ -n "$AUTO_OFF_TIME" ] && db_set "AutoOffTime" "$AUTO_OFF_TIME"
    [ -n "$CONN_OFF" ] && db_set "ConnectionOffEnable" "$CONN_OFF"
    [ -n "$CONN_OFF_TIME" ] && db_set "ConnectionOffTime" "$CONN_OFF_TIME"
    [ -n "$LED_OFF" ] && db_set "LedOffWithNoClient" "$LED_OFF"

    printf '{"ok":true}'
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
