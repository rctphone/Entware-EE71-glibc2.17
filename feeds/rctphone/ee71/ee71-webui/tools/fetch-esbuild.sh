#!/bin/sh
# fetch-esbuild.sh — stage a pinned, checksum-verified esbuild host binary.
#
# Usage: fetch-esbuild.sh <dl-dir> <bin-dir> <version> <sha256>
#
# The tarball is cached in the OpenWrt download directory, so the registry is
# contacted at most once per version per build tree. Every later build — and
# every build with no network at all — uses the cache. The checksum is
# verified on both paths, so the build is reproducible rather than "whatever
# the registry served that day".
#
# Set ESBUILD_TARBALL to a locally vendored tarball to skip the network
# entirely; it is checksum-verified like any other copy.

set -eu

DL_DIR="${1:?[ERR] download dir required}"
BIN_DIR="${2:?[ERR] bin dir required}"
VERSION="${3:?[ERR] esbuild version required}"
SHA256="${4:?[ERR] esbuild sha256 required}"

BIN="$BIN_DIR/esbuild-$VERSION"
TARBALL="$DL_DIR/esbuild-linux-x64-$VERSION.tgz"
URL="https://registry.npmjs.org/@esbuild/linux-x64/-/linux-x64-$VERSION.tgz"

if [ -x "$BIN" ]; then
	exit 0
fi

verify() {
	[ -f "$1" ] || return 1
	if command -v sha256sum >/dev/null 2>&1; then
		echo "$SHA256  $1" | sha256sum -c - >/dev/null 2>&1
	elif command -v shasum >/dev/null 2>&1; then
		echo "$SHA256  $1" | shasum -a 256 -c - >/dev/null 2>&1
	else
		echo "[ERR] no sha256sum/shasum available to verify esbuild" >&2
		exit 1
	fi
}

mkdir -p "$DL_DIR" "$BIN_DIR"

# A vendored tarball wins over the cache and over the network.
if [ -n "${ESBUILD_TARBALL:-}" ]; then
	if ! verify "$ESBUILD_TARBALL"; then
		echo "[ERR] ESBUILD_TARBALL=$ESBUILD_TARBALL does not match the pinned sha256" >&2
		exit 1
	fi
	cp "$ESBUILD_TARBALL" "$TARBALL"
fi

if ! verify "$TARBALL"; then
	if [ -f "$TARBALL" ]; then
		echo "[ee71-webui] cached esbuild tarball failed checksum, refetching" >&2
		rm -f "$TARBALL"
	fi
	echo "[ee71-webui] fetching esbuild $VERSION"
	if command -v curl >/dev/null 2>&1; then
		curl -fsSL -o "$TARBALL.part" "$URL" || true
	elif command -v wget >/dev/null 2>&1; then
		wget -q -O "$TARBALL.part" "$URL" || true
	else
		echo "[ERR] neither curl nor wget is available to fetch esbuild" >&2
		exit 1
	fi
	if ! verify "$TARBALL.part"; then
		rm -f "$TARBALL.part"
		echo "[ERR] could not obtain a valid esbuild $VERSION tarball." >&2
		echo "      Expected sha256: $SHA256" >&2
		echo "      Cache location:  $TARBALL" >&2
		echo "      Offline? Download $URL on a connected machine," >&2
		echo "      drop it at the cache location, or point ESBUILD_TARBALL at it." >&2
		exit 1
	fi
	mv "$TARBALL.part" "$TARBALL"
fi

TMP="$BIN_DIR/.esbuild-$VERSION.unpack"
rm -rf "$TMP"
mkdir -p "$TMP"
tar xzf "$TARBALL" -C "$TMP" package/bin/esbuild
chmod +x "$TMP/package/bin/esbuild"
mv "$TMP/package/bin/esbuild" "$BIN"
rm -rf "$TMP"

echo "[ee71-webui] esbuild $VERSION staged at $BIN"
