#!/bin/sh
# setup.sh — runs ON the EE71 device (via adb shell)
# Installs opkg from files already pushed to /tmp/ by the host installer.
#
# Normal mode:   installs to /usr/bin, /etc (persistent UBI)
# Recovery mode:  /system already mounted by init, installs to /system/...
#                 Also installs USB kernel patch so ADB works in normal mode.

set -e

PREFIX=""

# --- Detect mode ---
# Normal mode: /usr is a UBI mount (ubi0:usrfs on /usr)
# Recovery mode: /system is mounted by find_recovery_partitions.sh at boot
if mount | grep -q "ubi.*on /usr "; then
    echo "[*] Normal mode detected"
    PREFIX=""
elif [ -d "/system/usr/bin" ]; then
    echo "[*] Recovery mode detected (/system mounted)"
    PREFIX="/system"
else
    echo "[ERR] Cannot detect device mode."
    echo "  Normal: /usr should be UBI mount"
    echo "  Recovery: /system/usr/bin should exist"
    echo ""
    echo "  Current mounts:"
    mount | grep ubi
    exit 1
fi

# --- Find opkg ipk in /tmp ---
OPKG_FILE=$(ls /tmp/opkg_*.ipk 2>/dev/null | head -1)
if [ -z "$OPKG_FILE" ]; then
    echo "[ERR] opkg ipk not found in /tmp/"
    echo "  The host installer should have pushed it via ADB."
    exit 1
fi

if [ ! -f /tmp/opkg-status ]; then
    echo "[ERR] opkg-status not found in /tmp/"
    exit 1
fi

# --- Extract and install opkg binary ---
echo "[*] Installing opkg..."
cd /tmp
tar xzf "$OPKG_FILE" ./data.tar.gz
tar xzf data.tar.gz

if [ ! -f ./usr/bin/opkg ]; then
    echo "[ERR] opkg binary not found in ipk"
    exit 1
fi

cp ./usr/bin/opkg "$PREFIX/usr/bin/opkg"
chmod 755 "$PREFIX/usr/bin/opkg"
echo "  $PREFIX/usr/bin/opkg installed"

# --- Directories ---
mkdir -p "$PREFIX/usr/lib/opkg/info"
mkdir -p "$PREFIX/usr/lib/opkg/lists"
mkdir -p "$PREFIX/var/opkg-lists"

# --- Config ---
echo "[*] Writing opkg.conf..."
cat > "$PREFIX/etc/opkg.conf" << 'CONF'
dest root /
lists_dir ext /var/opkg-lists
arch all 100
arch noarch 100
arch armv7-3.10 200
arch armv7-softfp 300
src/gz ee71 https://raw.githubusercontent.com/rctphone/ee71-opkg/main
CONF

# --- Pre-register system libraries ---
echo "[*] Registering system packages..."
cp /tmp/opkg-status "$PREFIX/usr/lib/opkg/status"
count=$(grep -c '^Package:' "$PREFIX/usr/lib/opkg/status")
echo "  $count packages registered"

for pkg in $(sed -n 's/^Package: //p' "$PREFIX/usr/lib/opkg/status"); do
    touch "$PREFIX/usr/lib/opkg/info/${pkg}.list"
done

# --- Install USB kernel patch (ADB support) ---
if [ -f /tmp/patch_usb_kernel ]; then
    echo "[*] Installing USB kernel patch (ADB in normal mode)..."
    cp /tmp/patch_usb_kernel "$PREFIX/etc/init.d/patch_usb_kernel"
    chmod 755 "$PREFIX/etc/init.d/patch_usb_kernel"
    ln -sf ../init.d/patch_usb_kernel "$PREFIX/etc/rcS.d/S01patch_usb_kernel"
    echo "  $PREFIX/etc/rcS.d/S01patch_usb_kernel installed"

    # Also patch boot_hsusb_composition to include ADB
    COMP="$PREFIX/sbin/usb/boot_hsusb_composition"
    if [ -f "$COMP" ]; then
        if ! grep -q "ffs" "$COMP" 2>/dev/null; then
            echo "[*] Patching boot_hsusb_composition to include ADB..."
            # Replace the functions line to include diag,ffs,serial
            sed -i 's/echo rndis_qc,mass_storage/echo rndis_qc,diag,ffs,serial,mass_storage/' "$COMP"
            sed -i 's/echo ecm,mass_storage/echo ecm,diag,ffs,serial,mass_storage/' "$COMP"
            echo "  boot_hsusb_composition patched"
        else
            echo "  boot_hsusb_composition already has ADB"
        fi
    fi
fi

# --- Install curl + wget wrapper (HTTPS support for opkg) ---
CURL_IPKS=$(ls /tmp/curl_*.ipk /tmp/libcurl_*.ipk /tmp/ca-bundle_*.ipk 2>/dev/null)
if [ -n "$CURL_IPKS" ]; then
    echo "[*] Installing curl (HTTPS support for opkg)..."
    # Extract and install each ipk manually (opkg not yet functional for deps)
    for ipk in /tmp/ca-bundle_*.ipk /tmp/libcurl_*.ipk /tmp/curl_*.ipk; do
        [ -f "$ipk" ] || continue
        cd /tmp
        rm -rf _ipk_tmp && mkdir _ipk_tmp && cd _ipk_tmp
        tar xzf "$ipk" ./data.tar.gz 2>/dev/null
        tar xzf data.tar.gz -C "$PREFIX/" 2>/dev/null
        cd /tmp && rm -rf _ipk_tmp
        pkg=$(basename "$ipk" | sed 's/_.*//');
        echo "  $pkg extracted"
    done

    # Compat: current curl.ipk was built with --with-ca-bundle=/usr/etc/ssl/...
    # Symlink ensures it finds certs at the standard /etc/ssl/ location.
    # Safe to remove after curl is rebuilt with --with-ca-bundle=/etc/ssl/...
    if [ ! -e "$PREFIX/usr/etc/ssl" ]; then
        mkdir -p "$PREFIX/usr/etc"
        ln -sf /etc/ssl "$PREFIX/usr/etc/ssl"
    fi

    # Create wget wrapper so opkg uses curl for HTTPS downloads
    cat > "$PREFIX/usr/bin/wget" << 'WRAPPER'
#!/bin/sh
# wget wrapper — translates wget args to curl for HTTPS support
# opkg calls: wget -q [--no-check-certificate] [--timeout N] [-Y on] -O <file> <url>
OUT="" URL="" INSECURE="" TIMEOUT=""
while [ "$#" -gt 0 ]; do
    case "$1" in
        -q) shift ;;
        -O) OUT="$2"; shift 2 ;;
        --no-check-certificate) INSECURE="-k"; shift ;;
        --timeout) TIMEOUT="--max-time $2"; shift 2 ;;
        -Y) shift 2 ;;
        -*) shift ;;
        *) URL="$1"; shift ;;
    esac
done
exec curl -sfL $INSECURE $TIMEOUT -o "$OUT" "$URL"
WRAPPER
    chmod 755 "$PREFIX/usr/bin/wget"
    echo "  /usr/bin/wget wrapper installed (curl-based HTTPS)"
fi

# --- Local offline feed (install bundled .ipk with no network) ---
# Copies every .ipk pushed to /tmp into a persistent feed dir on usrfs and adds
# a file:// source. usrfs is the SAME volume whether reached as /usr (normal) or
# /system/usr (recovery), so the feed URL is always the normal-mode path and
# keeps working after a reboot. Lets `opkg install dropbear` run fully offline.
#
# usrfs is small - about 4.9 MB free on a device with our packages already on
# it - so this must never fill it. Size the copy first and skip the whole feed
# if it does not fit with room to spare, because a PARTIAL copy is worse than
# no feed at all: the Packages index would then list packages whose .ipk is not
# there, and opkg would fail at install time instead of at setup time.
#
# /cache is deliberately not used as a fallback despite having ~38 MB free: it
# is a partition we clean, and a feed that disappears when someone tidies up is
# worse than one that was never created. Without the feed, `opkg install
# /tmp/<file>.ipk` still works for whatever is still in /tmp.
FEED_RESERVE_KB=1024
if ls /tmp/*.ipk >/dev/null 2>&1; then
    echo "[*] Setting up local offline feed..."
    FEED_DIR="$PREFIX/usr/lib/opkg/ee71-local"
    FEED_URL="file:///usr/lib/opkg/ee71-local"

    # Deliberately does not subtract .ipk files already in FEED_DIR that the
    # copy would merely overwrite. That makes the check conservative, never
    # optimistic, which is the safe direction on a partition this small.
    need_kb=$(du -ck /tmp/*.ipk 2>/dev/null | awk 'END {print $1}')
    avail_kb=$(df -k "$PREFIX/usr" 2>/dev/null | awk 'NR==2 {print $4}')
    case "$need_kb$avail_kb" in
        *[!0-9]*|"") need_kb=""; avail_kb="" ;;
    esac

    if [ -z "$need_kb" ] || [ -z "$avail_kb" ]; then
        echo "  [WARN] cannot size /usr — skipping the local feed"
        echo "         install from /tmp directly: opkg install /tmp/<file>.ipk"
    elif [ "$avail_kb" -lt "$((need_kb + FEED_RESERVE_KB))" ]; then
        echo "  [WARN] not enough room on /usr for the local feed:"
        echo "         need ${need_kb} KB + ${FEED_RESERVE_KB} KB reserve, have ${avail_kb} KB"
        echo "         skipping it rather than half-filling the partition"
        echo "         install from /tmp directly: opkg install /tmp/<file>.ipk"
    else
        mkdir -p "$FEED_DIR"
        if cp /tmp/*.ipk "$FEED_DIR/"; then
            [ -f /tmp/Packages.gz ] && cp /tmp/Packages.gz "$FEED_DIR/Packages.gz"
            [ -f /tmp/Packages ]    && cp /tmp/Packages    "$FEED_DIR/Packages"
            if ! grep -q "ee71-local" "$PREFIX/etc/opkg.conf" 2>/dev/null; then
                echo "src/gz ee71-local $FEED_URL" >> "$PREFIX/etc/opkg.conf"
            fi
            echo "  feed: $FEED_URL ($(ls "$FEED_DIR"/*.ipk 2>/dev/null | wc -l | tr -d ' ') packages)"
        else
            # Ran out of space or hit an I/O error mid-copy. Take the feed back
            # out rather than leaving a partial one, and do not add the src line.
            echo "  [WARN] copy failed — removing the partial feed"
            rm -rf "$FEED_DIR"
        fi
    fi
fi

# --- Clean up ---
rm -f /tmp/Packages /tmp/Packages.gz /tmp/opkg-status /tmp/opkg_*.ipk /tmp/data.tar.gz
rm -f /tmp/patch_usb_kernel
rm -f /tmp/curl_*.ipk /tmp/libcurl_*.ipk /tmp/ca-bundle_*.ipk /tmp/dropbear_*.ipk
rm -rf /tmp/usr

# --- Test (normal mode only — recovery has no network) ---
if [ -z "$PREFIX" ]; then
    echo "[*] Testing opkg..."
    if opkg update 2>&1; then
        echo ""
        echo "=== Installed packages ==="
        opkg list-installed
        echo ""
        echo "=== Setup complete ==="
        echo "Install packages: opkg install <package>"
    else
        echo "[WARN] opkg update failed — check network"
        echo "  You can install from local .ipk: opkg install /path/to.ipk"
    fi
else
    echo ""
    echo "=== Setup complete (recovery mode) ==="
    echo "Reboot to normal mode: adb reboot"
    echo "Then: opkg update && opkg install dropbear"
fi
