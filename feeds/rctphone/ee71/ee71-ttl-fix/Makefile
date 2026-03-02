include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-ttl-fix
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/ee71-ttl-fix
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=TTL/HL normalization for carrier detection bypass
  DEPENDS:=+libc
endef

define Package/ee71-ttl-fix/description
  Sets outgoing TTL (IPv4) and Hop Limit (IPv6) on cellular
  interfaces (rmnet+) via iptables/ip6tables mangle rules.
  Configurable TTL value via /etc/rcS.d/ttl file (default 64).
  Excludes ICMPv6 to avoid breaking NDP/RA/PMTU.
endef

define Build/Compile
	true
endef

define Package/ee71-ttl-fix/install
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/ttl_fix $(1)/etc/init.d/
	$(INSTALL_DIR) $(1)/etc/rcS.d
	$(LN) ../init.d/ttl_fix $(1)/etc/rcS.d/S45ttl_fix
endef

$(eval $(call BuildPackage,ee71-ttl-fix))
