include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-speedtest-cli
PKG_VERSION:=1.2.7
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/ee71-speedtest-cli
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=Ookla Speedtest CLI (device-side engine)
  DEPENDS:=+jq
endef

define Package/ee71-speedtest-cli/description
  Static ARM Ookla Speedtest CLI binary + a CGI that runs it on the router and
  maps the JSON to the Web UI gauge shape. Measures the router's WAN from the
  device. Installed to /jrd-resource (so it does not fill the small /usr).
  Optional engine for ee71-webui Speed Test.
endef

define Build/Compile
endef

define Package/ee71-speedtest-cli/install
	$(INSTALL_DIR) $(1)/jrd-resource/speedtest-cli
	$(INSTALL_BIN) ./files/speedtest $(1)/jrd-resource/speedtest-cli/speedtest
	$(INSTALL_DATA) ./files/speedcert.pem $(1)/jrd-resource/speedtest-cli/speedcert.pem
	$(INSTALL_DIR) $(1)/jrd-resource/resource/webrc/www/cgi-bin
	$(INSTALL_BIN) ./files/speedtest_cli.cgi $(1)/jrd-resource/resource/webrc/www/cgi-bin/speedtest_cli.cgi
endef

$(eval $(call BuildPackage,ee71-speedtest-cli))
