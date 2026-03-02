include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-optimize
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/ee71-optimize
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=Performance optimization (full suite)
  DEPENDS:=+libc
endef

define Package/ee71-optimize/description
  EE71 performance optimization — all phases from optimization design doc.

  Phase 1 (oem_watch cleanup):
  - Remove drop_caches anti-pattern (7 occurrences, destroyed page cache)
  - Remove sysrq-trigger memory dumps
  - Skip sqlite3_integrity_check on boot
  - Increase oem_watch sleep from 15s to 60s

  Phase 1 (init script cleanup):
  - Disable bootlogd (debug only)
  - Disable hwclock.sh (no RTC hardware)
  - Disable start_alx_le (Atheros ethernet, no hardware)
  - Disable eMBMs_TunnelingModule (LTE broadcast, unused)
  - Disable start_subsystem_ramdump (debug only)
  - Disable stop-bootlogd
  - Reduce misc-daemon modem timeout 10s to 3s

  Phase 2 (service cleanup):
  - Right-size tmpfs (203MB to 100MB: /run 4m, /var/volatile 48m, /media/ram 48m)
  - Disable getty on ttyHSL0 (serial console)
  - Disable nbnsd (NetBIOS, QCMAP-respawned — rename binary)

  Phase 2 (filesystem):
  - Remount all UBIFS with noatime (20-30% write savings)
  - Rootfs noatime (kernel initial mount workaround)

  Phase 2 (memory):
  - Sysctl: swappiness=0, vfs_cache_pressure=50, min_free_kbytes=4096
  - Sysctl: dirty_ratio=10, dirty_background_ratio=5, overcommit_memory=1
  - Sysctl: dirty_expire_centisecs=1500, dirty_writeback_centisecs=500
  - Sysctl: printk=3 3 3 3, panic=10

  Phase 2 (storage cleanup):
  - Remove Bluetooth tools (btmon, hci*, sdptool)
  - Remove QMI test/ping utilities
  - Remove audio tools (amix, aplay, arec)
  - Remove keyboard tools (dumpkeys, loadkeys, setfont)
  - Remove testCne

  Phase 2 (firewall):
  - LAN firewall accept rule (bridge0 INPUT)
  - Disable dbus-daemon (no clients found on audit)

  Phase 3 (boot parallelization):
  - parallel_boot: backgrounds dropbear, syslog, thermal-engine, lan_accept, chgrp-diag
  - Keeps modem stack sequential: qmuxd -> netmgrd -> QCMAP -> qti -> core_app

  Phase 4 (runtime):
  - qcmap_renice: renices QCMAP busy-loop threads to priority 19
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

$(eval $(call BuildPackage,ee71-optimize))
