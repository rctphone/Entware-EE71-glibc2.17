include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-kmod-tun
PKG_VERSION:=3.10.49
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/ee71-kmod-tun
  SECTION:=ee71
  CATEGORY:=EE71
  SUBMENU:=Kernel modules
  TITLE:=TUN/TAP device driver (pre-built)
endef

define Package/ee71-kmod-tun/description
  TUN/TAP network device kernel module for kernel 3.10.49.
  Pre-built with Linaro GCC 4.9 (required for this kernel).
endef

define Build/Compile
	true
endef

define Package/ee71-kmod-tun/install
	$(INSTALL_DIR) $(1)/lib/modules/3.10.49
	$(INSTALL_DATA) ./files/tun.ko $(1)/lib/modules/3.10.49/
endef

$(eval $(call BuildPackage,ee71-kmod-tun))
