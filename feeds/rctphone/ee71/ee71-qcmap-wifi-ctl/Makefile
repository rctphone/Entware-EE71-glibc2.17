include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-qcmap-wifi-ctl
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/ee71-qcmap-wifi-ctl
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=WiFi settings + hostapd management tool
  DEPENDS:=+libstdcpp
endef

define Package/ee71-qcmap-wifi-ctl/description
  Manages WiFi settings on the EE71 router:
  - Generates /etc/hostapd-wlan1.conf for 5GHz (wlan1)
  - Sends SetWlanSettings IPC to core_app (JSON-RPC 2.0 via libsock_client.so.0)
  - Provides restart commands for wlan0/wlan1 hostapd

  Solves the dual-band WiFi problem: SetWlanSettings through
  core_app triggers QCMAP EnableWLAN which tears down ALL WiFi
  but only restarts wlan0. This tool generates the wlan1 config
  BEFORE the restart so QCMAP finds both configs.

  Runtime deps (on device): hostapd, iw, brctl, libsock_client.so.0
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
