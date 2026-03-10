include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-traffic-stats
PKG_VERSION:=1.0.0
PKG_RELEASE:=2

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_BUILD_FLAGS:=lto gc-sections

include $(INCLUDE_DIR)/package.mk

define Package/ee71-traffic-stats
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=Per-host traffic + LTE signal monitoring daemon
  DEPENDS:=+libc
endef

define Package/ee71-traffic-stats/description
  Reads /proc/net/nf_conntrack every 3s, aggregates per-LAN-host
  byte counters, computes speeds, stores in 4-level ring buffers,
  writes JSON to /tmp/traffic_stats.json.
  Also polls GetNetworkInfo via IPC for LTE signal metrics,
  writes /tmp/signal_current.txt and /tmp/signal_history.json.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) ./src/* $(PKG_BUILD_DIR)/
	$(CP) ./files/* $(PKG_BUILD_DIR)/
endef

define Build/Compile
	$(TARGET_CC) $(TARGET_CFLAGS) $(TARGET_CPPFLAGS) \
		-c -o $(PKG_BUILD_DIR)/cJSON.o $(PKG_BUILD_DIR)/cJSON.c
	$(TARGET_CC) $(TARGET_CFLAGS) $(TARGET_LDFLAGS) \
		-o $(PKG_BUILD_DIR)/traffic_stats \
		$(PKG_BUILD_DIR)/traffic_stats.c \
		$(PKG_BUILD_DIR)/cJSON.o -ldl
endef

define Package/ee71-traffic-stats/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/traffic_stats $(1)/usr/sbin/
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/traffic_stats.init $(1)/etc/init.d/traffic_stats
endef

define Package/ee71-traffic-stats/preinst
#!/bin/sh
# Stop daemon before upgrade
[ -x /etc/init.d/traffic_stats ] && /etc/init.d/traffic_stats stop 2>/dev/null
exit 0
endef

define Package/ee71-traffic-stats/postinst
#!/bin/sh
# Create rc5.d symlink (after core_app S65, before ee71_webui S75)
ln -sf ../init.d/traffic_stats /etc/rc5.d/S74traffic_stats
# Start daemon
/etc/init.d/traffic_stats start 2>/dev/null
exit 0
endef

define Package/ee71-traffic-stats/prerm
#!/bin/sh
# Stop daemon before removal
[ -x /etc/init.d/traffic_stats ] && /etc/init.d/traffic_stats stop 2>/dev/null
exit 0
endef

define Package/ee71-traffic-stats/postrm
#!/bin/sh
# Remove rc5.d symlink
rm -f /etc/rc5.d/S74traffic_stats
exit 0
endef

$(eval $(call BuildPackage,ee71-traffic-stats))
