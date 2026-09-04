include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-ipv6
PKG_VERSION:=2.2.0
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/ee71-ipv6
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=Full IPv6 support (radish + firewall)
  DEPENDS:=+libpthread +librt
  PROVIDES:=ee71-radish
endef

define Package/ee71-ipv6/description
  Complete IPv6 stack for EE71 (formerly ee71-radish).

  Radish (Qualcomm v1.1 + EE71 enhancements):
  - RDNSS: wrapper adds -d flag for DNS server in RA
  - Periodic RA: cached RA every 600s on bridge
  - RS response: immediate RA reply from cache to client RS
  - Startup RS: solicits RA from modem at boot
  - Bridge IPv6: assigns prefix::1 to bridge0

  IPv6 infrastructure:
  - ip6tables INPUT + FORWARD DROP firewall (S38, before QCMAP)
  2.2.0 adds the FORWARD half. Until then the policy was ACCEPT and nothing
  else set it (QCMAP does not, contrary to the old comment in the script), so
  once the PDP type became IPv4v6 every LAN client was reachable from the
  internet on every port at its autoconfigured global address — there is no
  NAT on v6 to hide behind. The chain is now default DROP with stateful
  return traffic, LAN-sourced forwarding, and RFC 4890 transit ICMPv6.
  FORWARD is shared with miniupnpd's MINIUPNPD jump and vpn_apply's leak
  guard, so our rules are check-then-add and the chain is never flushed.
  The boot-time dnsmasq AAAA filter was removed in 2.1.0: it blocked the
  init chain for 42 s, and its SIGHUP could never apply filter-AAAA anyway
  (dnsmasq re-reads hosts and leases on SIGHUP, never its config file).
  LAN IPv6 is now rejected audibly rather than blackholed while a VPN is up
  (see vpn_apply in ee71-webui), so clients fall back to IPv4 immediately
  and no DNS-level filter is needed.
  Analysis: docs/plans/s95-dnsmasq-ipv6-filter-analysis.md

  Binary at /usr/libexec/radish, wrapper at /usr/sbin/radish.
  Links against stock device libs.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) ./src/*.c ./src/*.h $(PKG_BUILD_DIR)/
endef

define Build/Compile
	$(TARGET_CC) $(TARGET_CFLAGS) \
		-D__packed__= \
		-DIMAGE_APPS_PROC \
		-DFEATURE_DATA_LINUX_LE \
		-DFEATURE_DATA_PREFIX_DELEGATION \
		-DRADISH_OFFLINE \
		-DRADISH_LOG_QXDM \
		-DFEATURE_DATA_LOG_SYSLOG \
		-DUSE_GLIB \
		-I./include \
		-I./include/dsutils \
		-I./include/diag \
		-I./include/glib-2.0 \
		-I$(PKG_BUILD_DIR) \
		-c -o $(PKG_BUILD_DIR)/radish.o $(PKG_BUILD_DIR)/radish.c
	$(TARGET_CC) $(TARGET_CFLAGS) \
		-D__packed__= \
		-DIMAGE_APPS_PROC \
		-DFEATURE_DATA_LINUX_LE \
		-DFEATURE_DATA_PREFIX_DELEGATION \
		-DRADISH_OFFLINE \
		-DRADISH_LOG_QXDM \
		-DFEATURE_DATA_LOG_SYSLOG \
		-DUSE_GLIB \
		-I./include \
		-I./include/dsutils \
		-I./include/diag \
		-I./include/glib-2.0 \
		-I$(PKG_BUILD_DIR) \
		-c -o $(PKG_BUILD_DIR)/config.o $(PKG_BUILD_DIR)/config.c
	$(TARGET_CC) $(TARGET_CFLAGS) \
		-D__packed__= \
		-DIMAGE_APPS_PROC \
		-DFEATURE_DATA_LINUX_LE \
		-DFEATURE_DATA_PREFIX_DELEGATION \
		-DRADISH_OFFLINE \
		-DRADISH_LOG_QXDM \
		-DFEATURE_DATA_LOG_SYSLOG \
		-DUSE_GLIB \
		-I./include \
		-I./include/dsutils \
		-I./include/diag \
		-I./include/glib-2.0 \
		-I$(PKG_BUILD_DIR) \
		-c -o $(PKG_BUILD_DIR)/icmpv6.o $(PKG_BUILD_DIR)/icmpv6.c
	$(TARGET_CC) $(TARGET_CFLAGS) \
		-c -o $(PKG_BUILD_DIR)/compat.o $(PKG_BUILD_DIR)/compat.c
	$(TARGET_CC) $(TARGET_LDFLAGS) -Wl,--allow-multiple-definition \
		-L./devlibs \
		-o $(PKG_BUILD_DIR)/radish \
		$(PKG_BUILD_DIR)/radish.o \
		$(PKG_BUILD_DIR)/config.o \
		$(PKG_BUILD_DIR)/icmpv6.o \
		$(PKG_BUILD_DIR)/compat.o \
		-ldsutils -ldiag -lglib-2.0 -lpthread -lrt
endef

# Stock device libs (libdiag, libdsutils, libglib-2.0) are not Entware packages
# Skip shared library dependency check for this package
define CheckDependencies
endef

define Package/ee71-ipv6/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_DIR) $(1)/usr/libexec
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/radish $(1)/usr/libexec/radish
	$(INSTALL_BIN) ./files/radish $(1)/usr/sbin/radish
	# IPv6 firewall init script
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/ip6tables_firewall $(1)/etc/init.d/
	$(INSTALL_DIR) $(1)/etc/rcS.d
	$(LN) ../init.d/ip6tables_firewall $(1)/etc/rcS.d/S38ip6tables_firewall
endef

# 2.0.1 and earlier shipped /usr/sbin/dnsmasq_ipv6_filter plus an
# /etc/rc5.d/S95dnsmasq_ipv6_filter symlink. opkg removes files it owns on
# upgrade, but the filter also appended lines to /etc/dnsmasq.conf (a conffile
# it does not own) and left runtime state behind. Clean both up.
define Package/ee71-ipv6/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
# The 2.0.x filter sleeps up to 42 s after boot and keeps running after its
# file is unlinked; stop it first or it re-appends filter-AAAA after cleanup.
pkill -f /usr/sbin/dnsmasq_ipv6_filter 2>/dev/null
rm -f /etc/rc5.d/S95dnsmasq_ipv6_filter \
      /etc/rc5.d/S95dnsmasq_ipv6_filter.old \
      /usr/sbin/dnsmasq_ipv6_filter \
      /var/run/dnsmasq_ipv6_filter.state \
      /var/run/dnsmasq_ipv6_filter.pending_restart
rmdir /var/run/dnsmasq_ipv6_filter.lock 2>/dev/null
if grep -q '^filter-AAAA$$' /etc/dnsmasq.conf 2>/dev/null; then
    sed -i '/^# AUTO: filter-AAAA (no routed IPv6)$$/d; /^filter-AAAA$$/d' /etc/dnsmasq.conf
    if dnsmasq --test -C /etc/dnsmasq.conf >/dev/null 2>&1; then
        echo "ee71-ipv6: removed filter-AAAA from /etc/dnsmasq.conf"
        echo "ee71-ipv6: restart dnsmasq or reboot for it to take effect"
    else
        echo "[ERR] ee71-ipv6: /etc/dnsmasq.conf failed dnsmasq --test after edit"
    fi
fi
exit 0
endef

$(eval $(call BuildPackage,ee71-ipv6))
