#!/bin/sh
# signal.cgi — Signal quality read-only endpoints
# All actions are GET-only, no CSRF needed
echo "Content-Type: application/json"
echo ""

. /jrd-resource/resource/webrc/www/cgi-bin/lib/cgi-common.sh

# Seconds to hold the modem node open (see the `ca` action).
AT_READ_TIMEOUT=3

ACTION="${QUERY_STRING%%&*}"
ACTION="${ACTION#action=}"

case "$ACTION" in

current)
    # Read signal info from /tmp/signal_current.txt
    # Written by signal_poll helper (or traffic_stats)
    # Format: KEY=VALUE per line
    FILE="/tmp/signal_current.txt"
    if [ ! -f "$FILE" ]; then
        printf '{"error":"signal data not available"}'
        exit 0
    fi
    awk -F= '
        /^#/ { next }
        NF >= 2 {
            key = $1
            val = $2
            for (i = 3; i <= NF; i++) val = val "=" $i
            print key "\t" val
        }
    ' "$FILE" | jq -nR '
        [inputs | split("\t") |
            {(.[0]): (.[1] // "" | (tonumber? // .))}
        ] | add // {}'
    ;;

history)
    # Return signal history ring buffer
    FILE="/tmp/signal_history.json"
    if [ -f "$FILE" ]; then
        cat "$FILE"
    else
        echo "[]"
    fi
    ;;

ca)
    # Carrier aggregation info via AT$QCRSRP?
    # Returns per-cell RSRP: PCI,EARFCN,"RSRP" triplets
    AT_DEV="/dev/smd7"
    [ ! -c "$AT_DEV" ] && AT_DEV="/dev/smd11"
    if [ ! -c "$AT_DEV" ]; then
        printf '{"error":"no AT device"}'
        exit 0
    fi

    # Send AT command, capture response. Open + write + read all run in
    # one bounded child: opening the modem node can itself block when the
    # modem is wedged, and webs is single-threaded, so a bound on the read
    # alone would not stop this from freezing the whole UI. `exec cat` so
    # the reader IS the process the timeout signals.
    # The command is passed as an argument, never interpolated into the
    # inner script — "AT$QCRSRP?" inside double quotes would expand
    # $QCRSRP to nothing and send a bare "AT?".
    _at_out="/tmp/signal_ca_$$.out"
    run_timeout "$AT_READ_TIMEOUT" sh -c '
        exec 3<>"$1" || exit 1
        printf "%s\r" "$2" >&3
        exec cat <&3
    ' signal_ca "$AT_DEV" 'AT$QCRSRP?' > "$_at_out" 2>/dev/null
    _resp=$(head -c 4096 "$_at_out" 2>/dev/null | head -10)
    rm -f "$_at_out"

    # Parse $QCRSRP response: extract EARFCN values, map to LTE bands
    # Format: $QCRSRP: PCI,EARFCN,"RSRP",PCI,EARFCN,"RSRP",...
    echo "$_resp" | awk '
    /\$QCRSRP:/ {
        # Remove prefix, quotes, carriage returns
        sub(/.*\$QCRSRP: */, "")
        gsub(/"/, "")
        gsub(/\r/, "")
        n = split($0, f, ",")
        # Extract unique EARFCNs with best RSRP per EARFCN
        for (i = 1; i <= n; i += 3) {
            pci = f[i]; earfcn = f[i+1]; rsrp = f[i+2]
            if (earfcn == "" || rsrp == "") continue
            if (!(earfcn in best) || rsrp+0 > best[earfcn]+0) {
                best[earfcn] = rsrp
            }
        }
    }
    function earfcn_to_band(e) {
        e = e + 0
        if (e >= 0 && e <= 599) return 1
        if (e >= 600 && e <= 1199) return 2
        if (e >= 1200 && e <= 1949) return 3
        if (e >= 1950 && e <= 2399) return 4
        if (e >= 2400 && e <= 2649) return 5
        if (e >= 2650 && e <= 2749) return 6
        if (e >= 2750 && e <= 3449) return 7
        if (e >= 3450 && e <= 3799) return 8
        if (e >= 3800 && e <= 4149) return 9
        if (e >= 4150 && e <= 4749) return 10
        if (e >= 4750 && e <= 4949) return 11
        if (e >= 5010 && e <= 5179) return 12
        if (e >= 5180 && e <= 5279) return 13
        if (e >= 5280 && e <= 5379) return 14
        if (e >= 5730 && e <= 5849) return 17
        if (e >= 5850 && e <= 5999) return 18
        if (e >= 6000 && e <= 6149) return 19
        if (e >= 6150 && e <= 6449) return 20
        if (e >= 6450 && e <= 6599) return 21
        if (e >= 7500 && e <= 7699) return 25
        if (e >= 7700 && e <= 8039) return 26
        if (e >= 8040 && e <= 8689) return 28
        if (e >= 9040 && e <= 9209) return 31
        if (e >= 9210 && e <= 9659) return 32
        if (e >= 36000 && e <= 36199) return 33
        if (e >= 36200 && e <= 36349) return 34
        if (e >= 36350 && e <= 36949) return 35
        if (e >= 36950 && e <= 37549) return 36
        if (e >= 37550 && e <= 37749) return 37
        if (e >= 37750 && e <= 38249) return 38
        if (e >= 38250 && e <= 38649) return 39
        if (e >= 38650 && e <= 39649) return 40
        if (e >= 39650 && e <= 41589) return 41
        if (e >= 41590 && e <= 43589) return 42
        if (e >= 43590 && e <= 45589) return 43
        return 0
    }
    END {
        # Sort EARFCNs by RSRP (best first = PCC)
        n = 0
        for (e in best) { n++; earfcns[n] = e; rsrps[n] = best[e] }
        for (i = 1; i < n; i++) {
            for (j = i+1; j <= n; j++) {
                if (rsrps[j]+0 > rsrps[i]+0) {
                    t = earfcns[i]; earfcns[i] = earfcns[j]; earfcns[j] = t
                    t = rsrps[i]; rsrps[i] = rsrps[j]; rsrps[j] = t
                }
            }
        }
        # Output as TSV for jq
        for (i = 1; i <= n; i++) {
            b = earfcn_to_band(earfcns[i])
            printf "%s\t%s\t%s\t%s\n", (i==1?"pcc":"scc"), earfcns[i], b, rsrps[i]
        }
    }' | jq -nR '
        { cells: [inputs | split("\t") | select(length >= 4) | {
            type: .[0],
            earfcn: (.[1] | tonumber? // 0),
            band: (.[2] | tonumber? // 0),
            rsrp: (.[3] | tonumber? // null)
        }] }
        | .bands = ([.cells[].band | select(. > 0)] | unique | sort)
        | .ca = ((.cells | length) > 1)'
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
