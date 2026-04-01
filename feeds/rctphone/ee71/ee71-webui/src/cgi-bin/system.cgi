#!/bin/sh
# system.cgi — System information and config restore endpoints
echo "Content-Type: application/json"
echo ""

# For POST actions: read body and check CSRF
BODY=""
if [ "$REQUEST_METHOD" = "POST" ]; then
    BODY=$(cat)
    ACTION=$(echo "$BODY" | jq -r '.action // empty')
    if [ "$HTTP_X_EE71_REQUEST" != "1" ]; then
        echo '{"error":"Missing X-EE71-Request header"}'; exit 0
    fi
    LAN_IP=$(ifconfig bridge0 2>/dev/null | sed -n 's/.*inet addr:\([^ ]*\).*/\1/p')
    LAN_IP="${LAN_IP:-192.168.1.1}"
    HOSTNAME=$(cat /etc/hostname 2>/dev/null)
    REQ_HOST=$(echo "$HTTP_HOST" | sed 's/:.*//')
    _origin_ok() {
        case "$1" in
            "http://${LAN_IP}"*|"http://${HOSTNAME}"*) return 0 ;;
        esac
        [ -n "$REQ_HOST" ] && case "$1" in
            "http://${REQ_HOST}"*) return 0 ;;
        esac
        return 1
    }
    if [ -n "$HTTP_ORIGIN" ]; then
        _origin_ok "$HTTP_ORIGIN" || { echo '{"error":"Invalid origin"}'; exit 0; }
    elif [ -n "$HTTP_REFERER" ]; then
        _origin_ok "$HTTP_REFERER" || { echo '{"error":"Invalid origin"}'; exit 0; }
    fi
else
    ACTION="${QUERY_STRING%%&*}"
    ACTION="${ACTION#action=}"
fi

case "$ACTION" in

interfaces)
    ip addr show 2>/dev/null | awk '
    /^[0-9]+:/ {
        if (iface != "") print iface_line
        orig = $0
        gsub(/^[0-9]+: */, ""); gsub(/:.*/, "")
        name = $0
        state = (orig ~ /UP/) ? "up" : "down"
        iface = name
        iface_line = name "\t" state
    }
    /^ *inet6? / {
        match($0, /inet6? [^ ]+/)
        split(substr($0, RSTART, RLENGTH), a, " ")
        iface_line = iface_line "\t" a[2]
    }
    END {
        if (iface != "") print iface_line
    }' | {
        while IFS='	' read -r NAME STATE ADDRS_REST; do
            ADDR_JSON="[]"
            if [ -n "$ADDRS_REST" ]; then
                ADDR_JSON=$(printf '%s' "$ADDRS_REST" | tr '	' '\n' | jq -R '.' | jq -s '.')
            fi
            jq -n --arg name "$NAME" --arg state "$STATE" --argjson addrs "$ADDR_JSON" \
                '{"name":$name,"state":$state,"addrs":$addrs}'
        done
    } | jq -s '.'
    ;;

routes)
    ip route show 2>/dev/null | while IFS= read -r LINE; do
        DEST=$(echo "$LINE" | awk '{print $1}')
        GW=""
        DEV=""
        set -- $LINE
        while [ $# -gt 0 ]; do
            case "$1" in
                via) shift; GW="$1" ;;
                dev) shift; DEV="$1" ;;
            esac
            shift
        done
        jq -n --arg dest "$DEST" --arg via "$GW" --arg dev "$DEV" \
            '{"dest":$dest,"via":$via,"dev":$dev}'
    done | jq -s '.'
    ;;

iptables)
    # Parse iptables -L -n -v into structured JSON
    RESULT="{}"
    for TABLE in filter nat mangle; do
        TMPF="/tmp/ipt_$$_$TABLE"
        iptables -t "$TABLE" -L -n -v --line-numbers 2>/dev/null > "$TMPF"
        CHAIN=""
        TABLE_JSON="{}"
        RULES_JSON="[]"
        POLICY=""
        while IFS= read -r LINE; do
            case "$LINE" in
                Chain\ *)
                    if [ -n "$CHAIN" ]; then
                        CHAIN_OBJ=$(jq -n --arg policy "$POLICY" --argjson rules "$RULES_JSON" \
                            '{"policy":$policy,"rules":$rules}')
                        TABLE_JSON=$(echo "$TABLE_JSON" | jq --arg ch "$CHAIN" --argjson obj "$CHAIN_OBJ" \
                            '. + {($ch): $obj}')
                    fi
                    CHAIN=$(echo "$LINE" | awk '{print $2}')
                    POLICY=$(echo "$LINE" | sed -n 's/.*policy \([A-Z]*\).*/\1/p')
                    RULES_JSON="[]"
                    ;;
                num*)
                    # header line, skip
                    ;;
                [0-9]*)
                    NUM=$(echo "$LINE" | awk '{print $1}')
                    PKTS=$(echo "$LINE" | awk '{print $2}')
                    BYTES=$(echo "$LINE" | awk '{print $3}')
                    TARGET=$(echo "$LINE" | awk '{print $4}')
                    PROTO=$(echo "$LINE" | awk '{print $5}')
                    IN=$(echo "$LINE" | awk '{print $7}')
                    OUT=$(echo "$LINE" | awk '{print $8}')
                    SRC=$(echo "$LINE" | awk '{print $9}')
                    DST=$(echo "$LINE" | awk '{print $10}')
                    EXTRA=$(echo "$LINE" | awk '{for(i=11;i<=NF;i++) printf "%s ", $i; printf "\n"}' | sed 's/ *$//')
                    RULE_OBJ=$(jq -n --argjson num "$NUM" \
                        --arg pkts "$PKTS" --arg bytes "$BYTES" \
                        --arg target "$TARGET" --arg proto "$PROTO" \
                        --arg in "$IN" --arg out "$OUT" \
                        --arg src "$SRC" --arg dst "$DST" \
                        --arg extra "$EXTRA" \
                        '{"num":$num,"pkts":$pkts,"bytes":$bytes,"target":$target,"proto":$proto,"in":$in,"out":$out,"src":$src,"dst":$dst,"extra":$extra}')
                    RULES_JSON=$(echo "$RULES_JSON" | jq --argjson rule "$RULE_OBJ" '. + [$rule]')
                    ;;
            esac
        done < "$TMPF"
        rm -f "$TMPF"
        if [ -n "$CHAIN" ]; then
            CHAIN_OBJ=$(jq -n --arg policy "$POLICY" --argjson rules "$RULES_JSON" \
                '{"policy":$policy,"rules":$rules}')
            TABLE_JSON=$(echo "$TABLE_JSON" | jq --arg ch "$CHAIN" --argjson obj "$CHAIN_OBJ" \
                '. + {($ch): $obj}')
        fi
        RESULT=$(echo "$RESULT" | jq --arg tbl "$TABLE" --argjson val "$TABLE_JSON" \
            '. + {($tbl): $val}')
    done
    echo "$RESULT"
    ;;

open_ports)
    netstat -tlnp 2>/dev/null | tail -n +3 | while IFS= read -r LINE; do
        PROTO=$(echo "$LINE" | awk '{print $1}')
        LOCAL=$(echo "$LINE" | awk '{print $4}')
        PID_PROG=$(echo "$LINE" | awk '{print $7}')
        PID=$(echo "$PID_PROG" | cut -d/ -f1)
        PROG=$(echo "$PID_PROG" | cut -d/ -f2-)
        jq -n --arg proto "$PROTO" --arg local "$LOCAL" \
            --arg pid "$PID" --arg program "$PROG" \
            '{"proto":$proto,"local":$local,"pid":$pid,"program":$program}'
    done | jq -s '.'
    ;;

conntrack_stats)
    COUNT=$(cat /proc/sys/net/netfilter/nf_conntrack_count 2>/dev/null || echo 0)
    MAX=$(cat /proc/sys/net/netfilter/nf_conntrack_max 2>/dev/null || echo 0)
    jq -n --argjson count "$COUNT" --argjson max "$MAX" \
        '{"count":$count,"max":$max}'
    ;;

memory)
    awk -F: '{gsub(/[() ]/, "", $1); print $1, $2+0}' /proc/meminfo | \
        jq -nR '[inputs | split(" ") | {(.[0]): (.[1] | tonumber)}] | add'
    ;;

cpu)
    # Read /proc/stat first line (cpu totals) + loadavg
    read -r _ USER NICE SYSTEM IDLE IOWAIT IRQ SOFTIRQ STEAL _ < /proc/stat
    read -r LOAD1 LOAD5 LOAD15 _ < /proc/loadavg
    jq -n --argjson user "$USER" --argjson nice "$NICE" \
        --argjson system "$SYSTEM" --argjson idle "$IDLE" \
        --argjson iowait "$IOWAIT" --argjson irq "$IRQ" \
        --argjson softirq "$SOFTIRQ" --argjson steal "$STEAL" \
        --arg load1 "$LOAD1" --arg load5 "$LOAD5" --arg load15 "$LOAD15" \
        '{"user":$user,"nice":$nice,"system":$system,"idle":$idle,"iowait":$iowait,"irq":$irq,"softirq":$softirq,"steal":$steal,"load1":$load1,"load5":$load5,"load15":$load15}'
    ;;

storage)
    df 2>/dev/null | tail -n +2 | while IFS= read -r LINE; do
        FS=$(echo "$LINE" | awk '{print $1}')
        SIZE=$(echo "$LINE" | awk '{print $2}')
        USED=$(echo "$LINE" | awk '{print $3}')
        AVAIL=$(echo "$LINE" | awk '{print $4}')
        PCT=$(echo "$LINE" | awk '{print $5}' | tr -d '%')
        MOUNT=$(echo "$LINE" | awk '{print $6}')
        jq -n --arg fs "$FS" --argjson size "$SIZE" \
            --argjson used "$USED" --argjson avail "$AVAIL" \
            --argjson pct "${PCT:-0}" --arg mount "$MOUNT" \
            '{"fs":$fs,"size":$size,"used":$used,"avail":$avail,"pct":$pct,"mount":$mount}'
    done | jq -s '.'
    ;;

hostname)
    SYS_HOSTNAME=$(cat /etc/hostname 2>/dev/null || echo "")
    HOSTS_ENTRY=""
    if [ -f /etc/hosts ]; then
        HOSTS_ENTRY=$(grep -v '^\s*#' /etc/hosts | grep -v '127.0.0.1' | head -1 | awk '{print $2}')
    fi
    jq -n --arg system "$SYS_HOSTNAME" --arg dns "$HOSTS_ENTRY" \
        '{"system":$system,"dns":$dns}'
    ;;

dhcp_leases)
    LEASE_FILE="/var/lib/misc/dnsmasq.leases"
    [ ! -f "$LEASE_FILE" ] && LEASE_FILE="/tmp/dnsmasq.leases"
    if [ -f "$LEASE_FILE" ]; then
        while IFS= read -r LINE; do
            [ -z "$LINE" ] && continue
            TS=$(echo "$LINE" | awk '{print $1}')
            MAC=$(echo "$LINE" | awk '{print $2}')
            IP=$(echo "$LINE" | awk '{print $3}')
            NAME=$(echo "$LINE" | awk '{print $4}')
            jq -n --argjson expires "$TS" --arg mac "$MAC" \
                --arg ip "$IP" --arg hostname "$NAME" \
                '{"expires":$expires,"mac":$mac,"ip":$ip,"hostname":$hostname}'
        done < "$LEASE_FILE"
    fi | jq -s '.'
    ;;

uptime)
    read -r UP IDLE < /proc/uptime
    jq -n --argjson seconds "${UP%%.*}" '{"seconds":$seconds}'
    ;;

kernel)
    KERNEL=$(uname -r 2>/dev/null || echo "")
    jq -n --arg version "$KERNEL" '{"version":$version}'
    ;;

wifi_power)
    # Read WiFi TX power levels from SQLite (not exposed via webapi)
    # PowerLevel: 0=100%, 1=75%, 2=50%, 3=25%
    DB="/jrd-resource/resource/sqlite3/user_info.db3"
    P2G=$(sqlite3 "$DB" "SELECT value FROM wifi_info WHERE items='2GPowerLevel';" 2>/dev/null)
    P5G=$(sqlite3 "$DB" "SELECT value FROM wifi_info WHERE items='5GPowerLevel';" 2>/dev/null)
    jq -n --argjson p2g "${P2G:-0}" --argjson p5g "${P5G:-0}" \
        '{"2GPowerLevel":$p2g,"5GPowerLevel":$p5g}'
    ;;

restore-extra)
    # Restore custom config files from backup JSON.
    # Expects POST with JSON body: { action: "restore-extra", ... }
    [ "$REQUEST_METHOD" != "POST" ] && { echo '{"error":"POST required"}'; exit 0; }

    APPLIED=""

    # Restore /etc/hosts
    HOSTS=$(echo "$BODY" | jq -r '.hosts // empty')
    if [ -n "$HOSTS" ]; then
        printf '%s\n' "$HOSTS" > /etc/hosts
        kill -HUP "$(pidof dnsmasq)" 2>/dev/null
        APPLIED="${APPLIED}hosts,"
    fi

    # Restore authorized_keys
    AUTH_KEYS=$(echo "$BODY" | jq -r '.authorized_keys // empty')
    if [ -n "$AUTH_KEYS" ]; then
        mkdir -p /etc/dropbear
        printf '%s\n' "$AUTH_KEYS" > /etc/dropbear/authorized_keys
        chmod 600 /etc/dropbear/authorized_keys
        APPLIED="${APPLIED}ssh_keys,"
    fi

    # Restore WG autostart init script
    WG_INIT=$(echo "$BODY" | jq -r '.wg_init // empty')
    if [ -n "$WG_INIT" ]; then
        printf '%s\n' "$WG_INIT" > /etc/init.d/wg_vadim
        chmod +x /etc/init.d/wg_vadim
        [ ! -e /etc/rc5.d/S85wg_vadim ] && ln -s ../init.d/wg_vadim /etc/rc5.d/S85wg_vadim
        APPLIED="${APPLIED}wg_init,"
    fi

    # Restore user-created APN profiles
    APN_COUNT=$(echo "$BODY" | jq '.user_apn_profiles | length' 2>/dev/null)
    if [ "${APN_COUNT:-0}" -gt 0 ]; then
        mkdir -p /jrd-resource/resource/profile/create
        I=0
        while [ "$I" -lt "$APN_COUNT" ]; do
            FNAME=$(echo "$BODY" | jq -r ".user_apn_profiles[$I].name")
            FCONTENT=$(echo "$BODY" | jq -r ".user_apn_profiles[$I].content")
            if [ -n "$FNAME" ] && [ -n "$FCONTENT" ]; then
                printf '%s' "$FCONTENT" > "/jrd-resource/resource/profile/create/$FNAME"
            fi
            I=$((I + 1))
        done
        APPLIED="${APPLIED}user_apn,"
    fi

    # Restore disabled init scripts
    DIS_COUNT=$(echo "$BODY" | jq '.disabled_inits | length' 2>/dev/null)
    if [ "${DIS_COUNT:-0}" -gt 0 ]; then
        I=0
        while [ "$I" -lt "$DIS_COUNT" ]; do
            SCRIPT=$(echo "$BODY" | jq -r ".disabled_inits[$I]")
            SRC="/etc/rc5.d/$SCRIPT"
            DST="/etc/rc5.d/DISABLED_$SCRIPT"
            if [ -e "$SRC" ] && [ ! -e "$DST" ]; then
                mv "$SRC" "$DST"
            fi
            I=$((I + 1))
        done
        APPLIED="${APPLIED}disabled_inits,"
    fi

    APPLIED=$(echo "$APPLIED" | sed 's/,$//')
    jq -n --arg applied "$APPLIED" '{"ok":true,"applied":$applied}'
    ;;

backup-extra)
    # Export custom config files not covered by webapi/CGI endpoints.
    # Used by backup.js for complete configuration export.
    WLAN_MODE=$(sed -n 's/.*<WlanMode>\(.*\)<\/WlanMode>.*/\1/p' /etc/mobileap_cfg.xml 2>/dev/null)
    AUTH_KEYS=$(cat /etc/dropbear/authorized_keys 2>/dev/null | head -20)
    HOSTS=$(cat /etc/hosts 2>/dev/null)
    WG_INIT=$(cat /etc/init.d/wg_vadim 2>/dev/null)

    # User-created APN profiles (in /jrd-resource/resource/profile/create/)
    APN_FILES=""
    for F in /jrd-resource/resource/profile/create/profile*; do
        [ -f "$F" ] || continue
        NAME=$(basename "$F")
        CONTENT=$(cat "$F")
        APN_FILES="${APN_FILES}${APN_FILES:+,}$(jq -n --arg name "$NAME" --arg content "$CONTENT" \
            '{"name":$name,"content":$content}')"
    done

    # Disabled init scripts
    DISABLED=""
    for D in /etc/rc5.d/DISABLED_*; do
        [ -e "$D" ] || continue
        DISABLED="${DISABLED}${DISABLED:+,}\"$(basename "$D" | sed 's/^DISABLED_//')\""
    done

    jq -n \
        --arg wlan_mode "${WLAN_MODE:-AP}" \
        --arg authorized_keys "$AUTH_KEYS" \
        --arg hosts "$HOSTS" \
        --arg wg_init "$WG_INIT" \
        --argjson user_apn_profiles "[${APN_FILES}]" \
        --argjson disabled_inits "[${DISABLED}]" \
        '{wlan_mode:$wlan_mode,authorized_keys:$authorized_keys,hosts:$hosts,wg_init:$wg_init,user_apn_profiles:$user_apn_profiles,disabled_inits:$disabled_inits}'
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
