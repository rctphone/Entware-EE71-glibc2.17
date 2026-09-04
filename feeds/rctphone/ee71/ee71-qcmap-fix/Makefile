include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-qcmap-fix
PKG_VERSION:=1.2.0
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

  Patch 1 — zero-length netlink fix (12 bytes at file offset 0x1C4C4,
  vaddr 0x244C4): fixes an infinite busy loop when a netlink TLV attribute
  has length=0.

  Patch 2 — preserve dnsmasq leases (1 byte at 0x6A858):
  Disables rm of /var/lib/misc/dnsmasq.leases on dnsmasq restart.
  QCMAP kills and restarts dnsmasq on WAN reconnect, deleting leases.
  This patch comments out the rm command so clients keep their IPs.

  Init script backs up the original, applies both patches, verifies, and
  restarts QCMAP. `stop` reverts to stock bytes; it works from the bytes
  themselves, so removing the package really does undo the patch.

  1.2.0 fixes patch 1's file offset. It was 116932 (0x1C8C4), 0x400 past the
  patch site, so patch 1 silently took the "bytes don't match" branch and was
  never applied on any device. It is 115908 (0x1C4C4) now — which means the
  next install of this package applies patch 1 for the first time. 1.2.0 also
  restarts QCMAP after patching instead of only killing it (nothing on this
  device respawns QCMAP), and adds the prerm revert.
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

# This package modifies a vendor binary it does not own. The revert lives in
# the init script, which opkg deletes on remove — so it has to run here, before
# the deletion, or the patched QCMAP is stranded with its undo gone from disk.
# Skipped during offline image builds.
define Package/ee71-qcmap-fix/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
if [ -x /etc/init.d/apply_qcmap_fix ]; then
	/etc/init.d/apply_qcmap_fix stop || true
	# The 478 KB stock copy is dead weight on a 16 MB /usr once the live
	# binary is stock again. Only drop it if the revert actually verified.
	if /etc/init.d/apply_qcmap_fix status 2>/dev/null | grep -q ': stock'; then
		rm -f /usr/bin/QCMAP_ConnectionManager.orig
	fi
fi
rm -f /usr/bin/QCMAP_ConnectionManager.tmp
exit 0
endef

$(eval $(call BuildPackage,ee71-qcmap-fix))
