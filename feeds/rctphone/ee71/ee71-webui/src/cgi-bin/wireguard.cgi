#!/bin/sh
# wireguard.cgi — WireGuard VPN management
# GET: status, config (read-only)
# POST: save, enable, disable, generate_key (with CSRF check)
echo "Content-Type: application/json"
echo ""

WG_CONF="/etc/wireguard/wg0.conf"
VPN_CONF="/etc/vpn.conf"
VPN_APPLY="/usr/bin/vpn_apply"
WG_MODULE="/usr/lib/modules/$(uname -r)/kernel/drivers/net/wireguard.ko"
WG_BIN="/usr/bin/wg"
IFACE="wg0"
# Detect LAN subnet from bridge0
_LAN=$(ifconfig bridge0 2>/dev/null | sed -n 's/.*inet addr:\([^ ]*\).*/\1/p')
LAN_NET=$(echo "${_LAN:-192.168.1.1}" | sed 's/\.[0-9]*$/.0\/24/')

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
    fi
}

# --- Helpers ---
is_wg_up() {
    ip link show "$IFACE" >/dev/null 2>&1 && echo 1 || echo 0
}

vpn_read() {
    _VPN="off"
    if [ -f "$VPN_CONF" ]; then
        . "$VPN_CONF"
        _VPN="${VPN:-off}"
    fi
}

vpn_write() {
    printf 'VPN=%s\n' "$1" > "$VPN_CONF"
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
    UP=$(is_wg_up)
    MODULE_LOADED=0
    lsmod 2>/dev/null | grep -q wireguard && MODULE_LOADED=1
    HAS_CONFIG=0
    [ -f "$WG_CONF" ] && HAS_CONFIG=1
    HAS_WG=0
    [ -x "$WG_BIN" ] && HAS_WG=1

    # Get address from wg0 interface (runtime), endpoint from config (for display when down)
    WG_ADDRESS=""
    if [ "$UP" = "1" ]; then
        WG_ADDRESS=$(ip -4 addr show "$IFACE" 2>/dev/null | sed -n 's/.*inet \([^ ]*\).*/\1/p' | head -1)
    fi
    CONF_ENDPOINT=""
    if [ -f "$WG_CONF" ]; then
        CONF_ENDPOINT=$(sed -n 's/^[[:space:]]*Endpoint[[:space:]]*=[[:space:]]*//p' "$WG_CONF" | head -1)
    fi

    vpn_read
    AUTO_START=0
    [ "$_VPN" = "wg" ] && AUTO_START=1

    # Get wg show dump if interface is up
    PEERS_JSON="[]"
    IFACE_JSON="{}"
    if [ "$UP" = "1" ] && [ -x "$WG_BIN" ]; then
        WG_DUMP=$("$WG_BIN" show "$IFACE" dump 2>/dev/null)
        if [ -n "$WG_DUMP" ]; then
            IFACE_LINE=$(echo "$WG_DUMP" | head -1)
            IFACE_PUBKEY=$(echo "$IFACE_LINE" | cut -f2)
            IFACE_PORT=$(echo "$IFACE_LINE" | cut -f3)

            IFACE_JSON=$(jq -n --arg pk "$IFACE_PUBKEY" --arg port "$IFACE_PORT" \
                '{"public_key":$pk,"listen_port":$port}')

            # Build peers JSON array: collect each peer as a JSON object, then wrap
            PEERS_JSON=$(echo "$WG_DUMP" | tail -n +2 | {
                NOW=$(date +%s)
                SEP=""
                printf '['
                while IFS='	' read -r PUBKEY PRESHARED ENDPOINT ALLOWED_IPS HANDSHAKE RX TX KEEPALIVE; do
                    [ -z "$PUBKEY" ] && continue
                    HANDSHAKE_AGO=""
                    if [ "$HANDSHAKE" != "0" ] && [ -n "$HANDSHAKE" ]; then
                        AGO=$((NOW - HANDSHAKE))
                        if [ "$AGO" -lt 60 ]; then
                            HANDSHAKE_AGO="${AGO}s ago"
                        elif [ "$AGO" -lt 3600 ]; then
                            HANDSHAKE_AGO="$((AGO / 60))m ago"
                        else
                            HANDSHAKE_AGO="$((AGO / 3600))h ago"
                        fi
                    fi
                    printf '%s' "$SEP"
                    jq -n \
                        --arg pk "$PUBKEY" \
                        --arg ep "$ENDPOINT" \
                        --arg aips "$ALLOWED_IPS" \
                        --arg hs "$HANDSHAKE_AGO" \
                        --argjson rx "${RX:-0}" \
                        --argjson tx "${TX:-0}" \
                        --arg ka "$KEEPALIVE" \
                        '{"public_key":$pk,"endpoint":$ep,"allowed_ips":$aips,"latest_handshake":$hs,"transfer_rx":$rx,"transfer_tx":$tx,"persistent_keepalive":$ka}'
                    SEP=","
                done
                printf ']'
            })
        fi
    fi

    jq -n \
        --argjson up "$UP" \
        --argjson ml "$MODULE_LOADED" \
        --argjson hc "$HAS_CONFIG" \
        --argjson hw "$HAS_WG" \
        --argjson as "$AUTO_START" \
        --arg addr "$WG_ADDRESS" \
        --arg ep "$CONF_ENDPOINT" \
        --argjson iface "$IFACE_JSON" \
        --argjson peers "$PEERS_JSON" \
        '{"up":$up,"module_loaded":$ml,"has_config":$hc,"has_wg":$hw,"auto_start":$as,"address":$addr,"endpoint":$ep,"interface":$iface,"peers":$peers}'
    ;;

config)
    if [ ! -f "$WG_CONF" ]; then
        echo '{"error":"No WireGuard config found"}'
        exit 0
    fi

    jq -Rs '{"config":.}' "$WG_CONF"
    ;;

save)
    CONFIG=$(echo "$BODY" | jq -r '.config // empty')

    if [ -z "$CONFIG" ]; then
        echo '{"error":"No config provided"}'
        exit 0
    fi

    if ! echo "$CONFIG" | grep -q '^\[Interface\]'; then
        echo '{"error":"Invalid config: missing [Interface] section"}'
        exit 0
    fi

    mkdir -p "$(dirname "$WG_CONF")"
    printf '%s\n' "$CONFIG" > "$WG_CONF"
    chmod 0600 "$WG_CONF"

    if [ "$(is_wg_up)" = "1" ] && [ -x "$WG_BIN" ]; then
        "$WG_BIN" strip "$WG_CONF" | "$WG_BIN" syncconf "$IFACE" /dev/stdin 2>/dev/null
    fi

    printf '{"ok":true}'
    ;;

enable)
    if [ ! -f "$WG_CONF" ]; then
        echo '{"error":"No WireGuard config. Save config first."}'
        exit 0
    fi

    # Write VPN state and apply (stops SS if running, starts WG + route all)
    vpn_write "wg"
    "$VPN_APPLY" >/dev/null 2>&1

    UP=$(is_wg_up)
    printf '{"ok":true,"up":%d}' "$UP"
    ;;

disable)
    # Write VPN off and apply (stops WG, cleans routes)
    vpn_write "off"
    "$VPN_APPLY" >/dev/null 2>&1

    UP=$(is_wg_up)
    printf '{"ok":true,"up":%d}' "$UP"
    ;;

generate_key)
    if [ ! -x "$WG_BIN" ]; then
        echo '{"error":"wg binary not found"}'
        exit 0
    fi

    PRIVKEY=$("$WG_BIN" genkey 2>/dev/null)
    PUBKEY=$(echo "$PRIVKEY" | "$WG_BIN" pubkey 2>/dev/null)

    jq -n --arg priv "$PRIVKEY" --arg pub "$PUBKEY" \
        '{"private_key":$priv,"public_key":$pub}'
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
