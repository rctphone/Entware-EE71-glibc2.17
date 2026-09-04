# SPDX-License-Identifier: GPL-2.0-only
#
# Copyright (C) 2006-2021 OpenWrt.org
#
# EE71: Synced with upstream Entware (2025-08-26 git snapshot).
# Stripped: wpad multicall, mesh, wolfssl/mbedtls TLS variants,
#           eapol-test, ubus/ucode/udebug dependencies.
# Adapted: libnl-tiny → libnl, glibc 2.17 compat (no getrandom).
# Crypto:   OpenSSL, not hostapd's internal TLS. SAE (WPA3-Personal) needs
#           elliptic-curve crypto and the internal backend has none — only
#           crypto_openssl.c and crypto_wolfssl.c implement crypto_ec_*.
#           This is also why upstream sets CONFIG_SAE=y per SSL variant
#           rather than in files/hostapd-*.config.

include $(TOPDIR)/rules.mk

PKG_NAME:=hostapd
PKG_RELEASE:=4

PKG_SOURCE_URL:=https://w1.fi/hostap.git
PKG_SOURCE_PROTO:=git
PKG_SOURCE_DATE:=2025-08-26
PKG_SOURCE_VERSION:=ca266cc24d8705eb1a2a0857ad326e48b1408b20
PKG_MIRROR_HASH:=59ac677093f524ff98588abd9f33805a336a6e929d6814222f0d784c854f2343

PKG_LICENSE:=BSD-3-Clause
PKG_CPE_ID:=cpe:/a:w1.fi:hostapd

PKG_BUILD_PARALLEL:=1
PKG_FLAGS:=essential

PKG_CONFIG_DEPENDS:= \
	CONFIG_PACKAGE_hostapd \
	CONFIG_WPA_RFKILL_SUPPORT \
	CONFIG_DRIVER_11AC_SUPPORT \
	CONFIG_DRIVER_11AX_SUPPORT \
	CONFIG_WPA_ENABLE_WEP

PKG_BUILD_FLAGS:=gc-sections lto

LOCAL_TYPE=$(strip \
		$(if $(findstring supplicant,$(BUILD_VARIANT)),supplicant, \
		hostapd \
		))

LOCAL_AND_LIB_VARIANT=$(patsubst hostapd-%,%,\
		      $(patsubst supplicant-%,%,\
		      $(BUILD_VARIANT)\
		      ))

LOCAL_VARIANT=$(patsubst %-openssl,%,\
	      $(patsubst %-internal,%,\
	      $(LOCAL_AND_LIB_VARIANT)\
	      ))

# EE71: OpenSSL crypto only (needed for SAE — see header)
SSL_VARIANT:=openssl

CONFIG_VARIANT:=$(LOCAL_VARIANT)

include $(INCLUDE_DIR)/package.mk

TARGET_LDFLAGS_C:=$(TARGET_LDFLAGS)

STAMP_CONFIGURED:=$(STAMP_CONFIGURED)_$(CONFIG_WPA_MSG_MIN_PRIORITY)

ifneq ($(CONFIG_DRIVER_11AC_SUPPORT),)
  HOSTAPD_IEEE80211AC:=y
endif

ifneq ($(CONFIG_DRIVER_11AX_SUPPORT),)
  HOSTAPD_IEEE80211AX:=y
endif

DRIVER_MAKEOPTS= \
	CONFIG_ACS=y CONFIG_DRIVER_NL80211=y \
	CONFIG_IEEE80211AC=$(HOSTAPD_IEEE80211AC) \
	CONFIG_IEEE80211AX=$(HOSTAPD_IEEE80211AX) \
	CONFIG_MBO=$(CONFIG_WPA_MBO_SUPPORT)

# EE71: SAE (WPA3-Personal). Deliberately just SAE — upstream's full-openssl
# variant also turns on OWE/DPP/SUITEB192/MESH, which this device has no use
# for and /usr has no room for.
# CONFIG_TLS here is a make command-line variable, so it overrides the
# CONFIG_TLS=internal that files/hostapd-full.config still carries — that is
# upstream's mechanism, not an oversight. -lcrypto/-lssl are added further
# down, after the -L that makes them findable.
ifeq ($(SSL_VARIANT),openssl)
  DRIVER_MAKEOPTS += CONFIG_TLS=openssl CONFIG_SAE=y
endif

ifneq ($(LOCAL_TYPE),hostapd)
  ifdef CONFIG_WPA_RFKILL_SUPPORT
    DRIVER_MAKEOPTS += NEED_RFKILL=y
  endif
endif

DRV_DEPENDS:=+libnl

ifeq ($(SSL_VARIANT),openssl)
  SSL_DEPENDS:=+libopenssl
endif


define Package/hostapd
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=WirelessAPD
  TITLE:=IEEE 802.1x Authenticator (full, OpenSSL)
  URL:=https://w1.fi/hostapd/
  DEPENDS:=$(DRV_DEPENDS) $(SSL_DEPENDS)
  VARIANT:=full-openssl
endef

define Package/hostapd/description
 This package contains a full featured IEEE 802.1x/WPA/EAP/RADIUS
 Authenticator, built against OpenSSL and with SAE (WPA3-Personal).
endef

define Package/wpa-supplicant
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=WirelessAPD
  TITLE:=WPA Supplicant (full, OpenSSL)
  URL:=https://w1.fi/wpa_supplicant/
  DEPENDS:=$(DRV_DEPENDS) $(SSL_DEPENDS)
  VARIANT:=supplicant-full-openssl
endef

define Package/wpa-supplicant/description
 WPA Supplicant with full feature set, built against OpenSSL and with SAE.
endef

define Package/hostapd/config
	source "$(SOURCE)/Config.in"
endef

define Package/wpa-supplicant/config
	source "$(SOURCE)/Config.in"
endef

define Package/hostapd-utils
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=WirelessAPD
  TITLE:=IEEE 802.1x Authenticator (utils)
  URL:=https://w1.fi/hostapd/
  DEPENDS:=+hostapd
  VARIANT:=*
endef

define Package/hostapd-utils/description
 This package contains the hostapd_cli utility.
endef

define Package/wpa-cli
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=WirelessAPD
  DEPENDS:=+wpa-supplicant
  TITLE:=WPA Supplicant command line control utility
  VARIANT:=*
endef


ifneq ($(wildcard $(PKG_BUILD_DIR)/.config_*),$(subst .configured_,.config_,$(STAMP_CONFIGURED)))
  define Build/Configure/rebuild
	$(FIND) $(PKG_BUILD_DIR) -name \*.o -or -name \*.a | $(XARGS) rm -f
	rm -f $(PKG_BUILD_DIR)/hostapd/hostapd
	rm -f $(PKG_BUILD_DIR)/wpa_supplicant/wpa_supplicant
	rm -f $(PKG_BUILD_DIR)/.config_*
	touch $(subst .configured_,.config_,$(STAMP_CONFIGURED))
  endef
endif

# EE71: Copy config, then fix for our target:
#   - remove CONFIG_UBUS/CONFIG_UCODE (needs OpenWrt ubus/ucode)
#   - remove CONFIG_GETRANDOM (needs glibc 2.25+, we have 2.17)
#   - set CONFIG_LIBNL32 (we use libnl 3.x, not libnl-tiny)
define Build/Configure
	$(Build/Configure/rebuild)
	$(if $(wildcard ./files/hostapd-$(CONFIG_VARIANT).config), \
		$(CP) ./files/hostapd-$(CONFIG_VARIANT).config $(PKG_BUILD_DIR)/hostapd/.config; \
		$(SED) '/CONFIG_UBUS/d' $(PKG_BUILD_DIR)/hostapd/.config; \
		$(SED) '/CONFIG_UCODE/d' $(PKG_BUILD_DIR)/hostapd/.config; \
		$(SED) '/CONFIG_GETRANDOM/d' $(PKG_BUILD_DIR)/hostapd/.config; \
		$(SED) '/CONFIG_RADIUS_SERVER/d' $(PKG_BUILD_DIR)/hostapd/.config; \
		echo 'CONFIG_LIBNL32=y' >> $(PKG_BUILD_DIR)/hostapd/.config \
	)
	$(if $(wildcard ./files/wpa_supplicant-$(CONFIG_VARIANT).config), \
		$(CP) ./files/wpa_supplicant-$(CONFIG_VARIANT).config $(PKG_BUILD_DIR)/wpa_supplicant/.config; \
		$(SED) '/CONFIG_UBUS/d' $(PKG_BUILD_DIR)/wpa_supplicant/.config; \
		$(SED) '/CONFIG_UCODE/d' $(PKG_BUILD_DIR)/wpa_supplicant/.config; \
		$(SED) '/CONFIG_GETRANDOM/d' $(PKG_BUILD_DIR)/wpa_supplicant/.config; \
		echo 'CONFIG_LIBNL32=y' >> $(PKG_BUILD_DIR)/wpa_supplicant/.config \
	)
endef

# EE71: libnl3 headers (not libnl-tiny), no ubus/ucode/udebug libs
TARGET_CPPFLAGS := \
	-I$(STAGING_DIR)/usr/include/libnl3 \
	-I$(PKG_BUILD_DIR)/src/crypto \
	$(TARGET_CPPFLAGS) \
	$(if $(filter openssl,$(SSL_VARIANT)),-I$(STAGING_DIR)/usr/include) \
	-DCONFIG_LIBNL20 \
	-D_GNU_SOURCE \
	$(if $(CONFIG_WPA_MSG_MIN_PRIORITY),-DCONFIG_MSG_MIN_PRIORITY=$(CONFIG_WPA_MSG_MIN_PRIORITY))

TARGET_LDFLAGS += -L$(STAGING_DIR)/usr/lib -lm -lnl-3 -lnl-genl-3
# Must come after the -L above: this tree's TARGET_LDFLAGS carries no -L of
# its own, and ld resolves each -l against the search path seen so far.
ifeq ($(SSL_VARIANT),openssl)
  TARGET_LDFLAGS += -lcrypto -lssl
endif

ifdef CONFIG_WPA_ENABLE_WEP
    DRIVER_MAKEOPTS += CONFIG_WEP=y
endif

define Build/RunMake
	CFLAGS="$(TARGET_CPPFLAGS) $(TARGET_CFLAGS)" \
	$(MAKE) $(PKG_JOBS) -C $(PKG_BUILD_DIR)/$(1) \
		$(TARGET_CONFIGURE_OPTS) \
		$(DRIVER_MAKEOPTS) \
		LIBS="$(TARGET_LDFLAGS)" \
		LIBS_c="$(TARGET_LDFLAGS_C)" \
		AR="$(TARGET_CROSS)gcc-ar" \
		BCHECK= \
		$(if $(findstring s,$(OPENWRT_VERBOSE)),V=1) \
		$(2)
endef

define Build/Compile/hostapd
	+$(call Build/RunMake,hostapd, \
		hostapd hostapd_cli \
	)
endef

define Build/Compile/supplicant
	+$(call Build/RunMake,wpa_supplicant, \
		wpa_cli wpa_supplicant \
	)
endef

define Build/Compile
	$(Build/Compile/$(LOCAL_TYPE))
endef

define Package/hostapd/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/hostapd/hostapd $(1)/usr/sbin/
endef

ifneq ($(LOCAL_TYPE),supplicant)
  define Package/hostapd-utils/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/hostapd/hostapd_cli $(1)/usr/sbin/
  endef
endif

define Package/wpa-supplicant/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/wpa_supplicant/wpa_supplicant $(1)/usr/sbin/
endef

ifneq ($(LOCAL_TYPE),hostapd)
  define Package/wpa-cli/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(CP) $(PKG_BUILD_DIR)/wpa_supplicant/wpa_cli $(1)/usr/sbin/
  endef
endif

$(eval $(call BuildPackage,hostapd))
$(eval $(call BuildPackage,wpa-supplicant))
$(eval $(call BuildPackage,hostapd-utils))
$(eval $(call BuildPackage,wpa-cli))
