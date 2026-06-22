include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-webs-csp
PKG_VERSION:=1.0.1
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/ee71-webs-csp
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=Patch stock webs binary for webui compatibility
  DEPENDS:=+libc
endef

define Package/ee71-webs-csp/description
  Patches the GoAhead webs binary in-place for EE71 webui compatibility.
  The package relaxes the stock CSP header and fixes the stock TestRequest
  watchdog JSON literal so core_app can parse it reliably.
  Backs up original binary before patching.
endef

define Build/Compile
	true
endef

define Package/ee71-webs-csp/install
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/patch_webs_csp $(1)/etc/init.d/
	$(INSTALL_DIR) $(1)/etc/rc5.d
	$(LN) ../init.d/patch_webs_csp $(1)/etc/rc5.d/S60patch_webs_csp
endef

$(eval $(call BuildPackage,ee71-webs-csp))
