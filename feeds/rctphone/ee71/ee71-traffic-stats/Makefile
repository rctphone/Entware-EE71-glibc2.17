include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-traffic-stats
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_BUILD_FLAGS:=lto gc-sections

include $(INCLUDE_DIR)/package.mk

define Package/ee71-traffic-stats
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=Per-host traffic monitoring daemon
  DEPENDS:=+libc
endef

define Package/ee71-traffic-stats/description
  Reads /proc/net/nf_conntrack every 3s, aggregates per-LAN-host
  byte counters, computes speeds, stores in 4-level ring buffers,
  writes JSON to /tmp/traffic_stats.json.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) ./src/* $(PKG_BUILD_DIR)/
endef

define Build/Compile
	$(TARGET_CC) $(TARGET_CFLAGS) $(TARGET_LDFLAGS) \
		-o $(PKG_BUILD_DIR)/traffic_stats \
		$(PKG_BUILD_DIR)/traffic_stats.c
endef

define Package/ee71-traffic-stats/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/traffic_stats $(1)/usr/sbin/
endef

$(eval $(call BuildPackage,ee71-traffic-stats))
