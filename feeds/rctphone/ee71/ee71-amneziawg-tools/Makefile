include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-amneziawg-tools
PKG_VERSION:=1.0.20220627
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/ee71-amneziawg-tools
  SECTION:=ee71
  CATEGORY:=EE71
  SUBMENU:=VPN
  TITLE:=AmneziaWG userspace tool (awg)
  DEPENDS:=+ee71-kmod-amneziawg
endef

define Package/ee71-amneziawg-tools/description
  AmneziaWG userspace control program (awg) for kernel 3.10.49.
  Fork of wireguard-tools with anti-DPI obfuscation support.
  Pre-built with ee71-crossoe (GCC 13.2, ARMv7-A soft-float).
endef

define Build/Compile
	true
endef

define Package/ee71-amneziawg-tools/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./files/awg $(1)/usr/bin/
endef

$(eval $(call BuildPackage,ee71-amneziawg-tools))
