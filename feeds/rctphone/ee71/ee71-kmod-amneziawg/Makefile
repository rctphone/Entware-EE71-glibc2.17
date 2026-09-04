include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-kmod-amneziawg
# The version the shipped files/amneziawg.ko actually reports:
#   strings files/amneziawg.ko | grep '^version='  ->  version=1.0.20251009
# It was labelled 1.0.20220627, which is neither this module's tag nor the
# awg tool's. Nothing was rebuilt; only the label was corrected.
PKG_VERSION:=1.0.20251009
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/ee71-kmod-amneziawg
  SECTION:=ee71
  CATEGORY:=EE71
  SUBMENU:=Kernel modules
  TITLE:=AmneziaWG kernel module (pre-built)
  DEPENDS:=+ee71-kmod-tun
endef

define Package/ee71-kmod-amneziawg/description
  AmneziaWG VPN kernel module for kernel 3.10.49.
  WireGuard variant with anti-DPI obfuscation.
  Pre-built with Linaro GCC 4.9 using compat layer.
endef

define Build/Compile
	true
endef

define Package/ee71-kmod-amneziawg/install
	$(INSTALL_DIR) $(1)/lib/modules/3.10.49
	$(INSTALL_DATA) ./files/amneziawg.ko $(1)/lib/modules/3.10.49/
endef

$(eval $(call BuildPackage,ee71-kmod-amneziawg))
