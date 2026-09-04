include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-core-app-wifi-fix
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/ee71-core-app-wifi-fix
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=Stop core_app from killing the 5 GHz (wlan1) AP
  DEPENDS:=+libc
endef

define Package/ee71-core-app-wifi-fix/description
  core_app's WiFi-apply path runs three broad `killall hostapd*` shell
  commands that tear down BOTH bands and then restart only wlan0, leaving
  the 5 GHz guest AP on wlan1 dead until something restarts it manually.

  This package replaces those three kill commands (plain NUL-terminated C
  strings, all loaded only by core_app fcn.001ea0a4) with calls to a small
  helper /etc/hk that kills ONLY wlan0's hostapd / hostapd_cli. wlan1 keeps
  running, so applying 2.4 GHz settings no longer drops 5 GHz.

  Patch is a string patch (no code change): each replacement is shorter
  than the slot it fills and is NUL-padded. The init script verifies the
  known stock byte layout before writing and refuses on any other build,
  is idempotent, and can revert to stock (`stop`). It runs in rcS (before
  oem_watch launches core_app) so the binary is patched in place while not
  running - no "Text file busy", no extra disk, no WAN blip.

  Backup of the stock binary goes to /cache/core_app.orig (2.98 MB; /usr
  has no room), and byte-level revert works even if that backup is gone.
endef

define Build/Compile
	true
endef

define Package/ee71-core-app-wifi-fix/install
	$(INSTALL_DIR) $(1)/usr/lib/ee71
	$(INSTALL_BIN) ./files/hk $(1)/usr/lib/ee71/hk
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/apply_core_app_wifi_fix $(1)/etc/init.d/
	$(INSTALL_DIR) $(1)/etc/rcS.d
	$(LN) ../init.d/apply_core_app_wifi_fix $(1)/etc/rcS.d/S41apply_core_app_wifi_fix
endef

define Package/ee71-core-app-wifi-fix/prerm
#!/bin/sh
# On removal, revert the binary to stock BEFORE the init script (which holds
# the only revert logic) is deleted. Skipped during offline image builds.
[ -n "$${IPKG_INSTROOT}" ] && exit 0
if [ -x /etc/init.d/apply_core_app_wifi_fix ]; then
	/etc/init.d/apply_core_app_wifi_fix stop || true
fi
exit 0
endef

$(eval $(call BuildPackage,ee71-core-app-wifi-fix))
