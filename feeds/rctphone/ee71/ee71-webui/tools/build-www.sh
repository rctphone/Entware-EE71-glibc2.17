#!/bin/sh
# build-www.sh — bundle the EE71 Web UI and rewrite index.html.
#
# Usage: build-www.sh <esbuild-binary> <www-dir>
#
# Replaces the old chain of `sed` edits in the package Makefile. Instead of
# pattern-matching individual tags, index.html carries explicit marker blocks:
#
#   <!-- BUNDLE:CSS:BEGIN --> ... <!-- BUNDLE:CSS:END -->
#   <!-- BUNDLE:JS:BEGIN -->  ... <!-- BUNDLE:JS:END -->
#
# The dev tags inside those blocks must list exactly the same files, in the
# same order, as css/entry.css and js/entry.js. That is checked here, so the
# unbundled page and the bundled page can never drift apart silently.
#
# Bundle filenames carry a content hash (app.<hash>.bundle.js). A package
# upgrade therefore changes the URL, and the browser cannot keep serving the
# previous bundle from cache.
#
# Source maps are written next to the bundle but are NOT linked from it and
# NOT installed on the device: zero runtime cost, zero flash cost, still
# available in the build directory for symbolicating a device stack trace.

set -eu

ESBUILD="${1:?[ERR] esbuild binary path required}"
WWW="${2:?[ERR] www directory required}"

[ -x "$ESBUILD" ] || { echo "[ERR] esbuild not executable: $ESBUILD" >&2; exit 1; }
[ -d "$WWW" ] || { echo "[ERR] www directory not found: $WWW" >&2; exit 1; }

INDEX="$WWW/index.html"
JS_ENTRY="$WWW/js/entry.js"
CSS_ENTRY="$WWW/css/entry.css"

for f in "$INDEX" "$JS_ENTRY" "$CSS_ENTRY"; do
	[ -f "$f" ] || { echo "[ERR] missing: $f" >&2; exit 1; }
done

TMP="$WWW/.build-www.tmp"
rm -rf "$TMP"
mkdir -p "$TMP"
trap 'rm -rf "$TMP"' EXIT

FAIL=0

hash_file() {
	if command -v sha256sum >/dev/null 2>&1; then
		sha256sum "$1" | cut -c1-10
	elif command -v shasum >/dev/null 2>&1; then
		shasum -a 256 "$1" | cut -c1-10
	elif command -v md5sum >/dev/null 2>&1; then
		md5sum "$1" | cut -c1-10
	else
		echo "[ERR] no sha256sum/shasum/md5sum available for cache-busting hash" >&2
		exit 1
	fi
}

# Extract the lines between a BEGIN/END marker pair.
marker_block() {
	awk -v b="$1" -v e="$2" '
		index($0, b) { on = 1; next }
		index($0, e) { on = 0; next }
		on { print }
	' "$INDEX"
}

require_marker() {
	if ! grep -q -- "$1" "$INDEX"; then
		echo "[ERR] index.html is missing the marker: $1" >&2
		exit 1
	fi
}

# --- 1. Entry point manifests ------------------------------------------------

# js/entry.js:   import './pages/wifi.js';  ->  js/pages/wifi.js
sed -n "s|^[[:space:]]*import[[:space:]]*'\./\([^']*\)'.*|js/\1|p" "$JS_ENTRY" > "$TMP/js-entry.txt"
# css/entry.css: @import './app.css';       ->  css/app.css
sed -n "s|^[[:space:]]*@import[[:space:]]*'\./\([^']*\)'.*|css/\1|p" "$CSS_ENTRY" > "$TMP/css-entry.txt"

[ -s "$TMP/js-entry.txt" ] || { echo "[ERR] no imports parsed from js/entry.js" >&2; exit 1; }
[ -s "$TMP/css-entry.txt" ] || { echo "[ERR] no @imports parsed from css/entry.css" >&2; exit 1; }

# Every import must resolve to a real file — a typo would otherwise become a
# page that silently does not exist at runtime.
while IFS= read -r rel; do
	if [ ! -f "$WWW/$rel" ]; then
		echo "[ERR] js/entry.js references a missing file: $rel" >&2
		FAIL=1
	fi
done < "$TMP/js-entry.txt"
while IFS= read -r rel; do
	if [ ! -f "$WWW/$rel" ]; then
		echo "[ERR] css/entry.css references a missing file: $rel" >&2
		FAIL=1
	fi
done < "$TMP/css-entry.txt"

# Every page module on disk must be imported — a new page nobody added to
# entry.js would otherwise build fine and simply not be in the UI.
for f in "$WWW"/js/pages/*.js; do
	[ -f "$f" ] || continue
	rel="js/pages/$(basename "$f")"
	if ! grep -qx -- "$rel" "$TMP/js-entry.txt"; then
		echo "[ERR] $rel exists but is not imported by js/entry.js" >&2
		FAIL=1
	fi
done

[ "$FAIL" -eq 0 ] || exit 1

# --- 2. index.html marker blocks must match the entry points ------------------

require_marker 'BUNDLE:JS:BEGIN'
require_marker 'BUNDLE:JS:END'
require_marker 'BUNDLE:CSS:BEGIN'
require_marker 'BUNDLE:CSS:END'

marker_block 'BUNDLE:JS:BEGIN' 'BUNDLE:JS:END' \
	| sed -n 's|.*<script src="\([^"]*\)".*|\1|p' > "$TMP/js-index.txt"
marker_block 'BUNDLE:CSS:BEGIN' 'BUNDLE:CSS:END' \
	| sed -n 's|.*<link[^>]*href="\([^"]*\)".*|\1|p' > "$TMP/css-index.txt"

if ! diff -u "$TMP/js-entry.txt" "$TMP/js-index.txt" > "$TMP/js.diff" 2>&1; then
	echo "[ERR] the <script> list in index.html does not match js/entry.js:" >&2
	sed 's/^/    /' "$TMP/js.diff" >&2
	exit 1
fi
if ! diff -u "$TMP/css-entry.txt" "$TMP/css-index.txt" > "$TMP/css.diff" 2>&1; then
	echo "[ERR] the <link rel=stylesheet> list in index.html does not match css/entry.css:" >&2
	sed 's/^/    /' "$TMP/css.diff" >&2
	exit 1
fi

# --- 3. Bundle ---------------------------------------------------------------

rm -f "$WWW"/js/app*.bundle.js "$WWW"/js/app*.bundle.js.map
rm -f "$WWW"/css/app*.bundle.css "$WWW"/css/app*.bundle.css.map

"$ESBUILD" "$JS_ENTRY" \
	--bundle --format=iife --minify \
	--sourcemap=external \
	--outfile="$WWW/js/app.bundle.js"

"$ESBUILD" "$CSS_ENTRY" \
	--bundle --minify --external:'*.woff2' \
	--sourcemap=external \
	--outfile="$WWW/css/app.bundle.css"

[ -s "$WWW/js/app.bundle.js" ] || { echo "[ERR] JS bundle is empty" >&2; exit 1; }
[ -s "$WWW/css/app.bundle.css" ] || { echo "[ERR] CSS bundle is empty" >&2; exit 1; }

# --- 4. Verify nothing was dropped from the bundle ---------------------------

# Every App.registerPage('<id>') in the page sources must survive into the bundle.
grep -ho "registerPage('[a-z0-9-]*'" "$WWW"/js/pages/*.js \
	| sed "s|registerPage('||; s|'\$||" | sort -u > "$TMP/page-ids.txt"

[ -s "$TMP/page-ids.txt" ] || { echo "[ERR] no App.registerPage() ids found in the page sources" >&2; exit 1; }

while IFS= read -r id; do
	[ -n "$id" ] || continue
	if ! grep -q "\"$id\"" "$WWW/js/app.bundle.js" && ! grep -q "'$id'" "$WWW/js/app.bundle.js"; then
		echo "[ERR] page '$id' registers in the sources but is absent from the bundle" >&2
		FAIL=1
	fi
done < "$TMP/page-ids.txt"

[ "$FAIL" -eq 0 ] || exit 1

# --- 5. Content hash ---------------------------------------------------------

JS_HASH="$(hash_file "$WWW/js/app.bundle.js")"
CSS_HASH="$(hash_file "$WWW/css/app.bundle.css")"

JS_NAME="app.$JS_HASH.bundle.js"
CSS_NAME="app.$CSS_HASH.bundle.css"

mv "$WWW/js/app.bundle.js" "$WWW/js/$JS_NAME"
mv "$WWW/css/app.bundle.css" "$WWW/css/$CSS_NAME"
if [ -f "$WWW/js/app.bundle.js.map" ]; then
	mv "$WWW/js/app.bundle.js.map" "$WWW/js/$JS_NAME.map"
fi
if [ -f "$WWW/css/app.bundle.css.map" ]; then
	mv "$WWW/css/app.bundle.css.map" "$WWW/css/$CSS_NAME.map"
fi

# --- 6. Rewrite index.html ---------------------------------------------------

awk -v js="$JS_NAME" -v css="$CSS_NAME" '
	index($0, "BUNDLE:CSS:BEGIN") { print "    <link rel=\"stylesheet\" href=\"css/" css "\">"; skip = 1; next }
	index($0, "BUNDLE:CSS:END")   { skip = 0; next }
	index($0, "BUNDLE:JS:BEGIN")  { print "    <script src=\"js/" js "\"></script>"; skip = 1; next }
	index($0, "BUNDLE:JS:END")    { skip = 0; next }
	!skip { print }
' "$INDEX" > "$TMP/index.html"

if ! grep -q "js/$JS_NAME" "$TMP/index.html"; then
	echo "[ERR] index.html rewrite lost the JS bundle reference" >&2; exit 1
fi
if ! grep -q "css/$CSS_NAME" "$TMP/index.html"; then
	echo "[ERR] index.html rewrite lost the CSS bundle reference" >&2; exit 1
fi
if grep -q '<script src="js/pages/' "$TMP/index.html"; then
	echo "[ERR] index.html still references unbundled page sources" >&2; exit 1
fi

mv "$TMP/index.html" "$INDEX"

echo "[www] js/$JS_NAME  ($(wc -c < "$WWW/js/$JS_NAME" | tr -d ' ') bytes)"
echo "[www] css/$CSS_NAME ($(wc -c < "$WWW/css/$CSS_NAME" | tr -d ' ') bytes)"
echo "[www] $(wc -l < "$TMP/page-ids.txt" | tr -d ' ') pages verified present in the bundle"
