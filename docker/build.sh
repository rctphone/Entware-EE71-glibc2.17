#!/bin/bash
# Build Entware packages for EE71 in Docker
#
# Usage:
#   ./docker/build.sh setup       — install feeds, apply config, defconfig
#   ./docker/build.sh toolchain   — build host tools + cross-compiler
#   ./docker/build.sh world       — build all selected packages
#   ./docker/build.sh <pkg>       — build a single package (e.g. curl, opkg)
#   ./docker/build.sh shell       — open interactive shell in container
#   ./docker/build.sh clean       — remove Docker volume (full rebuild)
#
# First run:
#   ./docker/build.sh setup
#   ./docker/build.sh toolchain   # ~20 min
#   ./docker/build.sh world       # ~40 min
#
# Output: .ipk files in bin/targets/ inside the Docker volume

set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE="ee71-entware"
VOLUME="entware-build"
SEED_CONFIG="$(pwd)/configs/ee71-armv7.config"
HOST_CONFIG_DIR="$(pwd)/.build"
HOST_CONFIG="${HOST_CONFIG_DIR}/ee71-armv7.config"
COMMAND="${1:-}"

if [[ ! -f "$SEED_CONFIG" ]]; then
    echo "[ERR] Entware seed config not found: $SEED_CONFIG"
    exit 1
fi

prepare_host_config() {
    mkdir -p "$HOST_CONFIG_DIR"
    cp "$SEED_CONFIG" "$HOST_CONFIG"
    chmod u+rw "$HOST_CONFIG"
}

require_host_config() {
    if [[ ! -f "$HOST_CONFIG" ]]; then
        echo "[ERR] Build config not found: $HOST_CONFIG"
        echo "  Run ./docker/build.sh setup once to generate it from:"
        echo "  $SEED_CONFIG"
        exit 1
    fi
}

# Build Docker image if needed
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
    echo "[*] Building $IMAGE Docker image..."
    docker build -f docker/Dockerfile -t "$IMAGE" .
fi

# Create Docker volume if needed
if ! docker volume inspect "$VOLUME" >/dev/null 2>&1; then
    echo "[*] Creating Docker volume: $VOLUME"
    docker volume create "$VOLUME" >/dev/null
fi

# Run command in container
run() {
    require_host_config
    docker run --rm \
        -e EE71_RUN_CMD="$1" \
        -v "$VOLUME":/entware \
        -v "${HOST_CONFIG_DIR}:/ee71-config" \
        -w /entware \
        "$IMAGE" \
        bash -c 'ln -sfn /ee71-config/ee71-armv7.config .config; exec bash -c "$EE71_RUN_CMD"'
}

# Run command in container before .config has been generated.
run_unconfigured() {
    docker run --rm \
        -v "$VOLUME":/entware \
        -w /entware \
        "$IMAGE" \
        bash -c "$1"
}

# Interactive run
run_tty() {
    require_host_config
    docker run --rm -it \
        -e EE71_RUN_CMD="$1" \
        -v "$VOLUME":/entware \
        -v "${HOST_CONFIG_DIR}:/ee71-config" \
        -w /entware \
        "$IMAGE" \
        bash -c 'ln -sfn /ee71-config/ee71-armv7.config .config; exec bash -c "$EE71_RUN_CMD"'
}

# Sync source into Docker volume (excludes build artifacts)
do_sync() {
    local src_dir="$(pwd)"
    echo "[*] Syncing source → Docker volume..."
    docker run --rm \
        -v "${src_dir}:/src:ro" \
        -v "${VOLUME}:/dst" \
        "$IMAGE" \
        rsync -a --delete \
            --exclude='/build_dir/' \
            --exclude='/staging_dir/' \
            --exclude='/tmp/' \
            --exclude='/dl/' \
            --exclude='/logs/' \
            --exclude='/bin/' \
            --exclude='/feeds/' \
            --exclude='/package/feeds/' \
            --exclude='.git/' \
            --exclude='/.config' \
            --exclude='/.config.old' \
            /src/ /dst/
    echo "[*] Sync complete"

    run_unconfigured 'rm -f .config .config.old'
}

do_setup() {
    do_sync
    echo "[*] Seeding host build config from configs/ee71-armv7.config..."
    prepare_host_config
    echo "=== Setting up Entware build tree ==="
    run '
set -e
echo "[*] Installing feeds..."
rm -rf package/feeds/rctphone
make package/symlinks
echo "[*] Running defconfig..."
make defconfig
echo ""
echo "=== Setup complete ==="
echo "Next: ./docker/build.sh toolchain"
'
}

do_toolchain() {
    do_sync
    echo "=== Building toolchain ==="
    run '
set -e
if [ ! -x staging_dir/host/bin/mkhash ]; then
    mkdir -p staging_dir/host/bin
    gcc -O2 -Itools/include -o staging_dir/host/bin/mkhash scripts/mkhash.c
    echo "[*] mkhash bootstrapped"
fi
make tools/install -j"$(nproc)"
echo "=== Tools done, building toolchain ==="
make toolchain/install -j"$(nproc)"
echo "=== Toolchain ready ==="
echo "Next: ./docker/build.sh world"
'
}

do_build() {
    local target="$1"
    do_sync
    echo "=== Building: $target ==="
    run "make $target V=s -j\$(nproc)"
}

do_clean() {
    echo "This will delete the Docker volume '$VOLUME' (full rebuild required)."
    read -p "Continue? [y/N] " -n1 answer
    echo
    if [[ "$answer" =~ ^[Yy]$ ]]; then
        docker volume rm "$VOLUME" 2>/dev/null || true
        echo "[*] Volume removed"
    fi
}

case "$COMMAND" in
    setup)      do_setup ;;
    toolchain)  do_toolchain ;;
    world)      do_sync; run "make world V=s -j\$(nproc)" ;;
    shell)      do_sync; run_tty 'bash' ;;
    clean)      do_clean ;;
    "")
        echo "Usage: ./docker/build.sh <command>"
        echo ""
        echo "Commands:"
        echo "  setup       — install feeds + apply config"
        echo "  toolchain   — build host tools + cross-compiler (~20 min)"
        echo "  world       — build all packages (~40 min)"
        echo "  <package>   — build a single package (e.g. curl, opkg)"
        echo "  shell       — open interactive shell in build container"
        echo "  clean       — remove Docker volume (full rebuild)"
        ;;
    *)
        # Resolve package name to make target
        TARGET=$(docker run --rm \
            -v "$VOLUME":/entware \
            "$IMAGE" \
            find /entware/package -name Makefile -path "*/$COMMAND/Makefile" \
            -not -path "*/host/*" 2>/dev/null | head -1)
        if [ -n "$TARGET" ]; then
            REL="${TARGET#/entware/}"
            do_build "${REL%/Makefile}/compile"
        else
            do_build "package/$COMMAND/compile"
        fi
        ;;
esac
