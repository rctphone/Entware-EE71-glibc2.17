include $(TOPDIR)/rules.mk

PKG_NAME:=curl
PKG_VERSION:=7.88.1
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.xz
PKG_SOURCE_URL:=https://curl.se/download/
PKG_HASH:=skip

PKG_LICENSE:=MIT
PKG_INSTALL:=1
PKG_BUILD_PARALLEL:=1
PKG_BUILD_FLAGS:=lto gc-sections

include $(INCLUDE_DIR)/package.mk

define Package/curl
  SECTION:=net
  CATEGORY:=Network
  TITLE:=curl CLI + libcurl (HTTP/HTTPS only)
  DEPENDS:=+libopenssl +zlib +ca-bundle
  URL:=https://curl.se/
endef

CONFIGURE_ARGS += \
	--with-openssl=$(STAGING_DIR)/usr \
	--with-zlib=$(STAGING_DIR)/usr \
	--with-ca-bundle=/usr/etc/ssl/certs/ca-certificates.crt \
	--without-ca-path \
	--without-brotli --without-libidn2 --without-libpsl \
	--without-librtmp --without-libssh2 --without-nghttp2 \
	--without-zstd \
	--disable-shared --disable-debug --disable-docs \
	--disable-manual --disable-verbose --disable-ares \
	--disable-cookies --disable-ipv6 --disable-proxy \
	--disable-unix-sockets \
	--disable-dict --disable-file --disable-ftp \
	--disable-gopher --disable-imap --disable-ldap \
	--disable-ldaps --disable-mqtt --disable-pop3 \
	--disable-rtsp --disable-smb --disable-smtp \
	--disable-telnet --disable-tftp \
	--enable-http --enable-threaded-resolver

define Package/curl/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/bin/curl $(1)/usr/bin/
endef

$(eval $(call BuildPackage,curl))
