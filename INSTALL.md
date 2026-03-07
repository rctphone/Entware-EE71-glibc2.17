# Installing opkg on EE71

One-command installer. Downloads everything from GitHub, pushes to device
via ADB, sets up the package manager.

## Requirements

- **USB cable** — must support data transfer (not charge-only)
- **ADB** — Android Debug Bridge (part of Android Platform Tools)
  - macOS: `brew install android-platform-tools`
  - Linux: `apt install adb`
  - Windows: [download](https://developer.android.com/tools/releases/platform-tools), extract, add to PATH

## Enabling ADB on a fresh device

Stock EE71 does not expose ADB. There are three ways to get ADB access:

### Method 1: Recovery mode (recommended)

Recovery mode always has ADB enabled. No extra tools needed.

1. Turn off the device
2. Press and hold the **Reset** button (small hole on the side)
3. While holding Reset, connect USB cable to computer, then to device
4. Release Reset when indicators start blinking (~10 seconds)
5. Check: `adb devices` — device should appear

After running the installer in recovery mode, the USB kernel patch is
installed automatically so ADB works in normal mode too.

### Method 2: USB mode switch via Python script

If the device is in normal mode and appears as a USB mass storage device
(hidden disk), you can switch it to ADB mode:

```bash
# Install dependencies
pip install pyusb
# macOS: brew install libusb
# Linux: apt install libusb-1.0-0

# Download and run
curl -sLO https://raw.githubusercontent.com/rctphone/ee71-tools/main/enable_adb_python/enable_adb.py
python3 enable_adb.py
```

The script sends a SCSI CDB command (`16 f9 ...`) via USB Mass Storage
interface to switch the device to ADB mode. Cross-platform replacement
for the Windows-only `TCL_SWITCH_UTILITY.exe`.

Options:
```bash
python3 enable_adb.py --list      # list USB devices
python3 enable_adb.py --verbose   # debug output
python3 enable_adb.py --vidpid 1bbb:0908  # specific device
```

### Method 3: Windows — TCL_SWITCH_UTILITY.exe

Use the original TCL utility (Windows only):
1. Install Qualcomm USB drivers
2. Connect device via USB
3. Run `TCL_SWITCH_UTILITY.exe`
4. Check: `adb devices`

## Quick start

### macOS / Linux

```bash
curl -sL https://raw.githubusercontent.com/rctphone/Entware-EE71-glibc2.17/ee71/install/install.sh | bash
```

Or download and run manually:

```bash
curl -sLO https://raw.githubusercontent.com/rctphone/Entware-EE71-glibc2.17/ee71/install/install.sh
chmod +x install.sh
./install.sh
```

### Windows

Download [install.bat](https://raw.githubusercontent.com/rctphone/Entware-EE71-glibc2.17/ee71/install/install.bat)
and run it, or from PowerShell:

```powershell
curl -sLO https://raw.githubusercontent.com/rctphone/Entware-EE71-glibc2.17/ee71/install/install.bat
.\install.bat
```

## What it does

1. Downloads `opkg` binary, package metadata, and USB patch from GitHub (on host)
2. Downloads `curl` + `libcurl` + `ca-bundle` packages (HTTPS support)
3. Pushes all files to device via `adb push`
4. Installs opkg to `/usr/bin/` (normal) or `/system/usr/bin/` (recovery)
5. Configures the package feed (`/etc/opkg.conf`)
6. Pre-registers 30 system libraries so opkg won't break them
7. Installs USB kernel patch for ADB access in normal mode
8. Installs curl and a `/usr/bin/wget` wrapper so opkg can download over HTTPS
9. Runs `opkg update` to verify (normal mode only)

## Normal mode vs Recovery mode

The installer auto-detects which mode the device is in.

**Normal mode** (device booted, WiFi active):
- ADB available after enabling via USB composition or kernel patch
- Installs directly to `/usr/bin/`, `/etc/` (persistent UBI storage)
- opkg works immediately after install

**Recovery mode** (hold Reset 10s, or `adb reboot recovery`):
- ADB always available, no WiFi/network
- `/system` is already mounted at boot (rootfs + usrfs)
- Installs to `/system/usr/bin/`, `/system/etc/`
- Also installs USB kernel patch so ADB works after reboot
- Host downloads all files (no internet on device in recovery)
- Reboot to normal mode after install, then run `opkg update`

## After install

```bash
# Connect via ADB
adb shell

# Update package list
opkg update

# Install packages
opkg install dropbear         # SSH server
opkg install curl             # HTTP client
opkg install iperf3           # Network speed test
opkg install wireguard-tools  # WireGuard VPN

# List all available packages
opkg list

# List installed
opkg list-installed
```

Default device IP: `192.168.1.1`

## Package feed

47 packages at [rctphone/ee71-opkg](https://github.com/rctphone/ee71-opkg).

Feed URL (already configured by installer):
```
https://raw.githubusercontent.com/rctphone/ee71-opkg/main
```

## Troubleshooting

**"No device found"**
- Check USB cable (must support data, not charge-only)
- Try `adb kill-server && adb devices`
- On Mac, install drivers: device appears as modem, switch to ADB first

**"opkg update failed — wget returned 255"**
- The stock BusyBox wget has no HTTPS support. The installer bundles curl
  and a wget wrapper to fix this. If you installed manually, see the
  manual install section below for how to set up the wget wrapper.
- Device needs internet (mobile data or WiFi backhaul)
- Check: `adb shell ping -c1 8.8.8.8`
- Check curl works: `adb shell curl -sI https://github.com && echo OK`

**"No space left on device"**
- `/usr` is 32 MB, check: `adb shell df /usr`
- Remove unused packages: `opkg remove <package>`

**Can't enter recovery mode**
- `sys_reboot recovery` does NOT work (no fota partition)
- Use `adb reboot recovery` instead
- Or hold the Reset button for ~10 seconds

## Manual install (without scripts)

If the scripts don't work, do it step by step:

```bash
# 1. Download files on your computer
curl -sLO https://raw.githubusercontent.com/rctphone/ee71-opkg/main/opkg-status
# Find opkg filename from Packages index:
curl -sL https://raw.githubusercontent.com/rctphone/ee71-opkg/main/Packages | grep "Filename: opkg_"
# Download it (replace filename):
curl -sLO https://raw.githubusercontent.com/rctphone/ee71-opkg/main/opkg_2025.11.05~80503d94-1_armv7-softfp.ipk

# 2. Push to device
adb push opkg_*.ipk /tmp/
adb push opkg-status /tmp/

# 3. Install on device
adb shell
cd /tmp
tar xzf opkg_*.ipk ./data.tar.gz
tar xzf data.tar.gz
cp ./usr/bin/opkg /usr/bin/opkg
chmod 755 /usr/bin/opkg
mkdir -p /usr/lib/opkg/info /usr/lib/opkg/lists /var/opkg-lists

# 4. Configure
cat > /etc/opkg.conf << 'EOF'
dest root /
lists_dir ext /var/opkg-lists
arch all 100
arch noarch 100
arch armv7-3.10 200
arch armv7-softfp 300
src/gz ee71 https://raw.githubusercontent.com/rctphone/ee71-opkg/main
EOF

# 5. Register system packages
cp /tmp/opkg-status /usr/lib/opkg/status
for pkg in $(sed -n 's/^Package: //p' /usr/lib/opkg/status); do
    touch "/usr/lib/opkg/info/${pkg}.list"
done

# 6. Install curl (HTTPS for opkg)
# Download on host:
curl -sL https://raw.githubusercontent.com/rctphone/ee71-opkg/main/Packages | grep "Filename: curl_\|Filename: libcurl_\|Filename: ca-bundle_"
# Download each file, push to device, then on device:
for ipk in /tmp/ca-bundle_*.ipk /tmp/libcurl_*.ipk /tmp/curl_*.ipk; do
    cd /tmp && mkdir -p _x && cd _x
    tar xzf "$ipk" ./data.tar.gz && tar xzf data.tar.gz -C /
    cd /tmp && rm -rf _x
done
# Create wget wrapper for opkg:
cat > /usr/bin/wget << 'WRAPPER'
#!/bin/sh
OUT="" URL="" INSECURE="" TIMEOUT=""
while [ "$#" -gt 0 ]; do
    case "$1" in
        -q) shift ;; -O) OUT="$2"; shift 2 ;;
        --no-check-certificate) INSECURE="-k"; shift ;;
        --timeout) TIMEOUT="--max-time $2"; shift 2 ;;
        -Y) shift 2 ;; -*) shift ;; *) URL="$1"; shift ;;
    esac
done
exec curl -sfL $INSECURE $TIMEOUT -o "$OUT" "$URL"
WRAPPER
chmod 755 /usr/bin/wget

# 7. Test
opkg update
opkg list-installed
```
