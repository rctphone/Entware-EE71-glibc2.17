#!/bin/sh
# internetometer.cgi — Yandex Интернетометр engine (device-side, measured from the router).
#   ?action=start  -> launch detached inet_measure.sh -> /tmp/inet_run.json
#   ?action=poll   -> current snapshot {stage,download_mbps,upload_mbps,ping_ms,ip,region,server,progress,done,error}
#   ?action=probes -> get-probes JSON (proxy; CORS-less)        [legacy/diagnostic]
#   ?action=region -> {"name","ip"} region of the WAN          [on-load connection info]
#   ?action=ip     -> {"ip":"<wan public ipv4>"}               [on-load connection info]
# Measures the router's WAN (binds to active VPN by routing). Protocol: docs/internetometer-protocol.md
echo "Content-Type: application/json"
echo "Cache-Control: no-store"
echo ""

UA="Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36"

# Bind proxy calls to the active VPN tunnel (by routing; proto-agnostic) so they
# reflect the same egress the measurement uses.
WAN_IF=$(ip route show default table main 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="dev"){print $(i+1);exit}}')
VPN_IF=$(ip route show table all 2>/dev/null | awk -v w="$WAN_IF" '/^default / {for(i=1;i<=NF;i++) if($i=="dev" && $(i+1)!=w && $(i+1)!="lo"){print $(i+1);exit}}')
BIND=""
[ -n "$VPN_IF" ] && BIND="--interface $VPN_IF"
GET() { curl -sS -A "$UA" $BIND --connect-timeout 8 --max-time 15 "$@"; }

WORKER="$(dirname "$0" 2>/dev/null)/inet_measure.sh"
[ -f "$WORKER" ] || WORKER=/jrd-resource/resource/webrc/www/cgi-bin/inet_measure.sh

ACTION="${QUERY_STRING#action=}"; ACTION="${ACTION%%&*}"

case "$ACTION" in
    start)
        pkill -f inet_measure.sh 2>/dev/null
        pkill -f "curl.*cdn.yandex.net" 2>/dev/null
        rm -f /tmp/inet_run.json
        # Subshell-wrap so the worker (which forks parallel curls) is fully
        # orphaned and never holds webs's output pipe (else the CGI hangs).
        ( setsid sh "$WORKER" </dev/null >/dev/null 2>&1 & )
        jq -n '{"ok":true}'
        ;;
    poll)
        if [ -f /tmp/inet_run.json ]; then cat /tmp/inet_run.json
        else jq -n '{"ok":true,"stage":"idle","done":false}'; fi
        ;;
    probes)
        GET -H 'X-Requested-With: XMLHttpRequest' \
            "https://yandex.ru/internet/api/v0/get-probes?nocache=$(date +%s)000&from=internet" \
            || echo '{"error":"get-probes failed"}'
        ;;
    region)
        GET "https://yandex.ru/internet/region" || echo '{"name":"","ip":""}'
        ;;
    ip)
        RAW=$(GET "https://ipv4-internet.yandex.net/api/v0/ip" 2>/dev/null)
        IP=$(printf '%s' "$RAW" | jq -r 'if type=="string" then . elif type=="object" then (.ip // "") else "" end' 2>/dev/null)
        [ -n "$IP" ] || IP=$(printf '%s' "$RAW" | sed -n 's/.*\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\).*/\1/p' | head -1)
        case "$IP" in
            *.*.*.*) jq -n --arg ip "$IP" '{"ip":$ip}' 2>/dev/null || printf '{"ip":"%s"}\n' "$IP" ;;
            *)       echo '{"ip":""}' ;;
        esac
        ;;
    *)
        echo '{"error":"unknown action"}'
        ;;
esac
