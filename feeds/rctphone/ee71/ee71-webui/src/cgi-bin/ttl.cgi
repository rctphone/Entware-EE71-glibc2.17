#!/bin/sh
# ttl.cgi — TTL fix management
# GET: status (read-only)
# POST: set, enable, disable (with CSRF check)
echo "Content-Type: application/json"
echo ""

TTL_CONF="/etc/ttl_fix.conf"
TTL_INIT="/etc/init.d/ttl_fix"
DEFAULT_TTL=64
DEFAULT_IFACE="rmnet+"

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

conf_get() {
    # Read key=value from TTL_CONF
    if [ -f "$TTL_CONF" ]; then
        sed -n "s/^$1=//p" "$TTL_CONF" 2>/dev/null | tr -d '[:space:]'
    fi
}

get_ttl_value() {
    VAL=$(conf_get ttl)
    case "$VAL" in
        [0-9]|[0-9][0-9]|[0-9][0-9][0-9])
            if [ "$VAL" -ge 1 ] && [ "$VAL" -le 255 ] 2>/dev/null; then
                echo "$VAL"; return
            fi ;;
    esac
    echo "$DEFAULT_TTL"
}

get_ttl_iface() {
    VAL=$(conf_get iface)
    if [ -n "$VAL" ]; then echo "$VAL"; else echo "$DEFAULT_IFACE"; fi
}

is_ttl_active() {
    # Check if any TTL mangle rules exist
    iptables -t mangle -L POSTROUTING -n 2>/dev/null | grep -q 'TTL' && echo 1 || echo 0
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
    # Extract action from JSON body
    ACTION=$(echo "$BODY" | jq -r '.action // empty')
    ;;
esac

case "$ACTION" in
status)
    TTL_VAL=$(get_ttl_value)
    TTL_IFACE=$(get_ttl_iface)
    ACTIVE=$(is_ttl_active)
    INIT_EXISTS=0
    [ -x "$TTL_INIT" ] && INIT_EXISTS=1

    # Get current mangle rules
    IPV4_RULES=$(iptables -t mangle -L -n -v --line-numbers 2>/dev/null | grep -c 'TTL' || echo 0)
    IPV6_RULES=$(ip6tables -t mangle -L -n -v --line-numbers 2>/dev/null | grep -c 'HL' || echo 0)

    jq -n --argjson ttl "$TTL_VAL" --arg iface "$TTL_IFACE" \
        --argjson active "$ACTIVE" --argjson init "$INIT_EXISTS" \
        --argjson v4 "$IPV4_RULES" --argjson v6 "$IPV6_RULES" \
        '{"ttl":$ttl,"iface":$iface,"active":$active,"init_exists":$init,"ipv4_rules":$v4,"ipv6_rules":$v6}'
    ;;

set)
    # Extract ttl value and interface from JSON body
    NEW_TTL=$(echo "$BODY" | jq -r '.ttl // empty')
    if [ -z "$NEW_TTL" ] || [ "$NEW_TTL" -lt 1 ] 2>/dev/null || [ "$NEW_TTL" -gt 255 ] 2>/dev/null; then
        printf '{"error":"TTL must be 1-255"}'
        exit 0
    fi

    NEW_IFACE=$(echo "$BODY" | jq -r '.iface // empty')
    # Validate interface: alphanumeric and + only
    case "$NEW_IFACE" in
        *[!a-zA-Z0-9+_]*|"") NEW_IFACE="$DEFAULT_IFACE" ;;
    esac

    # Write config
    printf 'ttl=%s\niface=%s\n' "$NEW_TTL" "$NEW_IFACE" > "$TTL_CONF"

    # Restart if active
    if [ "$(is_ttl_active)" = "1" ] && [ -x "$TTL_INIT" ]; then
        "$TTL_INIT" restart >/dev/null 2>&1
    fi

    jq -n --argjson ttl "$NEW_TTL" --arg iface "$NEW_IFACE" \
        '{"ok":true,"ttl":$ttl,"iface":$iface}'
    ;;

enable)
    if [ ! -x "$TTL_INIT" ]; then
        printf '{"error":"ttl_fix init script not found"}'
        exit 0
    fi
    "$TTL_INIT" start >/dev/null 2>&1
    ACTIVE=$(is_ttl_active)
    jq -n --argjson active "$ACTIVE" '{"ok":true,"active":$active}'
    ;;

disable)
    if [ -x "$TTL_INIT" ]; then
        "$TTL_INIT" stop >/dev/null 2>&1
    fi
    ACTIVE=$(is_ttl_active)
    jq -n --argjson active "$ACTIVE" '{"ok":true,"active":$active}'
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
