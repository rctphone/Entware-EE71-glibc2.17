#!/bin/sh
# diag.cgi — Diagnostics: ping, traceroute, iperf3, syslog, dmesg, netinfo
# GET: syslog, dmesg, netinfo (read-only)
# POST: ping, traceroute, iperf3 (with CSRF check)
echo "Content-Type: application/json"
echo ""

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

# Validate target: only hostname-safe chars, max 253, no leading dash
validate_target() {
    TARGET="$1"
    if [ -z "$TARGET" ]; then
        echo '{"error":"target required"}'; exit 0
    fi
    if [ ${#TARGET} -gt 253 ]; then
        echo '{"error":"target too long"}'; exit 0
    fi
    case "$TARGET" in
        -*) echo '{"error":"target cannot start with dash"}'; exit 0 ;;
    esac
    CLEAN=$(printf '%s' "$TARGET" | tr -cd 'a-zA-Z0-9._:-')
    if [ "$CLEAN" != "$TARGET" ]; then
        echo '{"error":"invalid target characters"}'; exit 0
    fi
}

# Escape a string for safe JSON output
json_escape_str() {
    printf '%s' "$1" | tr -d '\r' | \
        sed 's/\\/\\\\/g; s/"/\\"/g; s/	/\\t/g' | \
        awk 'NR>1{printf "\\n"}{printf "%s",$0}'
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

syslog)
    # Extract params from query string
    LINES=200
    FILTER=""
    OLDIFS="$IFS"; IFS='&'
    for PARAM in $QUERY_STRING; do
        KEY="${PARAM%%=*}"
        VAL="${PARAM#*=}"
        case "$KEY" in
            lines) LINES="$VAL" ;;
            filter) FILTER=$(printf '%s' "$VAL" | sed 's/+/ /g; s/%20/ /g; s/%2F/\//g') ;;
        esac
    done
    IFS="$OLDIFS"
    # Clamp lines
    case "$LINES" in [0-9]*) ;; *) LINES=200 ;; esac
    [ "$LINES" -gt 1000 ] 2>/dev/null && LINES=1000
    [ "$LINES" -lt 1 ] 2>/dev/null && LINES=1

    if [ -n "$FILTER" ]; then
        OUTPUT=$(logread 2>/dev/null | grep -F -- "$FILTER" | tail -n "$LINES")
    else
        OUTPUT=$(logread 2>/dev/null | tail -n "$LINES")
    fi
    ESCAPED=$(json_escape_str "$OUTPUT")
    printf '{"lines":%d,"output":"%s"}' "$LINES" "$ESCAPED"
    ;;

dmesg)
    LINES=100
    OLDIFS="$IFS"; IFS='&'
    for PARAM in $QUERY_STRING; do
        KEY="${PARAM%%=*}"
        VAL="${PARAM#*=}"
        case "$KEY" in lines) LINES="$VAL" ;; esac
    done
    IFS="$OLDIFS"
    case "$LINES" in [0-9]*) ;; *) LINES=100 ;; esac
    [ "$LINES" -gt 1000 ] 2>/dev/null && LINES=1000

    OUTPUT=$(dmesg 2>/dev/null | tail -n "$LINES")
    ESCAPED=$(json_escape_str "$OUTPUT")
    printf '{"lines":%d,"output":"%s"}' "$LINES" "$ESCAPED"
    ;;

netinfo)
    # Combined network info
    echo "{"
    # Interfaces
    printf '"interfaces":['
    FIRST=1
    ip addr show 2>/dev/null | while IFS= read -r LINE; do
        case "$LINE" in
            [0-9]*:\ *)
                if [ "$FIRST" = "0" ]; then echo ","; fi
                FIRST=0
                IFACE=$(echo "$LINE" | sed 's/^[0-9]*: *\([^:]*\).*/\1/')
                STATE="down"
                case "$LINE" in *UP*) STATE="up" ;; esac
                printf '{"name":"%s","state":"%s"}' "$IFACE" "$STATE"
                ;;
        esac
    done
    echo '],'
    # ARP table
    printf '"arp":['
    FIRST=1
    cat /proc/net/arp 2>/dev/null | tail -n +2 | while IFS= read -r LINE; do
        if [ "$FIRST" = "0" ]; then printf ","; fi
        FIRST=0
        IP=$(echo "$LINE" | awk '{print $1}')
        MAC=$(echo "$LINE" | awk '{print $4}')
        DEV=$(echo "$LINE" | awk '{print $6}')
        printf '{"ip":"%s","mac":"%s","dev":"%s"}' "$IP" "$MAC" "$DEV"
    done
    echo '],'
    # Routes
    printf '"routes":['
    FIRST=1
    ip route show 2>/dev/null | while IFS= read -r LINE; do
        if [ "$FIRST" = "0" ]; then printf ","; fi
        FIRST=0
        ESCAPED=$(printf '%s' "$LINE" | sed 's/\\/\\\\/g; s/"/\\"/g')
        printf '"%s"' "$ESCAPED"
    done
    echo '],'
    # Conntrack
    COUNT=$(cat /proc/sys/net/netfilter/nf_conntrack_count 2>/dev/null || echo 0)
    MAX=$(cat /proc/sys/net/netfilter/nf_conntrack_max 2>/dev/null || echo 0)
    printf '"conntrack":{"count":%s,"max":%s}' "$COUNT" "$MAX"
    echo "}"
    ;;

ping)
    TARGET=$(echo "$BODY" | sed -n 's/.*"target"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    validate_target "$TARGET"
    COUNT=$(echo "$BODY" | sed -n 's/.*"count"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p')
    COUNT="${COUNT:-4}"
    [ "$COUNT" -gt 20 ] 2>/dev/null && COUNT=20
    [ "$COUNT" -lt 1 ] 2>/dev/null && COUNT=1

    OUTPUT=$(timeout 60 ping -c "$COUNT" -- "$TARGET" 2>&1)
    ESCAPED=$(json_escape_str "$OUTPUT")
    printf '{"ok":true,"output":"%s"}' "$ESCAPED"
    ;;

traceroute)
    TARGET=$(echo "$BODY" | sed -n 's/.*"target"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    validate_target "$TARGET"
    MAXHOPS=$(echo "$BODY" | sed -n 's/.*"maxhops"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p')
    MAXHOPS="${MAXHOPS:-30}"
    [ "$MAXHOPS" -gt 30 ] 2>/dev/null && MAXHOPS=30

    OUTPUT=$(timeout 60 traceroute -m "$MAXHOPS" -- "$TARGET" 2>&1)
    ESCAPED=$(json_escape_str "$OUTPUT")
    printf '{"ok":true,"output":"%s"}' "$ESCAPED"
    ;;

iperf3)
    SERVER=$(echo "$BODY" | sed -n 's/.*"server"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    validate_target "$SERVER"
    PORT=$(echo "$BODY" | sed -n 's/.*"port"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p')
    PORT="${PORT:-5201}"
    DURATION=$(echo "$BODY" | sed -n 's/.*"duration"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p')
    DURATION="${DURATION:-10}"
    [ "$DURATION" -gt 30 ] 2>/dev/null && DURATION=30
    PROTO=$(echo "$BODY" | sed -n 's/.*"proto"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

    EXTRA=""
    [ "$PROTO" = "udp" ] && EXTRA="-u"

    OUTPUT=$(timeout 60 iperf3 -c "$SERVER" -p "$PORT" -t "$DURATION" $EXTRA 2>&1)
    ESCAPED=$(json_escape_str "$OUTPUT")
    printf '{"ok":true,"output":"%s"}' "$ESCAPED"
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
