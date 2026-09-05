#!/bin/sh
# ssh.cgi — Dropbear SSH management
# GET: status, keys, sessions (read-only)
# POST: save, add_key, remove_key (with CSRF check)
echo "Content-Type: application/json"
echo ""

DROPBEAR_CONF="/etc/default/dropbear"
AUTH_KEYS="/etc/dropbear/authorized_keys"

. /jrd-resource/resource/webrc/www/cgi-bin/lib/cgi-common.sh

# One authorized_keys line: accepted key types only.
#
# Must be called per LINE, never on a whole blob. Shell `case` globs match
# across newlines, so `case "$BLOB" in ssh-ed25519\ *)` succeeds when only the
# FIRST line is a key and everything after it is arbitrary — which is how
# add_key used to validate one line and then append all of them.
valid_key_line() {
    case "$1" in
        ssh-ed25519\ *|ssh-rsa\ *|ecdsa-sha2-*|sk-*) return 0 ;;
        *) return 1 ;;
    esac
}

# True when $1 contains a newline. `wc -l` counts newline characters, so a
# single unterminated line gives 0. Avoids embedding a literal newline in a
# case pattern, which is easy to get subtly wrong in ash.
has_newline() {
    [ "$(printf '%s' "$1" | wc -l | tr -d ' ')" -gt 0 ]
}

# True when the file names at least one usable key. Blank lines and comments
# do not count - "# nothing" is not a key.
has_usable_key() {
	[ -f "$1" ] || return 1
	grep -qvE '^[[:space:]]*($|#)' "$1"
}

# This device authenticates with keys only: dropbear runs with -s, from
# DROPBEAR_EXTRA_ARGS in /etc/default/dropbear, so password login is off. An
# authorized_keys with no keys in it is therefore a PERMANENT lockout,
# recoverable only over ADB with the case open. Both paths that can empty the
# file ask this first, and both take {"force":true} for someone who means it.
would_lock_out() {
	# $1: path to the candidate file. Locked out iff it holds no usable key
	# AND passwords are disabled.
	has_usable_key "$1" && return 1
	grep -q '^[[:space:]]*DROPBEAR_EXTRA_ARGS=.*-s' /etc/default/dropbear 2>/dev/null
}

# Is something LISTENING on the SSH port?
#
# `pidof dropbear` is not the right question: it matches the per-session child
# processes too, so an old connection that survived a stop makes it succeed for
# a listener that never came up. Ask about the socket instead - that is the
# thing "SSH works" actually means.
ssh_listening() {
	_port="$1"
	_out=$(netstat -ltn 2>/dev/null)
	if [ -n "$_out" ]; then
		# netstat answered: trust it, including when it says no.
		printf '%s\n' "$_out" | grep -qE "[:.]${_port}[[:space:]]"
		return $?
	fi
	# Only when netstat is missing or produced nothing at all: fall back to the
	# weaker test rather than reporting a failure that may not be one.
	#
	# The first version fell back whenever the GREP failed, which is precisely
	# the "not listening" case - so it answered "listening" for every port, and
	# my own test caught it saying that about 2222.
	pidof dropbear >/dev/null 2>&1
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
        # dropbear's -p takes [address:]port, and `save` writes exactly that
        # form. Keep only the port: the whole value used to go to
        # `jq --argjson port`, which demands valid JSON, so as soon as a listen
        # address was configured jq exited non-zero and printed nothing - the
        # CGI returned headers with an EMPTY BODY and the panel's JSON.parse
        # threw. The two halves disagreed: save wrote addr:port, status could
        # only read a bare integer.
        PORT="${PORT##*:}"
        case "$PORT" in
            ''|*[!0-9]*) PORT=22 ;;
        esac
    fi

    # Key fingerprints — build array with jq
    KEYS_JSON="["
    FIRST=1
    for KTYPE in ed25519 rsa; do
        KFILE="/etc/dropbear/dropbear_${KTYPE}_host_key"
        if [ -f "$KFILE" ]; then
            # dropbearkey can sit on a truncated/corrupt key file.
            FP=$(run_timeout 5 dropbearkey -y -f "$KFILE" 2>/dev/null \
                | grep 'Fingerprint:' | sed 's/.*: //')
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
    # Digits FIRST, with a glob, before any arithmetic test touches the value.
    #
    # The previous guard was
    #     [ -z "$PORT" ] || [ "$PORT" -lt 1 ] 2>/dev/null || [ "$PORT" -gt 65535 ] 2>/dev/null
    # and it accepted everything that was not a number. On a non-numeric operand
    # ash's `[` exits 2, not 1; inside an || chain any non-zero status is false,
    # so the chain fell through to the else branch and the value was taken. The
    # `2>/dev/null` that was there to hide the "Illegal number" noise is exactly
    # what turned the error into an accept. Confirmed on the device's own ash:
    # `[ "abc" -lt 1 ] 2>/dev/null; echo $?` prints 2, and the whole guard
    # accepted both "abc" and a string containing a quote and a semicolon.
    #
    # That matters more than a malformed port, because the value is written to
    # /etc/default/dropbear, which the init script SOURCES as root at every
    # boot. An unvalidated port is a persistent root-command sink, reachable by
    # anyone who can authenticate to the web API.
    case "$PORT" in
        ''|*[!0-9]*)
            json_err "port must be a number between 1 and 65535"
            exit 0 ;;
    esac

    # Strip leading zeros so the daemon and the firewall rule agree on the same
    # literal, then BOUND THE LENGTH before any arithmetic runs.
    #
    # The length check is the point. `[ "$n" -gt 65535 ]` on a number ash
    # cannot represent exits 2 with "out of range", not 1 — and inside an
    # `if A || B` that is falsy, so the range test passed everything above
    # about 19 digits. Measured on the device: 99999999999999999999 sailed
    # through and would have been written to /etc/default/dropbear, which
    # dropbear.init sources as root.
    #
    # That is the SAME defect as the original `[ "abc" -lt 1 ]` guard, which
    # also exited 2 and was also read as false. Fixing the first form without
    # fixing the second only raised the length of input needed. A port is at
    # most five digits, so checking that first makes the arithmetic safe by
    # construction rather than by hoping the operand is representable.
    PORT=$(printf '%s' "$PORT" | sed 's/^0*//')
    [ -n "$PORT" ] || PORT=0
    if [ "${#PORT}" -gt 5 ]; then
        json_err "port must be a number between 1 and 65535"
        exit 0
    fi
    if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
        json_err "port must be a number between 1 and 65535"
        exit 0
    fi

    # Build listen arg: -p [addr:]port
    LISTEN_ARG="$PORT"
    if [ -n "$LISTEN" ]; then
        # An address may only be hex digits, dots and colons - enough for IPv4,
        # IPv6 and nothing else. Rejecting loudly rather than silently dropping
        # the address: quietly binding every interface when the caller asked for
        # one is the wrong direction to fail in.
        case "$LISTEN" in
            *[!0-9A-Fa-f.:]*)
                json_err "listen address may contain only hex digits, dots and colons"
                exit 0 ;;
        esac
        LISTEN_ARG="${LISTEN}:${PORT}"
    fi

    # The port belongs in /etc/default/dropbear, which the init script sources.
    #
    # This used to `sed -i "s/-p [^ ]*/-p $LISTEN_ARG/"` the init script itself,
    # which was destructive in three ways at once. sed replaces the FIRST match
    # per line, and the script's first `-p ` is rarely the daemon's: on the
    # gen_keys line it is `mkdir -p "$DROPBEAR_KEYDIR"`, and on every firewall
    # line it is `-p tcp`. Saving once would have turned the key directory into
    # a directory named after the port and every iptables rule into
    # `-p <port>`, an invalid protocol - so under an INPUT policy of DROP the
    # device would have had no SSH ACCEPT rule at all. It also never survived a
    # package upgrade, since the init script is package-owned.
    #
    # Stop BEFORE writing the new port, so fw_close still sees the old one and
    # removes the rules it actually installed; then start with the new port so
    # fw_open opens it. Doing it in the other order strands an ACCEPT for the
    # old port and never opens the new one.
    if [ -x /etc/init.d/dropbear ]; then
        run_timeout 15 /etc/init.d/dropbear stop >/dev/null 2>&1
    fi

    DEF=/etc/default/dropbear
    touch "$DEF" 2>/dev/null
    # Keep the previous file so a failed start can be undone. Without this a
    # value that passes validation but that dropbear refuses leaves SSH down
    # and the config changed - the caller asked to move the port, not to lose
    # the device.
    DEF_BAK="${DEF}.rollback"
    cp -f "$DEF" "$DEF_BAK" 2>/dev/null
    # The port we are rolling back TO, so the error can name it. 22 is the
    # init script's own default when the file says nothing.
    OLD_PORT=$(sed -n 's/^[[:space:]]*DROPBEAR_PORT="\{0,1\}\([^"]*\)"\{0,1\}.*/\1/p' "$DEF" 2>/dev/null | tail -1)
    OLD_PORT="${OLD_PORT##*:}"
    case "$OLD_PORT" in ''|*[!0-9]*) OLD_PORT=22 ;; esac
    DEF_TMP="${DEF}.new"
    grep -v '^[[:space:]]*DROPBEAR_PORT=' "$DEF" 2>/dev/null > "$DEF_TMP"
    printf 'DROPBEAR_PORT="%s"\n' "$LISTEN_ARG" >> "$DEF_TMP"
    mv -f "$DEF_TMP" "$DEF"

    # Bounded: dropbear generates host keys on first run and can block on
    # a starved entropy pool, which would freeze the whole server.
    run_timeout 15 /etc/init.d/dropbear start >/dev/null 2>&1
    DB_RC=$?
    if [ "$DB_RC" -eq 124 ]; then
        json_err "dropbear did not start on $LISTEN_ARG within 15s"
        exit 0
    fi

    # Only 124 used to be inspected, so a dropbear that refused the arguments
    # and exited immediately still produced {"ok":true} - the UI reported
    # success while SSH was gone and the firewall had no rule for either port.
    # Check the daemon is actually there before saying so.
    if ! ssh_listening "$PORT"; then
        # Put the old configuration back and try again, rather than reporting a
        # failure and leaving the owner locked out of their own router.
        if [ -f "$DEF_BAK" ]; then
            mv -f "$DEF_BAK" "$DEF"
            run_timeout 15 /etc/init.d/dropbear start >/dev/null 2>&1
        fi
        if ssh_listening "$OLD_PORT"; then
            json_err "dropbear refused $LISTEN_ARG - the previous setting has been restored and SSH is back up on port $OLD_PORT"
        else
            json_err "dropbear refused $LISTEN_ARG and did not come back on the previous setting - SSH is down; reconnect over ADB and run /etc/init.d/dropbear start"
        fi
        exit 0
    fi
    rm -f "$DEF_BAK"
    jq -n --argjson port "$PORT" --arg listen "$LISTEN" \
        '{"ok":true,"port":$port,"listen":$listen}'
    ;;

add_key)
    KEY=$(echo "$BODY" | jq -r '.key // empty')
    if [ -z "$KEY" ]; then
        printf '{"error":"key required"}'
        exit 0
    fi
    # One key per request. Without this, a .key holding embedded newlines
    # passed validation on its first line and was then appended whole, so
    # every following line landed in authorized_keys unchecked.
    if has_newline "$KEY"; then
        json_err "one key per request — the key must not contain newlines"
        exit 0
    fi

    if ! valid_key_line "$KEY"; then
        printf '{"error":"invalid key format (must start with ssh-ed25519, ssh-rsa, ecdsa-sha2-, or sk-)"}'
        exit 0
    fi

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
        FORCE=$(echo "$BODY" | jq -r '.force // empty')
        if [ "$FORCE" != "true" ] && would_lock_out "$TMP"; then
            rm -f "$TMP"
            json_err "refusing: that is the last key, and password login is off (-s) — you would be locked out with only ADB left. Send force:true if you mean it."
            exit 0
        fi
        chmod 600 "$TMP" 2>/dev/null
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
    if [ -z "$KEYS" ]; then
        printf '{"error":"no keys provided"}'
        exit 0
    fi

    # A restore is legitimately multi-line, so unlike add_key it cannot just
    # refuse newlines - every line has to be checked instead. Blank lines and
    # comments are kept; anything else must be a key we recognise.
    #
    # Validate into a temp file and move it into place only if the whole set
    # passes, so a bad restore cannot leave authorized_keys half-written -
    # which for this file means locking the owner out or letting a rejected
    # key through in the same breath.
    mkdir -p /etc/dropbear
    RK_TMP=/etc/dropbear/.authorized_keys.new
    : > "$RK_TMP"
    chmod 600 "$RK_TMP" 2>/dev/null
    RK_LINE=0
    RK_BAD=""
    printf '%s\n' "$KEYS" > "$RK_TMP.raw"
    # Redirected, not piped: a `while ... | ...` would run in a subshell and
    # RK_BAD would be lost the moment the loop ended.
    while IFS= read -r line; do
        RK_LINE=$((RK_LINE + 1))
        case "$line" in
            ''|'#'*) continue ;;
        esac
        if ! valid_key_line "$line"; then
            RK_BAD="$RK_LINE"
            break
        fi
    done < "$RK_TMP.raw"

    if [ -n "$RK_BAD" ]; then
        rm -f "$RK_TMP" "$RK_TMP.raw"
        json_err "line $RK_BAD is not a recognised key — nothing was written"
        exit 0
    fi

    mv -f "$RK_TMP.raw" "$RK_TMP"
    chmod 600 "$RK_TMP" 2>/dev/null

    # Every line passing the format check does not mean any key survived:
    # blanks and comments are kept deliberately, so {"keys":"# nothing"} got
    # this far and was moved over the live file.
    RK_FORCE=$(echo "$BODY" | jq -r '.force // empty')
    if [ "$RK_FORCE" != "true" ] && would_lock_out "$RK_TMP"; then
        rm -f "$RK_TMP"
        json_err "refusing: that restore contains no keys, and password login is off (-s) — you would be locked out with only ADB left. Send force:true if you mean it."
        exit 0
    fi

    mv -f "$RK_TMP" /etc/dropbear/authorized_keys
    chmod 600 /etc/dropbear/authorized_keys
    printf '{"ok":true}'
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
