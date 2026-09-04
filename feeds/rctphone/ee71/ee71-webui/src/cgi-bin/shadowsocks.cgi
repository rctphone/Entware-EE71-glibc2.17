#!/bin/sh
# shadowsocks.cgi — ShadowSocks/Outline VPN management
# GET: status (read-only)
# POST: save, enable, disable, parse_uri, config (with CSRF check)
echo "Content-Type: application/json"
echo ""

SS_CONF="/etc/shadowsocks.json"
SS_REDIR="/usr/bin/ss-redir"
SS_TUNNEL="/usr/bin/ss-tunnel"
SS_REDIR_PID="/tmp/ss-redir.pid"
SS_TUNNEL_PID="/tmp/ss-tunnel.pid"
VPN_CONF="/etc/vpn.conf"
VPN_APPLY="/usr/bin/vpn_apply"
COMMENT="ee71-ss"
# Detect LAN subnet from bridge0
_LAN=$(ifconfig bridge0 2>/dev/null | sed -n 's/.*inet addr:\([^ ]*\).*/\1/p')
LAN_NET=$(echo "${_LAN:-192.168.1.1}" | sed 's/\.[0-9]*$/.0\/24/')
DNS_REMOTE="8.8.8.8"

. /jrd-resource/resource/webrc/www/cgi-bin/lib/cgi-common.sh

# --- Helpers ---
is_ss_running() {
    if [ -f "$SS_REDIR_PID" ]; then
        PID=$(cat "$SS_REDIR_PID" 2>/dev/null)
        if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
            echo 1
            return
        fi
    fi
    # Fallback: check process name
    pidof ss-redir >/dev/null 2>&1 && echo 1 || echo 0
}

vpn_read() {
    _VPN="off"
    [ -f "$VPN_CONF" ] && _VPN=$(sed -n 's/^VPN=//p' "$VPN_CONF")
}

# Bounds for the serialised VPN switch. The wait is deliberately much
# shorter than the run: if another VPN change is already in flight, failing
# fast with "in progress" beats freezing the single-threaded server for the
# full apply budget on top of it. Worst case per request is the sum.
VPN_LOCK_WAIT=10
VPN_LOCK_RUN=45

# vpn_switch <mode> — set /etc/vpn.conf and enforce it, serialised.
#
# wireguard.cgi, amneziawg.cgi and shadowsocks.cgi all write the same
# /etc/vpn.conf and then run vpn_apply, which rewrites routes and
# iptables and HUPs dnsmasq. Two of them running at once interleave those
# mutations and leave the router in a state neither request asked for.
# The write and the apply are one critical section held under a single
# named lock shared by all three scripts.
#
# Returns 124 if the lock could not be taken in time.
vpn_switch() {
    with_lock vpn "$VPN_LOCK_WAIT" "$VPN_LOCK_RUN" sh -c '
        printf "VPN=%s\n" "$2" > "$1"
        exec "$3"
    ' vpn_switch "$VPN_CONF" "$1" "$VPN_APPLY" >/dev/null 2>&1
}

# Read SS config JSON
read_ss_conf() {
    SS_SERVER="" SS_PORT="" SS_PASSWORD="" SS_METHOD="" SS_LOCAL_PORT="1080" SS_NAME=""
    if [ -f "$SS_CONF" ]; then
        SS_SERVER=$(jq -r '.server // empty' "$SS_CONF")
        SS_PORT=$(jq -r '.server_port // empty' "$SS_CONF")
        SS_PASSWORD=$(jq -r '.password // empty' "$SS_CONF")
        SS_METHOD=$(jq -r '.method // empty' "$SS_CONF")
        SS_LOCAL_PORT=$(jq -r '.local_port // empty' "$SS_CONF")
        SS_LOCAL_PORT="${SS_LOCAL_PORT:-1080}"
        SS_NAME=$(jq -r '.name // empty' "$SS_CONF")
    fi
}

# --- Parse action ---
case "$REQUEST_METHOD" in
GET)
    ACTION="${QUERY_STRING%%&*}"
    ACTION="${ACTION#action=}"
    ;;
POST)
    csrf_check
    read -r BODY
    ACTION=$(echo "$BODY" | jq -r '.action // empty')
    ;;
esac

case "$ACTION" in
status)
    RUNNING=$(is_ss_running)
    HAS_CONFIG=0
    [ -f "$SS_CONF" ] && HAS_CONFIG=1
    HAS_BIN=0
    [ -x "$SS_REDIR" ] && HAS_BIN=1

    vpn_read
    AUTO_START=0
    [ "$_VPN" = "ss" ] && AUTO_START=1

    read_ss_conf

    # Mask password
    MASKED_PW=""
    if [ -n "$SS_PASSWORD" ]; then
        LAST4=$(printf '%s' "$SS_PASSWORD" | tail -c 4)
        MASKED_PW="****${LAST4}"
    fi

    # Get uptime if running
    UPTIME=""
    if [ "$RUNNING" = "1" ] && [ -f "$SS_REDIR_PID" ]; then
        PID=$(cat "$SS_REDIR_PID" 2>/dev/null)
        if [ -n "$PID" ] && [ -d "/proc/$PID" ]; then
            START=$(stat -c %Y "/proc/$PID" 2>/dev/null || echo "")
            if [ -n "$START" ]; then
                NOW=$(date +%s)
                UPTIME=$((NOW - START))
            fi
        fi
    fi

    jq -n \
        --argjson running "$RUNNING" \
        --argjson has_config "$HAS_CONFIG" \
        --argjson has_bin "$HAS_BIN" \
        --argjson auto_start "$AUTO_START" \
        --arg server "$SS_SERVER" \
        --argjson server_port "${SS_PORT:-0}" \
        --arg password "$MASKED_PW" \
        --arg method "$SS_METHOD" \
        --argjson local_port "${SS_LOCAL_PORT:-1080}" \
        --argjson uptime "${UPTIME:-0}" \
        --arg name "$SS_NAME" \
        '{running:$running,has_config:$has_config,has_bin:$has_bin,auto_start:$auto_start,server:$server,server_port:$server_port,password:$password,method:$method,local_port:$local_port,uptime:$uptime,name:$name}'
    ;;

save)
    # Extract fields from JSON body
    SERVER=$(echo "$BODY" | jq -r '.server // empty')
    PORT=$(echo "$BODY" | jq -r '.server_port // empty')
    PASSWORD=$(echo "$BODY" | jq -r '.password // empty')
    METHOD=$(echo "$BODY" | jq -r '.method // empty')
    LOCAL_PORT=$(echo "$BODY" | jq -r '.local_port // empty')
    NAME=$(echo "$BODY" | jq -r '.name // empty')

    if [ -z "$SERVER" ] || [ -z "$PORT" ] || [ -z "$PASSWORD" ]; then
        echo '{"error":"Server, port, and password required"}'
        exit 0
    fi

    METHOD="${METHOD:-chacha20-ietf-poly1305}"
    LOCAL_PORT="${LOCAL_PORT:-1080}"

    # Validate port
    if [ "$PORT" -lt 1 ] 2>/dev/null || [ "$PORT" -gt 65535 ] 2>/dev/null; then
        echo '{"error":"Invalid port"}'
        exit 0
    fi

    # If password is empty, keep existing
    if [ -z "$PASSWORD" ] && [ -f "$SS_CONF" ]; then
        PASSWORD=$(jq -r '.password // empty' "$SS_CONF")
    fi

    # Keep existing name if not provided
    if [ -z "$NAME" ] && [ -f "$SS_CONF" ]; then
        NAME=$(jq -r '.name // empty' "$SS_CONF")
    fi

    # Write config
    jq -n \
        --arg server "$SERVER" \
        --argjson server_port "$PORT" \
        --arg password "$PASSWORD" \
        --arg method "$METHOD" \
        --argjson local_port "$LOCAL_PORT" \
        --arg name "$NAME" \
        '{server:$server,server_port:$server_port,password:$password,method:$method,local_address:"0.0.0.0",local_port:$local_port,timeout:60,name:$name}' \
        > "$SS_CONF"
    chmod 0600 "$SS_CONF"

    printf '{"ok":true}'
    ;;

enable)
    if [ ! -f "$SS_CONF" ]; then
        echo '{"error":"No ShadowSocks config. Save config first."}'
        exit 0
    fi

    if [ ! -x "$SS_REDIR" ]; then
        echo '{"error":"ss-redir binary not found"}'
        exit 0
    fi

    # Write VPN state and apply (stops WG if running, starts SS)
    vpn_switch "ss"
    case "$?" in
        0) ;;
        124) json_err "VPN switch timed out (waited up to ${VPN_LOCK_WAIT}s for a concurrent VPN change, then up to ${VPN_LOCK_RUN}s to apply)"
             exit 0 ;;
        *)   json_err "vpn_apply failed while switching to ss"
             exit 0 ;;
    esac

    RUNNING=$(is_ss_running)
    printf '{"ok":true,"running":%d}' "$RUNNING"
    ;;

disable)
    # Write VPN off and apply (stops SS, cleans iptables)
    vpn_switch "off"
    case "$?" in
        0) ;;
        124) json_err "VPN switch timed out (waited up to ${VPN_LOCK_WAIT}s for a concurrent VPN change, then up to ${VPN_LOCK_RUN}s to apply)"
             exit 0 ;;
        *)   json_err "vpn_apply failed while switching to off"
             exit 0 ;;
    esac

    RUNNING=$(is_ss_running)
    printf '{"ok":true,"running":%d}' "$RUNNING"
    ;;

parse_uri)
    # Parse ss:// URI → JSON config
    URI=$(echo "$BODY" | jq -r '.uri // empty')

    if [ -z "$URI" ]; then
        echo '{"error":"No URI provided"}'
        exit 0
    fi

    # Extract name from fragment (after #), URL-decode %XX
    P_NAME=$(printf '%s' "$URI" | sed -n 's/.*#\(.*\)/\1/p' | sed 's/%20/ /g; s/+/ /g; s/%2[Ff]/\//g; s/_/ /g')

    # ss://BASE64@host:port or ss://method:password@host:port
    # Remove ss:// prefix and optional fragment
    CLEAN=$(printf '%s' "$URI" | sed 's|^ss://||; s|#.*||')

    # Try to split at @
    if echo "$CLEAN" | grep -q '@'; then
        USERINFO=$(echo "$CLEAN" | sed 's/@.*//')
        HOSTPORT=$(echo "$CLEAN" | sed 's/.*@//')
    else
        # No @ — entire thing might be base64
        DECODED=$(printf '%s' "$CLEAN" | base64 -d 2>/dev/null)
        if [ -n "$DECODED" ] && echo "$DECODED" | grep -q '@'; then
            USERINFO=$(echo "$DECODED" | sed 's/@.*//')
            HOSTPORT=$(echo "$DECODED" | sed 's/.*@//')
        else
            echo '{"error":"Cannot parse SS URI"}'
            exit 0
        fi
    fi

    # Try base64 decode userinfo
    DECODED_UI=$(printf '%s' "$USERINFO" | base64 -d 2>/dev/null)
    if [ -n "$DECODED_UI" ] && echo "$DECODED_UI" | grep -q ':'; then
        USERINFO="$DECODED_UI"
    fi

    # Extract method:password
    P_METHOD=$(echo "$USERINFO" | sed 's/:.*//')
    P_PASSWORD=$(echo "$USERINFO" | sed 's/[^:]*://')

    # Extract host:port
    P_SERVER=$(echo "$HOSTPORT" | sed 's/:.*//')
    P_PORT=$(echo "$HOSTPORT" | sed 's/.*://' | tr -cd '0-9')

    if [ -z "$P_SERVER" ] || [ -z "$P_PORT" ] || [ -z "$P_METHOD" ] || [ -z "$P_PASSWORD" ]; then
        echo '{"error":"Incomplete SS URI"}'
        exit 0
    fi

    jq -n \
        --arg server "$P_SERVER" \
        --argjson server_port "$P_PORT" \
        --arg method "$P_METHOD" \
        --arg password "$P_PASSWORD" \
        --arg name "$P_NAME" \
        '{ok:true,server:$server,server_port:$server_port,method:$method,password:$password,name:$name}'
    ;;

config)
    # Full config for backup (unmasked password)
    read_ss_conf
    jq -n \
        --arg server "$SS_SERVER" \
        --argjson server_port "${SS_PORT:-0}" \
        --arg password "$SS_PASSWORD" \
        --arg method "$SS_METHOD" \
        --argjson local_port "${SS_LOCAL_PORT:-1080}" \
        --arg name "$SS_NAME" \
        '{server:$server,server_port:$server_port,password:$password,method:$method,local_port:$local_port,name:$name}'
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
