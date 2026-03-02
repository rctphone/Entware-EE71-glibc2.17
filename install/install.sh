#!/bin/bash
# install.sh — Install opkg on EE71 via ADB (macOS / Linux)
#
# Usage: ./install.sh
#
# Downloads everything from GitHub on the host, pushes to device via ADB,
# then runs setup on the device. Works in both normal and recovery mode.
#
# In recovery mode, also installs the USB kernel patch so ADB works
# after rebooting to normal mode.

set -e

REPO="https://raw.githubusercontent.com/rctphone/Entware-EE71-glibc2.17/ee71"
OPKG_REPO="https://raw.githubusercontent.com/rctphone/ee71-opkg/main"

echo "=== EE71 opkg installer ==="
echo ""

# Check ADB
if ! command -v adb &>/dev/null; then
    echo "[ERR] adb not found."
    echo ""
    echo "Install Android Platform Tools:"
    echo "  macOS:  brew install android-platform-tools"
    echo "  Linux:  apt install adb"
    echo "  Manual: https://developer.android.com/tools/releases/platform-tools"
    exit 1
fi

# Check device
if ! adb devices 2>/dev/null | grep -qw "device"; then
    echo "[ERR] No device found."
    echo ""
    echo "1. Connect EE71 via USB"
    echo "2. Enable ADB (hold Reset 10s for recovery, or use tcl_switch_usb.py)"
    echo "3. Run: adb devices"
    exit 1
fi

SERIAL=$(adb devices | grep -w "device" | head -1 | awk '{print $1}')
echo "[*] Device found: $SERIAL"

# Create temp dir
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Download all files on the host (device may have no internet in recovery)
echo "[*] Downloading files from GitHub..."
curl -sL "$REPO/install/setup.sh" -o "$TMP/setup.sh"
curl -sL "$OPKG_REPO/Packages" -o "$TMP/Packages"

OPKG_FILE=$(grep "^Filename: opkg_" "$TMP/Packages" | head -1 | awk '{print $2}')
if [ -z "$OPKG_FILE" ]; then
    echo "[ERR] opkg package not found in index"
    exit 1
fi

curl -sL "$OPKG_REPO/$OPKG_FILE" -o "$TMP/$OPKG_FILE"
curl -sL "$OPKG_REPO/opkg-status" -o "$TMP/opkg-status"
curl -sL "$REPO/install/patch_usb_kernel" -o "$TMP/patch_usb_kernel"

echo "[*] Downloaded: setup.sh, $OPKG_FILE, opkg-status, patch_usb_kernel"

# Push everything to device
echo "[*] Pushing to device..."
adb push "$TMP/setup.sh" /tmp/setup.sh
adb push "$TMP/Packages" /tmp/Packages
adb push "$TMP/$OPKG_FILE" "/tmp/$OPKG_FILE"
adb push "$TMP/opkg-status" /tmp/opkg-status
adb push "$TMP/patch_usb_kernel" /tmp/patch_usb_kernel

# Run setup on device
echo "[*] Running setup on device..."
echo ""
adb shell "sh /tmp/setup.sh" </dev/null

echo ""
echo "[*] Done!"
echo ""
echo "Connect to device:"
echo "  adb shell                (USB)"
echo "  ssh root@<device-ip>     (after installing Dropbear SSH)"
echo ""
echo "Install packages:"
echo "  opkg update"
echo "  opkg install dropbear curl iperf3"
