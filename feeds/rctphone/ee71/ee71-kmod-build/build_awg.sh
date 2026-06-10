#!/bin/sh
# Build awg tool inside ee71-crossoe container
set -e

CROSS=arm-oe-linux-gnueabi
SYSROOT=/opt/x-tools/${CROSS}/sysroot

cd /src
make clean 2>/dev/null || true
make CC=${CROSS}-gcc \
     LDFLAGS="--sysroot=${SYSROOT} -s" \
     CFLAGS="--sysroot=${SYSROOT} -Os -march=armv7-a -mtune=cortex-a7 -mfloat-abi=soft -I/src/uapi/linux -D_GNU_SOURCE -DRUNSTATEDIR=\\\"/var/run\\\"" \
     -j$(nproc)

echo ""
echo "=== Result ==="
ls -lh wg
${CROSS}-readelf -d wg | grep NEEDED

cp wg /out/awg
echo "Saved as /out/awg"
