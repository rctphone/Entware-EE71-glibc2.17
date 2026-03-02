include $(TOPDIR)/rules.mk

PKG_NAME:=miniupnpd
PKG_VERSION:=2.3.9
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=https://miniupnp.tuxfamily.org/files/
PKG_HASH:=skip

PKG_LICENSE:=BSD-3-Clause
PKG_BUILD_PARALLEL:=1
PKG_BUILD_FLAGS:=lto gc-sections

include $(INCLUDE_DIR)/package.mk

define Package/miniupnpd
  SECTION:=net
  CATEGORY:=Network
  TITLE:=UPnP/NAT-PMP/PCP daemon
  DEPENDS:=+libc +iptables +libnfnetlink +libnetfilter-conntrack
  PROVIDES:=miniupnpd-iptables
  URL:=http://miniupnp.free.fr/
endef

define Build/Configure
	cd $(PKG_BUILD_DIR) && \
	./configure \
		--firewall=iptables --ipv6 --igd2 \
		--leasefile --portinuse --vendorcfg \
		--disable-pppconn
	$(SED) '/HAS_LIBCAP/d' $(PKG_BUILD_DIR)/config.h
	$(SED) '/lcap/d' $(PKG_BUILD_DIR)/config.mk
endef

define Build/Compile
	$(MAKE) -C $(PKG_BUILD_DIR) \
		CC="$(TARGET_CC)" \
		CFLAGS="$(TARGET_CFLAGS) -DIPTABLES_143 -I$(STAGING_DIR)/usr/include" \
		LDFLAGS="$(TARGET_LDFLAGS) -L$(STAGING_DIR)/usr/lib -lip4tc -lip6tc -lnfnetlink -lnetfilter_conntrack"
endef

define Package/miniupnpd/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/miniupnpd $(1)/usr/sbin/
	$(INSTALL_DIR) $(1)/etc/miniupnpd
	$(INSTALL_DATA) ./files/miniupnpd.conf $(1)/etc/miniupnpd/
endef

$(eval $(call BuildPackage,miniupnpd))
