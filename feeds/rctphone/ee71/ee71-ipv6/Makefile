include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-ipv6
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/ee71-ipv6
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=IPv6 support (firewall + dnsmasq AAAA filter + RA)
  DEPENDS:=+libc
endef

define Package/ee71-ipv6/description
  IPv6 support bundle for EE71:
  - ip6tables INPUT DROP firewall (mirrors IPv4 whitelist, runs before QCMAP)
  - Conditional dnsmasq AAAA filter (filter-AAAA when no WAN IPv6)
  - Router Advertisement init for periodic RA relay to LAN clients
endef

define Build/Compile
	true
endef

define Package/ee71-ipv6/install
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/ip6tables_firewall $(1)/etc/init.d/
	$(INSTALL_BIN) ./files/dnsmasq_ipv6_filter $(1)/etc/init.d/
	$(INSTALL_BIN) ./files/send_ra $(1)/etc/init.d/
	$(INSTALL_DIR) $(1)/etc/rcS.d
	$(LN) ../init.d/ip6tables_firewall $(1)/etc/rcS.d/S38ip6tables_firewall
	$(INSTALL_DIR) $(1)/etc/rc5.d
	$(LN) ../init.d/dnsmasq_ipv6_filter $(1)/etc/rc5.d/S95dnsmasq_ipv6_filter
	$(LN) ../init.d/send_ra $(1)/etc/rc5.d/S96send_ra
endef

$(eval $(call BuildPackage,ee71-ipv6))
