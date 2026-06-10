#!/bin/sh
# power.cgi — Power management settings
# GET: status (read-only)
# POST: save (with CSRF check)
echo "Content-Type: application/json"
echo ""

DB="/jrd-resource/resource/sqlite3/user_info.db3"

. /jrd-resource/resource/webrc/www/cgi-bin/lib/cgi-common.sh

# Read a value from wifi_info table

# Write a value to wifi_info table

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

    jq -n --argjson aoe "${AUTO_OFF:-0}" --argjson aot "${AUTO_OFF_TIME:-1800}" \
        --argjson woe "${CONN_OFF:-0}" --argjson wot "${CONN_OFF_TIME:-600}" \
        --argjson led "${LED_OFF:-0}" \
        '{"auto_off_enable":$aoe,"auto_off_time":$aot,"wifi_off_enable":$woe,"wifi_off_time":$wot,"led_off_no_client":$led}'
    ;;

save)
    if [ ! -f "$DB" ]; then
        printf '{"error":"database not found"}'
        exit 0
    fi

    # Extract values from JSON body
    AUTO_OFF=$(echo "$BODY" | jq -r '.auto_off_enable // empty')
    AUTO_OFF_TIME=$(echo "$BODY" | jq -r '.auto_off_time // empty')
    CONN_OFF=$(echo "$BODY" | jq -r '.wifi_off_enable // empty')
    CONN_OFF_TIME=$(echo "$BODY" | jq -r '.wifi_off_time // empty')
    LED_OFF=$(echo "$BODY" | jq -r '.led_off_no_client // empty')

    # Validate timeouts: 60-7200 seconds
    if [ -n "$AUTO_OFF_TIME" ]; then
        [ "$AUTO_OFF_TIME" -lt 60 ] 2>/dev/null && AUTO_OFF_TIME=60
        [ "$AUTO_OFF_TIME" -gt 7200 ] 2>/dev/null && AUTO_OFF_TIME=7200
    fi
    if [ -n "$CONN_OFF_TIME" ]; then
        [ "$CONN_OFF_TIME" -lt 60 ] 2>/dev/null && CONN_OFF_TIME=60
        [ "$CONN_OFF_TIME" -gt 7200 ] 2>/dev/null && CONN_OFF_TIME=7200
    fi

    [ -n "$AUTO_OFF" ] && db_set wifi_info "AutoOffEnable" "$AUTO_OFF"
    [ -n "$AUTO_OFF_TIME" ] && db_set wifi_info "AutoOffTime" "$AUTO_OFF_TIME"
    [ -n "$CONN_OFF" ] && db_set wifi_info "ConnectionOffEnable" "$CONN_OFF"
    [ -n "$CONN_OFF_TIME" ] && db_set wifi_info "ConnectionOffTime" "$CONN_OFF_TIME"
    [ -n "$LED_OFF" ] && db_set wifi_info "LedOffWithNoClient" "$LED_OFF"

    printf '{"ok":true}'
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
