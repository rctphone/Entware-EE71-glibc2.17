include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-usb-adb
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/ee71-usb-adb
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=Kernel USB composition patch (ADB on all hosts)
  DEPENDS:=+busybox
endef

define Package/ee71-usb-adb/description
  Patches the kernel jrd_usb_configs_tab in RAM via /dev/kmem on every
  boot to add ADB (FunctionFS), DIAG, and Serial to all USB host
  compositions (Mac, Windows, Linux).
endef

define Build/Compile
	true
endef

define Package/ee71-usb-adb/install
	$(INSTALL_DIR) $(1)/etc/rcS.d
	$(INSTALL_BIN) ./files/patch_usb_kernel $(1)/etc/rcS.d/S01patch_usb_kernel
endef

$(eval $(call BuildPackage,ee71-usb-adb))
