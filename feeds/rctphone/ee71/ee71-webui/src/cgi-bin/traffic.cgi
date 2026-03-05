#!/bin/sh
# traffic.cgi — Traffic stats read-only endpoints
# Reads JSON written by traffic_stats daemon
# All actions are GET-only, no CSRF needed
echo "Content-Type: application/json"
echo ""

JSON_FILE="/tmp/traffic_stats.json"

ACTION="${QUERY_STRING%%&*}"
ACTION="${ACTION#action=}"

case "$ACTION" in

status)
    if [ -f "$JSON_FILE" ]; then
        cat "$JSON_FILE"
    else
        printf '{"error":"traffic_stats not running"}'
    fi
    ;;

chart)
    # Extract detail level from query string: ?action=chart&detail=N
    DETAIL=$(echo "$QUERY_STRING" | sed -n 's/.*detail=\([0-3]\).*/\1/p')
    DETAIL="${DETAIL:-0}"

    if [ ! -f "$JSON_FILE" ]; then
        printf '{"error":"traffic_stats not running"}'
        exit 0
    fi

    jq --argjson d "$DETAIL" '{detail:$d, data: .wan_chart[($d|tostring)]}' "$JSON_FILE" || \
        printf '{"error":"detail level not found"}'
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
