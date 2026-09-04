include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-kmod-wlan
# qcacld-2.0 QWLAN_VERSIONSTR of the source this was built from - the same
# version string the stock module on the device carries.
PKG_VERSION:=4.2.25.8
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/ee71-kmod-wlan
  SECTION:=ee71
  CATEGORY:=EE71
  SUBMENU:=Kernel modules
  TITLE:=WiFi driver, rebuilt from source (pre-built, not activated on install)
endef

define Package/ee71-kmod-wlan/description
  A from-source rebuild of the device's own WiFi driver: qcacld-2.0
  "Release 4.2.25.8 MDM9X40" (commit c26933bef522, 2016-05-10, branch
  LNX.LE.5.2 of the CodeLinaro qcacld-2.0 repository), compiled with GCC 4.9.4
  against the device's own kernel config. Stock options: no qcacld feature flag
  is set by hand, they are all derived from the kernel .config, which is why
  the result matches the vendor's module as closely as it does.

  THIS REPLACES A WORKING VENDOR DRIVER WITH A REBUILT ONE. There is no reason
  to install it unless you are chasing a specific WiFi defect or intend to
  change the driver source. If the rebuilt module does not load, the router
  comes up with no WiFi - no 2.4 GHz, no 5 GHz.

  Installing the package does NOT switch drivers. It only puts files on the
  device. Switching is a separate, deliberate step:

      /etc/init.d/ee71-wlan-rebuilt enable      # from the next WiFi start
      /etc/init.d/ee71-wlan-rebuilt disable     # back to stock
      /etc/init.d/ee71-wlan-rebuilt status
      dmesg | grep wlan_load                    # which driver actually loaded

  The stock /usr/lib/modules/3.10.49/extra/wlan.ko is never touched, moved or
  overwritten - so restoring it needs no backup of it. What `enable` changes is
  one line of the vendor's /etc/init.d/wlan (the only caller of insmod for this
  driver) so that it goes through /usr/lib/ee71/wlan_load. `disable` reverses
  that substitution byte for byte and reads no backup file, and removing the
  package runs `disable` first - so the stock driver comes back whether or not
  this package is still installed.

  IF IT MISBEHAVES - will not load, WiFi up but clients cannot associate,
  throughput collapses - recover over ADB, which comes up from rcS and does not
  depend on WiFi:

      adb shell
      /etc/init.d/ee71-wlan-rebuilt disable
      reboot

  There is deliberately no automatic fallback to the stock module at boot. It
  would run forever to guard against a state that takes thirty seconds to undo
  over a cable, and it would make every experiment lie about which driver
  actually loaded.

  The module ships gzipped (1.34 MB): /usr has about 3.6 MB free and the module
  is 3.63 MB, so an uncompressed second copy does not fit beside the stock one.
  wlan_load inflates it into tmpfs, insmods it from there, and deletes it. It
  is not offloaded to /cache: that partition is one we clean, and a WiFi driver
  that disappears when someone tidies up is worse than one that never shipped.

  What the module was built from is recorded in
  /usr/lib/ee71/wlan-rebuilt.buildinfo - source revision, compiler, vermagic,
  build options, size and sha256 - and `status` prints it.

  The four firmware blobs the driver loads (qwlan30.bin, bdwlan30.bin, otp30.bin,
  nvm_tlv_3.0.bin) live on the /firmware partition, are board-specific, and are
  not touched by any of this.

  Built by docker/kernel-modules/build.sh with BUILD_WLAN=1; build options live
  in QCACLD_KBUILD_EXTRA at the top of that script. Analysis:
  docs/wlan-ko-analysis.md
endef

MODULE_DIR:=/usr/lib/ee71

# The .ko is built out of tree with GCC 4.9 (kernel 3.10 cannot be built with
# GCC 8+), not by this Makefile. Fail with a useful message instead of a
# confusing install error when it is absent.
define Build/Compile
	@for f in wlan.ko.gz wlan.ko.buildinfo; do \
		[ -f ./files/$$$$f ] && continue; \
		echo "[ERR] $(PKG_NAME): ./files/$$$$f missing"; \
		echo "[ERR] build it first:"; \
		echo "[ERR]   cd docker/kernel-modules && BUILD_WLAN=1 ./build_host.sh"; \
		echo "[ERR]   cp work/out/wlan.ko.gz work/out/wlan.ko.buildinfo \\"; \
		echo "[ERR]      $(CURDIR)/files/"; \
		exit 1; \
	done
endef

define Package/ee71-kmod-wlan/install
	$(INSTALL_DIR) $(1)$(MODULE_DIR)
	$(INSTALL_DATA) ./files/wlan.ko.gz $(1)$(MODULE_DIR)/wlan-rebuilt.ko.gz
	$(INSTALL_DATA) ./files/wlan.ko.buildinfo $(1)$(MODULE_DIR)/wlan-rebuilt.buildinfo
	$(INSTALL_BIN) ./files/wlan_load $(1)$(MODULE_DIR)/wlan_load
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/ee71-wlan-rebuilt $(1)/etc/init.d/
endef

# No postinst: installing must not switch the WiFi driver. Activation is
# `/etc/init.d/ee71-wlan-rebuilt enable`, run by a human who is watching.

define Package/ee71-kmod-wlan/prerm
#!/bin/sh
# Put the stock driver back in the boot path BEFORE the script that knows how
# to do that is deleted. Skipped during offline image builds.
[ -n "$${IPKG_INSTROOT}" ] && exit 0
if [ -x /etc/init.d/ee71-wlan-rebuilt ]; then
	/etc/init.d/ee71-wlan-rebuilt disable || true
fi
exit 0
endef

$(eval $(call BuildPackage,ee71-kmod-wlan))
