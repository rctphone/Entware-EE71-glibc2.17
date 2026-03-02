include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-qcmap-fix
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/ee71-qcmap-fix
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=QCMAP_ConnectionManager zero-length netlink fix
  DEPENDS:=+libc
endef

define Package/ee71-qcmap-fix/description
  Patches QCMAP_ConnectionManager binary to fix infinite busy loop
  caused by zero-length netlink TLV attributes. 12-byte ARM32 patch
  at vaddr 0x244C4 adds a zero-step guard in the attribute parser.
  Includes Python patcher script and init script that applies patch
  on boot (backs up original, verifies before patching).
endef

define Build/Compile
	true
endef

define Package/ee71-qcmap-fix/install
	$(INSTALL_DIR) $(1)/usr/lib/ee71
	$(INSTALL_DATA) ./files/patch_qcmap.py $(1)/usr/lib/ee71/
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/apply_qcmap_fix $(1)/etc/init.d/
	$(INSTALL_DIR) $(1)/etc/rcS.d
	$(LN) ../init.d/apply_qcmap_fix $(1)/etc/rcS.d/S40apply_qcmap_fix
endef

$(eval $(call BuildPackage,ee71-qcmap-fix))
