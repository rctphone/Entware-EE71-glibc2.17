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

    # Use lightweight JSON filtering — extract wan_chart.N
    # The daemon writes wan_chart with keys "0","1","2","3"
    # We need a minimal JSON path extractor for POSIX sh
    # Since the JSON structure is predictable, use awk
    awk -v detail="$DETAIL" '
    BEGIN { RS=""; FS="" }
    {
        # Find "wan_chart":{"<detail>":[...]}
        key = "\"wan_chart\":{\"" detail "\":"
        idx = index($0, key)
        if (idx == 0) {
            print "{\"error\":\"detail level not found\"}"
            exit
        }
        # Extract from the opening [ to matching ]
        rest = substr($0, idx + length(key))
        depth = 0
        result = ""
        for (i = 1; i <= length(rest); i++) {
            c = substr(rest, i, 1)
            if (c == "[") depth++
            if (depth > 0) result = result c
            if (c == "]") {
                depth--
                if (depth == 0) break
            }
        }
        printf "{\"detail\":%s,\"data\":%s}", detail, result
    }
    ' "$JSON_FILE"
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
