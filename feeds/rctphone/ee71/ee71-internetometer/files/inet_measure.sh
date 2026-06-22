#!/bin/sh
# inet_measure.sh — device-side Yandex Интернетометр measurement with live progress.
# Launched detached by internetometer.cgi (?action=start); writes a poll snapshot to
# /tmp/inet_run.json that internetometer.cgi (?action=poll) serves. Same JSON shape as
# the Ookla engine's poll, so the Web UI gauge handles both engines identically.
# Measures the ROUTER's WAN (binds to an active VPN tunnel by routing, like Ookla).
F=/tmp/inet_run.json
UA="Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36"
DL_SECS=10
DL_STREAMS=3
UP_CHUNK=2097152   # 2 MB
UP_ROUNDS=4

err(){ jq -n --arg m "$1" '{"ok":false,"error":$m}' > "$F.tmp" 2>/dev/null && mv -f "$F.tmp" "$F"; exit 0; }

# Bind to active VPN tunnel (by routing; proto-agnostic) so we measure the router's
# actual egress, matching the Ookla engine.
WAN_IF=$(ip route show default table main 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="dev"){print $(i+1);exit}}')
VPN_IF=$(ip route show table all 2>/dev/null | awk -v w="$WAN_IF" '/^default / {for(i=1;i<=NF;i++) if($i=="dev" && $(i+1)!=w && $(i+1)!="lo"){print $(i+1);exit}}')
BIND=""
[ -n "$VPN_IF" ] && BIND="--interface $VPN_IF"
GET(){ curl -sS -A "$UA" $BIND "$@"; }

snap(){ # snap <stage> <dl> <ul> <progress> <done>
    jq -n --arg st "$1" --argjson dl "${2:-0}" --argjson ul "${3:-0}" \
        --argjson pr "${4:-0}" --argjson dn "${5:-false}" \
        --argjson pg "${PING:-0}" --arg ip "${IP:-}" --arg reg "${REGION:-}" --arg srv "${HOST:-}" \
        '{ok:true,done:$dn,stage:$st,download_mbps:$dl,upload_mbps:$ul,ping_ms:$pg,
          progress:$pr,ip:$ip,region:$reg,server:$srv}' > "$F.tmp" 2>/dev/null && mv -f "$F.tmp" "$F"
}

snap connect 0 0 0 false
GET --connect-timeout 8 --max-time 15 -H 'X-Requested-With: XMLHttpRequest' \
    "https://yandex.ru/internet/api/v0/get-probes?nocache=$(date +%s)000&from=internet" -o /tmp/inet_gp.json
jq -e .mid /tmp/inet_gp.json >/dev/null 2>&1 || err "no connection"
DLURL=$(jq -r 'first(.download.probes[]|select(.url|contains("50mb")).url)' /tmp/inet_gp.json)
PINGURL=$(jq -r '.latency.probes[0].url' /tmp/inet_gp.json)
UPURL=$(jq -r '.upload.probes[0].url' /tmp/inet_gp.json | sed 's/&size=.*//')
HOST=$(echo "$DLURL" | sed -e 's#^https\{0,1\}://##' -e 's#/.*##')
IP=$(GET --max-time 12 "https://ipv4-internet.yandex.net/api/v0/ip" 2>/dev/null | tr -d '"')
REGION=$(GET --max-time 12 "https://yandex.ru/internet/region" 2>/dev/null | jq -r '.name // ""' 2>/dev/null)

# --- ping ---
snap ping 0 0 0 false
PING=$(GET --connect-timeout 4 --max-time 6 -o /dev/null -w '%{http_code} %{time_total}\n' \
    "$PINGURL" "$PINGURL" "$PINGURL" 2>/dev/null \
    | awk '$1==200{t=$2*1000; if(m==""||t<m)m=t} END{printf "%.0f",(m==""?0:m)}')

# --- download (parallel streams, sampled every 0.5s for live speed) ---
rm -f /tmp/inet_dl_*
s=1; while [ "$s" -le "$DL_STREAMS" ]; do
    ( GET --connect-timeout 8 --max-time $((DL_SECS+3)) -o "/tmp/inet_dl_$s" "$DLURL" 2>/dev/null ) &
    s=$((s+1))
done
last=0; i=0; max=$((DL_SECS*2))
while [ "$i" -lt "$max" ]; do
    sleep 0.5; i=$((i+1))
    b=$(wc -c /tmp/inet_dl_* 2>/dev/null | tail -1 | awk '{print $1+0}')
    inst=$(awk "BEGIN{printf \"%.2f\", ($b-$last)*8/500000}")
    snap download "$inst" 0 "$(awk "BEGIN{printf \"%.3f\", $i/$max}")" false
    last="$b"
done
wait
TOTAL=$(wc -c /tmp/inet_dl_* 2>/dev/null | tail -1 | awk '{print $1+0}')
DL=$(awk "BEGIN{printf \"%.2f\", $TOTAL*8/$DL_SECS/1000000}")
snap download "$DL" 0 1 false

# --- upload (chunked for live progress; keep peak as the result) ---
ULMAX=0; r=1
while [ "$r" -le "$UP_ROUNDS" ]; do
    bps=$(head -c "$UP_CHUNK" /dev/zero | GET --connect-timeout 8 --max-time 12 \
        -X POST --data-binary @- -o /dev/null -w '%{speed_upload}' "${UPURL}&size=${UP_CHUNK}" 2>/dev/null)
    ul=$(awk "BEGIN{printf \"%.2f\", ${bps:-0}*8/1000000}")
    ULMAX=$(awk "BEGIN{print ($ul>$ULMAX)?$ul:$ULMAX}")
    snap upload "$DL" "$ul" "$(awk "BEGIN{printf \"%.3f\", $r/$UP_ROUNDS}")" false
    r=$((r+1))
done

# --- result ---
snap result "$DL" "$ULMAX" 1 true
rm -f /tmp/inet_dl_* /tmp/inet_gp.json
