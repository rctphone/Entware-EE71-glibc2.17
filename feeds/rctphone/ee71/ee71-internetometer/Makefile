include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-internetometer
PKG_VERSION:=1.1.0
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/ee71-internetometer
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=Yandex Интернетометр speed test (device-side)
  DEPENDS:=+curl +jq
endef

define Package/ee71-internetometer/description
  Internet speed test using the Yandex Интернетометр method, measured from the
  ROUTER's WAN (binds to an active VPN tunnel by routing). Runs detached and
  streams live stages + intermediate speed via polling (webs can't stream).
  Uses Yandex CDN, which is reachable on the raw WAN without a VPN. Reuses the
  real yandex.ru/internet gauge look. Optional engine for ee71-webui Speed Test.
endef

define Build/Compile
endef

define Package/ee71-internetometer/install
	$(INSTALL_DIR) $(1)/jrd-resource/resource/webrc/www/cgi-bin
	$(INSTALL_BIN) ./files/internetometer.cgi $(1)/jrd-resource/resource/webrc/www/cgi-bin/internetometer.cgi
	$(INSTALL_BIN) ./files/inet_measure.sh $(1)/jrd-resource/resource/webrc/www/cgi-bin/inet_measure.sh
endef

$(eval $(call BuildPackage,ee71-internetometer))
