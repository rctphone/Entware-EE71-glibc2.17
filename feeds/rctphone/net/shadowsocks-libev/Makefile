include $(TOPDIR)/rules.mk

PKG_NAME:=shadowsocks-libev
PKG_VERSION:=3.3.6
PKG_RELEASE:=3

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=https://github.com/shadowsocks/shadowsocks-libev/releases/download/v$(PKG_VERSION)/
PKG_HASH:=ee83b43b36d6a51cfbee72254b6088d4b625feadf06cc2f0bcb810c8236438a5

# Static dependency versions. Upstream 3.3.6 is cmake-only with empty submodule
# directories, so OpenWrt's autotools recipe does not apply (and OpenWrt dropped
# the package in 2024 anyway); the deps are fetched and built inline below.
# Every tarball is checked against the hash next to its version — nothing is
# built from an unverified download. Cached in $(DL_DIR) so repeat builds and
# offline builds do not re-fetch.
LIBEV_VERSION:=4.33
LIBEV_HASH:=507eb7b8d1015fbec5b935f34ebed15bf346bed04a11ab82b8eee848c4205aea
LIBSODIUM_VERSION:=1.0.22
LIBSODIUM_HASH:=adbdd8f16149e81ac6078a03aca6fc03b592b89ef7b5ed83841c086191be3349
# c-ares contributes no code to ss-local/ss-redir/ss-tunnel: resolv.c is in
# SS_SERVER_SOURCE only, so the static linker drops libcares.a entirely (device
# binaries contain zero ares_* symbols). It is still built because the top-level
# CMakeLists has find_package(Cares REQUIRED). Kept current regardless.
CARES_VERSION:=1.34.8
CARES_HASH:=c222b6d681096f9444d2c4863d2c1174019e27cacca0a4a5c114d36dd7d7bf78
# Final release of the 2.28 branch. Only the cipher/HMAC primitives are used
# here (crypto.c, aead.c, stream.c) — no TLS, X.509 or RSA — so the 2.28 CVEs
# do not apply. 3.3.6 does carry MBEDTLS_VERSION_NUMBER >= 0x03000000 guards,
# so a move to 3.6.x is possible, but it needs a build: the config header is
# renamed (include/mbedtls/mbedtls_config.h) and the seds below must follow.
MBEDTLS_VERSION:=2.28.10
MBEDTLS_HASH:=19e5b81fdac0fe22009b9e2bdcd52d7dcafbf62bc67fc59cf0a76b5b5540d149
PCRE2_VERSION:=10.47
PCRE2_HASH:=47fe8c99461250d42f89e6e8fdaeba9da057855d06eb7fc08d9ca03fd08d7bc7

LIBBLOOM_COMMIT:=437e1add5a2b9a87797d8c648df7cf5f3ee155a8
LIBBLOOM_HASH:=6e0131faa238c5dd15da4b43931d2f628590ba07e1177a47ead8e4dd18752459
LIBCORK_COMMIT:=074e074b26e9e372e90e6ade215217763c8644aa
LIBCORK_HASH:=f8e4b637f35bbe0bc5d893164e439aefa61d2b6fe58b0a79c30e42f5f54f08e0
LIBIPSET_COMMIT:=3ea7fe30adf4b39b27d932e5a70a2ddce4adb508
LIBIPSET_HASH:=89be31c635814948c0887f660d2a98f4bc4b1dc6691a57d653c2466a8098f887

PKG_LICENSE:=GPL-3.0
PKG_BUILD_PARALLEL:=1
PKG_BUILD_FLAGS:=lto gc-sections

include $(INCLUDE_DIR)/package.mk
include $(INCLUDE_DIR)/cmake.mk

define Package/shadowsocks-libev
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Shadowsocks-libev (all deps static)
  DEPENDS:=+libc +libpthread
  URL:=https://github.com/shadowsocks/shadowsocks-libev
endef

define Package/shadowsocks-libev/description
  Lightweight SOCKS5 proxy with encrypted tunnel.
  All dependencies (libev, libsodium, c-ares, mbedTLS, PCRE2)
  are downloaded and statically linked at build time.
endef

SS_DEPS_DIR:=$(PKG_BUILD_DIR)/deps
SS_DEPS_SRC:=$(PKG_BUILD_DIR)/deps-src
SS_BUILD_DIR:=$(PKG_BUILD_DIR)/cmake-build
# Strip LTO from dep builds — static .a with -fno-fat-lto-objects breaks test tool linking
SS_DEPS_CFLAGS:=$(filter-out -flto% -fno-fat-lto-objects -fuse-linker-plugin,$(TARGET_CFLAGS))
SS_DEPS_LDFLAGS:=$(filter-out -flto% -fuse-linker-plugin,$(TARGET_LDFLAGS))
SS_COMMON_CFLAGS:=$(SS_DEPS_CFLAGS) -I$(SS_DEPS_DIR)/include
SS_COMMON_LDFLAGS:=$(SS_DEPS_LDFLAGS) -L$(SS_DEPS_DIR)/lib

# Skip default configure — we handle it ourselves after building deps
define Build/Configure
	true
endef

define Build/Compile
	mkdir -p $(SS_DEPS_DIR) $(SS_DEPS_SRC)
	# --- 1. Build libev ---
	if [ ! -f "$(SS_DEPS_DIR)/lib/libev.a" ]; then \
		echo "=== Building libev $(LIBEV_VERSION) ===" ; \
		mkdir -p $(DL_DIR) && cd $(DL_DIR) && \
		{ [ -f libev-$(LIBEV_VERSION).tar.gz ] || \
		  curl -fsSLO "http://dist.schmorp.de/libev/libev-$(LIBEV_VERSION).tar.gz" ; } && \
		echo "$(LIBEV_HASH)  libev-$(LIBEV_VERSION).tar.gz" | sha256sum -c - && \
		tar xf libev-$(LIBEV_VERSION).tar.gz -C $(SS_DEPS_SRC) && \
		cd $(SS_DEPS_SRC)/libev-$(LIBEV_VERSION) && \
		CC="$(TARGET_CC)" CFLAGS="$(SS_DEPS_CFLAGS)" LDFLAGS="$(SS_DEPS_LDFLAGS)" \
		./configure --host=$(GNU_TARGET_NAME) --prefix=$(SS_DEPS_DIR) \
			--enable-static --disable-shared && \
		$(MAKE) -j$$$$(nproc) && $(MAKE) install ; \
	fi
	# --- 2. Build libsodium ---
	if [ ! -f "$(SS_DEPS_DIR)/lib/libsodium.a" ]; then \
		echo "=== Building libsodium $(LIBSODIUM_VERSION) ===" ; \
		mkdir -p $(DL_DIR) && cd $(DL_DIR) && \
		{ [ -f libsodium-$(LIBSODIUM_VERSION).tar.gz ] || \
		  curl -fsSLO "https://github.com/jedisct1/libsodium/releases/download/$(LIBSODIUM_VERSION)-RELEASE/libsodium-$(LIBSODIUM_VERSION).tar.gz" ; } && \
		echo "$(LIBSODIUM_HASH)  libsodium-$(LIBSODIUM_VERSION).tar.gz" | sha256sum -c - && \
		tar xf libsodium-$(LIBSODIUM_VERSION).tar.gz -C $(SS_DEPS_SRC) && \
		SODIUM_DIR=$$$$(find $(SS_DEPS_SRC) -maxdepth 1 -name "libsodium-*" -type d | head -1) && \
		cd "$$$$SODIUM_DIR" && \
		CC="$(TARGET_CC)" CFLAGS="$(SS_DEPS_CFLAGS)" LDFLAGS="$(SS_DEPS_LDFLAGS)" \
		./configure --host=$(GNU_TARGET_NAME) --prefix=$(SS_DEPS_DIR) \
			--enable-static --disable-shared --disable-ssp && \
		$(MAKE) -j$$$$(nproc) && $(MAKE) install ; \
	fi
	# --- 3. Build c-ares ---
	if [ ! -f "$(SS_DEPS_DIR)/lib/libcares.a" ]; then \
		echo "=== Building c-ares $(CARES_VERSION) ===" ; \
		mkdir -p $(DL_DIR) && cd $(DL_DIR) && \
		{ [ -f c-ares-$(CARES_VERSION).tar.gz ] || \
		  curl -fsSLO "https://github.com/c-ares/c-ares/releases/download/v$(CARES_VERSION)/c-ares-$(CARES_VERSION).tar.gz" ; } && \
		echo "$(CARES_HASH)  c-ares-$(CARES_VERSION).tar.gz" | sha256sum -c - && \
		tar xf c-ares-$(CARES_VERSION).tar.gz -C $(SS_DEPS_SRC) && \
		cd $(SS_DEPS_SRC)/c-ares-$(CARES_VERSION) && \
		CC="$(TARGET_CC)" CFLAGS="$(SS_DEPS_CFLAGS)" LDFLAGS="$(SS_DEPS_LDFLAGS)" \
		./configure --host=$(GNU_TARGET_NAME) --prefix=$(SS_DEPS_DIR) \
			--enable-static --disable-shared && \
		$(MAKE) -j$$$$(nproc) && $(MAKE) install ; \
	fi
	# --- 4. Build mbedTLS ---
	if [ ! -f "$(SS_DEPS_DIR)/lib/libmbedtls.a" ]; then \
		echo "=== Building mbedTLS $(MBEDTLS_VERSION) ===" ; \
		mkdir -p $(DL_DIR) && cd $(DL_DIR) && \
		{ [ -f mbedtls-$(MBEDTLS_VERSION).tar.bz2 ] || \
		  curl -fsSLO "https://github.com/Mbed-TLS/mbedtls/releases/download/mbedtls-$(MBEDTLS_VERSION)/mbedtls-$(MBEDTLS_VERSION).tar.bz2" ; } && \
		echo "$(MBEDTLS_HASH)  mbedtls-$(MBEDTLS_VERSION).tar.bz2" | sha256sum -c - && \
		tar xf mbedtls-$(MBEDTLS_VERSION).tar.bz2 -C $(SS_DEPS_SRC) && \
		cd $(SS_DEPS_SRC)/mbedtls-$(MBEDTLS_VERSION) && \
		sed -i 's|//#define MBEDTLS_THREADING_C|#define MBEDTLS_THREADING_C|' include/mbedtls/config.h && \
		sed -i 's|//#define MBEDTLS_THREADING_PTHREAD|#define MBEDTLS_THREADING_PTHREAD|' include/mbedtls/config.h && \
		$(MAKE) -j$$$$(nproc) CC="$(TARGET_CC)" AR="$(TARGET_CROSS)gcc-ar" \
			CFLAGS="$(SS_DEPS_CFLAGS)" LDFLAGS="$(SS_DEPS_LDFLAGS)" \
			DESTDIR=$(SS_DEPS_DIR) lib install && \
		[ -d "$(SS_DEPS_DIR)/include/psa" ] || cp -r include/psa $(SS_DEPS_DIR)/include/ 2>/dev/null || true ; \
	fi
	# --- 5. Build PCRE2 ---
	if [ ! -f "$(SS_DEPS_DIR)/lib/libpcre2-8.a" ]; then \
		echo "=== Building PCRE2 $(PCRE2_VERSION) ===" ; \
		mkdir -p $(DL_DIR) && cd $(DL_DIR) && \
		{ [ -f pcre2-$(PCRE2_VERSION).tar.bz2 ] || \
		  curl -fsSLO "https://github.com/PCRE2Project/pcre2/releases/download/pcre2-$(PCRE2_VERSION)/pcre2-$(PCRE2_VERSION).tar.bz2" ; } && \
		echo "$(PCRE2_HASH)  pcre2-$(PCRE2_VERSION).tar.bz2" | sha256sum -c - && \
		tar xf pcre2-$(PCRE2_VERSION).tar.bz2 -C $(SS_DEPS_SRC) && \
		cd $(SS_DEPS_SRC)/pcre2-$(PCRE2_VERSION) && \
		CC="$(TARGET_CC)" CFLAGS="$(SS_DEPS_CFLAGS)" LDFLAGS="$(SS_DEPS_LDFLAGS)" \
		./configure --host=$(GNU_TARGET_NAME) --prefix=$(SS_DEPS_DIR) \
			--enable-static --disable-shared \
			--enable-pcre2-8 --disable-pcre2-16 --disable-pcre2-32 \
			--disable-jit && \
		$(MAKE) -j$$$$(nproc) && $(MAKE) install ; \
	fi
	# --- 6. Restore embedded submodules pinned by upstream v$(PKG_VERSION) ---
	if [ ! -f "$(PKG_BUILD_DIR)/libcork/src/libcork/cli/commands.c" ]; then \
		echo "=== Fetching libcork $(LIBCORK_COMMIT) ===" ; \
		mkdir -p $(DL_DIR) && cd $(DL_DIR) && \
		{ [ -f libcork-$(LIBCORK_COMMIT).tar.gz ] || \
		  curl -fsSL "https://github.com/shadowsocks/libcork/archive/$(LIBCORK_COMMIT).tar.gz" -o libcork-$(LIBCORK_COMMIT).tar.gz ; } && \
		echo "$(LIBCORK_HASH)  libcork-$(LIBCORK_COMMIT).tar.gz" | sha256sum -c - && \
		rm -rf $(PKG_BUILD_DIR)/libcork && \
		tar xf libcork-$(LIBCORK_COMMIT).tar.gz -C $(PKG_BUILD_DIR) && \
		mv $(PKG_BUILD_DIR)/libcork-$(LIBCORK_COMMIT) $(PKG_BUILD_DIR)/libcork ; \
	fi
	if [ ! -f "$(PKG_BUILD_DIR)/libipset/src/libipset/general.c" ]; then \
		echo "=== Fetching libipset $(LIBIPSET_COMMIT) ===" ; \
		mkdir -p $(DL_DIR) && cd $(DL_DIR) && \
		{ [ -f libipset-$(LIBIPSET_COMMIT).tar.gz ] || \
		  curl -fsSL "https://github.com/shadowsocks/ipset/archive/$(LIBIPSET_COMMIT).tar.gz" -o libipset-$(LIBIPSET_COMMIT).tar.gz ; } && \
		echo "$(LIBIPSET_HASH)  libipset-$(LIBIPSET_COMMIT).tar.gz" | sha256sum -c - && \
		rm -rf $(PKG_BUILD_DIR)/libipset && \
		tar xf libipset-$(LIBIPSET_COMMIT).tar.gz -C $(PKG_BUILD_DIR) && \
		mv $(PKG_BUILD_DIR)/ipset-$(LIBIPSET_COMMIT) $(PKG_BUILD_DIR)/libipset ; \
	fi
	if [ ! -f "$(PKG_BUILD_DIR)/libbloom/bloom.c" ]; then \
		echo "=== Fetching libbloom $(LIBBLOOM_COMMIT) ===" ; \
		mkdir -p $(DL_DIR) && cd $(DL_DIR) && \
		{ [ -f libbloom-$(LIBBLOOM_COMMIT).tar.gz ] || \
		  curl -fsSL "https://github.com/shadowsocks/libbloom/archive/$(LIBBLOOM_COMMIT).tar.gz" -o libbloom-$(LIBBLOOM_COMMIT).tar.gz ; } && \
		echo "$(LIBBLOOM_HASH)  libbloom-$(LIBBLOOM_COMMIT).tar.gz" | sha256sum -c - && \
		rm -rf $(PKG_BUILD_DIR)/libbloom && \
		tar xf libbloom-$(LIBBLOOM_COMMIT).tar.gz -C $(PKG_BUILD_DIR) && \
		mv $(PKG_BUILD_DIR)/libbloom-$(LIBBLOOM_COMMIT) $(PKG_BUILD_DIR)/libbloom ; \
	fi
	# --- 7. Build shadowsocks-libev ---
	echo "=== Building shadowsocks-libev $(PKG_VERSION) ==="
	rm -rf $(SS_BUILD_DIR) && mkdir -p $(SS_BUILD_DIR)
	cd $(SS_BUILD_DIR) && \
	PKG_CONFIG_PATH="$(SS_DEPS_DIR)/lib/pkgconfig" \
	CFLAGS="$(SS_COMMON_CFLAGS)" \
	LDFLAGS="$(SS_COMMON_LDFLAGS) -Wl,--dynamic-linker=/lib/ld-linux.so.3" \
	cmake \
		-DCMAKE_SYSTEM_NAME=Linux \
		-DCMAKE_SYSTEM_VERSION=1 \
		-DCMAKE_SYSTEM_PROCESSOR=$(ARCH) \
		-DCMAKE_BUILD_TYPE=Release \
		-DCMAKE_C_COMPILER="$(CMAKE_C_COMPILER)" \
		-DCMAKE_AR="$(CMAKE_AR)" \
		-DCMAKE_NM="$(CMAKE_NM)" \
		-DCMAKE_RANLIB="$(CMAKE_RANLIB)" \
		-DCMAKE_FIND_ROOT_PATH="$(SS_DEPS_DIR);$(CMAKE_FIND_ROOT_PATH)" \
		-DCMAKE_FIND_ROOT_PATH_MODE_PROGRAM=NEVER \
		-DCMAKE_FIND_ROOT_PATH_MODE_LIBRARY=ONLY \
		-DCMAKE_FIND_ROOT_PATH_MODE_INCLUDE=ONLY \
		-DCMAKE_PREFIX_PATH="$(SS_DEPS_DIR)" \
		-DCMAKE_INCLUDE_PATH="$(SS_DEPS_DIR)/include" \
		-DCMAKE_LIBRARY_PATH="$(SS_DEPS_DIR)/lib" \
		-DCMAKE_EXE_LINKER_FLAGS:STRING="$(SS_COMMON_LDFLAGS) -Wl,--dynamic-linker=/lib/ld-linux.so.3" \
		-DCMAKE_SKIP_RPATH=TRUE \
		-DCMAKE_INSTALL_PREFIX=/usr \
		-DWITH_STATIC=ON \
		-DWITH_EMBEDDED_SRC=ON \
		-DBUILD_SHARED_LIBS=OFF \
		-DBUILD_TESTING=OFF \
		-DENABLE_CONNMARKTOS=OFF \
		-DENABLE_NFTABLES=OFF \
		-DDISABLE_SSP=ON \
		$(PKG_BUILD_DIR) && \
	cmake --build . --target ss-redir ss-tunnel ss-local -j$$$$(nproc)
endef

define Build/Install
	true
endef

define Package/shadowsocks-libev/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(SS_BUILD_DIR)/bin/ss-redir $(1)/usr/bin/
	$(INSTALL_BIN) $(SS_BUILD_DIR)/bin/ss-tunnel $(1)/usr/bin/
	$(INSTALL_BIN) $(SS_BUILD_DIR)/bin/ss-local $(1)/usr/bin/
endef

$(eval $(call BuildPackage,shadowsocks-libev))
