include $(TOPDIR)/rules.mk

PKG_NAME:=iperf3
PKG_VERSION:=3.20
PKG_RELEASE:=1

PKG_SOURCE:=iperf-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=https://downloads.es.net/pub/iperf/
PKG_HASH:=skip

PKG_LICENSE:=BSD-3-Clause
PKG_INSTALL:=1
PKG_BUILD_PARALLEL:=1
PKG_BUILD_FLAGS:=lto gc-sections

PKG_BUILD_DIR:=$(BUILD_DIR)/iperf-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/iperf3
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Network bandwidth measurement tool
  DEPENDS:=+libc +openssl +libatomic
  PROVIDES:=iperf3-ssl
  URL:=https://software.es.net/iperf/
endef

TARGET_CFLAGS += -D_GNU_SOURCE
TARGET_LDFLAGS += -latomic

CONFIGURE_ARGS += \
	--with-openssl=$(STAGING_DIR)/usr \
	--without-sctp \
	--disable-shared --enable-static

define Package/iperf3/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/bin/iperf3 $(1)/usr/bin/
endef

$(eval $(call BuildPackage,iperf3))
