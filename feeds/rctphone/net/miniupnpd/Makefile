include $(TOPDIR)/rules.mk

PKG_NAME:=miniupnpd
PKG_VERSION:=2.3.11
PKG_RELEASE:=2

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

# /etc/miniupnpd/miniupnpd.conf carries secure_mode=yes and a restricted UPnP
# ACL; without this an upgrade silently resets both.
#
# CAVEAT, and it is a big one: this only protects the file from opkg. The
# vendor's core_app rewrites it on every boot in jrd_router_upnp_init -
#     cp -f /jrd-resource/resource/router/miniupnpd.conf /etc/miniupnpd/miniupnpd.conf
#     sed -i 's/^uuid=.*/.../' ... (uuid, friendly_name, manufacturer_*, model_*)
# - and the jrd-resource copy is the generic TCL one with secure_mode=no and
# `allow 0-65535 0.0.0.0/0 0-65535`. So on a booted device the hardened config
# below is live only until core_app next runs its UPnP init. Making it stick
# means shipping the hardened copy to /jrd-resource/resource/router/ too, which
# is another vendor-owned file and its own decision - not made here.
define Package/miniupnpd/conffiles
/etc/miniupnpd/miniupnpd.conf
endef

define Package/miniupnpd/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/miniupnpd $(1)/usr/sbin/
	$(INSTALL_DIR) $(1)/etc/miniupnpd
	$(INSTALL_DATA) ./files/miniupnpd.conf $(1)/etc/miniupnpd/
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/miniupnpd.init $(1)/etc/init.d/miniupnpd
endef

# /etc/init.d/miniupnpd is a STOCK file we take over: core_app calls it by that
# exact path, and it exists on every EE71 whether or not this package is
# installed. preinst runs before the new files are unpacked, so this is the
# only place the vendor's copy can still be saved. Guarded three ways so an
# upgrade can never overwrite the stock backup with our own script.
define Package/miniupnpd/preinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
if [ -f /etc/init.d/miniupnpd ] && [ ! -f /etc/init.d/miniupnpd.stock ] && \
   ! grep -q 'CONTRACT WITH core_app' /etc/init.d/miniupnpd 2>/dev/null; then
	cp /etc/init.d/miniupnpd /etc/init.d/miniupnpd.stock && \
		echo "miniupnpd: saved stock init script to /etc/init.d/miniupnpd.stock"
fi
exit 0
endef

# Stop the daemon and tear down the MINIUPNPD chains while the script that
# knows how to do it is still on disk. opkg deletes it right after this.
define Package/miniupnpd/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
[ -x /etc/init.d/miniupnpd ] && /etc/init.d/miniupnpd stop 2>/dev/null
exit 0
endef

# Put the vendor's init script back. Without this, `opkg remove miniupnpd`
# leaves core_app calling a path that no longer exists and the stock UPnP
# toggle is dead for good. Keyed on the file being absent rather than on the
# argument opkg passes, so an upgrade (where the new script is already in
# place) never triggers it, whatever the ordering.
# Note: the stock /usr/sbin/miniupnpd binary was overwritten at install time
# and is not restored - the stock script's `test -f $MINIUPNPD || exit 0`
# turns that into a clean no-op rather than an error.
define Package/miniupnpd/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
if [ ! -f /etc/init.d/miniupnpd ] && [ -f /etc/init.d/miniupnpd.stock ]; then
	mv /etc/init.d/miniupnpd.stock /etc/init.d/miniupnpd && \
		chmod 755 /etc/init.d/miniupnpd && \
		echo "miniupnpd: restored stock /etc/init.d/miniupnpd"
fi
exit 0
endef

$(eval $(call BuildPackage,miniupnpd))
