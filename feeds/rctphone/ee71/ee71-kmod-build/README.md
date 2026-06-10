# Kernel Modules for EE71 (TUN + WireGuard)

Cross-compile TUN and WireGuard kernel modules for the Alcatel EE71 router (MDM9640, kernel 3.10.49).

## Prerequisites

1. **Docker Desktop** with Rosetta emulation (for Apple Silicon) or any x86_64 Docker host
2. **Kernel source** cloned locally:

```bash
git clone --depth 1 --branch LNX.LE.5.1 \
  https://git.codelinaro.org/clo/la/kernel/msm-3.10.git \
  docker/kernel-msm-3.10-mdm9640-le-3-0
```

> ~743 MB download. Branch `LNX.LE.5.1` = kernel 3.10.49 matching the device.

## Build

```bash
./opkg/entware/feeds/rctphone/ee71/ee71-kmod-build/build_host.sh
```

This runs a Debian bookworm x86_64 container that:
1. Installs build dependencies and Linaro GCC 4.9.4 (kernel 3.10 ARM asm is incompatible with GCC 8+)
2. Prepares the kernel tree with device config (`kernel.config` from `/proc/config.gz`)
3. Builds `tun.ko` as out-of-tree module
4. Downloads and builds `wireguard.ko` from [wireguard-linux-compat](https://git.zx2c4.com/wireguard-linux-compat/) v1.0.20220627

Output in `work/out/`:
- `tun.ko` (~25 KB) — TUN/TAP virtual network interface
- `wireguard.ko` (~132 KB) — WireGuard VPN (bundles own ChaCha20, Poly1305, Curve25519, BLAKE2s)

Both modules have VERMAGIC `3.10.49 preempt mod_unload ARMv7` matching the device kernel.

## Install on Device

### 1. Copy modules

```bash
SSH_OPTS="-o PubkeyAcceptedKeyTypes=+ssh-rsa -o HostkeyAlgorithms=+ssh-rsa"

scp $SSH_OPTS work/out/tun.ko root@192.168.88.1:/tmp/
scp $SSH_OPTS work/out/wireguard.ko root@192.168.88.1:/tmp/
```

### 2. Test loading

```bash
ssh $SSH_OPTS root@192.168.88.1
# password: oemlinux1

insmod /tmp/tun.ko
insmod /tmp/wireguard.ko

# Verify
lsmod
ls -la /dev/net/tun
ip link add wg0 type wireguard
ip link show wg0
ip link del wg0
```

### 3. Install persistently

Copy to the kernel modules directory on the persistent rootfs partition:

```bash
mkdir -p /lib/modules/3.10.49/kernel/drivers/net/
cp /tmp/tun.ko /lib/modules/3.10.49/kernel/drivers/net/
cp /tmp/wireguard.ko /lib/modules/3.10.49/kernel/drivers/net/
```

### 4. Set up autoloading at boot

Create init script:

```bash
cat > /etc/init.d/wireguard_modules << 'EOF'
#!/bin/sh
### BEGIN INIT INFO
# Provides:          wireguard_modules
# Required-Start:    $local_fs
# Default-Start:     2 3 4 5
# Short-Description: Load TUN and WireGuard kernel modules
### END INIT INFO

TUN_MOD=/lib/modules/3.10.49/kernel/drivers/net/tun.ko
WG_MOD=/lib/modules/3.10.49/kernel/drivers/net/wireguard.ko

case "$1" in
  start)
    if ! lsmod | grep -q "^tun "; then
      insmod "$TUN_MOD" && echo "wireguard_modules: tun.ko loaded" || echo "[ERR] tun.ko failed"
    fi
    if ! lsmod | grep -q "^wireguard "; then
      insmod "$WG_MOD" && echo "wireguard_modules: wireguard.ko loaded" || echo "[ERR] wireguard.ko failed"
    fi
    ;;
  stop)
    rmmod wireguard 2>/dev/null && echo "wireguard_modules: wireguard.ko unloaded" || true
    rmmod tun 2>/dev/null && echo "wireguard_modules: tun.ko unloaded" || true
    ;;
  restart) $0 stop; $0 start ;;
  status) lsmod | grep -E "^(tun|wireguard) " || echo "no modules loaded" ;;
  *) echo "Usage: $0 { start | stop | restart | status }" >&2; exit 1 ;;
esac
exit 0
EOF

chmod +x /etc/init.d/wireguard_modules
ln -sf ../init.d/wireguard_modules /etc/rc5.d/S12wireguard_modules
```

### 5. Verify after reboot

```bash
reboot
# wait ~30 seconds, then reconnect
ssh $SSH_OPTS root@192.168.88.1
/etc/init.d/wireguard_modules status
```

## Notes

- **GCC version matters**: Kernel 3.10 ARM inline assembly uses `__asmeq` macro which is incompatible with GCC 8+. The build script automatically downloads Linaro GCC 4.9.4.
- **Docker platform**: Must be `linux/amd64` (Linaro GCC is x86_64 binary). On Apple Silicon, Docker uses Rosetta.
- **WireGuard crypto**: The module bundles its own ChaCha20, Poly1305, Curve25519, BLAKE2s implementations. No external kernel crypto dependencies needed.
- **QCE hardware acceleration**: The MDM9640 has a Qualcomm Crypto Engine 5.3.1, but `qcrypto.ko` hangs on load due to BAM/SPS DMA initialization issues. WireGuard's algorithms (ChaCha20/Poly1305) are not supported by QCE hardware anyway.
