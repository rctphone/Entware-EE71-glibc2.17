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
#     run_timeout 5 some_slow_command
#     with_lock vpn 30 /usr/bin/vpn_apply
#     json_err "something went wrong"

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

# --- Error reporting ---
# json_err <msg> — the single error shape for every CGI.
# Writes {"error":"<msg>"} to the client and "[ERR] <msg>" to the server
# log. Callers still decide whether to exit; this only emits.
json_err() {
    _je_msg="$1"
    [ -n "$_je_msg" ] || _je_msg="unknown error"
    echo "[ERR] ${_je_msg}" >&2
    # jq is the only safe JSON escaper here; if it is missing, emit a
    # fixed string rather than risk producing invalid JSON.
    jq -n --arg error "$_je_msg" '{"error":$error}' 2>/dev/null \
        || printf '{"error":"internal error"}'
}

# --- Bounded execution ---
# webs is single-threaded: a CGI that blocks blocks the entire UI. Every
# external command that talks to a device node, the network or another
# daemon must go through this.
#
# run_timeout <secs> <cmd> [args...]
# Returns the command's own exit status, except 124 when it was killed on
# timeout. BusyBox `timeout` exits 143 (128+TERM) / 137 (128+KILL); those
# are normalised to the GNU 124 convention so callers test one value.
run_timeout() {
    _rt_secs="$1"
    shift
    if [ -z "$_rt_secs" ] || [ "$#" -eq 0 ]; then
        echo "[ERR] run_timeout: usage: run_timeout <secs> <cmd> [args...]" >&2
        return 2
    fi
    if command -v timeout >/dev/null 2>&1; then
        timeout -k 2 "$_rt_secs" "$@"
        _rt_rc=$?
    else
        # No timeout applet — run unbounded rather than fail the request.
        # Moot on the main system (BusyBox 1.36.1 has it), but the recovery
        # partition ships BusyBox 1.20.2 with a different applet set, so
        # this branch is reachable there: the caller's bound silently
        # becomes no bound at all. The [ERR] line is the only warning.
        echo "[ERR] run_timeout: timeout applet missing, running unbounded" >&2
        "$@"
        _rt_rc=$?
    fi
    case "$_rt_rc" in
        137|143) return 124 ;;
    esac
    return "$_rt_rc"
}

# --- Serialisation ---
# with_lock <name> <wait_secs> <run_secs> <cmd> [args...]
# Serialise mutations of shared system state (VPN routing / iptables /
# dnsmasq reloads) across concurrent CGI requests.
#
# What this actually guarantees:
#   - waiting for the lock is bounded by <wait_secs>  -> returns 124
#   - running <cmd> is bounded by <run_secs>          -> returns 124
#   - the lock is released when the function returns, however it returns
# Worst-case wall time is wait_secs + run_secs. Both are the caller's to
# choose, so the total a request can cost is visible at the call site.
# Not guaranteed: <cmd> is signalled, not its grandchildren, and a command
# killed mid-flight can leave partial state — bounded, not transactional.
#
# WHY THE FILE-DESCRIPTOR FORM. `run_timeout N flock FILE CMD` does NOT
# bound CMD. BusyBox flock forks a child to exec CMD and blocks in
# waitpid(), so CMD is timeout's GRANDchild, one level too deep to be
# signalled — and the fd it inherited keeps the lock held. Measured on
# device: the wrapper returned 143 at 3 s while the command ran on to its
# natural 8 s end, with the lock held the whole time. Locking a descriptor
# instead puts no process between timeout and <cmd>.
# BusyBox flock has no -w, so the wait is bounded by timeout too; the lock
# lives on the open file description this shell holds, so it outlives the
# short-lived `flock -x 9` helper and drops when the subshell exits.
#
# The subshell is load-bearing, not style: a failed `exec 9>` terminates a
# non-interactive ash outright, which inside a CGI would cut the response
# off mid-flight. Contained here, it costs one degraded request instead.
with_lock() {
    _wl_name="$1"
    _wl_wait="$2"
    _wl_run="$3"
    shift 3
    _wl_file="/tmp/ee71-webui-${_wl_name}.lock"

    if ! command -v flock >/dev/null 2>&1; then
        echo "[ERR] with_lock: flock applet missing, running unserialised" >&2
        run_timeout "$_wl_run" "$@"
        return $?
    fi
    # Probe before the subshell so an unusable /tmp degrades to an
    # unserialised run instead of an ambiguous exit status.
    if ! : >>"$_wl_file" 2>/dev/null; then
        echo "[ERR] with_lock: cannot open ${_wl_file}, running unserialised" >&2
        run_timeout "$_wl_run" "$@"
        return $?
    fi

    (
        exec 9>>"$_wl_file"
        run_timeout "$_wl_wait" flock -x 9 || exit 124
        # 9>&- is what makes the run bound mean anything. Without it the
        # command and every descendant inherit fd 9, so a child that
        # outlives the TERM — an orphaned `sleep` under a killed shell,
        # say — keeps the lock held after this function has already
        # returned 124 and reported the switch abandoned. Measured: the
        # lock stayed held for the orphan's full lifetime. Closing the
        # descriptor for the command leaves this subshell the only holder,
        # so the lock is released exactly when the function returns.
        run_timeout "$_wl_run" "$@" 9>&-
    )
}
