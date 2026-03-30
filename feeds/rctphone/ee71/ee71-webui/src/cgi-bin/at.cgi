#!/bin/sh
# at.cgi — AT command interface
# GET: templates (read-only)
# POST: send (with CSRF check)
echo "Content-Type: application/json"
echo ""

AT_DEV="/dev/smd7"
[ ! -c "$AT_DEV" ] && AT_DEV="/dev/ttyUSB0"

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

# Validate command: must start with AT, no shell metacharacters
validate_cmd() {
    CMD="$1"
    if [ -z "$CMD" ]; then
        echo '{"error":"cmd required"}'; exit 0
    fi
    # Must start with AT (case insensitive)
    case "$CMD" in
        AT*|at*) ;;
        *) echo '{"error":"command must start with AT"}'; exit 0 ;;
    esac
    # Block shell metacharacters
    CLEAN=$(printf '%s' "$CMD" | tr -cd 'A-Za-z0-9+^$=,.:?!"_ -')
    if [ "$CLEAN" != "$CMD" ]; then
        echo '{"error":"invalid characters in command"}'; exit 0
    fi
    # Max length
    if [ ${#CMD} -gt 200 ]; then
        echo '{"error":"command too long"}'; exit 0
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

templates)
    cat <<'TEMPLATES_EOF'
{"templates":[
{"cmd":"ATI","desc":"Device info (model, revision, IMEI)","cat":"info"},
{"cmd":"AT+GMI","desc":"Manufacturer","cat":"info"},
{"cmd":"AT+GMM","desc":"Model","cat":"info"},
{"cmd":"AT+GMR","desc":"Firmware revision","cat":"info"},
{"cmd":"AT+GSN","desc":"IMEI","cat":"info"},
{"cmd":"AT+GCAP","desc":"Capabilities","cat":"info"},
{"cmd":"AT+CIMI","desc":"IMSI","cat":"info"},
{"cmd":"AT+ICCID","desc":"SIM ICCID","cat":"info"},
{"cmd":"AT$QCHWREV","desc":"Hardware revision","cat":"info"},
{"cmd":"AT+CLAC","desc":"List all supported commands","cat":"info"},
{"cmd":"AT+CSQ","desc":"Signal quality (RSSI, BER)","cat":"signal"},
{"cmd":"AT$QCSQ","desc":"Extended signal (RSRP, RSRQ, SNR, SINR, RSSI)","cat":"signal"},
{"cmd":"AT$QCSYSMODE","desc":"Current system mode (LTE/WCDMA/GSM)","cat":"signal"},
{"cmd":"AT$QCRSRP?","desc":"Serving + neighbor cells RSRP","cat":"signal"},
{"cmd":"AT$QCRSRQ?","desc":"Serving + neighbor cells RSRQ","cat":"signal"},
{"cmd":"AT$QCANTE","desc":"Antenna count","cat":"signal"},
{"cmd":"AT$QCRPW","desc":"Received radio power","cat":"signal"},
{"cmd":"AT$CSQ","desc":"Classic signal quality","cat":"signal"},
{"cmd":"AT+COPS?","desc":"Current operator","cat":"network"},
{"cmd":"AT+CEREG?","desc":"LTE registration","cat":"network"},
{"cmd":"AT+CREG?","desc":"2G registration","cat":"network"},
{"cmd":"AT+CGREG?","desc":"3G registration","cat":"network"},
{"cmd":"AT+CGATT?","desc":"PS attach status","cat":"network"},
{"cmd":"AT+CGDCONT?","desc":"PDP contexts (APN)","cat":"network"},
{"cmd":"AT+CGACT?","desc":"PDP activation","cat":"network"},
{"cmd":"AT+CGPADDR","desc":"PDP addresses","cat":"network"},
{"cmd":"AT*CNTI?","desc":"Technology indicator","cat":"network"},
{"cmd":"AT$QCCOPS?","desc":"QC operator info","cat":"network"},
{"cmd":"AT+CPIN?","desc":"SIM status","cat":"status"},
{"cmd":"AT+CFUN?","desc":"Phone functionality mode","cat":"status"},
{"cmd":"AT$QCSIMSTAT?","desc":"QC SIM status","cat":"status"},
{"cmd":"AT$QCSIMT","desc":"SIM type (SIM/USIM)","cat":"status"},
{"cmd":"AT^SYSINFO","desc":"System info (srv, domain, roaming, mode)","cat":"status"},
{"cmd":"AT^SYSCONFIG?","desc":"System config","cat":"status"},
{"cmd":"AT^CARDMODE","desc":"Card mode","cat":"status"},
{"cmd":"AT^SPN","desc":"SIM provider name","cat":"status"},
{"cmd":"AT+CCLK?","desc":"Clock","cat":"status"},
{"cmd":"AT+CPAS","desc":"Phone activity status","cat":"status"},
{"cmd":"AT+CPMS?","desc":"SMS storage","cat":"sms"},
{"cmd":"AT+CSCA?","desc":"SMS center","cat":"sms"},
{"cmd":"AT+CNMI?","desc":"New message indication","cat":"sms"},
{"cmd":"AT$QCPDPP?","desc":"PDP auth settings","cat":"pdp"},
{"cmd":"AT$QCPDPCFGE?","desc":"PDP extended config","cat":"pdp"},
{"cmd":"AT$QCDNSP?","desc":"Primary DNS","cat":"pdp"},
{"cmd":"AT$QCDNSS?","desc":"Secondary DNS","cat":"pdp"},
{"cmd":"AT$QCBANDPREF?","desc":"Band preferences","cat":"pdp"},
{"cmd":"AT+CFUN=1,1","desc":"Reboot modem","cat":"system","warn":"Drops connection for 30-60s"},
{"cmd":"AT+CFUN=0","desc":"Airplane mode","cat":"system","warn":"Kills all connectivity"},
{"cmd":"AT+CFUN=1","desc":"Normal mode","cat":"system"}
]}
TEMPLATES_EOF
    ;;

send)
    CMD=$(echo "$BODY" | jq -r '.cmd // empty')
    validate_cmd "$CMD"

    if [ ! -c "$AT_DEV" ]; then
        printf '{"error":"AT device not found (%s)"}' "$AT_DEV"
        exit 0
    fi

    # Send command via fd and read response
    exec 3<>"$AT_DEV"
    printf '%s\r' "$CMD" >&3
    OUTPUT=$(timeout 3 cat <&3 2>/dev/null | head -50)
    exec 3>&-
    jq -n --arg cmd "$CMD" --arg output "$OUTPUT" \
        '{"ok":true,"cmd":$cmd,"output":$output}'
    ;;

*)
    printf '{"error":"unknown action"}'
    ;;
esac
