#!/bin/sh
# ssh.cgi — Dropbear SSH management
# GET: status, keys, sessions (read-only)
# POST: save, add_key, remove_key (with CSRF check)
echo "Content-Type: application/json"
echo ""

DROPBEAR_CONF="/etc/default/dropbear"
AUTH_KEYS="/etc/dropbear/authorized_keys"

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
    # Check if dropbear is running
    PID=$(pidof dropbear 2>/dev/null || echo "")
    RUNNING=0
    [ -n "$PID" ] && RUNNING=1

    # Get port from running process or config
    PORT=22
    if [ -n "$PID" ]; then
        PORT=$(cat /proc/"$(echo $PID | awk '{print $1}')"/cmdline 2>/dev/null | tr '\0' '\n' | grep -A1 '^-p$' | tail -1)
        [ -z "$PORT" ] && PORT=22
    fi

    # Key fingerprints — build array with jq
    KEYS_JSON="["
    FIRST=1
    for KTYPE in ed25519 rsa; do
        KFILE="/etc/dropbear/dropbear_${KTYPE}_host_key"
        if [ -f "$KFILE" ]; then
            FP=$(dropbearkey -y -f "$KFILE" 2>/dev/null | grep 'Fingerprint:' | sed 's/.*: //')
            if [ -n "$FP" ]; then
                ENTRY=$(jq -n --arg type "$KTYPE" --arg fp "$FP" \
                    '{"type":$type,"fingerprint":$fp}')
                [ "$FIRST" = "0" ] && KEYS_JSON="${KEYS_JSON},"
                FIRST=0
                KEYS_JSON="${KEYS_JSON}${ENTRY}"
            fi
        fi
    done
    KEYS_JSON="${KEYS_JSON}]"

    jq -n --argjson running "$RUNNING" --arg pid "$PID" \
        --argjson port "$PORT" --argjson host_keys "$KEYS_JSON" \
        '{"running":$running,"pid":$pid,"port":$port,"host_keys":$host_keys}'
    ;;

keys)
    # List authorized_keys — build array with jq
    RESULT="["
    FIRST=1
    if [ -f "$AUTH_KEYS" ]; then
        IDX=0
        while IFS= read -r LINE; do
            # Skip empty lines and comments
            case "$LINE" in ""|\#*) continue ;; esac
            TYPE=$(echo "$LINE" | awk '{print $1}')
            COMMENT=$(echo "$LINE" | awk '{for(i=3;i<=NF;i++) printf "%s ", $i}' | sed 's/ *$//')
            KEYPART=$(echo "$LINE" | awk '{print substr($2,1,20)}')
            ENTRY=$(jq -n --argjson idx "$IDX" --arg type "$TYPE" \
                --arg kp "${KEYPART}..." --arg comment "$COMMENT" \
                '{"index":$idx,"type":$type,"key_prefix":$kp,"comment":$comment}')
            [ "$FIRST" = "0" ] && RESULT="${RESULT},"
            FIRST=0
            RESULT="${RESULT}${ENTRY}"
            IDX=$((IDX + 1))
        done < "$AUTH_KEYS"
    fi
    RESULT="${RESULT}]"
    printf '%s' "$RESULT"
    ;;

sessions)
    # Active SSH sessions from ps
    ps 2>/dev/null | grep 'dropbear' | grep -v grep | while IFS= read -r LINE; do
        PID=$(echo "$LINE" | awk '{print $1}')
        CMD=$(echo "$LINE" | awk '{for(i=5;i<=NF;i++) printf "%s ", $i}' | sed 's/ *$//')
        case "$CMD" in *"dropbear"*) ;; *) continue ;; esac
        jq -n --argjson pid "$PID" --arg cmd "$CMD" \
            '{"pid":$pid,"cmd":$cmd}'
    done > /tmp/cgi_sessions.$$
    jq -s '.' /tmp/cgi_sessions.$$ 2>/dev/null || echo "[]"
    rm -f /tmp/cgi_sessions.$$
    ;;

save)
    PORT=$(echo "$BODY" | jq -r '.port // empty')
    LISTEN=$(echo "$BODY" | jq -r '.listen // empty')
    if [ -z "$PORT" ] || [ "$PORT" -lt 1 ] 2>/dev/null || [ "$PORT" -gt 65535 ] 2>/dev/null; then
        printf '{"error":"port must be 1-65535"}'
        exit 0
    fi

    # Build listen arg: -p [addr:]port
    LISTEN_ARG="$PORT"
    if [ -n "$LISTEN" ]; then
        # Validate: alphanumeric, dots, colons only
        CLEAN=$(printf '%s' "$LISTEN" | tr -cd 'a-zA-Z0-9.:')
        if [ "$CLEAN" = "$LISTEN" ]; then
            LISTEN_ARG="${LISTEN}:${PORT}"
        fi
    fi

    # Update dropbear init with new port/listen
    if [ -f /etc/init.d/dropbear ]; then
        sed -i "s/-p [^ ]*/-p $LISTEN_ARG/" /etc/init.d/dropbear 2>/dev/null
    fi

    # Restart dropbear on new port (safe: start new first, then stop old)
    dropbear -p "$LISTEN_ARG" 2>/dev/null
    jq -n --argjson port "$PORT" --arg listen "$LISTEN" \
        '{"ok":true,"port":$port,"listen":$listen}'
    ;;

add_key)
    KEY=$(echo "$BODY" | jq -r '.key // empty')
    if [ -z "$KEY" ]; then
        printf '{"error":"key required"}'
        exit 0
    fi
    # Validate key format
    case "$KEY" in
        ssh-ed25519\ *|ssh-rsa\ *|ecdsa-sha2-*|sk-*) ;;
        *) printf '{"error":"invalid key format (must start with ssh-ed25519, ssh-rsa, ecdsa-sha2-, or sk-)"}'; exit 0 ;;
    esac

    # Append to authorized_keys
    mkdir -p "$(dirname "$AUTH_KEYS")" 2>/dev/null
    echo "$KEY" >> "$AUTH_KEYS"
    chmod 600 "$AUTH_KEYS" 2>/dev/null

    printf '{"ok":true}'
    ;;

remove_key)
    INDEX=$(echo "$BODY" | jq -r '.index // empty')
    if [ -z "$INDEX" ]; then
        printf '{"error":"index required"}'
        exit 0
    fi

    if [ ! -f "$AUTH_KEYS" ]; then
        printf '{"error":"no authorized_keys file"}'
        exit 0
    fi

    # Remove line at index (0-based, skipping empty/comment lines)
    TMP=$(mktemp)
    IDX=0
    REMOVED=0
    while IFS= read -r LINE; do
        case "$LINE" in ""|\#*)
            echo "$LINE" >> "$TMP"
            continue
            ;;
        esac
        if [ "$IDX" = "$INDEX" ]; then
            REMOVED=1
        else
            echo "$LINE" >> "$TMP"
        fi
        IDX=$((IDX + 1))
    done < "$AUTH_KEYS"

    if [ "$REMOVED" = "1" ]; then
        mv "$TMP" "$AUTH_KEYS"
        chmod 600 "$AUTH_KEYS" 2>/dev/null
        printf '{"ok":true}'
    else
        rm -f "$TMP"
        printf '{"error":"key index not found"}'
    fi
    ;;

restore-keys)
    # Restore authorized_keys from backup
    KEYS=$(echo "$BODY" | jq -r '.keys // empty')
    if [ -n "$KEYS" ]; then
        mkdir -p /etc/dropbear
        printf '%s\n' "$KEYS" > /etc/dropbear/authorized_keys
        chmod 600 /etc/dropbear/authorized_keys
        printf '{"ok":true}'
    else
        printf '{"error":"no keys provided"}'
    fi
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
