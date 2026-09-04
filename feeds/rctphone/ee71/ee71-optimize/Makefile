include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-optimize
PKG_VERSION:=1.6.0
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/ee71-optimize
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=Performance optimization (full suite)
  DEPENDS:=+libc +jq +sqlite3
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

  1.6.0 dropped the two WiFi boot scripts (S38ee71_prewarm_wlan,
  S92ee71_wifi_boot) and their helpers. They existed to force
  <WlanMode>AP-AP</WlanMode> back into mobileap_cfg.xml at boot, fighting a
  revert that our own wifi.cgi caused by writing to the wifi_config rows
  core_app derives its WLAN mode from: a corrupted row made core_app ask
  QCMAP for plain AP, and QCMAP then persisted AP. With that write gone,
  QCMAP starts both APs from its own XML and core_app re-asserts AP-AP
  itself; the scripts were already no-ops on the last boot. See
  docs/plans/ee71-dual-wifi-redesign.md.
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
	$(INSTALL_DIR) $(1)/etc/rcS.d
	$(LN) ../init.d/oem_watch_patch $(1)/etc/rcS.d/S36oem_watch_patch
	$(LN) ../init.d/ee71_optimize $(1)/etc/rcS.d/S11lan_accept
	$(INSTALL_DIR) $(1)/etc/rc5.d
	$(LN) ../init.d/parallel_boot $(1)/etc/rc5.d/S10parallel_boot
	$(LN) ../init.d/ee71_optimize $(1)/etc/rc5.d/S11ee71_optimize
	$(LN) ../init.d/qcmap_renice $(1)/etc/rc5.d/S91qcmap_renice
	$(INSTALL_DIR) $(1)/etc
	$(INSTALL_DATA) ./files/sysctl.conf $(1)/etc/sysctl.conf
	$(INSTALL_DATA) ./files/fstab.optimized $(1)/etc/fstab.optimized
endef

# 1.5.4 and earlier shipped the two WiFi boot scripts, their helpers and
# their rc symlinks. opkg unlinks the files it owns on upgrade, but:
#  - ee71_apply_wifi_boot runs backgrounded and waits up to 70 s for QCMAP.
#    On an upgrade shortly after boot a copy is still alive with the script
#    already read into memory; unlinking the file does not stop it, and it
#    would go on to sed <WlanMode> and fire a mode-switching apply at a
#    qcmap_wifi_ctl that no longer has that code. Kill it first.
#  - /etc/init.d/enable_dual_wifi is owned by no package at all (an orphan
#    dropped on the device by hand on 2026-03-01, no rc symlink, never run).
#    opkg will never remove it, so do it here.
# The rm -f list repeats files opkg already owns: they are cheap, idempotent,
# and cover a device where an earlier install left a symlink behind.
define Package/ee71-optimize/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
pkill -f /usr/bin/ee71_apply_wifi_boot 2>/dev/null
pkill -f /usr/bin/ee71_prewarm_wlan_mode 2>/dev/null
rm -f /etc/rcS.d/S38ee71_prewarm_wlan \
      /etc/rc5.d/S92ee71_wifi_boot \
      /etc/init.d/ee71_prewarm_wlan \
      /etc/init.d/ee71_wifi_boot \
      /etc/init.d/enable_dual_wifi \
      /usr/bin/ee71_prewarm_wlan_mode \
      /usr/bin/ee71_apply_wifi_boot \
      /tmp/ee71_prewarm_wlan.log \
      /tmp/ee71_apply_wifi_boot.log \
      /tmp/ee71_wifi_health
exit 0
endef

$(eval $(call BuildPackage,ee71-optimize))
