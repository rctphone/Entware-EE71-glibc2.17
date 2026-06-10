#!/usr/bin/env bash
# Build tcrypt.ko (kernel crypto benchmark) for EE71
set -euo pipefail

KERNEL_DIR=/kernel
LINARO_DIR="/opt/linaro"
LINARO_PREFIX="arm-linux-gnueabi"
LINARO_URL="https://releases.linaro.org/components/toolchain/binaries/4.9-2017.01/arm-linux-gnueabi/gcc-linaro-4.9.4-2017.01-x86_64_arm-linux-gnueabi.tar.xz"
OUT=/work/out

# Install deps
if ! command -v make &>/dev/null; then
  apt-get update -qq
  apt-get install -y -qq --no-install-recommends \
    build-essential bc curl xz-utils python3 ca-certificates >/dev/null
fi

if [[ ! -x "${LINARO_DIR}/bin/${LINARO_PREFIX}-gcc" ]]; then
  mkdir -p "${LINARO_DIR}"
  curl -fsSL "${LINARO_URL}" -o /tmp/linaro-gcc.tar.xz
  tar xf /tmp/linaro-gcc.tar.xz --strip-components=1 -C "${LINARO_DIR}"
  rm -f /tmp/linaro-gcc.tar.xz
fi

export PATH="${LINARO_DIR}/bin:${PATH}"
export ARCH=arm
export CROSS_COMPILE="${LINARO_PREFIX}-"

if ! command -v python &>/dev/null; then
  ln -sf "$(command -v python3)" /usr/local/bin/python
fi

cd "${KERNEL_DIR}"

# Prepare if needed
if [[ ! -f include/generated/autoconf.h ]]; then
  cat > scripts/gcc-wrapper.py <<'PYWRAP'
#!/usr/bin/env python3
import subprocess, sys; sys.exit(subprocess.call(sys.argv[1:]))
PYWRAP
  cp /dist/kernel.config .config
  make olddefconfig
  make modules_prepare HOSTCFLAGS="-fcommon"
fi

# Build tcrypt.ko in-tree (needs internal.h from crypto/)
# Temporarily enable CONFIG_CRYPTO_TEST=m
sed -i 's/# CONFIG_CRYPTO_TEST is not set/CONFIG_CRYPTO_TEST=m/' .config
make olddefconfig
# Force rebuild of modules_prepare with new config
make modules_prepare HOSTCFLAGS="-fcommon"

# Force build tcrypt specifically
rm -f crypto/tcrypt.o crypto/tcrypt.ko crypto/tcrypt.mod.*
make -C "${KERNEL_DIR}" M=crypto modules HOSTCFLAGS="-fcommon" -j"$(nproc)" 2>&1

if [[ -f crypto/tcrypt.ko ]]; then
  cp crypto/tcrypt.ko "$OUT/"
  "${LINARO_PREFIX}-strip" --strip-debug "$OUT/tcrypt.ko"
  echo "[OK] tcrypt.ko: $(ls -lh "$OUT/tcrypt.ko" | awk '{print $5}')"
else
  echo "[FAIL] tcrypt.ko not found"
  ls -la crypto/*.ko 2>/dev/null || echo "no .ko files in crypto/"
  exit 1
fi
