#!/bin/sh
# signal.cgi — Signal quality read-only endpoints
# All actions are GET-only, no CSRF needed
echo "Content-Type: application/json"
echo ""

ACTION="${QUERY_STRING%%&*}"
ACTION="${ACTION#action=}"

case "$ACTION" in

current)
    # Read signal info from /tmp/signal_current.txt
    # Written by signal_poll helper (or traffic_stats)
    # Format: KEY=VALUE per line
    FILE="/tmp/signal_current.txt"
    if [ ! -f "$FILE" ]; then
        printf '{"error":"signal data not available"}'
        exit 0
    fi
    echo "{"
    FIRST=1
    while IFS='=' read -r KEY VAL; do
        [ -z "$KEY" ] && continue
        case "$KEY" in \#*) continue ;; esac
        if [ "$FIRST" = "0" ]; then printf ","; fi
        FIRST=0
        # Detect if value is numeric
        case "$VAL" in
            ''|*[!0-9.-]*) printf '"%s":"%s"' "$KEY" "$VAL" ;;
            *) printf '"%s":%s' "$KEY" "$VAL" ;;
        esac
    done < "$FILE"
    echo "}"
    ;;

history)
    # Return signal history ring buffer
    FILE="/tmp/signal_history.json"
    if [ -f "$FILE" ]; then
        cat "$FILE"
    else
        echo "[]"
    fi
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
