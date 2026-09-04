#!/bin/sh
# power.cgi — Power management settings
# GET: status (read-only)
# POST: save (with CSRF check)
#
# DIRECT sqlite WRITES — deliberate, and they do NOT take effect at once.
#
# Fields written straight to wifi_info: AutoOffEnable, AutoOffTime,
# ConnectionOffEnable, ConnectionOffTime, LedOffWithNoClient.
#
# Why direct: the only interface that applies these live is core_app's
# SetPowerSavingMode, reachable solely over /jrd/webapi — and webs binds
# 192.168.88.1:80 and refuses connections originating on the device, so a
# CGI cannot call it. There is no device-side IPC tool for power settings
# (qcmap_wifi_ctl covers WiFi only), and config_manager is backup/restore
# only. The sqlite row is therefore the sole path available here.
#
# Why it is not live (measured on device, 2026-09-04):
#   - SetPowerSavingMode{ConnAutoOff:1} -> wifi_info.ConnectionOffEnable
#     became 1, and SetPowerSavingMode{SmartMode:0} -> LedOffWithNoClient
#     became 0. So core_app owns these rows and maps:
#       SmartMode   <-> LedOffWithNoClient
#       ConnAutoOff <-> ConnectionOffEnable
#       WiFiMode    <-> AutoOffEnable (by elimination; not directly proven)
#     AutoOffTime / ConnectionOffTime have no field in that API at all.
#   - Writing ConnectionOffEnable 0->1 in sqlite left GetPowerSavingMode
#     still reporting 0: core_app caches these values in memory and never
#     re-reads the DB. It arms POSIX timers when the value is set, not
#     when the row changes.
# So a write here persists across a reboot but does not change behaviour
# until core_app restarts, and the three fields core_app also owns can be
# overwritten from its stale cache the next time anything calls
# SetPowerSavingMode. `save` reports this instead of claiming success.
echo "Content-Type: application/json"
echo ""

DB="/jrd-resource/resource/sqlite3/user_info.db3"

. /jrd-resource/resource/webrc/www/cgi-bin/lib/cgi-common.sh

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

    # A missing or non-numeric row would make --argjson emit invalid JSON
    # and break the page, so fall back to the stock default instead.
    db_get_int() {
        _v=$(db_get "$1")
        case "$_v" in
            ''|*[!0-9]*) printf '%s' "$2" ;;
            *) printf '%s' "$_v" ;;
        esac
    }

    AUTO_OFF=$(db_get_int "AutoOffEnable" 0)
    AUTO_OFF_TIME=$(db_get_int "AutoOffTime" 1800)
    CONN_OFF=$(db_get_int "ConnectionOffEnable" 0)
    CONN_OFF_TIME=$(db_get_int "ConnectionOffTime" 600)
    LED_OFF=$(db_get_int "LedOffWithNoClient" 0)

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

    # Every field here is an integer row. Reject anything else outright
    # rather than storing junk core_app will later choke on.
    is_int() {
        case "$1" in
            ''|*[!0-9]*) return 1 ;;
            *) return 0 ;;
        esac
    }
    for PAIR in "auto_off_enable:$AUTO_OFF" "auto_off_time:$AUTO_OFF_TIME" \
                "wifi_off_enable:$CONN_OFF" "wifi_off_time:$CONN_OFF_TIME" \
                "led_off_no_client:$LED_OFF"; do
        VAL="${PAIR#*:}"
        [ -n "$VAL" ] || continue
        if ! is_int "$VAL"; then
            json_err "${PAIR%%:*} must be a non-negative integer"
            exit 0
        fi
    done

    # Validate timeouts: 60-7200 seconds
    if [ -n "$AUTO_OFF_TIME" ]; then
        [ "$AUTO_OFF_TIME" -lt 60 ] && AUTO_OFF_TIME=60
        [ "$AUTO_OFF_TIME" -gt 7200 ] && AUTO_OFF_TIME=7200
    fi
    if [ -n "$CONN_OFF_TIME" ]; then
        [ "$CONN_OFF_TIME" -lt 60 ] && CONN_OFF_TIME=60
        [ "$CONN_OFF_TIME" -gt 7200 ] && CONN_OFF_TIME=7200
    fi

    # See the header comment: these rows are core_app's, and core_app
    # holds them in memory. The write persists; it does not apply.
    WROTE=0
    FAILED=""
    write_field() {
        [ -n "$2" ] || return 0
        if db_set wifi_info "$1" "$2"; then
            WROTE=$((WROTE + 1))
        else
            FAILED="${FAILED}${FAILED:+,}$1"
        fi
    }
    write_field AutoOffEnable "$AUTO_OFF"
    write_field AutoOffTime "$AUTO_OFF_TIME"
    write_field ConnectionOffEnable "$CONN_OFF"
    write_field ConnectionOffTime "$CONN_OFF_TIME"
    write_field LedOffWithNoClient "$LED_OFF"

    if [ -n "$FAILED" ]; then
        json_err "could not write: $FAILED"
        exit 0
    fi

    # Honest result: saved, but not in force until core_app restarts.
    # A request that carried no fields wrote nothing, so it needs no
    # restart either — claiming otherwise would send the user to reboot
    # for a change that never happened.
    jq -n --argjson saved "$WROTE" '
        if $saved == 0 then
            {"ok": true, "saved": 0, "applied": false,
             "restart_required": false,
             "note": "No power settings were supplied, so nothing changed."}
        else
            {"ok": true, "saved": $saved, "applied": false,
             "restart_required": true,
             "note": "Saved. core_app keeps power settings in memory, so the new values take effect after a reboot."}
        end'
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
