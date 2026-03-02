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

# --- CSRF check for POST ---
csrf_check() {
    if [ "$REQUEST_METHOD" = "POST" ]; then
        case "$CONTENT_TYPE" in
            application/json*) ;;
            *) echo '{"error":"JSON required"}'; exit 0 ;;
        esac
        if [ "$HTTP_X_EE71_REQUEST" != "1" ]; then
            echo '{"error":"Missing X-EE71-Request header"}'; exit 0
        fi
        LAN_IP=$(ifconfig bridge0 2>/dev/null | sed -n 's/.*inet addr:\([^ ]*\).*/\1/p')
        LAN_IP="${LAN_IP:-192.168.1.1}"
        HOSTNAME=$(cat /etc/hostname 2>/dev/null)
        ALLOWED="http://${LAN_IP}"
        case "$HTTP_ORIGIN" in
            "$ALLOWED"|"http://${HOSTNAME}") ;;
            "") case "$HTTP_REFERER" in
                    ${ALLOWED}/*|http://${HOSTNAME}/*) ;;
                    *) echo '{"error":"Invalid origin"}'; exit 0 ;;
                esac ;;
            *) echo '{"error":"Invalid origin"}'; exit 0 ;;
        esac
    fi
}

# --- Helpers ---
json_escape() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/	/\\t/g'
}

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

vpn_write() {
    printf 'VPN=%s\n' "$1" > "$VPN_CONF"
}

# Read SS config JSON
read_ss_conf() {
    SS_SERVER="" SS_PORT="" SS_PASSWORD="" SS_METHOD="" SS_LOCAL_PORT="1080" SS_NAME=""
    if [ -f "$SS_CONF" ]; then
        SS_SERVER=$(sed -n 's/.*"server"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$SS_CONF")
        SS_PORT=$(sed -n 's/.*"server_port"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p' "$SS_CONF")
        SS_PASSWORD=$(sed -n 's/.*"password"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$SS_CONF")
        SS_METHOD=$(sed -n 's/.*"method"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$SS_CONF")
        SS_LOCAL_PORT=$(sed -n 's/.*"local_port"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p' "$SS_CONF")
        SS_LOCAL_PORT="${SS_LOCAL_PORT:-1080}"
        SS_NAME=$(sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$SS_CONF")
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
    ACTION=$(echo "$BODY" | sed -n 's/.*"action"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
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

    printf '{"running":%d,"has_config":%d,"has_bin":%d,"auto_start":%d,"server":"%s","server_port":%s,"password":"%s","method":"%s","local_port":%s,"uptime":%s,"name":"%s"}' \
        "$RUNNING" "$HAS_CONFIG" "$HAS_BIN" "$AUTO_START" \
        "$(json_escape "$SS_SERVER")" \
        "${SS_PORT:-0}" \
        "$(json_escape "$MASKED_PW")" \
        "$(json_escape "$SS_METHOD")" \
        "${SS_LOCAL_PORT:-1080}" \
        "${UPTIME:-0}" \
        "$(json_escape "$SS_NAME")"
    ;;

save)
    # Extract fields from JSON body
    SERVER=$(echo "$BODY" | sed -n 's/.*"server"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    PORT=$(echo "$BODY" | sed -n 's/.*"server_port"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p')
    PASSWORD=$(echo "$BODY" | sed -n 's/.*"password"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    METHOD=$(echo "$BODY" | sed -n 's/.*"method"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    LOCAL_PORT=$(echo "$BODY" | sed -n 's/.*"local_port"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p')
    NAME=$(echo "$BODY" | sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

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
        PASSWORD=$(sed -n 's/.*"password"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$SS_CONF")
    fi

    # Keep existing name if not provided
    if [ -z "$NAME" ] && [ -f "$SS_CONF" ]; then
        NAME=$(sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$SS_CONF")
    fi

    # Write config
    cat > "$SS_CONF" <<EOF
{
    "server": "$SERVER",
    "server_port": $PORT,
    "password": "$PASSWORD",
    "method": "$METHOD",
    "local_address": "0.0.0.0",
    "local_port": $LOCAL_PORT,
    "timeout": 60,
    "name": "$NAME"
}
EOF
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
    vpn_write "ss"
    "$VPN_APPLY" >/dev/null 2>&1

    RUNNING=$(is_ss_running)
    printf '{"ok":true,"running":%d}' "$RUNNING"
    ;;

disable)
    # Write VPN off and apply (stops SS, cleans iptables)
    vpn_write "off"
    "$VPN_APPLY" >/dev/null 2>&1

    RUNNING=$(is_ss_running)
    printf '{"ok":true,"running":%d}' "$RUNNING"
    ;;

parse_uri)
    # Parse ss:// URI → JSON config
    URI=$(echo "$BODY" | sed -n 's/.*"uri"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

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

    printf '{"ok":true,"server":"%s","server_port":%s,"method":"%s","password":"%s","name":"%s"}' \
        "$(json_escape "$P_SERVER")" \
        "$P_PORT" \
        "$(json_escape "$P_METHOD")" \
        "$(json_escape "$P_PASSWORD")" \
        "$(json_escape "$P_NAME")"
    ;;

config)
    # Full config for backup (unmasked password)
    read_ss_conf
    printf '{"server":"%s","server_port":%s,"password":"%s","method":"%s","local_port":%s,"name":"%s"}' \
        "$(json_escape "$SS_SERVER")" "${SS_PORT:-0}" \
        "$(json_escape "$SS_PASSWORD")" "$(json_escape "$SS_METHOD")" "${SS_LOCAL_PORT:-1080}" \
        "$(json_escape "$SS_NAME")"
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
