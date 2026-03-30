#!/bin/sh
# usb.cgi — USB composition management
# GET: status, compositions, kernel_table (read-only)
# POST: set (with CSRF check)
echo "Content-Type: application/json"
echo ""

COMP_DIR="/sbin/usb/compositions"
USB_CONF="/usb_conf/usb_config.ini"
PATCH_CONF="/usb_conf/usb_patch.conf"

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
    # Current USB PID
    PID=$(cat /sys/class/android_usb/android0/idProduct 2>/dev/null || echo "unknown")
    ENABLED=$(cat /sys/class/android_usb/android0/enable 2>/dev/null || echo "0")
    FUNCS=$(cat /sys/class/android_usb/android0/functions 2>/dev/null || echo "")
    SERIAL=$(cat /sys/class/android_usb/android0/iSerial 2>/dev/null || echo "")

    # Current config from usb_config.ini
    CONF_PID=""
    if [ -f "$USB_CONF" ]; then
        CONF_PID=$(grep 'usb_config_value=' "$USB_CONF" 2>/dev/null | head -1 | sed 's/.*=//')
    fi

    jq -n --arg pid "$PID" --argjson enabled "$ENABLED" \
        --arg funcs "$FUNCS" --arg serial "$SERIAL" --arg conf_pid "$CONF_PID" \
        '{"pid":$pid,"enabled":$enabled,"functions":$funcs,"serial":$serial,"config_pid":$conf_pid}'
    ;;

compositions)
    # List available composition scripts — build array with jq
    RESULT="["
    FIRST=1
    if [ -d "$COMP_DIR" ]; then
        for F in "$COMP_DIR"/*; do
            [ ! -f "$F" ] && continue
            NAME=$(basename "$F")
            # Skip internal/empty compositions
            case "$NAME" in empty|hsic_next|hsusb_next) continue ;; esac
            # Extract DESCRIPTION comment
            DESC=$(grep '# DESCRIPTION:' "$F" 2>/dev/null | head -1 | sed 's/.*DESCRIPTION:[[:space:]]*//')
            # PID: try idProduct grep (quoted or unquoted), fallback to filename
            CPID=$(grep 'idProduct' "$F" 2>/dev/null | head -1 | sed -n 's/.*[" ]\([0-9A-Fa-f]\{3,\}\).*/\1/p')
            [ -z "$CPID" ] && CPID=$(echo "$NAME" | sed 's/^1BBB_//')
            # Functions: try quoted, then unquoted (echo funcs > .../functions)
            CFUNCS=$(grep '/functions' "$F" 2>/dev/null | head -1 | sed -n 's/.*echo[[:space:]]*"\{0,1\}\([^">]*\)"\{0,1\}[[:space:]]*>.*/\1/p')
            # Use functions as fallback description if no DESCRIPTION comment
            if [ -z "$DESC" ] && [ -n "$CFUNCS" ]; then
                DESC=$(echo "$CFUNCS" | sed 's/,/ + /g; s/_qc//g; s/ffs/ADB/g; s/diag/DIAG/g; s/serial/Serial/g; s/rndis/RNDIS/g; s/ecm/ECM/g; s/mass_storage/Mass Storage/g; s/rmnet/RMNET/g; s/ncm/NCM/g')
            fi
            ENTRY=$(jq -n --arg name "$NAME" --arg pid "$CPID" \
                --arg funcs "$CFUNCS" --arg desc "$DESC" \
                '{"name":$name,"pid":$pid,"functions":$funcs,"desc":$desc}')
            [ "$FIRST" = "0" ] && RESULT="${RESULT},"
            FIRST=0
            RESULT="${RESULT}${ENTRY}"
        done
    fi
    RESULT="${RESULT}]"
    printf '%s' "$RESULT"
    ;;

kernel_table)
    # Read kernel USB configs table from /dev/kmem (read-only, 15 entries)
    if [ ! -c /dev/kmem ]; then
        printf '{"error":"kmem not available"}'
        exit 0
    fi

    BASE_ADDR="0xc0a4a890"
    ENTRY_SIZE=36
    FUNC_NAMES='{"0":"ffs","2":"ecm_qc","7":"diag","9":"serial","15":"rndis_qc","16":"ecm","18":"mass_storage"}'

    ENTRIES="["
    FIRST=1
    I=0
    while [ "$I" -lt 15 ]; do
        [ "$FIRST" = "0" ] && ENTRIES="${ENTRIES},"
        FIRST=0
        OFFSET=$((I * ENTRY_SIZE))
        # Read 36 bytes: 4-byte PID + 8 x 4-byte func_id (join od lines)
        RAW=$(dd if=/dev/kmem bs=1 skip=$((0xc0a4a890 + OFFSET)) count=36 2>/dev/null | od -A n -t u4 | tr '\n' ' ' | tr -s ' ')
        PID=$(echo "$RAW" | awk '{print $1}')
        # Build funcs array
        FUNCS_ARR="["
        J=0
        while [ "$J" -lt 8 ]; do
            [ "$J" -gt 0 ] && FUNCS_ARR="${FUNCS_ARR},"
            FID=$(echo "$RAW" | awk -v n=$((J+2)) '{print $n}')
            FUNCS_ARR="${FUNCS_ARR}${FID:-0}"
            J=$((J + 1))
        done
        FUNCS_ARR="${FUNCS_ARR}]"
        ENTRIES="${ENTRIES}{\"index\":${I},\"pid\":${PID:-0},\"funcs\":${FUNCS_ARR}}"
        I=$((I + 1))
    done
    ENTRIES="${ENTRIES}]"

    jq -n --argjson func_names "$FUNC_NAMES" --argjson entries "$ENTRIES" \
        '{"func_names":$func_names,"entries":$entries}'
    ;;

patch_entry)
    IDX=$(echo "$BODY" | jq -r '.index // empty')
    FUNCS_STR=$(echo "$BODY" | jq -r '.funcs // empty')

    # Only allow patching known OS entries
    case "$IDX" in
        5|14) ;;
        *) printf '{"error":"only entries 5 and 14 can be patched"}'; exit 0 ;;
    esac

    if [ -z "$FUNCS_STR" ]; then
        printf '{"error":"funcs required (comma-separated function IDs)"}'
        exit 0
    fi

    # Validate function IDs (0=ffs, 2=ecm_qc, 7=diag, 9=serial, 15=rndis_qc, 16=ecm, 18=mass_storage)
    VALID_FIDS="0,2,7,9,15,16,18"
    OLD_IFS="$IFS"
    IFS=','
    for fid in $FUNCS_STR; do
        FOUND=0
        for v in $VALID_FIDS; do
            [ "$fid" = "$v" ] && FOUND=1
        done
        if [ "$FOUND" != "1" ]; then
            IFS="$OLD_IFS"
            printf '{"error":"invalid function ID: %s"}' "$fid"
            exit 0
        fi
    done
    IFS="$OLD_IFS"

    # Save to config file
    if [ ! -d /usb_conf ]; then
        mkdir -p /usb_conf
    fi
    if [ -f "$PATCH_CONF" ]; then
        if grep -q "^${IDX}=" "$PATCH_CONF" 2>/dev/null; then
            sed -i "s/^${IDX}=.*/${IDX}=${FUNCS_STR}/" "$PATCH_CONF"
        else
            echo "${IDX}=${FUNCS_STR}" >> "$PATCH_CONF"
        fi
    else
        cat > "$PATCH_CONF" <<CONFEOF
# USB kernel patch config — written by web UI, read at boot by S01patch_usb_kernel
# Format: ENTRY_INDEX=FUNC_ID,FUNC_ID,...
# Function IDs: 0=ffs 2=ecm_qc 7=diag 9=serial 15=rndis_qc 16=ecm 18=mass_storage
${IDX}=${FUNCS_STR}
CONFEOF
    fi
    sync

    # Apply via patch_usb_kernel (patches kernel memory from config)
    /etc/init.d/patch_usb_kernel start 2>/dev/null

    jq -n --argjson idx "$IDX" --arg funcs "$FUNCS_STR" \
        '{"ok":true,"index":$idx,"funcs":$funcs}'
    ;;

patch_config)
    # Read saved patch config (persistent across reboots)
    if [ -f "$PATCH_CONF" ]; then
        RESULT="{"
        FIRST=1
        while IFS='=' read -r key val; do
            case "$key" in
                \#*|"") continue ;;
            esac
            ENTRY=$(jq -n --arg k "$key" --arg v "$val" '{($k):$v}')
            if [ "$FIRST" = "1" ]; then
                # Extract inner content (strip outer braces)
                INNER=$(echo "$ENTRY" | sed 's/^{//; s/}$//')
                RESULT="${RESULT}${INNER}"
                FIRST=0
            else
                INNER=$(echo "$ENTRY" | sed 's/^{//; s/}$//')
                RESULT="${RESULT},${INNER}"
            fi
        done < "$PATCH_CONF"
        RESULT="${RESULT}}"
        printf '%s' "$RESULT"
    else
        printf '{}'
    fi
    ;;

set)
    COMP=$(echo "$BODY" | jq -r '.composition // empty')
    if [ -z "$COMP" ]; then
        printf '{"error":"composition required"}'
        exit 0
    fi
    # Validate: only hex digits
    CLEAN=$(printf '%s' "$COMP" | tr -cd '0-9A-Fa-f')
    if [ "$CLEAN" != "$COMP" ] || [ ${#COMP} -gt 8 ]; then
        printf '{"error":"invalid composition ID"}'
        exit 0
    fi
    # Check composition script exists
    if [ ! -x "$COMP_DIR/$COMP" ]; then
        printf '{"error":"composition script not found"}'
        exit 0
    fi

    # Apply composition
    /sbin/usb_composition "$COMP" 2>/dev/null
    jq -n --arg comp "$COMP" '{"ok":true,"composition":$comp}'
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
