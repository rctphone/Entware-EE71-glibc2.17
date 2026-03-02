#!/bin/sh
# wifi_ext.cgi — WiFi Extender scan via iw
# Bypasses broken SearchHotspot API; uses iw directly.
set -u

printf "Content-Type: application/json\r\n\r\n"

ACTION="${QUERY_STRING%%&*}"
ACTION="${ACTION#action=}"

case "$ACTION" in
scan)
    # Try active scan; if busy (AP using radio), fall back to cached results
    OUT=$(iw dev wlan0 scan 2>/dev/null) || OUT=$(iw dev wlan0 scan dump 2>/dev/null) || {
        printf '{"ok":false,"error":"scan failed"}'
        exit 0
    }

    # Parse iw scan output into JSON via awk
    echo "$OUT" | awk '
    BEGIN { first=1; printf "{\"ok\":true,\"networks\":[" }
    /^BSS / {
        if (ssid != "") {
            if (!first) printf ","
            first=0
            gsub(/"/, "\\\"", ssid)
            printf "{\"ssid\":\"%s\",\"signal\":%s,\"freq\":%s,\"bssid\":\"%s\",\"security\":\"%s\"}", ssid, signal, freq, bssid, sec
        }
        bssid=$2; gsub(/\(.*/, "", bssid)
        ssid=""; signal="0"; freq="0"; sec="Open"
    }
    /^\tSSID: / { ssid=substr($0, index($0, "SSID: ")+6) }
    /^\tsignal: / { signal=$2; sub(/\..*/, "", signal) }
    /^\tfreq: / { freq=$2 }
    /^\tRSN:/ { sec="WPA2" }
    /^\tWPA:/ { if (sec=="Open") sec="WPA" }
    END {
        if (ssid != "") {
            if (!first) printf ","
            gsub(/"/, "\\\"", ssid)
            printf "{\"ssid\":\"%s\",\"signal\":%s,\"freq\":%s,\"bssid\":\"%s\",\"security\":\"%s\"}", ssid, signal, freq, bssid, sec
        }
        printf "]}"
    }'
    ;;

*)
    printf '{"ok":false,"error":"unknown action: %s"}' "$ACTION"
    ;;
esac
