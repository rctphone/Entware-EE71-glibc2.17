include $(TOPDIR)/rules.mk

PKG_NAME:=curl
PKG_VERSION:=8.17.0
PKG_RELEASE:=2

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.xz
PKG_SOURCE_URL:=https://curl.se/download/
PKG_HASH:=955f6e729ad6b3566260e8fef68620e76ba3c31acf0a18524416a185acf77992

PKG_LICENSE:=MIT
PKG_INSTALL:=1
PKG_BUILD_PARALLEL:=1
PKG_BUILD_FLAGS:=gc-sections

include $(INCLUDE_DIR)/package.mk

# Strip LTO flags — libtool export-symbols-regex breaks with LTO IR objects
TARGET_CFLAGS:=$(filter-out -flto% -fno-fat-lto-objects,$(TARGET_CFLAGS))
TARGET_LDFLAGS:=$(filter-out -flto% -fuse-linker-plugin,$(TARGET_LDFLAGS))

define Package/libcurl
  SECTION:=libs
  CATEGORY:=Libraries
  TITLE:=libcurl (HTTP/HTTPS)
  DEPENDS:=+libopenssl +zlib +ca-bundle
  URL:=https://curl.se/
endef

define Package/curl
  SECTION:=net
  CATEGORY:=Network
  TITLE:=curl CLI (HTTP/HTTPS only)
  DEPENDS:=+libcurl
  URL:=https://curl.se/
endef

CONFIGURE_ARGS += \
	--with-openssl=$(STAGING_DIR)/usr \
	--with-zlib=$(STAGING_DIR)/usr \
	--with-ca-bundle=/etc/ssl/certs/ca-certificates.crt \
	--without-ca-path \
	--without-brotli --without-libidn2 --without-libpsl \
	--without-librtmp --without-libssh2 --without-nghttp2 \
	--without-zstd \
	--enable-shared --disable-debug --disable-docs \
	--disable-manual --disable-verbose --disable-ares \
	--disable-cookies --enable-ipv6 --disable-proxy \
	--disable-unix-sockets \
	--disable-dict --disable-file --disable-ftp \
	--disable-gopher --disable-imap --disable-ldap \
	--disable-ldaps --disable-mqtt --disable-pop3 \
	--disable-rtsp --disable-smb --disable-smtp \
	--disable-telnet --disable-tftp \
	--enable-http --enable-threaded-resolver

define Build/InstallDev
	$(INSTALL_DIR) $(1)/usr/include/curl
	$(CP) $(PKG_INSTALL_DIR)/usr/include/curl/*.h $(1)/usr/include/curl/
	$(INSTALL_DIR) $(1)/usr/lib
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/libcurl.so* $(1)/usr/lib/
	$(INSTALL_DIR) $(1)/usr/lib/pkgconfig
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/pkgconfig/libcurl.pc $(1)/usr/lib/pkgconfig/
endef

define Package/libcurl/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/libcurl.so* $(1)/usr/lib/
endef

define Package/curl/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/bin/curl $(1)/usr/bin/
endef

$(eval $(call BuildPackage,libcurl))
$(eval $(call BuildPackage,curl))
