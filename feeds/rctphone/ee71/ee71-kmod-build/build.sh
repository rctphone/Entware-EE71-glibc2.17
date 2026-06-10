#!/usr/bin/env bash
# Cross-compile kernel modules (tun.ko, wireguard.ko, amneziawg.ko) for EE71
# Runs inside Docker container (debian:bookworm --platform linux/amd64)
# Uses Linaro GCC 4.9 (not GCC 13) — kernel 3.10 inline asm is incompatible with GCC 8+
# Device VERMAGIC: 3.10.49 preempt mod_unload ARMv7
# CONFIG_MODVERSIONS is NOT set — no CRC symbol matching needed
set -euo pipefail

: "${KERNEL_DIR:=/kernel}"
: "${WORK_ROOT:=/work}"
: "${OUT_ROOT:=${WORK_ROOT}/out}"
: "${WG_COMPAT_VERSION:=1.0.20220627}"

LINARO_PREFIX="arm-linux-gnueabi"

mkdir -p "${OUT_ROOT}"

# PATH, ARCH, CROSS_COMPILE set by Dockerfile (ee71-kernel-build image)

# ============================================================
# Step 1: Prepare kernel headers
# ============================================================
echo "=== Preparing kernel tree ==="
cd "${KERNEL_DIR}"

# Fix QC gcc-wrapper.py — Python 2 syntax incompatible with Python 3
# Replace with a simple passthrough (we don't need QC's warning checker)
cat > scripts/gcc-wrapper.py <<'PYWRAP'
#!/usr/bin/env python3
import subprocess, sys
result = subprocess.call(sys.argv[1:])
sys.exit(result)
PYWRAP

# Apply device config with CONFIG_TUN enabled as module
cp /dist/kernel.config .config
# Enable TUN in config (was disabled in device firmware)
sed -i 's/# CONFIG_TUN is not set/CONFIG_TUN=m/' .config

# Prepare kernel tree for out-of-tree module builds
# This generates include/generated/*, scripts/*, Module.symvers etc.
# HOSTCFLAGS=-fcommon: host GCC 12 defaults to -fno-common, breaking old dtc code
make olddefconfig
make modules_prepare HOSTCFLAGS="-fcommon"

echo "  Kernel $(make -s kernelversion) prepared"
echo "  Cross-compiler: $(${LINARO_PREFIX}-gcc --version | head -1)"

# ============================================================
# Step 2: Build tun.ko
# ============================================================
echo ""
echo "=== Building tun.ko ==="

# Build tun as out-of-tree module to avoid building entire drivers/net/
TUN_BUILD="/tmp/tun_build"
rm -rf "${TUN_BUILD}"
mkdir -p "${TUN_BUILD}"
cp drivers/net/tun.c "${TUN_BUILD}/"
cat > "${TUN_BUILD}/Makefile" <<'KBUILD'
obj-m := tun.o
KBUILD

make -C "${KERNEL_DIR}" M="${TUN_BUILD}" modules \
  HOSTCFLAGS="-fcommon" \
  -j"$(nproc)"

if [[ -f "${TUN_BUILD}/tun.ko" ]]; then
  cp "${TUN_BUILD}/tun.ko" "${OUT_ROOT}/"
  "${LINARO_PREFIX}-strip" --strip-debug "${OUT_ROOT}/tun.ko"
  echo "  [OK] tun.ko built"
else
  echo "  [FAIL] tun.ko build failed"
  exit 1
fi

# ============================================================
# Step 3: Build wireguard.ko
# ============================================================
echo ""
echo "=== Building wireguard.ko ==="

WG_SRC="${WORK_ROOT}/src/wireguard-linux-compat"

if [[ ! -d "${WG_SRC}" ]]; then
  echo "  Downloading wireguard-linux-compat ${WG_COMPAT_VERSION}..."
  mkdir -p "${WORK_ROOT}/src"
  cd /tmp
  curl -fsSL "https://git.zx2c4.com/wireguard-linux-compat/snapshot/wireguard-linux-compat-${WG_COMPAT_VERSION}.tar.xz" \
    -o "wireguard-linux-compat-${WG_COMPAT_VERSION}.tar.xz"
  tar xf "wireguard-linux-compat-${WG_COMPAT_VERSION}.tar.xz" -C "${WORK_ROOT}/src"
  mv "${WORK_ROOT}/src/wireguard-linux-compat-${WG_COMPAT_VERSION}" "${WG_SRC}"
  rm -f "/tmp/wireguard-linux-compat-${WG_COMPAT_VERSION}.tar.xz"
fi

cd "${WG_SRC}/src"

# wireguard-linux-compat includes its own crypto implementations:
# ChaCha20, Poly1305, Curve25519, BLAKE2s, SipHash
# No external crypto dependencies needed
# -Dfallthrough=: GCC 4.9 doesn't have fallthrough keyword (GCC 7+)
make -C "${KERNEL_DIR}" M="$(pwd)" modules \
  HOSTCFLAGS="-fcommon" \
  KCFLAGS="-Dfallthrough=" \
  -j"$(nproc)"

if [[ -f wireguard.ko ]]; then
  cp wireguard.ko "${OUT_ROOT}/"
  "${LINARO_PREFIX}-strip" --strip-debug "${OUT_ROOT}/wireguard.ko"
  echo "  [OK] wireguard.ko built"
else
  echo "  [FAIL] wireguard.ko build failed"
  exit 1
fi

# ============================================================
# Step 4: Build amneziawg.ko (WireGuard + anti-DPI obfuscation)
# ============================================================
echo ""
echo "=== Building amneziawg.ko ==="

AWG_SRC="${WORK_ROOT}/src/amneziawg-linux-kernel-module"

if [[ ! -d "${AWG_SRC}" ]]; then
  echo "  Downloading amneziawg-linux-kernel-module..."
  mkdir -p "${WORK_ROOT}/src"
  cd /tmp
  curl -fsSL "https://github.com/amnezia-vpn/amneziawg-linux-kernel-module/archive/refs/heads/master.tar.gz" \
    -o amneziawg.tar.gz
  tar xf amneziawg.tar.gz -C "${WORK_ROOT}/src"
  mv "${WORK_ROOT}/src/amneziawg-linux-kernel-module-master" "${AWG_SRC}"
  rm -f /tmp/amneziawg.tar.gz
fi

cd "${AWG_SRC}/src"

make -C "${KERNEL_DIR}" M="$(pwd)" modules \
  HOSTCFLAGS="-fcommon" \
  KCFLAGS="-Dfallthrough=" \
  -j"$(nproc)"

if [[ -f amneziawg.ko ]]; then
  cp amneziawg.ko "${OUT_ROOT}/"
  "${LINARO_PREFIX}-strip" --strip-debug "${OUT_ROOT}/amneziawg.ko"
  echo "  [OK] amneziawg.ko built"
else
  echo "  [FAIL] amneziawg.ko build failed"
  exit 1
fi

# ============================================================
# Step 6: Verify
# ============================================================
echo ""
echo "== Build result =="
ls -lh "${OUT_ROOT}/"*.ko

echo ""
echo "== Module info =="
for mod in "${OUT_ROOT}"/*.ko; do
  echo "--- $(basename "$mod") ---"
  "${LINARO_PREFIX}-readelf" -p .modinfo "$mod" 2>/dev/null | grep -E '(vermagic|description|depends|parm)' || true
done

echo ""
echo "== VERMAGIC check =="
echo "Expected: 3.10.49 preempt mod_unload ARMv7"
for mod in "${OUT_ROOT}"/*.ko; do
  vm=$("${LINARO_PREFIX}-readelf" -p .modinfo "$mod" 2>/dev/null | grep vermagic | sed 's/.*vermagic=//' || echo "UNKNOWN")
  echo "  $(basename "$mod"): ${vm}"
done

