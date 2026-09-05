include $(TOPDIR)/rules.mk

PKG_NAME:=miniupnpd
PKG_VERSION:=2.3.11
PKG_RELEASE:=4

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=https://miniupnp.tuxfamily.org/files/
PKG_HASH:=91994b127da735b2c97f19992e34420648c0e8c4ace8a4bcb0596e7685c48678

PKG_LICENSE:=BSD-3-Clause
PKG_BUILD_PARALLEL:=1
PKG_BUILD_FLAGS:=lto gc-sections
PKG_BUILD_DEPENDS:=libmnl

include $(INCLUDE_DIR)/package.mk

define Package/miniupnpd
  SECTION:=net
  CATEGORY:=Network
  TITLE:=UPnP/NAT-PMP/PCP daemon
  DEPENDS:=+libc +iptables +libnfnetlink +libnetfilter-conntrack +libmnl
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

# configure defines USE_NFCT when it finds libnetfilter_conntrack + libmnl in
# staging, which compiles netfilter/nfct_get.c and makes mnl_* a direct
# dependency of the daemon. So the daemon needs libmnl at RUNTIME, and
# +libmnl in DEPENDS above is what supplies it.
#
# It used to try to avoid that with `-Wl,-Bstatic -lmnl -Wl,-Bdynamic` below,
# on the reasoning that +libmnl could not help because opkg already believed a
# pre-registered stub was installed. Both halves are now wrong:
#
#   - The static link never worked. Measured, not assumed: after a full
#     `miniupnpd/clean` and rebuild, `readelf -d miniupnpd | grep NEEDED` still
#     lists libmnl.so.0. upstream's own link line appends -lmnl after ours,
#     by which point -Bdynamic is back in effect. This Makefile even told the
#     reader to run that exact check, and nobody ran it — the shipped
#     2.3.11-2 binary has libmnl.so.0 in DT_NEEDED and the daemon cannot start
#     on a device that has no libmnl.
#   - libmnl is no longer pre-registered. It is absent from the stock firmware
#     manifest, so the reconciliation refuses to claim it, and the real
#     libmnl_1.0.5 in the feed gets installed like any other dependency.
#
# The -Bstatic flags are kept only because dropping them changes nothing
# measurable; the dependency is what makes it work. If you ever remove them,
# re-run the readelf check rather than trusting this comment.
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

# The netfilter chain scripts go in /etc/miniupnpd because they source each
# other through `. $(dirname "$$0")/miniupnpd_functions.sh`, so they must sit
# together, and the init script resolves them relative to ETCPATH.
#
# Without them the daemon runs and does nothing: miniupnpd's netfilter backend
# does not create its own chains, so every port mapping it accepts is silently
# a no-op, and it logs "chain MINIUPNPD not found" every ten minutes forever.
# That is exactly what 2.3.11-3 and everything before it shipped - the init
# script has always looked for these scripts, and the package has never
# installed them.
define Package/miniupnpd/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/miniupnpd $(1)/usr/sbin/
	$(INSTALL_DIR) $(1)/etc/miniupnpd
	$(INSTALL_DATA) ./files/miniupnpd.conf $(1)/etc/miniupnpd/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/netfilter/miniupnpd_functions.sh $(1)/etc/miniupnpd/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/netfilter/iptables_init.sh $(1)/etc/miniupnpd/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/netfilter/iptables_removeall.sh $(1)/etc/miniupnpd/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/netfilter/ip6tables_init.sh $(1)/etc/miniupnpd/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/netfilter/ip6tables_removeall.sh $(1)/etc/miniupnpd/
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
