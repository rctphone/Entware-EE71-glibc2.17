#!/bin/sh
# Login banner for Dropbear SSH — place in /etc/profile.d/banner.sh
# Shows system info and uptime

FW_VER=$(grep 'External_Ver' /jrd-resource/resource/jrdcfg/config.xml 2>/dev/null | cut -d'>' -f2 | cut -d'<' -f1)
DROPBEAR_VER=$(dropbear -V 2>&1 | head -1)
BB_VER=$(busybox 2>&1 | head -1)
UP=$(uptime)

printf "\n\033[1;36mAlcatel 4GEE WiFi Mini (EE71)\033[0m | FW %s\n" "${FW_VER:-unknown}"
printf "\033[0;37m%s | %s\n" "$DROPBEAR_VER" "$BB_VER"
printf "%s %s | %s\033[0m\n\n" "$(uname -sr)" "$(uname -m)" "$UP"
