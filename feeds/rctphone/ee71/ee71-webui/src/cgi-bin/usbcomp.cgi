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

    printf '{"pid":"%s","enabled":%s,"functions":"%s","serial":"%s","config_pid":"%s"}' \
        "$PID" "$ENABLED" "$(json_escape_str "$FUNCS")" "$(json_escape_str "$SERIAL")" "$CONF_PID"
    ;;

compositions)
    # List available composition scripts
    echo "["
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
            [ "$FIRST" = "0" ] && printf ","
            FIRST=0
            printf '{"name":"%s","pid":"%s","functions":"%s","desc":"%s"}' \
                "$(json_escape_str "$NAME")" "$CPID" "$(json_escape_str "$CFUNCS")" "$(json_escape_str "$DESC")"
        done
    fi
    echo "]"
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

    echo "{"
    printf '"func_names":%s,' "$FUNC_NAMES"
    printf '"entries":['
    FIRST=1
    I=0
    while [ "$I" -lt 15 ]; do
        [ "$FIRST" = "0" ] && printf ","
        FIRST=0
        OFFSET=$((I * ENTRY_SIZE))
        # Read 36 bytes: 4-byte PID + 8 × 4-byte func_id (join od lines)
        RAW=$(dd if=/dev/kmem bs=1 skip=$((0xc0a4a890 + OFFSET)) count=36 2>/dev/null | od -A n -t u4 | tr '\n' ' ' | tr -s ' ')
        PID=$(echo "$RAW" | awk '{print $1}')
        printf '{"index":%d,"pid":%d,"funcs":[' "$I" "${PID:-0}"
        J=0
        while [ "$J" -lt 8 ]; do
            [ "$J" -gt 0 ] && printf ","
            FID=$(echo "$RAW" | awk -v n=$((J+2)) '{print $n}')
            printf '%d' "${FID:-0}"
            J=$((J + 1))
        done
        printf ']}'
        I=$((I + 1))
    done
    echo "]}"
    ;;

patch_entry)
    IDX=$(echo "$BODY" | sed -n 's/.*"index"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p')
    FUNCS_STR=$(echo "$BODY" | sed -n 's/.*"funcs"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

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

    printf '{"ok":true,"index":%d,"funcs":"%s"}' "$IDX" "$FUNCS_STR"
    ;;

patch_config)
    # Read saved patch config (persistent across reboots)
    if [ -f "$PATCH_CONF" ]; then
        printf '{'
        FIRST=1
        while IFS='=' read -r key val; do
            case "$key" in
                \#*|"") continue ;;
            esac
            [ "$FIRST" = "0" ] && printf ','
            FIRST=0
            printf '"%s":"%s"' "$key" "$val"
        done < "$PATCH_CONF"
        printf '}'
    else
        printf '{}'
    fi
    ;;

set)
    COMP=$(echo "$BODY" | sed -n 's/.*"composition"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
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
    printf '{"ok":true,"composition":"%s"}' "$COMP"
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
