include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-apn-ru
PKG_VERSION:=1.1.0
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/ee71-apn-ru
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=Russian operator APN profiles
endef

define Package/ee71-apn-ru/description
  APN match profiles for Russian mobile operators:
  MTS, Yota, Tele2, Beeline, MOTIV, Rostelecom, Tinkoff.
endef

define Build/Compile
	true
endef

define Package/ee71-apn-ru/install
	$(INSTALL_DIR) $(1)/jrd-resource/resource/profile/match
	$(CP) ./files/profiles/match/* $(1)/jrd-resource/resource/profile/match/
endef

$(eval $(call BuildPackage,ee71-apn-ru))
