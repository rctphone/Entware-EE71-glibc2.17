include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-webui
PKG_VERSION:=1.9.2
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/ee71-webui
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=EE71 Custom Web UI
  DEPENDS:= \
	+ee71-traffic-stats \
	+ee71-sms-forward \
	+ee71-webs-csp \
	+ee71-ttl-fix \
	+ee71-ipv6 \
	+ee71-qcmap-fix \
	+ee71-qcmap-wifi-ctl \
	+ee71-optimize \
	+ee71-usb-adb \
	+ee71-kmod-wireguard \
	+ee71-kmod-nat66 \
	+ee71-kmod-amneziawg \
	+ee71-kmod-tun \
	+wireguard-tools \
	+ee71-amneziawg-tools \
	+shadowsocks-libev \
	+curl \
	+busybox \
	+dropbear \
	+dnsmasq \
	+iperf3 \
	+miniupnpd \
	+sqlite3 \
	+hostapd \
	+jq
  # Version-pinned because wifi.cgi and qcmap_wifi_ctl changed contract together
  # in 2.0.0 and neither half is safe against the other's old version:
  #  - new wifi.cgi + old (1.4.2) binary: the CGI still sends "mode" and the old
  #    binary still honours it, resurrecting the runtime rewrite of
  #    mobileap_cfg.xml and factory_mobileap_cfg.xml — the documented root cause
  #    of "AP-AP reverts after reboot". It also has no stop-guest, so "5 GHz off"
  #    silently does nothing.
  #  - old wifi.cgi + new binary: the CGI's rejection of mode 5g is the only
  #    guard against AP5G.ApStatus=1 combined with guest ApStatus=1 (two 5 GHz
  #    APs on one radio). The tool now guards this itself, but the old CGI would
  #    still drive toward it.
  # DEPENDS handles build-time selection; EXTRA_DEPENDS is what reaches the ipk
  # Depends: field, where opkg enforces it (include/package-pack.mk:396).
  EXTRA_DEPENDS:=ee71-qcmap-wifi-ctl (>=2.0.0)
endef

define Package/ee71-webui/description
  Single-page web interface for the EE71 router.
  Includes SPA (HTML/JS/CSS), CGI scripts, init scripts,
  VPN enforcement, SMS forwarding, and signal monitoring.

  Runtime dependencies:
  - webs CSP patch (iframe/inline support for GoAhead)
  - TTL/HL normalization (iptables mangle rules)
  - IPv6 support (firewall + dnsmasq AAAA filter + RA)
  - QCMAP binary fix (zero-length netlink attribute)
  - Performance optimizations (tmpfs, daemons, sysctl)
  - USB ADB kernel patch (/dev/kmem)
  - WireGuard (kernel module + wg userspace)
  - AmneziaWG (kernel module + awg userspace)
  - ShadowSocks (ss-redir, ss-tunnel)
  - curl, busybox, dropbear, dnsmasq, iperf3
  - miniupnpd, sqlite3, hostapd
endef

# esbuild host tool — pinned version + sha256 so the build is reproducible and
# works offline once the tarball is in $(DL_DIR). See tools/fetch-esbuild.sh.
ESBUILD_VERSION:=0.28.0
ESBUILD_SHA256:=e94bf1c7f44197b22cf6a787578eca9af805aa9624104488252de2a765c6a4f0
ESBUILD:=$(STAGING_DIR_HOST)/bin/esbuild-$(ESBUILD_VERSION)

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) ./src/www $(PKG_BUILD_DIR)/
	$(CP) ./src/cgi-bin $(PKG_BUILD_DIR)/
	$(CP) ./src/internetometer $(PKG_BUILD_DIR)/
	# Stale bundles from the source tree must never reach the package — the
	# hashed ones produced by Build/Compile are the only bundles installed.
	rm -f $(PKG_BUILD_DIR)/www/js/app*.bundle.js* $(PKG_BUILD_DIR)/www/css/app*.bundle.css*
	sh ./tools/fetch-esbuild.sh \
		"$(DL_DIR)" "$(STAGING_DIR_HOST)/bin" "$(ESBUILD_VERSION)" "$(ESBUILD_SHA256)"
endef

define Build/Compile
	# Validates the entry points against index.html, bundles JS + CSS, checks
	# every page survived minification, then rewrites index.html to point at
	# content-hashed bundle filenames (cache-busting across upgrades).
	sh ./tools/build-www.sh "$(ESBUILD)" "$(PKG_BUILD_DIR)/www"
endef

define Package/ee71-webui/install
	# Web files (bundled)
	$(INSTALL_DIR) $(1)/jrd-resource/resource/webrc/www
	$(CP) $(PKG_BUILD_DIR)/www/index.html $(1)/jrd-resource/resource/webrc/www/
	# Content-hashed bundles only. The .map files stay in the build dir —
	# they cost flash and are not referenced by the bundle.
	$(INSTALL_DIR) $(1)/jrd-resource/resource/webrc/www/js
	$(CP) $(PKG_BUILD_DIR)/www/js/app.*.bundle.js $(1)/jrd-resource/resource/webrc/www/js/
	$(INSTALL_DIR) $(1)/jrd-resource/resource/webrc/www/css
	$(CP) $(PKG_BUILD_DIR)/www/css/app.*.bundle.css $(1)/jrd-resource/resource/webrc/www/css/
	# Internetometer gauge mirror (real yandex.ru/internet UI, calls our CLI)
	$(INSTALL_DIR) $(1)/jrd-resource/resource/webrc/www/internetometer
	$(CP) $(PKG_BUILD_DIR)/internetometer/index.html $(1)/jrd-resource/resource/webrc/www/internetometer/
	# PWA icons + manifest. The SVG icon sprite is inlined in index.html, so
	# there is no icons/ directory to install.
	for F in favicon.png apple-touch-icon.png icon-192.png manifest.json; do \
		[ -f $(PKG_BUILD_DIR)/www/$$$$F ] && $(CP) $(PKG_BUILD_DIR)/www/$$$$F $(1)/jrd-resource/resource/webrc/www/ || true; \
	done
	# Fonts
	if [ -d $(PKG_BUILD_DIR)/www/fonts ]; then \
		$(INSTALL_DIR) $(1)/jrd-resource/resource/webrc/www/fonts; \
		$(CP) $(PKG_BUILD_DIR)/www/fonts/* $(1)/jrd-resource/resource/webrc/www/fonts/; \
	fi
	# CGI scripts
	$(INSTALL_DIR) $(1)/jrd-resource/resource/webrc/www/cgi-bin
	find $(PKG_BUILD_DIR)/cgi-bin -maxdepth 1 -type f -exec $(INSTALL_BIN) {} $(1)/jrd-resource/resource/webrc/www/cgi-bin/ \;
	# Shared CGI library (sourced by every *.cgi)
	$(INSTALL_DIR) $(1)/jrd-resource/resource/webrc/www/cgi-bin/lib
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/cgi-bin/lib/cgi-common.sh $(1)/jrd-resource/resource/webrc/www/cgi-bin/lib/cgi-common.sh
	# Init script
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/ee71_webui.init $(1)/etc/init.d/ee71_webui
	$(INSTALL_DIR) $(1)/etc/rc5.d
	ln -sf ../init.d/ee71_webui $(1)/etc/rc5.d/S75ee71_webui
	# Helper scripts
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./files/vpn_apply $(1)/usr/bin/vpn_apply
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/wireguard_init $(1)/etc/init.d/wireguard
	$(INSTALL_DIR) $(1)/etc/rc5.d
	ln -sf ../init.d/wireguard $(1)/etc/rc5.d/S80wireguard
	# sms_forward config provided by ee71-sms-forward package
endef

$(eval $(call BuildPackage,ee71-webui))
