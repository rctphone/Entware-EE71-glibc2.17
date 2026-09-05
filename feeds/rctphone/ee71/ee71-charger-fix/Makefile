include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-charger-fix
PKG_VERSION:=1.0.0
PKG_RELEASE:=4

include $(INCLUDE_DIR)/package.mk

define Package/ee71-charger-fix
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=Stop the charger tripping the USB port's over-current protection
  DEPENDS:=+busybox
endef

define Package/ee71-charger-fix/description
  The stock firmware programs the BQ25601's input current limit to 1500 mA on
  every USB attach, even when it has just recognised the port as a plain USB
  host port. Both lines appear together in the device's own log:

      bq25601-charger 3-006b: Warning: USB TYPE POWER_SUPPLY_TYPE_USB
      bq25601-charger 3-006b: set input limit to 1500mA !!!

  On a 500 mA port the inrush at the next recharge attempt trips the HOST's
  over-current protection. VBUS then disappears completely - the charger
  reports power_good 0 AND vbus_stat 0, which is power gone rather than power
  sagging - the USB gadget disconnects, ecm0 leaves the bridge, and the host
  sees a brand new device. From the outside this looks exactly like the router
  rebooting every few minutes, and on a Mac it makes Parallels ask again which
  VM should get the device. The router is not rebooting: uptime is continuous
  across every one of these events.

  What drives it is a software loop, not the chip. Measured on the device:
  battery 4151 mV against a hardware recharge threshold of 4008 mV
  (REG04 VREG 4208 mV, VRECHG 200 mV), so the BQ25601 is not asking to
  recharge at all. The vendor's battery_core layer decides on its own, from a
  reported capacity of 97%, and retries every 20 seconds - 72 times in one
  observed window - re-enabling charging each time. Roughly one attempt in nine
  collapsed the port.

  This package lowers one register field: REG00 bits[4:0], the input current
  limit, to what the port actually advertises. Nothing else is touched - not
  the charge current (REG02 ICHG), not the charge voltage (REG04 VREG), not
  the safety timer. The value is only ever lowered, never raised, so the worst
  outcome is slower charging.

  Verified on the device before this package existed: writing REG00 0x6e ->
  0x64 (1500 mA -> 500 mA) held, the vendor driver did not overwrite it across
  a recharge event, and no further VBUS drop occurred while it was in place.
  The driver reprograms REG00 on USB ATTACH rather than on every recharge,
  which is why a slow poll is enough to survive a replug.

  Why it cannot be a kernel patch: battery_core and the bq25601 driver are not
  in the CodeLinaro msm-3.10 tree this device's kernel came from. They are TCL
  additions, compiled in rather than built as modules, and published nowhere -
  a GitHub code search for the exact log string "set input limit to 1500mA !!!"
  returns only this project's own repository. The register map used here comes
  from the public bq2560x drivers in other vendors' kernels.

  SAFETY. The chip is located by name - the init script reads
  /sys/bus/i2c/devices/*/name and refuses unless it finds bq25601-charger -
  rather than by a hardcoded bus and address, because writing a register to
  whatever else might sit at 3-006b is not a risk worth taking. It only ever
  lowers the limit. It cannot overcharge a battery: the charge voltage and
  current registers are never written.

  REQUIRES BUSYBOX 1.26 OR NEWER for the i2c applets, and this cannot be
  expressed as an opkg dependency. The stock firmware's BusyBox is 1.20.2,
  which predates them, and busybox is registered as stock-provided - so
  `DEPENDS:=+busybox` is satisfied by the stock claim while the applets are
  still missing. The init script checks at run time and says so.

  Usage:

      /etc/init.d/charger_limit start | stop | status | restart

  `status` prints the live register, the port's advertised limit, the enforced
  ceiling, and how many VBUS drops have happened since boot - which is the
  number to watch to tell whether this is working.

  Configuration lives in /etc/default/charger_limit. CHARGER_INPUT_LIMIT_MA is
  a CEILING, not a target: the enforced value is the lower of it and what the
  port advertises. On a genuine 2 A charger, raise it there rather than making
  this trust the port's own claim - this device has been observed classifying
  a laptop port as USB_DCP with current_max 2040000, which is how the fault
  presents in the first place.

  If it misbehaves, `/etc/init.d/charger_limit stop` ends the watcher and the
  vendor driver reprograms the register on the next USB attach. The register is
  deliberately not restored on stop: putting 1500 mA back would re-create the
  fault on purpose.
endef

define Build/Compile
endef

define Package/ee71-charger-fix/install
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/charger_limit $(1)/etc/init.d/charger_limit
	$(INSTALL_DIR) $(1)/etc/default
	$(INSTALL_DATA) ./files/charger_limit.default $(1)/etc/default/charger_limit
	$(INSTALL_DIR) $(1)/etc/rc5.d
	$(LN) ../init.d/charger_limit $(1)/etc/rc5.d/S99charger_limit
endef

# The config file is the user's once they have edited it.
define Package/ee71-charger-fix/conffiles
/etc/default/charger_limit
endef

define Package/ee71-charger-fix/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
/etc/init.d/charger_limit start || true
exit 0
endef

define Package/ee71-charger-fix/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
[ -x /etc/init.d/charger_limit ] && /etc/init.d/charger_limit stop || true
exit 0
endef

$(eval $(call BuildPackage,ee71-charger-fix))
