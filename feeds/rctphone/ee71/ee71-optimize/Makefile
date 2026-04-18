include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-optimize
PKG_VERSION:=1.5.1
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/ee71-optimize
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=Performance optimization (full suite)
  DEPENDS:=+libc +jq +sqlite3 +ee71-qcmap-wifi-ctl
endef

define Package/ee71-optimize/description
  EE71 performance optimization suite.

  One-time (marker file, skipped on subsequent boots):
  - Disable unused init scripts (bootlogd, hwclock, alx, eMBMs, ramdump, dbus)
  - Disable getty, nbnsd, reduce misc-daemon timeout
  - Patch find_partitions.sh with noatime, install optimized fstab
  - Remove unused binaries (~4 MB: bluetooth, perl, QMI test, audio, keyboard)

  Every boot:
  - Right-size tmpfs (203MB reserved → 100MB), clean stale CGI temp files
  - Remount UBIFS with noatime, apply sysctl tuning
  - bridge0 INPUT ACCEPT firewall rule

  Companion scripts (separate init entries):
  - oem_watch_patch: remove drop_caches anti-pattern from watchdog
  - parallel_boot: background dropbear/syslog/thermal-engine at boot
  - qcmap_renice: renice QCMAP busy-loop threads to priority 19
endef

define Build/Compile
	true
endef

define Package/ee71-optimize/install
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/ee71_optimize $(1)/etc/init.d/
	$(INSTALL_BIN) ./files/oem_watch_patch $(1)/etc/init.d/
	$(INSTALL_BIN) ./files/parallel_boot $(1)/etc/init.d/
	$(INSTALL_BIN) ./files/qcmap_renice $(1)/etc/init.d/
	$(INSTALL_BIN) ./files/ee71_prewarm_wlan.init $(1)/etc/init.d/ee71_prewarm_wlan
	$(INSTALL_BIN) ./files/ee71_wifi_boot.init $(1)/etc/init.d/ee71_wifi_boot
	$(INSTALL_DIR) $(1)/etc/rcS.d
	$(LN) ../init.d/oem_watch_patch $(1)/etc/rcS.d/S36oem_watch_patch
	$(LN) ../init.d/ee71_prewarm_wlan $(1)/etc/rcS.d/S38ee71_prewarm_wlan
	$(LN) ../init.d/ee71_optimize $(1)/etc/rcS.d/S11lan_accept
	$(INSTALL_DIR) $(1)/etc/rc5.d
	$(LN) ../init.d/parallel_boot $(1)/etc/rc5.d/S10parallel_boot
	$(LN) ../init.d/ee71_optimize $(1)/etc/rc5.d/S11ee71_optimize
	$(LN) ../init.d/qcmap_renice $(1)/etc/rc5.d/S91qcmap_renice
	$(LN) ../init.d/ee71_wifi_boot $(1)/etc/rc5.d/S92ee71_wifi_boot
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./files/ee71_prewarm_wlan_mode $(1)/usr/bin/ee71_prewarm_wlan_mode
	$(INSTALL_BIN) ./files/ee71_apply_wifi_boot $(1)/usr/bin/ee71_apply_wifi_boot
	$(INSTALL_DIR) $(1)/etc
	$(INSTALL_DATA) ./files/sysctl.conf $(1)/etc/sysctl.conf
	$(INSTALL_DATA) ./files/fstab.optimized $(1)/etc/fstab.optimized
endef

$(eval $(call BuildPackage,ee71-optimize))
