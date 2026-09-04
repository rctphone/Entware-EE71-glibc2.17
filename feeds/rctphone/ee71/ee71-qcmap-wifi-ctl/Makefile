include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-qcmap-wifi-ctl
PKG_VERSION:=2.1.0
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/ee71-qcmap-wifi-ctl
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=5GHz (wlan1) hostapd config + restart
  DEPENDS:=+libstdcpp +sqlite3
endef

define Package/ee71-qcmap-wifi-ctl/description
  The WiFi jobs no stock component on the EE71 does:
  - Generates /etc/hostapd-wlan1.conf from the Guest5G* settings
  - Restarts the wlan1 hostapd after core_app's `killall hostapd`
    (core_app restarts only wlan0; QCMAP never notices wlan1 died)
  - Sets wifi_config.GuestAP=1 when the guest AP is switched on. That row
    decides dual-band at boot and has no field in the JSON-RPC wire
    protocol, so no API call can reach it. Written one-way (never 0) and
    only when already different, so "5 GHz off" can never make dual-band
    unrecoverable. See docs/plans/guestap-apmode-semantics.md.
  - stop-guest: "5 GHz off" as a runtime state, leaving provisioning alone

  Also sends the one SetWlanSettings IPC to core_app (JSON-RPC 2.0 via
  libsock_client.so.0) so core_app owns every DB write and wlan0.

  Deliberately NOT here (2.0.0 removed all of it): WLAN mode switching
  and mobileap_cfg.xml editing (QCMAP reads the XML only at start and
  core_app re-asserts the mode at every start, so a runtime edit changed
  nothing), and wlan0 hostapd restarts (core_app owns wlan0). The device
  is always AP-AP.

  Runtime deps (on device): hostapd, libsock_client.so.0
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) ./files/qcmap_wifi_ctl.cpp $(PKG_BUILD_DIR)/
endef

define Build/Compile
	$(TARGET_CXX) $(TARGET_CXXFLAGS) -std=c++11 \
		-o $(PKG_BUILD_DIR)/qcmap_wifi_ctl \
		$(PKG_BUILD_DIR)/qcmap_wifi_ctl.cpp \
		$(TARGET_LDFLAGS) -ldl -lpthread
endef

define Package/ee71-qcmap-wifi-ctl/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/qcmap_wifi_ctl $(1)/usr/bin/
endef

$(eval $(call BuildPackage,ee71-qcmap-wifi-ctl))
