include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-webs-csp
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/ee71-webs-csp
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=Patch webs binary CSP header for iframe support
  DEPENDS:=+libc
endef

define Package/ee71-webs-csp/description
  Patches the GoAhead webs binary Content-Security-Policy string
  in-place to allow iframe embedding and inline scripts/styles.
  Original CSP is very restrictive; replaced with permissive policy.
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
