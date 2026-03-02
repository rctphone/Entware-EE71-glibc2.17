# Entware for Alcatel EE71

Entware fork for the **Alcatel EE71** 4G/LTE mobile router.

## Device

| | |
|---|---|
| SoC | Qualcomm MDM9640, ARM Cortex-A7 |
| Kernel | Linux 3.10.49 |
| libc | glibc 2.17 |
| Flash | UBI/UBIFS on NAND, ~16 MB rootfs + ~32 MB usrfs |
| Shell | BusyBox ash |

## Why Entware

Stock Entware uses glibc (unlike OpenWrt which uses musl). The EE71 ships with
glibc 2.17, so Entware packages link against the same libc without bundling a
second C library. This saves significant space on a device with very limited
NAND flash.

## /usr instead of /opt

Standard Entware installs everything under `/opt` and expects a dedicated
partition or USB storage. The EE71 has no USB host port and no spare partition
for `/opt`. All available space is on the existing `/system` rootfs.

This fork patches the build system to install to `/usr` — the same prefix the
stock firmware already uses. No extra mountpoints, no symlinks, no wasted space.

Changes from upstream Entware:

- `package-defaults.mk`, `cmake.mk`, `rules.mk` — `/opt` → `/usr`
- `ee71-skip-opt-patches.mk` — auto-skips feed patches that add `/opt` paths
- Custom target `armv7-3.10` — Cortex-A7, NEON VFPv4, softfp, glibc 2.17

## Packages

**47 packages** built for the device, delivered via an
[opkg feed](https://github.com/rctphone/ee71-opkg).

Base tree (customized):
opkg, iptables, busybox, dropbear, dnsmasq, hostapd, wpa-supplicant,
curl, ppp, wireguard-tools, openssl, zlib, libnl, libxml2, ncurses

Feed (`feeds/rctphone`):
sqlite3, iperf3, miniupnpd, shadowsocks-libev, and 13 EE71-specific packages
(web UI, VPN, kernel modules, system tweaks).

## Build

Requires: Docker.

```bash
git clone https://github.com/rctphone/Entware-EE71-glibc2.17.git
cd Entware-EE71-glibc2.17
git checkout ee71

# First-time setup (~2 min)
./docker/build.sh setup

# Build cross-compiler (~20 min)
./docker/build.sh toolchain

# Build all packages (~40 min)
./docker/build.sh world
```

Build a single package:

```bash
./docker/build.sh curl
./docker/build.sh opkg
./docker/build.sh iptables
```

Other commands:

```bash
./docker/build.sh shell       # interactive shell in build container
./docker/build.sh clean       # remove Docker volume (full rebuild)
```

Output `.ipk` files are inside the Docker volume at `bin/targets/`.
Use `./docker/build.sh shell` to access them or copy them out.

## Architecture

```
Source (git) ──rsync──► Docker volume ──make──► .ipk packages
                        (fast I/O)
```

The build script syncs source files into a Docker volume before each build.
Build artifacts (toolchain, object files) stay in the volume and persist
between runs. Only a `clean` destroys them.

## Config

Build configuration: `configs/ee71-armv7.config`

This is a seed config expanded by `make defconfig`. Key settings:

- Target: `armv7-3.10` (custom, not upstream Entware)
- Toolchain: GCC 13.4.0, binutils 2.34, glibc 2.17
- Optimization: `-Os -pipe -mtune=cortex-a7`, LTO enabled
- Security hardening: disabled (size over security on embedded target)

## License

GPL-2.0-or-later, same as upstream Entware.
