include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-qcmap-fix
PKG_VERSION:=1.1.0
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/ee71-qcmap-fix
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=QCMAP_ConnectionManager binary patches
  DEPENDS:=+libc
endef

define Package/ee71-qcmap-fix/description
  Patches QCMAP_ConnectionManager binary on boot.

  Patch 1 — zero-length netlink fix (12 bytes at 0x1C4C4):
  Fixes infinite busy loop when netlink TLV attribute has length=0.

  Patch 2 — preserve dnsmasq leases (1 byte at 0x6A858):
  Disables rm of /var/lib/misc/dnsmasq.leases on dnsmasq restart.
  QCMAP kills and restarts dnsmasq on WAN reconnect, deleting leases.
  This patch comments out the rm command so clients keep their IPs.

  Init script backs up original, applies both patches, verifies.
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
