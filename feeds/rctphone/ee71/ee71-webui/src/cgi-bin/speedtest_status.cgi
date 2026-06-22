#!/bin/sh
# speedtest_status.cgi — report which Speed Test engine packages are installed.
# GET -> {"internetometer":bool,"ookla":bool}
echo "Content-Type: application/json"
echo "Cache-Control: no-store"
echo ""

W=/jrd-resource/resource/webrc/www
INET=false
OOKLA=false

[ -f "$W/internetometer/index.html" ] && [ -x "$W/cgi-bin/internetometer.cgi" ] && INET=true
if [ -x "$W/cgi-bin/speedtest_cli.cgi" ]; then
    { [ -x /jrd-resource/speedtest-cli/speedtest ] || [ -x /usr/share/speedtest/speedtest ]; } && OOKLA=true
fi

jq -n --argjson i "$INET" --argjson o "$OOKLA" \
    '{"internetometer":$i,"ookla":$o}' 2>/dev/null \
    || printf '{"internetometer":%s,"ookla":%s}' "$INET" "$OOKLA"
