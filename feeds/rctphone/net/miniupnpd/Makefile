include $(TOPDIR)/rules.mk

PKG_NAME:=miniupnpd
PKG_VERSION:=2.3.11
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=https://miniupnp.tuxfamily.org/files/
PKG_HASH:=91994b127da735b2c97f19992e34420648c0e8c4ace8a4bcb0596e7685c48678

PKG_LICENSE:=BSD-3-Clause
PKG_BUILD_PARALLEL:=1
PKG_BUILD_FLAGS:=lto gc-sections
# Build-time only: libmnl.a is linked statically (see Build/Compile). This
# guarantees libmnl is staged first without adding a runtime Depends.
PKG_BUILD_DEPENDS:=libmnl

include $(INCLUDE_DIR)/package.mk

define Package/miniupnpd
  SECTION:=net
  CATEGORY:=Network
  TITLE:=UPnP/NAT-PMP/PCP daemon
  DEPENDS:=+libc +iptables +libnfnetlink +libnetfilter-conntrack
  PROVIDES:=miniupnpd-iptables
  URL:=http://miniupnp.free.fr/
endef

define Build/Configure
	cd $(PKG_BUILD_DIR) && \
	./configure \
		--firewall=iptables --ipv6 --igd2 \
		--leasefile --portinuse --vendorcfg \
		--disable-pppconn
	$(SED) '/HAS_LIBCAP/d' $(PKG_BUILD_DIR)/config.h
	$(SED) '/lcap/d' $(PKG_BUILD_DIR)/config.mk
endef

# libmnl is linked statically on purpose. configure defines USE_NFCT when it
# finds libnetfilter_conntrack + libmnl in staging, which compiles
# netfilter/nfct_get.c and makes mnl_* a direct dependency of the daemon.
# The device has no libmnl.so.0 anywhere: the opkg entry for libmnl is a
# pre-registered stub with an empty file list (SYSTEM_PKGS in
# opkg/build_entware.sh), and the stock libnetfilter_conntrack.so.3 does not
# pull it in either. Adding +libmnl to DEPENDS would not help — opkg already
# believes the stub is installed, so nothing would be fetched. Linking the
# ~30 KB libmnl.a in removes libmnl.so.0 from DT_NEEDED and makes the binary
# start on both fresh and already-provisioned devices.
# After building, verify: readelf -d miniupnpd | grep NEEDED  →  no libmnl.
define Build/Compile
	$(MAKE) -C $(PKG_BUILD_DIR) \
		CC="$(TARGET_CC)" \
		CFLAGS="$(TARGET_CFLAGS) -DIPTABLES_143 -I$(STAGING_DIR)/usr/include" \
		LDFLAGS="$(TARGET_LDFLAGS) -L$(STAGING_DIR)/usr/lib -lip4tc -lip6tc -lnfnetlink -lnetfilter_conntrack -Wl,-Bstatic -lmnl -Wl,-Bdynamic"
endef

define Package/miniupnpd/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/miniupnpd $(1)/usr/sbin/
	$(INSTALL_DIR) $(1)/etc/miniupnpd
	$(INSTALL_DATA) ./files/miniupnpd.conf $(1)/etc/miniupnpd/
endef

$(eval $(call BuildPackage,miniupnpd))
