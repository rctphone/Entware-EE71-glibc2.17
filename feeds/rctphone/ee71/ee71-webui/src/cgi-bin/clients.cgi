#!/bin/sh
# clients.cgi — Connected clients list with WiFi signal data
# Collects: dnsmasq leases + ARP + hostapd stations + RSSI + channel/mode/BW
# All actions are GET-only, no CSRF needed
echo "Content-Type: application/json"
echo ""

ACTION="${QUERY_STRING%%&*}"
ACTION="${ACTION#action=}"

# Get bridge IP for subnet detection
BRIDGE_IP=$(ifconfig bridge0 2>/dev/null | sed -n 's/.*inet addr:\([^ ]*\).*/\1/p')
BRIDGE_IP="${BRIDGE_IP:-192.168.88.1}"

case "$ACTION" in

list)
    # === 1. Parse hostapd configs for per-interface WiFi capabilities ===
    # wlan0 = 2.4GHz, wlan1 = 5GHz
    _parse_hapd_conf() {
        _conf="$1"
        [ -f "$_conf" ] || return
        _hw_mode="" _ieee80211n=0 _ieee80211ac=0 _ht40=0 _vht_bw=0
        while IFS='=' read -r _key _val; do
            case "$_key" in
                hw_mode)      _hw_mode="$_val" ;;
                ieee80211n)   _ieee80211n="$_val" ;;
                ieee80211ac)  _ieee80211ac="$_val" ;;
                ht_capab)     case "$_val" in *HT40*) _ht40=1 ;; esac ;;
                vht_oper_chwidth) _vht_bw="$_val" ;;
            esac
        done < "$_conf"

        # Determine wifi_mode
        if [ "$_hw_mode" = "a" ] && [ "$_ieee80211ac" = "1" ]; then
            _wifi_mode="11ac"
        elif [ "$_ieee80211n" = "1" ]; then
            _wifi_mode="11n"
        elif [ "$_hw_mode" = "a" ]; then
            _wifi_mode="11a"
        elif [ "$_hw_mode" = "g" ]; then
            _wifi_mode="11g"
        else
            _wifi_mode="11b"
        fi

        # Determine bandwidth
        if [ "$_vht_bw" = "1" ]; then
            _bandwidth=80
        elif [ "$_ht40" = "1" ]; then
            _bandwidth=40
        else
            _bandwidth=20
        fi

        printf '%s %s\n' "$_wifi_mode" "$_bandwidth"
    }

    WLAN0_CAP=$(_parse_hapd_conf /etc/hostapd.conf)
    WLAN1_CAP=$(_parse_hapd_conf /etc/hostapd-wlan1.conf)
    WLAN0_MODE="${WLAN0_CAP% *}"
    WLAN0_BW="${WLAN0_CAP##* }"
    WLAN1_MODE="${WLAN1_CAP% *}"
    WLAN1_BW="${WLAN1_CAP##* }"

    # === 2. Get actual channels via iwpriv ===
    _get_channel() {
        iwpriv "$1" getchannel 2>/dev/null | sed -n 's/.*getchannel:\([0-9]*\).*/\1/p'
    }
    WLAN0_CH=$(_get_channel wlan0)
    WLAN1_CH=$(_get_channel wlan1)

    # === 3. Calculate max_speed from mode + bandwidth (2SS SGI) ===
    _max_speed() {
        case "${1}_${2}" in
            11n_20)  echo 144 ;;
            11n_40)  echo 300 ;;
            11ac_20) echo 173 ;;
            11ac_40) echo 400 ;;
            11ac_80) echo 867 ;;
            *)       echo 0 ;;
        esac
    }
    WLAN0_SPEED=$(_max_speed "$WLAN0_MODE" "$WLAN0_BW")
    WLAN1_SPEED=$(_max_speed "$WLAN1_MODE" "$WLAN1_BW")

    LEASES="/tmp/dnsmasq.leases"
    [ -f "$LEASES" ] || LEASES="/var/lib/misc/dnsmasq.leases"

    # === 4. Collect hostapd station data (MAC -> interface, connected_time) ===
    HAPD_DATA=$(
        for IFACE in wlan0 wlan1; do
            hostapd_cli -i "$IFACE" -p /var/run/hostapd all_sta 2>/dev/null | \
                awk -v iface="$IFACE" '
                    /^[0-9a-f][0-9a-f]:[0-9a-f]/ { mac=tolower($0) }
                    /^connected_time=/ { split($0,a,"="); print mac "\t" iface "\t" a[2] }
                '
        done
    )

    # === 5. Get RSSI for each WiFi station ===
    TAB=$(printf '\t')
    RSSI_DATA=""
    _old_IFS="$IFS"
    IFS="
"
    for _line in $HAPD_DATA; do
        _mac="${_line%%${TAB}*}"
        _rest="${_line#*${TAB}}"
        _iface="${_rest%%${TAB}*}"
        if [ -n "$_mac" ] && [ -n "$_iface" ]; then
            _rssi_raw=$(iwpriv "$_iface" getRSSI "$_mac" 2>/dev/null)
            _rssi=$(echo "$_rssi_raw" | sed -n 's/.*\[\([0-9]*\)\].*/\1/p')
            if [ -n "$_rssi" ]; then
                RSSI_DATA="${RSSI_DATA}${_mac}${TAB}-${_rssi}
"
            fi
        fi
    done
    IFS="$_old_IFS"

    # === 6. Collect ARP data ===
    ARP_DATA=$(awk '/bridge0/ && !/00:00:00:00:00:00/ {
        print tolower($4) "\t" $1
    }' /proc/net/arp)

    # === 6b. Detect USB interface name (non-wlan bridge members) ===
    USB_IFACE=""
    for _brif in /sys/class/net/bridge0/brif/*; do
        _name="${_brif##*/}"
        case "$_name" in wlan*) continue ;; esac
        USB_IFACE="$_name"
        break
    done
    USB_IFACE="${USB_IFACE:-usb0}"

    # === 6c. Bridge MAC table: mac -> interface (reliable for all bridge members) ===
    # Build port_no -> iface mapping from sysfs
    _PORT_MAP=""
    for _brif in /sys/class/net/bridge0/brif/*; do
        _name="${_brif##*/}"
        _pno=$(cat "$_brif/port_no" 2>/dev/null)
        [ -n "$_pno" ] && _PORT_MAP="${_PORT_MAP}${_pno} ${_name}
"
    done
    # Parse brctl showmacs -> mac<TAB>iface
    BRIDGE_MACS=$(brctl showmacs bridge0 2>/dev/null | awk -v pmap="$_PORT_MAP" '
    BEGIN {
        n = split(pmap, lines, "\n")
        for (i = 1; i <= n; i++) {
            split(lines[i], f, " ")
            if (f[1] != "") port_iface[f[1]+0] = f[2]
        }
    }
    NR > 1 && $3 == "no" {
        iface = port_iface[$1+0]
        if (iface != "") print tolower($2) "\t" iface
    }')

    # === 7. Build JSON ===
    NOW=$(date +%s)

    {
        [ -f "$LEASES" ] && cat "$LEASES" || true
    } | awk -v hapd="$HAPD_DATA" -v arp="$ARP_DATA" -v rssi_data="$RSSI_DATA" \
         -v bridge_macs="$BRIDGE_MACS" \
         -v w0_mode="$WLAN0_MODE" -v w0_bw="$WLAN0_BW" -v w0_ch="$WLAN0_CH" -v w0_speed="$WLAN0_SPEED" \
         -v w1_mode="$WLAN1_MODE" -v w1_bw="$WLAN1_BW" -v w1_ch="$WLAN1_CH" -v w1_speed="$WLAN1_SPEED" \
         -v usb_iface="$USB_IFACE" -v now="$NOW" '
    BEGIN {
        # Parse hostapd data: mac -> iface, connected_time
        n = split(hapd, lines, "\n")
        for (i = 1; i <= n; i++) {
            split(lines[i], f, "\t")
            if (f[1] != "") {
                h_iface[f[1]] = f[2]
                h_time[f[1]] = f[3]
            }
        }
        # Parse ARP data: mac -> ip
        n = split(arp, lines, "\n")
        for (i = 1; i <= n; i++) {
            split(lines[i], f, "\t")
            if (f[1] != "") arp_ip[f[1]] = f[2]
        }
        # Parse RSSI data: mac -> rssi
        n = split(rssi_data, lines, "\n")
        for (i = 1; i <= n; i++) {
            split(lines[i], f, "\t")
            if (f[1] != "") mac_rssi[f[1]] = f[2]
        }
        # Parse bridge MAC table: mac -> iface (from brctl showmacs)
        n = split(bridge_macs, lines, "\n")
        for (i = 1; i <= n; i++) {
            split(lines[i], f, "\t")
            if (f[1] != "") br_iface[f[1]] = f[2]
        }
    }
    function emit(mac, ip, name, iface, conn, ctime, online) {
        # WiFi fields
        _rssi = ""; _ch = ""; _mode = ""; _bw = ""; _speed = ""
        if (iface == "wlan0") {
            _rssi = mac_rssi[mac]
            _ch = w0_ch; _mode = w0_mode; _bw = w0_bw; _speed = w0_speed
        } else if (iface == "wlan1") {
            _rssi = mac_rssi[mac]
            _ch = w1_ch; _mode = w1_mode; _bw = w1_bw; _speed = w1_speed
        }
        printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n", \
            mac, ip, name, iface, conn, ctime, online, _rssi, _ch, _mode, _bw, _speed
    }
    {
        # dnsmasq lease: expiry mac ip hostname client-id
        mac = tolower($2)
        ip = $3
        name = $4
        if (name == "*") name = ""

        iface = h_iface[mac]
        # Fallback: bridge MAC table (reliable even when hostapd misses the client)
        if (iface == "" && mac in br_iface) iface = br_iface[mac]

        if (iface == "wlan0") { conn = "wifi_2g" }
        else if (iface == "wlan1") { conn = "wifi_5g" }
        else if (mac in arp_ip) { conn = "usb"; iface = usb_iface }
        else {
            # Not in hostapd, bridge, or ARP — show only if lease not expired
            expiry = $1 + 0
            if (expiry > 0 && expiry < now + 0) next
            conn = "offline"; iface = ""
        }

        ctime = h_time[mac]
        if (ctime == "") ctime = "0"
        online = (mac in arp_ip) ? "true" : "false"

        seen[mac] = 1
        emit(mac, ip, name, iface, conn, ctime, online)
    }
    END {
        for (mac in arp_ip) {
            if (!(mac in seen)) {
                ip = arp_ip[mac]
                iface = h_iface[mac]
                if (iface == "" && mac in br_iface) iface = br_iface[mac]
                if (iface == "wlan0") conn = "wifi_2g"
                else if (iface == "wlan1") conn = "wifi_5g"
                else { conn = "usb"; iface = usb_iface }
                ctime = h_time[mac]
                if (ctime == "") ctime = "0"
                emit(mac, ip, "", iface, conn, ctime, "true")
            }
        }
    }' | jq -nR '
        [inputs | split("\t") | select(length >= 12) |
        {
            mac: .[0],
            ip: .[1],
            name: (.[2] | if . == "" then null else . end),
            interface: .[3],
            connection: .[4],
            connected_time: (.[5] | tonumber? // 0),
            online: (.[6] == "true")
        } + (
            if .[7] != "" then { rssi: (.[7] | tonumber? // null) } else {} end
        ) + (
            if .[8] != "" then { channel: (.[8] | tonumber? // null) } else {} end
        ) + (
            if .[9] != "" then { wifi_mode: .[9] } else {} end
        ) + (
            if .[10] != "" then { bandwidth: (.[10] | tonumber? // null) } else {} end
        ) + (
            if .[11] != "" and .[11] != "0" then { max_speed: (.[11] | tonumber? // null) } else {} end
        )]'
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
