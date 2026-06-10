#!/usr/bin/env bash
# Build kernel modules (tun.ko, wireguard.ko, amneziawg.ko) for EE71
# Uses x86_64 container with Linaro GCC 4.9 (kernel 3.10 requires GCC <8)
# Requires: cloned kernel in the project-level docker/kernel-msm-3.10-mdm9640-le-3-0/
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../../../../../" && pwd)"
KERNEL_DIR="${KERNEL_DIR:-${PROJECT_ROOT}/docker/kernel-msm-3.10-mdm9640-le-3-0}"
WORK="${SCRIPT_DIR}/work"

mkdir -p "${WORK}"

# Verify kernel source exists
if [[ ! -f "${KERNEL_DIR}/Makefile" ]]; then
  echo "ERROR: Kernel source not found at ${KERNEL_DIR}"
  echo "Clone it first:"
  echo "  git clone --depth 1 --branch LNX.LE.5.1 \\"
  echo "    https://git.codelinaro.org/clo/la/kernel/msm-3.10.git \\"
  echo "    ${KERNEL_DIR}"
  exit 1
fi

# Build Docker image with Linaro GCC 4.9 (cached after first build)
echo "=== Building ee71-kernel-build image ==="
docker build --platform linux/amd64 -t ee71-kernel-build "${SCRIPT_DIR}"

# Run build
docker run --rm \
  --platform linux/amd64 \
  -v "${KERNEL_DIR}:/kernel" \
  -v "${WORK}:/work" \
  -v "${SCRIPT_DIR}:/dist:ro" \
  ee71-kernel-build /dist/build.sh

echo ""
echo "Output:"
ls -lh "${WORK}/out/"
