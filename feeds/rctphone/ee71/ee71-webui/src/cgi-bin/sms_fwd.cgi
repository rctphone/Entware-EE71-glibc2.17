#!/bin/sh
# sms_fwd.cgi — SMS forwarding configuration (Telegram + phone)
# GET: status, bot_info, recent_chats
# POST: save, test_telegram (with CSRF check)
echo "Content-Type: application/json"
echo ""

CONF_FILE="/etc/sms_forward.conf"
DAEMON_PID="/var/run/sms_forward.pid"

. /jrd-resource/resource/webrc/www/cgi-bin/lib/cgi-common.sh

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

telegram_error() {
    _msg="$1"
    case "$_msg" in
        *"Failed to connect to api.telegram.org port 443"*|*"Connection timed out"*|*"Operation timed out"*|*"curl: (28)"*)
            _msg="api.telegram.org:443 connection timed out after 3s. The current network/VPN path cannot complete a TCP connection to Telegram API."
            ;;
        "")
            _msg="api.telegram.org is unreachable or timed out"
            ;;
    esac
    jq -n --arg err "Telegram API: $_msg" '{error:$err}'
}

telegram_get() {
    _url="$1"
    curl -sS --connect-timeout 3 --max-time 5 --speed-limit 1 --speed-time 3 "$_url" 2>&1
}

json_sh_quote() {
    jq -Rn --arg v "$1" '$v|@sh'
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
    HAS_TOKEN=0
    [ -n "$TELEGRAM_BOT_TOKEN" ] && HAS_TOKEN=1

    jq -n \
        --argjson telegram_enabled "$TELEGRAM_ENABLED" \
        --arg telegram_bot_token "$MASKED_TOKEN" \
        --arg telegram_chat_id "$TELEGRAM_CHAT_ID" \
        --argjson phone_enabled "$PHONE_ENABLED" \
        --arg phone_target "$PHONE_TARGET" \
        --arg filter_numbers "$FILTER_NUMBERS" \
        --argjson running "$RUNNING" \
        --argjson has_token "$HAS_TOKEN" \
        '{telegram_enabled:$telegram_enabled,telegram_bot_token:$telegram_bot_token,telegram_chat_id:$telegram_chat_id,phone_enabled:$phone_enabled,phone_target:$phone_target,filter_numbers:$filter_numbers,running:$running,has_token:$has_token}'
    ;;

save)
    # Extract fields from JSON body
    TG_EN=$(echo "$BODY" | jq -r '.telegram_enabled // empty')
    TG_TOKEN=$(echo "$BODY" | jq -r '.telegram_bot_token // empty')
    TG_CHAT=$(echo "$BODY" | jq -r '.telegram_chat_id // empty')
    PH_EN=$(echo "$BODY" | jq -r '.phone_enabled // empty')
    PH_TARGET=$(echo "$BODY" | jq -r '.phone_target // empty')
    FILTER=$(echo "$BODY" | jq -r '.filter_numbers // empty')

    # Defaults
    [ "$TG_EN" = "1" ] || TG_EN=0
    [ "$PH_EN" = "1" ] || PH_EN=0

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

    if [ -n "$TG_CHAT" ]; then
        CLEAN_CHAT=$(printf '%s' "$TG_CHAT" | tr -cd '0-9-')
        if [ "$CLEAN_CHAT" != "$TG_CHAT" ]; then
            echo '{"error":"Chat ID contains invalid characters"}'; exit 0
        fi
    fi

    # Validate phone target (digits, +, spaces only)
    if [ -n "$PH_TARGET" ]; then
        CLEAN=$(printf '%s' "$PH_TARGET" | tr -cd '0-9+ ')
        PH_TARGET="$CLEAN"
    fi

    FILTER=$(printf '%s' "$FILTER" | tr -cd '0-9+ ,_-')

    # Write config
    QT_TOKEN=$(json_sh_quote "$TG_TOKEN")
    QT_CHAT=$(json_sh_quote "$TG_CHAT")
    QT_PHONE=$(json_sh_quote "$PH_TARGET")
    QT_FILTER=$(json_sh_quote "$FILTER")
    cat > "$CONF_FILE" <<EOF
TELEGRAM_ENABLED=$TG_EN
TELEGRAM_BOT_TOKEN=$QT_TOKEN
TELEGRAM_CHAT_ID=$QT_CHAT
PHONE_ENABLED=$PH_EN
PHONE_TARGET=$QT_PHONE
FILTER_NUMBERS=$QT_FILTER
EOF
    chmod 0600 "$CONF_FILE"

    # Restart/reload the actual forwarding daemon after config changes.
    if [ -x "/etc/init.d/sms_forward" ]; then
        /etc/init.d/sms_forward restart >/dev/null 2>&1
    fi

    printf '{"ok":true}'
    ;;

test_telegram)
    # Extract token and chat_id from POST body
    TG_TOKEN=$(echo "$BODY" | jq -r '.telegram_bot_token // empty')
    TG_CHAT=$(echo "$BODY" | jq -r '.telegram_chat_id // empty')

    if [ -z "$TG_TOKEN" ] && [ -f "$CONF_FILE" ]; then
        . "$CONF_FILE" 2>/dev/null
        TG_TOKEN="$TELEGRAM_BOT_TOKEN"
    fi

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
    RESULT=$(curl -sS --connect-timeout 3 --max-time 5 \
        --speed-limit 1 --speed-time 3 \
        "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
        -d "chat_id=${TG_CHAT}" \
        -d "text=${MSG}" \
        -d "parse_mode=HTML" 2>&1)
    CURL_RC=$?
    if [ "$CURL_RC" -ne 0 ]; then
        telegram_error "$RESULT"
        exit 0
    fi

    if echo "$RESULT" | jq -e '.ok == true' >/dev/null 2>&1; then
        printf '{"ok":true,"message":"Test message sent successfully"}'
    else
        ERR=$(echo "$RESULT" | jq -r '.description // "Unknown error"')
        telegram_error "$ERR"
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

    RESULT=$(telegram_get "https://api.telegram.org/bot${TOKEN}/getMe")
    CURL_RC=$?
    if [ "$CURL_RC" -ne 0 ]; then
        telegram_error "$RESULT"
        exit 0
    fi
    if echo "$RESULT" | jq -e '.ok == true' >/dev/null 2>&1; then
        USERNAME=$(echo "$RESULT" | jq -r '.result.username // empty')
        FIRST=$(echo "$RESULT" | jq -r '.result.first_name // empty')
        jq -n \
            --arg username "$USERNAME" \
            --arg first_name "$FIRST" \
            --arg link "https://t.me/$USERNAME" \
            '{ok:true,username:$username,first_name:$first_name,link:$link}'
    else
        ERR=$(echo "$RESULT" | jq -r '.description // "Unknown error"')
        telegram_error "$ERR"
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

    RESULT=$(telegram_get "https://api.telegram.org/bot${TOKEN}/getUpdates?limit=50")
    CURL_RC=$?
    if [ "$CURL_RC" -ne 0 ]; then
        telegram_error "$RESULT"
        exit 0
    fi
    if echo "$RESULT" | jq -e '.ok == true' >/dev/null 2>&1; then
        echo "$RESULT" | jq '{ok:true,chats:[.result[].message.chat // empty | {id:(.id|tostring),title:(.first_name // .title // "Unknown"),type:.type}] | unique_by(.id)}'
    else
        ERR=$(echo "$RESULT" | jq -r '.description // "Unknown error"')
        telegram_error "$ERR"
    fi
    ;;

config)
    # Full config for backup (unmasked token)
    read_conf
    jq -n \
        --argjson telegram_enabled "$TELEGRAM_ENABLED" \
        --arg telegram_bot_token "$TELEGRAM_BOT_TOKEN" \
        --arg telegram_chat_id "$TELEGRAM_CHAT_ID" \
        --argjson phone_enabled "$PHONE_ENABLED" \
        --arg phone_target "$PHONE_TARGET" \
        --arg filter_numbers "$FILTER_NUMBERS" \
        '{telegram_enabled:$telegram_enabled,telegram_bot_token:$telegram_bot_token,telegram_chat_id:$telegram_chat_id,phone_enabled:$phone_enabled,phone_target:$phone_target,filter_numbers:$filter_numbers}'
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
