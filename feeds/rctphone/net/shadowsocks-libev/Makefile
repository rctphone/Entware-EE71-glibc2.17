include $(TOPDIR)/rules.mk

PKG_NAME:=shadowsocks-libev
PKG_VERSION:=3.3.5
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=https://github.com/shadowsocks/shadowsocks-libev/releases/download/v$(PKG_VERSION)/
PKG_HASH:=skip

# Static dependency versions (downloaded and built inline)
LIBEV_VERSION:=4.33
LIBSODIUM_VERSION:=1.0.19
CARES_VERSION:=1.27.0
MBEDTLS_VERSION:=2.28.8
PCRE_VERSION:=8.45

PKG_LICENSE:=GPL-3.0
PKG_BUILD_PARALLEL:=1
PKG_BUILD_FLAGS:=lto gc-sections

include $(INCLUDE_DIR)/package.mk

define Package/shadowsocks-libev
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Shadowsocks-libev (all deps static)
  DEPENDS:=+libc +libpthread
  URL:=https://github.com/shadowsocks/shadowsocks-libev
endef

define Package/shadowsocks-libev/description
  Lightweight SOCKS5 proxy with encrypted tunnel.
  All dependencies (libev, libsodium, c-ares, mbedTLS, PCRE)
  are downloaded and statically linked at build time.
endef

SS_DEPS_DIR:=$(PKG_BUILD_DIR)/deps
SS_DEPS_SRC:=$(PKG_BUILD_DIR)/deps-src
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
		cd /tmp && \
		curl -fsSLO "http://dist.schmorp.de/libev/libev-$(LIBEV_VERSION).tar.gz" && \
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
		cd /tmp && \
		curl -fsSLO "https://github.com/jedisct1/libsodium/releases/download/$(LIBSODIUM_VERSION)-RELEASE/libsodium-$(LIBSODIUM_VERSION).tar.gz" && \
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
		cd /tmp && \
		CARES_TAG=$$$$(echo "$(CARES_VERSION)" | tr '.' '_') && \
		curl -fsSLO "https://github.com/c-ares/c-ares/releases/download/cares-$$$${CARES_TAG}/c-ares-$(CARES_VERSION).tar.gz" && \
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
		cd /tmp && \
		curl -fsSLO "https://github.com/Mbed-TLS/mbedtls/releases/download/v$(MBEDTLS_VERSION)/mbedtls-$(MBEDTLS_VERSION).tar.bz2" && \
		tar xf mbedtls-$(MBEDTLS_VERSION).tar.bz2 -C $(SS_DEPS_SRC) && \
		cd $(SS_DEPS_SRC)/mbedtls-$(MBEDTLS_VERSION) && \
		sed -i 's|//#define MBEDTLS_THREADING_C|#define MBEDTLS_THREADING_C|' include/mbedtls/config.h && \
		sed -i 's|//#define MBEDTLS_THREADING_PTHREAD|#define MBEDTLS_THREADING_PTHREAD|' include/mbedtls/config.h && \
		$(MAKE) -j$$$$(nproc) CC="$(TARGET_CC)" AR="$(TARGET_CROSS)gcc-ar" \
			CFLAGS="$(SS_DEPS_CFLAGS)" LDFLAGS="$(SS_DEPS_LDFLAGS)" \
			DESTDIR=$(SS_DEPS_DIR) lib install && \
		[ -d "$(SS_DEPS_DIR)/include/psa" ] || cp -r include/psa $(SS_DEPS_DIR)/include/ 2>/dev/null || true ; \
	fi
	# --- 5. Build PCRE ---
	if [ ! -f "$(SS_DEPS_DIR)/lib/libpcre.a" ]; then \
		echo "=== Building PCRE $(PCRE_VERSION) ===" ; \
		cd /tmp && \
		curl -fsSL "https://sourceforge.net/projects/pcre/files/pcre/$(PCRE_VERSION)/pcre-$(PCRE_VERSION).tar.bz2/download" \
			-o pcre-$(PCRE_VERSION).tar.bz2 && \
		tar xf pcre-$(PCRE_VERSION).tar.bz2 -C $(SS_DEPS_SRC) && \
		cd $(SS_DEPS_SRC)/pcre-$(PCRE_VERSION) && \
		CC="$(TARGET_CC)" CFLAGS="$(SS_DEPS_CFLAGS)" LDFLAGS="$(SS_DEPS_LDFLAGS)" \
		./configure --host=$(GNU_TARGET_NAME) --prefix=$(SS_DEPS_DIR) \
			--enable-static --disable-shared --disable-cpp \
			--enable-utf --enable-unicode-properties && \
		$(MAKE) -j$$$$(nproc) && $(MAKE) install ; \
	fi
	# --- 6. Build shadowsocks-libev ---
	echo "=== Building shadowsocks-libev $(PKG_VERSION) ==="
	cd $(PKG_BUILD_DIR) && \
	PKG_CONFIG_PATH="$(SS_DEPS_DIR)/lib/pkgconfig" \
	CFLAGS="$(SS_COMMON_CFLAGS)" \
	LDFLAGS="$(SS_COMMON_LDFLAGS) -Wl,--dynamic-linker=/lib/ld-linux.so.3" \
	LIBS="-lmbedtls -lmbedx509 -lmbedcrypto -lsodium -lev -lpcre -lcares -lpthread -lm" \
	./configure \
		--host=$(GNU_TARGET_NAME) \
		--prefix=/usr \
		--disable-documentation \
		--disable-assert \
		--disable-ssp \
		--with-mbedtls=$(SS_DEPS_DIR) \
		--with-sodium=$(SS_DEPS_DIR) \
		--with-cares=$(SS_DEPS_DIR) \
		--with-pcre=$(SS_DEPS_DIR) && \
	$(MAKE) -j$$$$(nproc)
endef

define Package/shadowsocks-libev/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/src/ss-redir $(1)/usr/bin/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/src/ss-tunnel $(1)/usr/bin/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/src/ss-local $(1)/usr/bin/
endef

$(eval $(call BuildPackage,shadowsocks-libev))
