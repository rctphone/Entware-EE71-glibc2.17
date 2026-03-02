#!/bin/sh
# system.cgi — Read-only system information endpoints
# All actions are GET-only, no CSRF needed
echo "Content-Type: application/json"
echo ""

ACTION="${QUERY_STRING%%&*}"
ACTION="${ACTION#action=}"

case "$ACTION" in

interfaces)
    echo "["
    FIRST=1
    ip addr show 2>/dev/null | while IFS= read -r LINE; do
        case "$LINE" in
            [0-9]*:\ *)
                if [ "$FIRST" = "0" ]; then printf ']},'; fi
                FIRST=0
                IFACE=$(echo "$LINE" | sed 's/^[0-9]*: *\([^:]*\).*/\1/')
                STATE="down"
                case "$LINE" in *UP*) STATE="up" ;; esac
                printf '{"name":"%s","state":"%s","addrs":[' "$IFACE" "$STATE"
                FIRST_ADDR=1
                ;;
            *inet\ *)
                ADDR=$(echo "$LINE" | sed 's/.*inet \([^ ]*\).*/\1/')
                if [ "$FIRST_ADDR" = "0" ]; then printf ","; fi
                FIRST_ADDR=0
                printf '"%s"' "$ADDR"
                ;;
            *inet6\ *)
                ADDR=$(echo "$LINE" | sed 's/.*inet6 \([^ ]*\).*/\1/')
                if [ "$FIRST_ADDR" = "0" ]; then printf ","; fi
                FIRST_ADDR=0
                printf '"%s"' "$ADDR"
                ;;
        esac
    done
    # Close last interface
    echo "]}"
    echo "]"
    ;;

routes)
    echo "["
    FIRST=1
    ip route show 2>/dev/null | while IFS= read -r LINE; do
        if [ "$FIRST" = "0" ]; then printf ","; fi
        FIRST=0
        # Extract dest, gateway, dev
        DEST=$(echo "$LINE" | awk '{print $1}')
        GW=""
        DEV=""
        set -- $LINE
        while [ $# -gt 0 ]; do
            case "$1" in
                via) shift; GW="$1" ;;
                dev) shift; DEV="$1" ;;
            esac
            shift
        done
        printf '{"dest":"%s","via":"%s","dev":"%s"}' "$DEST" "$GW" "$DEV"
    done
    echo "]"
    ;;

iptables)
    # Parse iptables -L -n -v into structured JSON
    # Use temp file to avoid subshell variable scoping issues with pipe
    echo "{"
    FIRST_TABLE=1
    for TABLE in filter nat mangle; do
        if [ "$FIRST_TABLE" = "0" ]; then printf ","; fi
        FIRST_TABLE=0
        printf '"%s":{' "$TABLE"
        CHAIN=""
        FIRST_RULE=1
        TMPF="/tmp/ipt_$$_$TABLE"
        iptables -t "$TABLE" -L -n -v --line-numbers 2>/dev/null > "$TMPF"
        while IFS= read -r LINE; do
            case "$LINE" in
                Chain\ *)
                    if [ -n "$CHAIN" ]; then
                        printf ']}'
                        printf ","
                    fi
                    CHAIN=$(echo "$LINE" | awk '{print $2}')
                    POLICY=$(echo "$LINE" | sed -n 's/.*policy \([A-Z]*\).*/\1/p')
                    printf '"%s":{"policy":"%s","rules":[' "$CHAIN" "$POLICY"
                    FIRST_RULE=1
                    ;;
                num*)
                    # header line, skip
                    ;;
                [0-9]*)
                    if [ "$FIRST_RULE" = "0" ]; then printf ","; fi
                    FIRST_RULE=0
                    NUM=$(echo "$LINE" | awk '{print $1}')
                    PKTS=$(echo "$LINE" | awk '{print $2}')
                    BYTES=$(echo "$LINE" | awk '{print $3}')
                    TARGET=$(echo "$LINE" | awk '{print $4}')
                    PROTO=$(echo "$LINE" | awk '{print $5}')
                    IN=$(echo "$LINE" | awk '{print $7}')
                    OUT=$(echo "$LINE" | awk '{print $8}')
                    SRC=$(echo "$LINE" | awk '{print $9}')
                    DST=$(echo "$LINE" | awk '{print $10}')
                    EXTRA=$(echo "$LINE" | awk '{for(i=11;i<=NF;i++) printf "%s ", $i}' | sed 's/"/\\"/g; s/ *$//')
                    printf '{"num":%s,"pkts":"%s","bytes":"%s","target":"%s","proto":"%s","in":"%s","out":"%s","src":"%s","dst":"%s","extra":"%s"}' \
                        "$NUM" "$PKTS" "$BYTES" "$TARGET" "$PROTO" "$IN" "$OUT" "$SRC" "$DST" "$EXTRA"
                    ;;
            esac
        done < "$TMPF"
        rm -f "$TMPF"
        if [ -n "$CHAIN" ]; then
            printf ']}'
        fi
        echo "}"
    done
    echo "}"
    ;;

open_ports)
    echo "["
    FIRST=1
    netstat -tlnp 2>/dev/null | tail -n +3 | while IFS= read -r LINE; do
        if [ "$FIRST" = "0" ]; then printf ","; fi
        FIRST=0
        PROTO=$(echo "$LINE" | awk '{print $1}')
        LOCAL=$(echo "$LINE" | awk '{print $4}')
        PID_PROG=$(echo "$LINE" | awk '{print $7}')
        PID=$(echo "$PID_PROG" | cut -d/ -f1)
        PROG=$(echo "$PID_PROG" | cut -d/ -f2-)
        printf '{"proto":"%s","local":"%s","pid":"%s","program":"%s"}' \
            "$PROTO" "$LOCAL" "$PID" "$PROG"
    done
    echo "]"
    ;;

conntrack_stats)
    COUNT=$(cat /proc/sys/net/netfilter/nf_conntrack_count 2>/dev/null || echo 0)
    MAX=$(cat /proc/sys/net/netfilter/nf_conntrack_max 2>/dev/null || echo 0)
    printf '{"count":%s,"max":%s}' "$COUNT" "$MAX"
    ;;

memory)
    echo "{"
    FIRST=1
    while IFS= read -r LINE; do
        KEY=$(echo "$LINE" | awk -F: '{gsub(/[() ]/, "", $1); print $1}')
        VAL=$(echo "$LINE" | awk '{print $2}')
        if [ "$FIRST" = "0" ]; then printf ","; fi
        FIRST=0
        printf '"%s":%s' "$KEY" "$VAL"
    done < /proc/meminfo
    echo "}"
    ;;

cpu)
    # Read /proc/stat first line (cpu totals) + loadavg
    read -r _ USER NICE SYSTEM IDLE IOWAIT IRQ SOFTIRQ STEAL _ < /proc/stat
    read -r LOAD1 LOAD5 LOAD15 _ < /proc/loadavg
    printf '{"user":%s,"nice":%s,"system":%s,"idle":%s,"iowait":%s,"irq":%s,"softirq":%s,"steal":%s,"load1":"%s","load5":"%s","load15":"%s"}' \
        "$USER" "$NICE" "$SYSTEM" "$IDLE" "$IOWAIT" "$IRQ" "$SOFTIRQ" "$STEAL" "$LOAD1" "$LOAD5" "$LOAD15"
    ;;

storage)
    echo "["
    FIRST=1
    df 2>/dev/null | tail -n +2 | while IFS= read -r LINE; do
        FS=$(echo "$LINE" | awk '{print $1}')
        SIZE=$(echo "$LINE" | awk '{print $2}')
        USED=$(echo "$LINE" | awk '{print $3}')
        AVAIL=$(echo "$LINE" | awk '{print $4}')
        PCT=$(echo "$LINE" | awk '{print $5}' | tr -d '%')
        MOUNT=$(echo "$LINE" | awk '{print $6}')
        if [ "$FIRST" = "0" ]; then printf ","; fi
        FIRST=0
        printf '{"fs":"%s","size":%s,"used":%s,"avail":%s,"pct":%s,"mount":"%s"}' \
            "$FS" "$SIZE" "$USED" "$AVAIL" "${PCT:-0}" "$MOUNT"
    done
    echo "]"
    ;;

hostname)
    SYS_HOSTNAME=$(cat /etc/hostname 2>/dev/null || echo "")
    HOSTS_ENTRY=""
    if [ -f /etc/hosts ]; then
        HOSTS_ENTRY=$(grep -v '^\s*#' /etc/hosts | grep -v '127.0.0.1' | head -1 | awk '{print $2}')
    fi
    printf '{"system":"%s","dns":"%s"}' "$SYS_HOSTNAME" "$HOSTS_ENTRY"
    ;;

dhcp_leases)
    echo "["
    FIRST=1
    if [ -f /tmp/dnsmasq.leases ]; then
        while IFS= read -r LINE; do
            [ -z "$LINE" ] && continue
            TS=$(echo "$LINE" | awk '{print $1}')
            MAC=$(echo "$LINE" | awk '{print $2}')
            IP=$(echo "$LINE" | awk '{print $3}')
            NAME=$(echo "$LINE" | awk '{print $4}')
            if [ "$FIRST" = "0" ]; then printf ","; fi
            FIRST=0
            printf '{"expires":%s,"mac":"%s","ip":"%s","hostname":"%s"}' \
                "$TS" "$MAC" "$IP" "$NAME"
        done < /tmp/dnsmasq.leases
    fi
    echo "]"
    ;;

uptime)
    read -r UP IDLE < /proc/uptime
    printf '{"seconds":%d}' "${UP%%.*}"
    ;;

kernel)
    KERNEL=$(uname -r 2>/dev/null || echo "")
    printf '{"version":"%s"}' "$KERNEL"
    ;;

wifi_power)
    # Read WiFi TX power levels from SQLite (not exposed via webapi)
    # PowerLevel: 0=100%, 1=75%, 2=50%, 3=25%
    DB="/jrd-resource/resource/sqlite3/user_info.db3"
    P2G=$(sqlite3 "$DB" "SELECT value FROM wifi_info WHERE items='2GPowerLevel';" 2>/dev/null)
    P5G=$(sqlite3 "$DB" "SELECT value FROM wifi_info WHERE items='5GPowerLevel';" 2>/dev/null)
    printf '{"2GPowerLevel":%s,"5GPowerLevel":%s}' "${P2G:-0}" "${P5G:-0}"
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
