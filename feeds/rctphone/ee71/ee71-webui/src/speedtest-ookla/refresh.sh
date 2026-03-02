#!/bin/sh
# Manually refresh the speedtest params cache on the device.
# The CGI auto-refreshes every hour, but this forces an immediate refresh.
# Run on the device: /jrd-resource/speedtest/refresh.sh
#
# Also useful locally for development: ./refresh.sh

UPSTREAM="https://domv.speedtestcustom.com/"
PARAMS_CACHE="/tmp/speedtest_params.cache"

echo "Fetching $UPSTREAM ..."
HTML=$(curl -sL "$UPSTREAM")
if [ -z "$HTML" ]; then
    echo "ERROR: Failed to fetch $UPSTREAM"
    exit 1
fi

PARAMS=$(echo "$HTML" | sed -n 's/.*window\.ST_PARAMS = \(.*\);$/\1/p')
if [ -z "$PARAMS" ]; then
    echo "ERROR: Could not extract ST_PARAMS"
    exit 1
fi

# Patch embed config + strip identity (same as CGI — theme-independent)
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
    -e 's/"jwtToken":"[^"]*"/"jwtToken":""/g' \
    -e 's/"cityName":"[^"]*"/"cityName":""/g' \
    -e 's/"countryName":"[^"]*"/"countryName":""/g' \
    -e 's/"regionName":"[^"]*"/"regionName":""/g' \
    -e 's/"latitude":[0-9.]*/"latitude":0/g' \
    -e 's/"longitude":[0-9.]*/"longitude":0/g' \
    -e 's/"isEUCountry":true/"isEUCountry":false/' \
    -e 's|https:\\u002F\\u002F|http:\\u002F\\u002F|g' \
)

# Update params cache (theme colors applied per-request by CGI)
echo "$PARAMS" > "$PARAMS_CACHE"

echo "OK — params cache refreshed"
echo "Theme colors will be applied per-request from SPA query params."

# Show server info
SERVERS=$(echo "$PARAMS" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    for s in d.get('serverList',[]):
        print(f'  {s.get(\"sponsor\",\"\"):30s} {s.get(\"name\",\"\"):20s} {s.get(\"host\",\"\")}')
except: pass
" 2>/dev/null)
if [ -n "$SERVERS" ]; then
    echo "Servers:"
    echo "$SERVERS"
fi
