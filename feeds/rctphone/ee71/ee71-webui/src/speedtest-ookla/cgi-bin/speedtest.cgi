#!/bin/sh
# speedtest.cgi — Serve Ookla Speedtest Custom widget page
# Runs under BusyBox httpd on port 8877 (ee71.speedtestcustom.com).
#
# Query params (from SPA iframe):
#   theme=dark|light   — background color selection
#   accent=%23rrggbb   — primary/accent color (URL-encoded #)
#
# Fetches the page from domv.speedtestcustom.com, strips identity fields,
# caches params for 1 hour.  Theme colors applied per-request (not cached).

UPSTREAM="https://domv.speedtestcustom.com/"
PARAMS_CACHE="/tmp/speedtest_params.cache"
CACHE_MAX=3600
OUT="/tmp/speedtest_cgi_$$.html"

# Detect LAN IP for embedUrls (Ookla widget checks parent frame origin)
LAN_IP=$(ifconfig bridge0 2>/dev/null | sed -n 's/.*inet addr:\([^ ]*\).*/\1/p')
LAN_IP="${LAN_IP:-192.168.1.1}"

# --- Parse query string ---
THEME=$(echo "$QUERY_STRING" | sed -n 's/.*theme=\([^&]*\).*/\1/p')
ACCENT=$(echo "$QUERY_STRING" | sed -n 's/.*accent=\([^&]*\).*/\1/p')
ACCENT=$(echo "$ACCENT" | sed 's/%23/#/g')

# Defaults
case "$THEME" in
    light) BG_COLOR="#f1f5f9" ;;
    *)     BG_COLOR="#0f172a" ;;
esac
PRIMARY_COLOR="${ACCENT:-#3d8b7a}"

# --- Load or refresh cached params ---
NEED_FETCH=1
if [ -f "$PARAMS_CACHE" ]; then
    FILE_TIME=$(stat -c %Y "$PARAMS_CACHE" 2>/dev/null || echo 0)
    NOW=$(date +%s)
    AGE=$((NOW - FILE_TIME))
    [ "$AGE" -lt "$CACHE_MAX" ] && NEED_FETCH=0
fi

if [ "$NEED_FETCH" = "1" ]; then
    RAW=$(curl -sL --connect-timeout 10 --max-time 20 "$UPSTREAM" 2>/dev/null)
    if [ -n "$RAW" ]; then
        PARAMS=$(echo "$RAW" | sed -n 's/.*window\.ST_PARAMS = \(.*\);$/\1/p')
        if [ -n "$PARAMS" ]; then
            # Patch embed config + strip identity (theme-independent)
            PARAMS=$(echo "$PARAMS" | sed \
                -e 's/"subdomain":"[^"]*"/"subdomain":"ee71"/g' \
                -e 's/"embedUrls":\[[^]]*\]/"embedUrls":["__LAN_IP__","ee71.speedtestcustom.com:8877"]/' \
                -e 's/"httpsOnly":true/"httpsOnly":false/' \
                -e 's/"subscriptionId":[0-9][0-9]*/"subscriptionId":null/' \
                -e 's/"testConfigurationId":[0-9][0-9]*/"testConfigurationId":0/' \
                -e 's/"dataProtectionContactId":[0-9][0-9]*/"dataProtectionContactId":0/' \
                -e 's/"resellerContactId":[0-9][0-9]*/"resellerContactId":0/' \
                -e 's/"apiKey":"[^"]*"/"apiKey":null/' \
                -e 's/"buildId":[0-9][0-9]*/"buildId":0/' \
                -e 's/"ipAddress":"[^"]*"/"ipAddress":""/' \
                -e 's/"ispName":"[^"]*"/"ispName":""/' \
                -e 's/"ispId":[0-9][0-9]*/"ispId":0/' \
                -e 's|https:\\u002F\\u002F|http:\\u002F\\u002F|g' \
                -e 's/"serverList":\[[^]]*\]/"serverList":[]/' \
            )
            echo "$PARAMS" > "${PARAMS_CACHE}.tmp" && mv -f "${PARAMS_CACHE}.tmp" "$PARAMS_CACHE"
        fi
    fi
fi

# --- Fallback: extract params from static index.html if no cache ---
if [ ! -f "$PARAMS_CACHE" ]; then
    STATIC="/jrd-resource/speedtest/index.html"
    if [ -f "$STATIC" ]; then
        FALLBACK=$(sed -n 's/.*window\.ST_PARAMS = \(.*\);$/\1/p' "$STATIC")
        if [ -n "$FALLBACK" ]; then
            # Apply same identity/embed patches as upstream path
            FALLBACK=$(echo "$FALLBACK" | sed \
                -e 's/"subdomain":"[^"]*"/"subdomain":"ee71"/g' \
                -e 's/"embedUrls":\[[^]]*\]/"embedUrls":["__LAN_IP__","ee71.speedtestcustom.com:8877"]/' \
                -e 's/"httpsOnly":true/"httpsOnly":false/' \
                -e 's/"ipAddress":"[^"]*"/"ipAddress":""/' \
                -e 's/"ispName":"[^"]*"/"ispName":""/' \
                -e 's/"ispId":[0-9][0-9]*/"ispId":0/' \
                -e 's/"serverList":\[[^]]*\]/"serverList":[]/' \
            )
            echo "$FALLBACK" > "$PARAMS_CACHE"
        fi
    fi
fi

if [ ! -f "$PARAMS_CACHE" ]; then
    BODY='<!doctype html><html><body style="background:#0f172a;color:#94a3b8;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p>Speed test temporarily unavailable. Check internet connection.</p></body></html>'
    LEN=$(echo "$BODY" | wc -c | tr -d ' ')
    echo "Content-Type: text/html"
    echo "Content-Length: $LEN"
    echo "Connection: close"
    echo ""
    echo "$BODY"
    exit 0
fi

PARAMS=$(cat "$PARAMS_CACHE")

# --- Apply theme colors + LAN IP (per-request, not cached) ---
PARAMS=$(echo "$PARAMS" | sed \
    -e "s/\"backgroundColor\":\"[^\"]*\"/\"backgroundColor\":\"${BG_COLOR}\"/" \
    -e "s/\"primaryColor\":\"[^\"]*\"/\"primaryColor\":\"${PRIMARY_COLOR}\"/" \
    -e "s/__LAN_IP__/${LAN_IP}/g" \
)

# --- Build page into temp file, then serve with Content-Length ---
cat > "$OUT" <<EOF
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Speed Test</title>
  <link rel="stylesheet" type="text/css" href="/css/gauge.min.css" />
  <script>
    window.ST_PARAMS = ${PARAMS};
  </script>
</head>
<body style="margin:0;padding:0;height:100%;">
  <div id="root"></div>
  <script src="/js/testBundle.js"></script>
</body>
</html>
EOF

LEN=$(wc -c < "$OUT" | tr -d ' ')
echo "Content-Type: text/html"
echo "Content-Length: $LEN"
echo "Connection: close"
echo ""
cat "$OUT"
rm -f "$OUT"
