#!/bin/sh
# speedtest_install.cgi — install a Speed Test engine package from the opkg feed.
# POST {"pkg":"ee71-internetometer"|"ee71-speedtest-cli"} -> {"ok":bool,"log":"..."}
#
# Uses curl to fetch the .ipk (busybox wget / opkg's downloader hangs on GitHub
# over LTE), then opkg-installs the local file. Avoids `opkg update`.
echo "Content-Type: application/json"
echo "Cache-Control: no-store"
echo ""

LIB="/jrd-resource/resource/webrc/www/cgi-bin/lib/cgi-common.sh"
[ -f "$LIB" ] && . "$LIB"
# This CGI sources the lib conditionally, so keep working without it.
command -v run_timeout >/dev/null 2>&1 || run_timeout() {
    _s="$1"; shift
    timeout -k 2 "$_s" "$@"
    _rc=$?
    case "$_rc" in 137|143) return 124 ;; esac
    return "$_rc"
}
FEED="https://raw.githubusercontent.com/rctphone/ee71-opkg/main"

if [ "$REQUEST_METHOD" = "POST" ]; then csrf_check 2>/dev/null; fi
read -r BODY
PKG=$(echo "$BODY" | jq -r '.pkg // empty' 2>/dev/null)
case "$PKG" in
    ee71-internetometer|ee71-speedtest-cli) ;;
    *) jq -n '{"ok":false,"error":"unknown package"}'; exit 0 ;;
esac

LOG=/tmp/st_install_$$.log; : > "$LOG"
cfail() { jq -n --argjson ok false --arg log "$(tail -c 1500 "$LOG" 2>/dev/null)$1" '{"ok":$ok,"log":($log)}'; rm -f "$LOG"; exit 0; }

# Resolve the .ipk filename from the feed index (curl, with retries)
FN=""
for t in 1 2 3; do
    FN=$(curl -sS --connect-timeout 8 --max-time 25 "$FEED/Packages" 2>>"$LOG" \
        | awk -v p="$PKG" '$1=="Package:"&&$2==p{f=1} f&&$1=="Filename:"{print $2;exit}')
    [ -n "$FN" ] && break
done
[ -n "$FN" ] || cfail " (package not found in feed)"

# Download the .ipk (curl, with retries — GitHub TLS can flake on LTE)
echo "downloading $FN" >> "$LOG"
ok=0
for t in 1 2 3; do
    if curl -sS --connect-timeout 8 --max-time 60 -o "/tmp/$FN" "$FEED/$FN" 2>>"$LOG" && [ -s "/tmp/$FN" ]; then ok=1; break; fi
done
[ "$ok" = 1 ] || cfail " (download failed)"

echo "installing $FN" >> "$LOG"
# opkg can stall on a busy UBIFS or a stale lock; webs is single-threaded,
# so bound it rather than freeze the whole UI.
run_timeout 180 opkg install --force-space --force-overwrite "/tmp/$FN" >>"$LOG" 2>&1
[ "$?" -eq 124 ] && echo "[ERR] opkg install timed out after 180s" >> "$LOG"
rm -f "/tmp/$FN"

OK=false
run_timeout 30 opkg list-installed 2>/dev/null | grep -q "^$PKG " && OK=true
jq -n --argjson ok "$OK" --arg log "$(tail -c 1500 "$LOG" 2>/dev/null)" '{"ok":$ok,"log":$log}'
rm -f "$LOG"
