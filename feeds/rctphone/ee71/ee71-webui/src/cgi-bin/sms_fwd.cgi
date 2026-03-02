#!/bin/sh
# sms_fwd.cgi — SMS forwarding configuration (Telegram + phone)
# GET: status, bot_info, recent_chats
# POST: save, test_telegram (with CSRF check)
echo "Content-Type: application/json"
echo ""

CONF_FILE="/etc/sms_forward.conf"
DAEMON_PID="/var/run/sms_watchd.pid"

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

# --- Read config ---
read_conf() {
    TELEGRAM_ENABLED=0
    TELEGRAM_BOT_TOKEN=""
    TELEGRAM_CHAT_ID=""
    PHONE_ENABLED=0
    PHONE_TARGET=""
    FILTER_NUMBERS=""
    if [ -f "$CONF_FILE" ]; then
        . "$CONF_FILE"
    fi
}

# --- Helpers ---
json_escape() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/	/\\t/g'
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
    read_conf
    RUNNING=0
    if [ -f "$DAEMON_PID" ]; then
        PID=$(cat "$DAEMON_PID" 2>/dev/null)
        if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
            RUNNING=1
        fi
    fi
    # Mask bot token: show only last 4 chars (acceptance req 5.3)
    MASKED_TOKEN=""
    if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
        LAST4=$(printf '%s' "$TELEGRAM_BOT_TOKEN" | tail -c 4)
        MASKED_TOKEN="****${LAST4}"
    fi
    printf '{"telegram_enabled":%d,"telegram_bot_token":"%s","telegram_chat_id":"%s","phone_enabled":%d,"phone_target":"%s","filter_numbers":"%s","running":%d,"has_token":%d}' \
        "$TELEGRAM_ENABLED" \
        "$(json_escape "$MASKED_TOKEN")" \
        "$(json_escape "$TELEGRAM_CHAT_ID")" \
        "$PHONE_ENABLED" \
        "$(json_escape "$PHONE_TARGET")" \
        "$(json_escape "$FILTER_NUMBERS")" \
        "$RUNNING" \
        "$([ -n "$TELEGRAM_BOT_TOKEN" ] && echo 1 || echo 0)"
    ;;

save)
    # Extract fields from JSON body
    TG_EN=$(echo "$BODY" | sed -n 's/.*"telegram_enabled"[[:space:]]*:[[:space:]]*\([01]\).*/\1/p')
    TG_TOKEN=$(echo "$BODY" | sed -n 's/.*"telegram_bot_token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    TG_CHAT=$(echo "$BODY" | sed -n 's/.*"telegram_chat_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    PH_EN=$(echo "$BODY" | sed -n 's/.*"phone_enabled"[[:space:]]*:[[:space:]]*\([01]\).*/\1/p')
    PH_TARGET=$(echo "$BODY" | sed -n 's/.*"phone_target"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    FILTER=$(echo "$BODY" | sed -n 's/.*"filter_numbers"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

    # Defaults
    TG_EN="${TG_EN:-0}"
    PH_EN="${PH_EN:-0}"

    # If token is empty, keep existing one from config
    if [ -z "$TG_TOKEN" ] && [ -f "$CONF_FILE" ]; then
        . "$CONF_FILE" 2>/dev/null
        TG_TOKEN="$TELEGRAM_BOT_TOKEN"
    fi

    # Validate bot token format: digits:alphanumeric-underscore-dash (e.g. 123456:ABC-DEF_ghi)
    if [ "$TG_EN" = "1" ] && [ -n "$TG_TOKEN" ]; then
        CLEAN_TOKEN=$(printf '%s' "$TG_TOKEN" | tr -cd '0-9A-Za-z:_-')
        if [ "$CLEAN_TOKEN" != "$TG_TOKEN" ]; then
            echo '{"error":"Token contains invalid characters"}'; exit 0
        fi
        case "$TG_TOKEN" in
            [0-9][0-9]*:[A-Za-z0-9_-]*) ;; # digits:alphanumeric_underscore-dash
            *) echo '{"error":"Invalid bot token format (expected digits:chars)"}'; exit 0 ;;
        esac
    fi

    # Validate phone target (digits, +, spaces only)
    if [ -n "$PH_TARGET" ]; then
        CLEAN=$(printf '%s' "$PH_TARGET" | tr -cd '0-9+ ')
        PH_TARGET="$CLEAN"
    fi

    # Write config
    cat > "$CONF_FILE" <<EOF
TELEGRAM_ENABLED=$TG_EN
TELEGRAM_BOT_TOKEN="$TG_TOKEN"
TELEGRAM_CHAT_ID="$TG_CHAT"
PHONE_ENABLED=$PH_EN
PHONE_TARGET="$PH_TARGET"
FILTER_NUMBERS="$FILTER"
EOF
    chmod 0600 "$CONF_FILE"

    # Restart daemon if running
    if [ -f "$DAEMON_PID" ]; then
        PID=$(cat "$DAEMON_PID" 2>/dev/null)
        if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
            kill "$PID" 2>/dev/null
            sleep 1
            # Daemon should auto-restart via init script or we start it
            if [ -x "/etc/init.d/ee71_webui" ]; then
                /etc/init.d/ee71_webui start >/dev/null 2>&1
            fi
        fi
    fi

    printf '{"ok":true}'
    ;;

test_telegram)
    # Extract token and chat_id from POST body
    TG_TOKEN=$(echo "$BODY" | sed -n 's/.*"telegram_bot_token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    TG_CHAT=$(echo "$BODY" | sed -n 's/.*"telegram_chat_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

    if [ -z "$TG_TOKEN" ] || [ -z "$TG_CHAT" ]; then
        echo '{"error":"Bot token and chat ID required"}'
        exit 0
    fi

    # Validate token format
    case "$TG_TOKEN" in
        [0-9]*:*) ;;
        *) echo '{"error":"Invalid bot token format"}'; exit 0 ;;
    esac

    # Send test message
    MSG="EE71 SMS Forward test message. If you see this, forwarding is configured correctly."
    RESULT=$(curl -s -m 10 \
        "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
        -d "chat_id=${TG_CHAT}" \
        -d "text=${MSG}" \
        -d "parse_mode=HTML" 2>&1)

    if echo "$RESULT" | grep -q '"ok":true'; then
        printf '{"ok":true,"message":"Test message sent successfully"}'
    else
        ERR=$(echo "$RESULT" | sed -n 's/.*"description"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
        ERR="${ERR:-Unknown error}"
        printf '{"error":"Telegram API: %s"}' "$(json_escape "$ERR")"
    fi
    ;;

bot_info)
    # Get bot info from saved config or query string
    read_conf
    TOKEN="${TELEGRAM_BOT_TOKEN}"

    # Allow override from query string
    QS_TOKEN=$(echo "$QUERY_STRING" | sed -n 's/.*token=\([^&]*\).*/\1/p')
    if [ -n "$QS_TOKEN" ]; then
        TOKEN="$QS_TOKEN"
    fi

    if [ -z "$TOKEN" ]; then
        echo '{"error":"No bot token configured"}'
        exit 0
    fi

    RESULT=$(curl -s -m 10 "https://api.telegram.org/bot${TOKEN}/getMe" 2>&1)
    if echo "$RESULT" | grep -q '"ok":true'; then
        USERNAME=$(echo "$RESULT" | sed -n 's/.*"username"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
        FIRST=$(echo "$RESULT" | sed -n 's/.*"first_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
        printf '{"ok":true,"username":"%s","first_name":"%s","link":"https://t.me/%s"}' \
            "$(json_escape "$USERNAME")" "$(json_escape "$FIRST")" "$(json_escape "$USERNAME")"
    else
        ERR=$(echo "$RESULT" | sed -n 's/.*"description"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
        printf '{"error":"Telegram API: %s"}' "$(json_escape "${ERR:-Unknown error}")"
    fi
    ;;

recent_chats)
    read_conf
    TOKEN="${TELEGRAM_BOT_TOKEN}"

    QS_TOKEN=$(echo "$QUERY_STRING" | sed -n 's/.*token=\([^&]*\).*/\1/p')
    if [ -n "$QS_TOKEN" ]; then
        TOKEN="$QS_TOKEN"
    fi

    if [ -z "$TOKEN" ]; then
        echo '{"error":"No bot token configured"}'
        exit 0
    fi

    RESULT=$(curl -s -m 10 "https://api.telegram.org/bot${TOKEN}/getUpdates?limit=50" 2>&1)
    if echo "$RESULT" | grep -q '"ok":true'; then
        # Extract unique chat IDs and names using sed/awk
        # Output: [{"id":"123","title":"Chat Name","type":"private"}, ...]
        # Simple approach: extract chat objects
        printf '{"ok":true,"chats":['
        FIRST_CHAT=1
        SEEN_IDS=""
        # Parse each chat block - extract id, first_name/title, type
        echo "$RESULT" | tr '{}' '\n' | grep '"chat"' | while IFS= read -r LINE; do
            CHAT_ID=$(echo "$LINE" | sed -n 's/.*"id"[[:space:]]*:[[:space:]]*\(-\{0,1\}[0-9]*\).*/\1/p')
            [ -z "$CHAT_ID" ] && continue
            # Skip if already seen
            echo "$SEEN_IDS" | grep -qF "|${CHAT_ID}|" && continue
            SEEN_IDS="${SEEN_IDS}|${CHAT_ID}|"

            CHAT_TYPE=$(echo "$LINE" | sed -n 's/.*"type"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
            CHAT_TITLE=$(echo "$LINE" | sed -n 's/.*"first_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
            [ -z "$CHAT_TITLE" ] && CHAT_TITLE=$(echo "$LINE" | sed -n 's/.*"title"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
            CHAT_TITLE="${CHAT_TITLE:-Unknown}"

            if [ "$FIRST_CHAT" = "1" ]; then
                FIRST_CHAT=0
            else
                printf ','
            fi
            printf '{"id":"%s","title":"%s","type":"%s"}' \
                "$(json_escape "$CHAT_ID")" "$(json_escape "$CHAT_TITLE")" "$(json_escape "$CHAT_TYPE")"
        done
        printf ']}'
    else
        ERR=$(echo "$RESULT" | sed -n 's/.*"description"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
        printf '{"error":"Telegram API: %s"}' "$(json_escape "${ERR:-Unknown error}")"
    fi
    ;;

config)
    # Full config for backup (unmasked token)
    read_conf
    printf '{"telegram_enabled":%d,"telegram_bot_token":"%s","telegram_chat_id":"%s","phone_enabled":%d,"phone_target":"%s","filter_numbers":"%s"}' \
        "$TELEGRAM_ENABLED" \
        "$(json_escape "$TELEGRAM_BOT_TOKEN")" \
        "$(json_escape "$TELEGRAM_CHAT_ID")" \
        "$PHONE_ENABLED" \
        "$(json_escape "$PHONE_TARGET")" \
        "$(json_escape "$FILTER_NUMBERS")"
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
