include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-webui
PKG_VERSION:=1.5.1
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

ESBUILD_VERSION:=0.24.2
ESBUILD:=$(STAGING_DIR_HOST)/bin/esbuild

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) ./src/www $(PKG_BUILD_DIR)/
	$(CP) ./src/cgi-bin $(PKG_BUILD_DIR)/
	if [ -d ./src/speedtest-ookla ]; then $(CP) ./src/speedtest-ookla $(PKG_BUILD_DIR)/speedtest; fi
	# Download esbuild (host tool, cached in staging)
	if [ ! -x $(ESBUILD) ]; then \
		mkdir -p $(STAGING_DIR_HOST)/bin; \
		wget -qO /tmp/esbuild.tgz \
			"https://registry.npmjs.org/@esbuild/linux-x64/-/linux-x64-$(ESBUILD_VERSION).tgz" && \
		tar xzf /tmp/esbuild.tgz -C /tmp package/bin/esbuild && \
		mv /tmp/package/bin/esbuild $(ESBUILD) && \
		chmod +x $(ESBUILD) && \
		rm -rf /tmp/esbuild.tgz /tmp/package; \
	fi
endef

define Build/Compile
	# Bundle JS (vendor + core + pages + boot)
	$(ESBUILD) $(PKG_BUILD_DIR)/www/js/entry.js \
		--bundle --format=iife --outfile=$(PKG_BUILD_DIR)/www/js/app.bundle.js
	# Bundle CSS (vendor + custom)
	$(ESBUILD) $(PKG_BUILD_DIR)/www/css/entry.css \
		--bundle --external:'*.woff2' --outfile=$(PKG_BUILD_DIR)/www/css/app.bundle.css
	# Patch index.html to use bundles
	cd $(PKG_BUILD_DIR)/www && \
		sed -i '/<link rel="stylesheet" href="css\/pico/d' index.html && \
		sed -i '/<link rel="stylesheet" href="css\/uPlot/d' index.html && \
		sed -i 's|<link rel="stylesheet" href="css/app.css">|<link rel="stylesheet" href="css/app.bundle.css">|' index.html && \
		sed -i '/<script src="js\//d' index.html && \
		sed -i 's|<!-- Scripts -->|<!-- Scripts -->\n    <script src="js/app.bundle.js"></script>|' index.html
endef

define Package/ee71-webui/install
	# Web files (bundled)
	$(INSTALL_DIR) $(1)/jrd-resource/resource/webrc/www
	$(CP) $(PKG_BUILD_DIR)/www/index.html $(1)/jrd-resource/resource/webrc/www/
	$(INSTALL_DIR) $(1)/jrd-resource/resource/webrc/www/js
	$(CP) $(PKG_BUILD_DIR)/www/js/app.bundle.js $(1)/jrd-resource/resource/webrc/www/js/
	$(INSTALL_DIR) $(1)/jrd-resource/resource/webrc/www/css
	$(CP) $(PKG_BUILD_DIR)/www/css/app.bundle.css $(1)/jrd-resource/resource/webrc/www/css/
	# Icons + PWA
	$(INSTALL_DIR) $(1)/jrd-resource/resource/webrc/www/icons
	$(CP) $(PKG_BUILD_DIR)/www/icons/* $(1)/jrd-resource/resource/webrc/www/icons/ 2>/dev/null || true
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
	# Speedtest Ookla Custom assets
	if [ -d $(PKG_BUILD_DIR)/speedtest ]; then \
		$(INSTALL_DIR) $(1)/jrd-resource/speedtest; \
		$(CP) $(PKG_BUILD_DIR)/speedtest/cgi-bin $(1)/jrd-resource/speedtest/; \
		find $(1)/jrd-resource/speedtest/cgi-bin -type f -exec chmod 755 {} \; ; \
		$(CP) $(PKG_BUILD_DIR)/speedtest/css $(1)/jrd-resource/speedtest/; \
		$(CP) $(PKG_BUILD_DIR)/speedtest/js $(1)/jrd-resource/speedtest/; \
		$(CP) $(PKG_BUILD_DIR)/speedtest/static $(1)/jrd-resource/speedtest/; \
	fi
endef

$(eval $(call BuildPackage,ee71-webui))
