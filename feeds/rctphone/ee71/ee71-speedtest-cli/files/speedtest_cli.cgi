#!/bin/sh
# speedtest_cli.cgi — Ookla Speedtest CLI engine with live progress via polling.
# webs (GoAhead 2.x, HTTP/1.0) buffers CGI output and has no ws/SSE/chunked, so
# the test runs detached and the page polls for intermediate results.
#   ?action=start -> launch detached `speedtest -f jsonl` into /tmp/st_run.jsonl
#   ?action=poll  -> snapshot {stage,progress,download_mbps,upload_mbps,ping_ms,
#                              ip,isp,server,done,error}
#   ?action=run   -> blocking single-shot (fallback)
echo "Content-Type: application/json"
echo "Cache-Control: no-store"
echo ""

# webs spawns CGIs with no HOME; the Ookla binary aborts (std::logic_error) without it.
export HOME="${HOME:-/tmp}"
fail(){ jq -n --arg m "$1" '{"ok":false,"error":$m}' 2>/dev/null || printf '{"ok":false,"error":"%s"}' "$1"; exit 0; }

BIN=""
for c in /jrd-resource/speedtest-cli/speedtest /usr/share/speedtest/speedtest /usr/sbin/speedtest; do
    [ -x "$c" ] && { BIN="$c"; break; }
done
[ -n "$BIN" ] || fail "speedtest CLI not installed"
CACERT=""
for c in /jrd-resource/speedtest-cli/speedcert.pem /usr/share/speedtest/speedcert.pem; do
    [ -f "$c" ] && { CACERT="--ca-certificate=$c"; break; }
done
command -v jq >/dev/null 2>&1 || fail "jq not available"

# Bind to an active VPN tunnel (detected by routing; proto-agnostic) so the test
# reaches Ookla when the raw WAN is region-blocked.
WAN_IF=$(ip route show default table main 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="dev"){print $(i+1);exit}}')
VPN_IF=$(ip route show table all 2>/dev/null | awk -v w="$WAN_IF" '/^default / {for(i=1;i<=NF;i++) if($i=="dev" && $(i+1)!=w && $(i+1)!="lo"){print $(i+1);exit}}')
BIND=""
[ -n "$VPN_IF" ] && BIND="--interface $VPN_IF"

F=/tmp/st_run.jsonl
ACTION="${QUERY_STRING#action=}"; ACTION="${ACTION%%&*}"

case "$ACTION" in
start)
    pkill -f "$BIN" 2>/dev/null; sleep 1
    : > "$F"
    # Detached: stdout/stderr -> file, stdin from /dev/null, new session, so it
    # outlives this CGI and never holds webs's output pipe.
    setsid $BIN $CACERT $BIND -f jsonl --accept-license --accept-gdpr </dev/null >"$F" 2>>"$F" &
    jq -n '{"ok":true}'
    ;;

poll)
    [ -f "$F" ] || { jq -n '{"ok":true,"stage":"idle","done":false}'; exit 0; }
    if grep -qiE "Could not retrieve|Cannot retrieve|read configuration" "$F"; then
        fail "Ookla servers unreachable from this connection"
    fi
    if ! grep -q '"type":"result"' "$F" && grep -qiE "terminate called|null not valid|Aborted|\"level\":\"error\"" "$F"; then
        fail "Speedtest failed — please try again"
    fi
    grep -E '^\{.*\}$' "$F" 2>/dev/null | jq -s '
      (map(select(.type=="testStart"))|last) as $ts |
      (map(select(.type=="result"))|last)    as $res |
      (map(select(.type=="ping"))|last)      as $pg |
      (map(select(.type=="download"))|last)  as $dl |
      (map(select(.type=="upload"))|last)    as $ul |
      (if length>0 then .[-1] else {} end)   as $cur |
      (($res // $ts // {}).server)           as $srv |
      {
        ok:true,
        done: ($res!=null),
        stage: (if $res then "result" else ($cur.type // "idle") end),
        ip:  (($res // $ts // {}).interface.externalIp // ""),
        isp: (($res // $ts // {}).isp // ""),
        server: (if $srv then ($srv.name + " / " + $srv.location) else "" end),
        ping_ms: (($res.ping.latency // $pg.ping.latency // 0)|floor),
        download_mbps: (((($res.download // $dl.download // {}).bandwidth // 0)*8/1000000*100|floor)/100),
        upload_mbps:   (((($res.upload   // $ul.upload   // {}).bandwidth // 0)*8/1000000*100|floor)/100),
        progress: ($cur.download.progress // $cur.upload.progress // $cur.ping.progress // 0)
      }' 2>/dev/null || jq -n '{"ok":true,"stage":"idle","done":false}'
    ;;

run)
    if command -v timeout >/dev/null 2>&1; then RAW=$(timeout 110 $BIN $CACERT $BIND -f json --accept-license --accept-gdpr 2>&1); else RAW=$($BIN $CACERT $BIND -f json --accept-license --accept-gdpr 2>&1); fi
    OUT=$(echo "$RAW" | grep -E '"type":"result"' | tail -n 1)
    if ! echo "$OUT" | jq -e . >/dev/null 2>&1; then
        echo "$RAW" | grep -qiE "Could not retrieve|Cannot retrieve|configuration" && fail "Ookla servers unreachable from this connection"
        fail "Speedtest failed — please try again"
    fi
    jq -n --argjson d "$OUT" '{"ok":true,"ping_ms":($d.ping.latency|floor),"download_mbps":(($d.download.bandwidth*8/1000000*100|floor)/100),"upload_mbps":(($d.upload.bandwidth*8/1000000*100|floor)/100),"server":($d.server.name // "")}'
    ;;

*) fail "unknown action" ;;
esac
