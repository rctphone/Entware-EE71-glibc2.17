# cgi-common.sh — shared helpers for EE71 WebUI CGI scripts
#
# Sourced (not executed) by every *.cgi. Provides a single source of
# truth for CSRF/origin validation and SQLite access so the logic does
# not drift across 11 copies. Emits no output of its own — each CGI is
# responsible for its own Content-Type header.
#
# Usage (after printing the Content-Type header):
#     . /jrd-resource/resource/webrc/www/cgi-bin/lib/cgi-common.sh
#     csrf_check
#     val=$(db_get "ItemName")
#     db_set wifi_info "ItemName" "$val"

# Default DB path (overridable by the caller before sourcing)
DB="${DB:-/jrd-resource/resource/sqlite3/user_info.db3}"

# --- CSRF / origin check for POST requests ---
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

# --- SQLite helpers (single-quote escaped to survive special chars) ---
_sql_escape() {
    printf '%s' "$1" | sed "s/'/''/g"
}

# db_get <item> [table]   — read a value (default table: wifi_info)
db_get() {
    _item=$(_sql_escape "$1")
    _table="${2:-wifi_info}"
    sqlite3 "$DB" "SELECT value FROM ${_table} WHERE items='${_item}';" 2>/dev/null
}

# db_set <table> <item> <value>   — update a value, report failures
db_set() {
    _table="$1"
    _item=$(_sql_escape "$2")
    _value=$(_sql_escape "$3")
    sqlite3 "$DB" "UPDATE ${_table} SET value='${_value}' WHERE items='${_item}';" 2>/dev/null
    _rc=$?
    [ "$_rc" -eq 0 ] || echo "[ERR] db_set failed: ${_table}.$2" >&2
    return "$_rc"
}
