#!/bin/bash
# install.sh — Install opkg on EE71 via ADB (macOS / Linux)
#
# Usage: ./install.sh
#
# Downloads the setup script from GitHub and runs it on the device.
# Works in both normal and recovery mode.

set -e

REPO="https://raw.githubusercontent.com/rctphone/Entware-EE71-glibc2.17/ee71"
SETUP_URL="$REPO/install/setup.sh"

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

# Download setup script
echo "[*] Downloading setup script..."
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
curl -sL "$SETUP_URL" -o "$TMP/setup.sh"

# Push and run
echo "[*] Pushing to device..."
adb push "$TMP/setup.sh" /tmp/setup.sh

echo "[*] Running setup on device..."
echo ""
adb shell "sh /tmp/setup.sh"

echo ""
echo "[*] Done!"
echo ""
echo "Connect to device:"
echo "  ssh root@192.168.88.1    (if Dropbear SSH installed)"
echo "  adb shell                (USB)"
echo ""
echo "Install packages:"
echo "  opkg update"
echo "  opkg install dropbear curl iperf3"
