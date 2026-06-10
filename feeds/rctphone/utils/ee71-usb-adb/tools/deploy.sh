#!/bin/sh
# Deploy USB ADB scripts to EE71 device via SSH
# Usage: ./deploy.sh [host]
# Default host: 192.168.88.1
set -e

HOST="${1:-192.168.88.1}"
SSH="ssh root@$HOST"
SCP="scp -O"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Deploying USB+ADB scripts to $HOST ==="

echo "[1/3] Uploading scripts..."
$SCP "$DIR/patch_usb_kernel" "root@$HOST:/etc/init.d/patch_usb_kernel"

echo "[2/3] Setting permissions and symlinks..."
$SSH '
chmod 755 /etc/init.d/patch_usb_kernel

# Kernel patch — first in rcS (patches table before jrd_usb_switch)
ln -sf ../init.d/patch_usb_kernel /etc/rcS.d/S01patch_usb_kernel

# FunctionFS mount — early in rcS (after find_partitions)
ln -sf ../init.d/usb /etc/rcS.d/S38usb

# Remove old watchdog if present
rm -f /etc/rc5.d/S90usb_ecm_adb /etc/init.d/usb_ecm_adb
'

echo "[3/3] Syncing and verifying..."
$SSH '
sync
echo "--- rcS.d USB scripts ---"
ls -la /etc/rcS.d/ | grep -i "usb\|patch"
echo "--- init.d ---"
ls -la /etc/init.d/patch_usb_kernel
'

echo ""
echo "=== Done ==="
echo "Boot sequence:"
echo "  S01patch_usb_kernel  — patches kernel USB table (adds ADB to Mac/Win entries)"
echo "  S38usb               — mounts FunctionFS for adbd"
echo ""
echo "Reboot to apply: ssh root@$HOST 'sync; sys_reboot'"
