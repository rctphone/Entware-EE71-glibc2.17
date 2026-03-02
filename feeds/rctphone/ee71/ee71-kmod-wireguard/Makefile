include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-kmod-wireguard
PKG_VERSION:=1.0.20220627
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/ee71-kmod-wireguard
  SECTION:=ee71
  CATEGORY:=EE71
  SUBMENU:=Kernel modules
  TITLE:=WireGuard kernel module (pre-built)
  DEPENDS:=+ee71-kmod-tun
endef

define Package/ee71-kmod-wireguard/description
  WireGuard VPN kernel module for kernel 3.10.49.
  Pre-built with Linaro GCC 4.9 using compat layer.
endef

define Build/Compile
	true
endef

define Package/ee71-kmod-wireguard/install
	$(INSTALL_DIR) $(1)/lib/modules/3.10.49
	$(INSTALL_DATA) ./files/wireguard.ko $(1)/lib/modules/3.10.49/
endef

$(eval $(call BuildPackage,ee71-kmod-wireguard))
