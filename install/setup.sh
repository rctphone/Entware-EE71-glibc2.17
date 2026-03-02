#!/bin/sh
# setup.sh — runs ON the EE71 device (via adb shell)
# Downloads opkg + packages from GitHub and configures the package manager.
#
# Normal mode:   installs to /usr/bin, /etc (persistent UBI)
# Recovery mode:  /system already mounted by init, installs to /system/...

set -e

REPO="https://raw.githubusercontent.com/rctphone/ee71-opkg/main"
PREFIX=""

# --- Detect mode ---
# Normal mode: /usr is a UBI mount (ubi0:usrfs)
# Recovery mode: /system is mounted by find_recovery_partitions.sh at boot
if mount | grep -q "ubi.*on /usr"; then
    echo "[*] Normal mode detected (/usr is UBI mount)"
    PREFIX=""
elif [ -d "/system/usr/bin" ]; then
    echo "[*] Recovery mode detected (/system already mounted)"
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

# --- Check wget/curl ---
DL=""
if command -v curl >/dev/null 2>&1; then
    DL="curl -sL -o"
elif command -v wget >/dev/null 2>&1; then
    DL="wget -q -O"
else
    echo "[ERR] No curl or wget found on device."
    echo "  Push files manually via ADB (see INSTALL.md)."
    exit 1
fi

# --- Download opkg ipk ---
echo "[*] Downloading package index..."
$DL /tmp/Packages "$REPO/Packages"

OPKG_FILE=$(grep "^Filename: opkg_" /tmp/Packages | head -1 | awk '{print $2}')
if [ -z "$OPKG_FILE" ]; then
    echo "[ERR] opkg package not found in index"
    exit 1
fi

echo "[*] Downloading $OPKG_FILE..."
$DL "/tmp/$OPKG_FILE" "$REPO/$OPKG_FILE"

echo "[*] Downloading opkg-status..."
$DL /tmp/opkg-status "$REPO/opkg-status"

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

# --- Clean up ---
rm -f /tmp/Packages /tmp/opkg-status /tmp/opkg_*.ipk /tmp/data.tar.gz
rm -rf /tmp/usr

# --- Test (normal mode only) ---
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
    echo "Reboot to normal mode, then run: opkg update"
fi
