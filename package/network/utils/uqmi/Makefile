include $(TOPDIR)/rules.mk

PKG_NAME:=uqmi
PKG_RELEASE:=2

PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL=$(PROJECT_GIT)/project/uqmi.git
PKG_SOURCE_DATE:=2025-07-30
PKG_SOURCE_VERSION:=7914da43cddaaf6cfba116260c81e6e9adffd5ab
PKG_MIRROR_HASH:=5972a5f90bd60d34b5c7a8cec14ae98f13dbb6ea5b35d845ce5da7a8a3b0e59c
PKG_MAINTAINER:=Matti Laakso <malaakso@elisanet.fi>

PKG_LICENSE:=GPL-2.0
PKG_LICENSE_FILES:=

PKG_FLAGS:=nonshared
PKG_BUILD_FLAGS:=gc-sections

include $(INCLUDE_DIR)/package.mk
include $(INCLUDE_DIR)/cmake.mk

define Package/uqmi
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=WWAN
  DEPENDS:=+libubox +libblobmsg-json
  TITLE:=Control utility for mobile broadband modems
endef

define Package/uqmi/description
  uqmi is a command line tool for controlling mobile broadband modems using
  the QMI-protocol.
endef

# XXX Entware specific: GCC-8.x.x (cc1: error: -Werror=dangling-pointer: no option -Wdangling-pointer)
TARGET_CFLAGS += \
	-I$(STAGING_DIR)/usr/include \
	$(if $(CONFIG_GCC_USE_VERSION_8),,-Wno-error=dangling-pointer) \
	-Wno-error=maybe-uninitialized

CMAKE_OPTIONS += \
	-DDEBUG=1

define Package/uqmi/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/uqmi/uqmi $(1)/usr/sbin/
#	$(CP) ./files/* $(1)/
endef

$(eval $(call BuildPackage,uqmi))
