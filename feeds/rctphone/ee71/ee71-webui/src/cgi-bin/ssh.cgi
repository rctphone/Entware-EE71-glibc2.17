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

json_escape_str() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/	/\\t/g' | tr '\n' '\n' | \
        awk 'NR>1{printf "\\n"}{printf "%s",$0}'
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

    # Key fingerprints
    KEYS_JSON="["
    FIRST=1
    for KTYPE in ed25519 rsa; do
        KFILE="/etc/dropbear/dropbear_${KTYPE}_host_key"
        if [ -f "$KFILE" ]; then
            FP=$(dropbearkey -y -f "$KFILE" 2>/dev/null | grep 'Fingerprint:' | sed 's/.*: //')
            if [ -n "$FP" ]; then
                [ "$FIRST" = "0" ] && KEYS_JSON="${KEYS_JSON},"
                FIRST=0
                KEYS_JSON="${KEYS_JSON}{\"type\":\"${KTYPE}\",\"fingerprint\":\"${FP}\"}"
            fi
        fi
    done
    KEYS_JSON="${KEYS_JSON}]"

    printf '{"running":%d,"pid":"%s","port":%d,"host_keys":%s}' \
        "$RUNNING" "$PID" "$PORT" "$KEYS_JSON"
    ;;

keys)
    # List authorized_keys
    echo "["
    FIRST=1
    if [ -f "$AUTH_KEYS" ]; then
        IDX=0
        while IFS= read -r LINE; do
            # Skip empty lines and comments
            case "$LINE" in ""|\#*) continue ;; esac
            [ "$FIRST" = "0" ] && printf ","
            FIRST=0
            TYPE=$(echo "$LINE" | awk '{print $1}')
            COMMENT=$(echo "$LINE" | awk '{for(i=3;i<=NF;i++) printf "%s ", $i}' | sed 's/ *$//')
            # Truncate key for display
            KEYPART=$(echo "$LINE" | awk '{print substr($2,1,20)}')
            printf '{"index":%d,"type":"%s","key_prefix":"%s...","comment":"%s"}' \
                "$IDX" "$TYPE" "$KEYPART" "$(json_escape_str "$COMMENT")"
            IDX=$((IDX + 1))
        done < "$AUTH_KEYS"
    fi
    echo "]"
    ;;

sessions)
    # Active SSH sessions from who/ps
    echo "["
    FIRST=1
    ps 2>/dev/null | grep 'dropbear' | grep -v grep | while IFS= read -r LINE; do
        PID=$(echo "$LINE" | awk '{print $1}')
        CMD=$(echo "$LINE" | awk '{for(i=5;i<=NF;i++) printf "%s ", $i}' | sed 's/ *$//')
        case "$CMD" in *"dropbear"*) ;; *) continue ;; esac
        [ "$FIRST" = "0" ] && printf ","
        FIRST=0
        printf '{"pid":%d,"cmd":"%s"}' "$PID" "$(json_escape_str "$CMD")"
    done
    echo "]"
    ;;

save)
    PORT=$(echo "$BODY" | sed -n 's/.*"port"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p')
    LISTEN=$(echo "$BODY" | sed -n 's/.*"listen"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
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
    printf '{"ok":true,"port":%d,"listen":"%s"}' "$PORT" "$LISTEN"
    ;;

add_key)
    KEY=$(echo "$BODY" | sed -n 's/.*"key"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
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
    INDEX=$(echo "$BODY" | sed -n 's/.*"index"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p')
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

*)
    printf '{"error":"unknown action"}'
    ;;
esac
