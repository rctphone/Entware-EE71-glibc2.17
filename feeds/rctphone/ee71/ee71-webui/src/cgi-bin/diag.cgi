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
    jq -n --argjson lines "$LINES" --arg output "$OUTPUT" \
        '{"lines":$lines,"output":$output}'
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
    jq -n --argjson lines "$LINES" --arg output "$OUTPUT" \
        '{"lines":$lines,"output":$output}'
    ;;

netinfo)
    # Build interfaces array
    IFACES="["
    FIRST=1
    ip addr show 2>/dev/null | while IFS= read -r LINE; do
        case "$LINE" in
            [0-9]*:\ *)
                IFACE=$(echo "$LINE" | sed 's/^[0-9]*: *\([^:]*\).*/\1/')
                STATE="down"
                case "$LINE" in *UP*) STATE="up" ;; esac
                ENTRY=$(jq -n --arg name "$IFACE" --arg state "$STATE" \
                    '{"name":$name,"state":$state}')
                if [ "$FIRST" = "1" ]; then
                    printf '%s' "$ENTRY"
                    FIRST=0
                else
                    printf ',%s' "$ENTRY"
                fi
                ;;
        esac
    done > /tmp/cgi_ifaces.$$
    IFACES_JSON="[$(cat /tmp/cgi_ifaces.$$ 2>/dev/null)]"
    rm -f /tmp/cgi_ifaces.$$

    # Build ARP array
    cat /proc/net/arp 2>/dev/null | tail -n +2 | while IFS= read -r LINE; do
        IP=$(echo "$LINE" | awk '{print $1}')
        MAC=$(echo "$LINE" | awk '{print $4}')
        DEV=$(echo "$LINE" | awk '{print $6}')
        jq -n --arg ip "$IP" --arg mac "$MAC" --arg dev "$DEV" \
            '{"ip":$ip,"mac":$mac,"dev":$dev}'
    done > /tmp/cgi_arp.$$
    ARP_JSON=$(jq -s '.' /tmp/cgi_arp.$$ 2>/dev/null || echo "[]")
    rm -f /tmp/cgi_arp.$$

    # Build routes array
    ip route show 2>/dev/null | while IFS= read -r LINE; do
        jq -n --arg r "$LINE" '$r'
    done > /tmp/cgi_routes.$$
    ROUTES_JSON=$(jq -s '.' /tmp/cgi_routes.$$ 2>/dev/null || echo "[]")
    rm -f /tmp/cgi_routes.$$

    # Conntrack
    COUNT=$(cat /proc/sys/net/netfilter/nf_conntrack_count 2>/dev/null || echo 0)
    MAX=$(cat /proc/sys/net/netfilter/nf_conntrack_max 2>/dev/null || echo 0)

    jq -n \
        --argjson interfaces "$IFACES_JSON" \
        --argjson arp "$ARP_JSON" \
        --argjson routes "$ROUTES_JSON" \
        --argjson count "$COUNT" \
        --argjson max "$MAX" \
        '{"interfaces":$interfaces,"arp":$arp,"routes":$routes,"conntrack":{"count":$count,"max":$max}}'
    ;;

ping)
    TARGET=$(echo "$BODY" | jq -r '.target // empty')
    validate_target "$TARGET"
    COUNT=$(echo "$BODY" | jq -r '.count // empty')
    COUNT="${COUNT:-4}"
    [ "$COUNT" -gt 20 ] 2>/dev/null && COUNT=20
    [ "$COUNT" -lt 1 ] 2>/dev/null && COUNT=1

    OUTPUT=$(timeout 60 ping -c "$COUNT" -- "$TARGET" 2>&1)
    jq -n --arg output "$OUTPUT" '{"ok":true,"output":$output}'
    ;;

traceroute)
    TARGET=$(echo "$BODY" | jq -r '.target // empty')
    validate_target "$TARGET"
    MAXHOPS=$(echo "$BODY" | jq -r '.maxhops // empty')
    MAXHOPS="${MAXHOPS:-30}"
    [ "$MAXHOPS" -gt 30 ] 2>/dev/null && MAXHOPS=30

    OUTPUT=$(timeout 60 traceroute -m "$MAXHOPS" -- "$TARGET" 2>&1)
    jq -n --arg output "$OUTPUT" '{"ok":true,"output":$output}'
    ;;

iperf3)
    SERVER=$(echo "$BODY" | jq -r '.server // empty')
    validate_target "$SERVER"
    PORT=$(echo "$BODY" | jq -r '.port // empty')
    PORT="${PORT:-5201}"
    DURATION=$(echo "$BODY" | jq -r '.duration // empty')
    DURATION="${DURATION:-10}"
    [ "$DURATION" -gt 30 ] 2>/dev/null && DURATION=30
    PROTO=$(echo "$BODY" | jq -r '.proto // empty')

    EXTRA=""
    [ "$PROTO" = "udp" ] && EXTRA="-u"

    OUTPUT=$(timeout 60 iperf3 -c "$SERVER" -p "$PORT" -t "$DURATION" $EXTRA 2>&1)
    jq -n --arg output "$OUTPUT" '{"ok":true,"output":$output}'
    ;;

snapshot)
    # One-shot LTE/system diagnostic dump — all data in single JSON response
    UP=$(cat /proc/uptime 2>/dev/null | awk '{print $1}')

    # rmnet state — operstate is always "unknown" on Qualcomm rmnet, derive from flags
    RMNET_FLAGS=$(cat /sys/class/net/rmnet_data0/flags 2>/dev/null || echo "0x0")
    RMNET_IP=$(ifconfig rmnet_data0 2>/dev/null | sed -n 's/.*inet addr:\([^ ]*\).*/\1/p')
    if [ -z "$RMNET_IP" ]; then
        RMNET_STATE="down (no IP)"
    elif [ "$((RMNET_FLAGS & 1))" = "1" ]; then
        RMNET_STATE="up"
    else
        RMNET_STATE="down"
    fi
    RMNET_RX=$(cat /sys/class/net/rmnet_data0/statistics/rx_bytes 2>/dev/null || echo 0)
    RMNET_TX=$(cat /sys/class/net/rmnet_data0/statistics/tx_bytes 2>/dev/null || echo 0)

    # Signal (from signal.cgi ca action)
    SIGNAL=""
    RSRP_VAL=""
    CA_RAW=$(QUERY_STRING="action=ca" REQUEST_METHOD=GET /jrd-resource/resource/webrc/www/cgi-bin/signal.cgi 2>/dev/null)
    # Strip HTTP headers (everything before first '{')
    CA_JSON=$(echo "$CA_RAW" | sed -n '/^{/,/^}/p')
    if [ -n "$CA_JSON" ]; then
        SIGNAL=$(echo "$CA_JSON" | jq -r '
            if .cells then
                [.cells[] | .type + " B" + (.band|tostring) + " EARFCN=" + (.earfcn|tostring) +
                 " RSRP=" + (if .rsrp then (.rsrp|tostring) + "dBm" else "?" end) +
                 " RSRQ=" + (if .rsrq then (.rsrq|tostring) + "dB" else "?" end) +
                 " SINR=" + (if .sinr then (.sinr|tostring) + "dB" else "?" end)
                ] | join(", ")
            else "no data" end' 2>/dev/null)
        RSRP_VAL=$(echo "$CA_JSON" | jq -r '.cells[0].rsrp // empty' 2>/dev/null)
    fi

    # DNS
    DNS=$(grep nameserver /etc/resolv.conf 2>/dev/null | awk '{print $2}' | head -2 | tr '\n' ',' | sed 's/,$//')

    # Thermal
    TEMPS=""
    for z in /sys/devices/virtual/thermal/thermal_zone*/; do
        N=$(cat "${z}type" 2>/dev/null)
        T=$(cat "${z}temp" 2>/dev/null)
        [ -n "$N" ] && TEMPS="${TEMPS}${N}:${T},"
    done
    TEMPS=$(echo "$TEMPS" | sed 's/,$//')

    # Battery
    BAT_CAP=$(cat /sys/class/power_supply/battery/capacity 2>/dev/null)
    BAT_ST=$(cat /sys/class/power_supply/battery/status 2>/dev/null)

    # WiFi
    HAPD_2G=$(grep max_num_sta /etc/hostapd.conf 2>/dev/null | head -1)
    HAPD_CH=$(grep "^channel=" /etc/hostapd.conf 2>/dev/null | head -1)
    WLAN0_CLIENTS=$(hostapd_cli -i wlan0 -p /var/run/hostapd list_sta 2>/dev/null | grep -c '^[0-9a-f]')
    WLAN1_CLIENTS=$(hostapd_cli -i wlan1 -p /var/run/hostapd list_sta 2>/dev/null | grep -c '^[0-9a-f]')

    # Default route
    DEF_ROUTE=$(ip route 2>/dev/null | head -1)

    # Ping test (1 packet, 2s timeout)
    PING_OK="false"
    ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1 && PING_OK="true"

    # Load
    LOAD=$(cat /proc/loadavg 2>/dev/null | awk '{print $1}')

    # Last 50 dmesg lines (unfiltered — catch everything around the event)
    DMESG_TAIL=$(dmesg | tail -50)

    # Last 30 syslog lines
    SYSLOG_TAIL=$(logread 2>/dev/null | tail -30)

    # LTE monitor log (if running)
    MON_LOG=""
    [ -f /tmp/lte_monitor.log ] && MON_LOG=$(tail -50 /tmp/lte_monitor.log)

    # Conntrack
    CT_COUNT=$(cat /proc/sys/net/netfilter/nf_conntrack_count 2>/dev/null || echo 0)

    jq -n \
        --arg uptime "$UP" \
        --arg rmnet_state "$RMNET_STATE" \
        --arg rmnet_ip "$RMNET_IP" \
        --arg rmnet_rx "$RMNET_RX" \
        --arg rmnet_tx "$RMNET_TX" \
        --arg signal "$SIGNAL" \
        --arg rsrp "$RSRP_VAL" \
        --arg dns "$DNS" \
        --arg temps "$TEMPS" \
        --arg bat_cap "$BAT_CAP" \
        --arg bat_status "$BAT_ST" \
        --arg hapd "$HAPD_2G" \
        --arg hapd_ch "$HAPD_CH" \
        --argjson wlan0_clients "$WLAN0_CLIENTS" \
        --argjson wlan1_clients "$WLAN1_CLIENTS" \
        --arg def_route "$DEF_ROUTE" \
        --argjson ping_ok "$PING_OK" \
        --arg load "$LOAD" \
        --arg dmesg "$DMESG_TAIL" \
        --arg syslog "$SYSLOG_TAIL" \
        --arg monitor "$MON_LOG" \
        --argjson conntrack "$CT_COUNT" \
        '{
            uptime: $uptime,
            lte: {state: $rmnet_state, ip: $rmnet_ip, rx_bytes: $rmnet_rx, tx_bytes: $rmnet_tx, ping_ok: $ping_ok, signal: $signal, rsrp: $rsrp},
            dns: $dns,
            thermal: $temps,
            battery: {capacity: $bat_cap, status: $bat_status},
            wifi: {hostapd: $hapd, channel: $hapd_ch, clients_2g: $wlan0_clients, clients_5g: $wlan1_clients},
            system: {load: $load, def_route: $def_route, conntrack: $conntrack},
            dmesg: $dmesg,
            syslog: $syslog,
            monitor_log: $monitor
        }'
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
