# Installing opkg on EE71

One-command installer. Downloads everything from GitHub, pushes to device
via ADB, sets up the package manager.

## Requirements

- **USB cable** — connect EE71 to computer
- **ADB** — Android Debug Bridge (part of Android Platform Tools)
  - macOS: `brew install android-platform-tools`
  - Linux: `apt install adb`
  - Windows: [download](https://developer.android.com/tools/releases/platform-tools), extract, add to PATH

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

1. Downloads `opkg` binary and package metadata from GitHub
2. Pushes to device via `adb push`
3. Installs opkg to `/usr/bin/`
4. Configures the package feed (`/etc/opkg.conf`)
5. Pre-registers 30 system libraries so opkg won't break them
6. Runs `opkg update` to verify

## Normal mode vs Recovery mode

The installer auto-detects which mode the device is in.

**Normal mode** (device booted, WiFi active):
- ADB available after enabling via USB composition or kernel patch
- Installs directly to `/usr/bin/`, `/etc/` (persistent UBI storage)
- opkg works immediately after install

**Recovery mode** (hold Reset 10s, or `sys_reboot recovery`):
- ADB always available, no WiFi/network
- `/system` is already mounted at boot (rootfs + usrfs)
- Installs to `/system/usr/bin/`, `/system/etc/`
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

**"opkg update failed"**
- Device needs internet (mobile data or WiFi backhaul)
- Check: `adb shell ping -c1 8.8.8.8`
- Some carriers block ICMP — try: `adb shell wget -q -O /dev/null http://google.com && echo OK`

**"No space left on device"**
- `/usr` is 32 MB, check: `adb shell df /usr`
- Remove unused packages: `opkg remove <package>`

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

# 6. Test
opkg update
opkg list-installed
```
