# SPDX-License-Identifier: GPL-2.0-or-later
#
# Copyright (C) 2006-2021 OpenWrt.org
#
# Entware specific: static linkage against libubox, opkg upgrade (all) support
# no MENU, no DEPENDS

include $(TOPDIR)/rules.mk
include $(INCLUDE_DIR)/kernel.mk

PKG_NAME:=opkg
PKG_RELEASE:=1
PKG_FLAGS:=essential

PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL=$(PROJECT_GIT)/project/opkg-lede.git
PKG_SOURCE_DATE:=2025-11-05
PKG_SOURCE_VERSION:=80503d94e356476250adaf1f669ee955ec26de76
PKG_MIRROR_HASH:=41fb2c79ce6014e28f7dd0cd8c65efe803986278f2587d1d4681883d8847d87c

PKG_LICENSE:=GPL-2.0
PKG_LICENSE_FILES:=COPYING

PKG_MAINTAINER:=Jo-Philipp Wich <jo@mein.io>

# Extend depends from version.mk
PKG_CONFIG_DEPENDS += \
	CONFIG_SIGNATURE_CHECK \
	CONFIG_TARGET_INIT_PATH

HOST_BUILD_DEPENDS:=libubox/host
HOST_PATCH_DIR:=
PKG_BUILD_DEPENDS:=libubox

PKG_BUILD_FLAGS:=gc-sections

include $(INCLUDE_DIR)/package.mk
include $(INCLUDE_DIR)/host-build.mk
include $(INCLUDE_DIR)/cmake.mk

define Package/opkg
  SECTION:=base
  CATEGORY:=Base system
  TITLE:=opkg package manager
  DEFAULT:=y if !USE_APK
  URL:=$(PKG_SOURCE_URL)
  PKG_DEFAULT_DEPENDS:=
endef

define Package/opkg/description
  Lightweight package management system
  opkg is the opkg Package Management System, for handling
  installation and removal of packages on a system. It can
  recursively follow dependencies and download all packages
  necessary to install a particular package.

  opkg knows how to install both .ipk and .deb packages.
endef

define Package/opkg/conffiles
/etc/opkg.conf
endef

TARGET_CFLAGS += -D_LARGEFILE_SOURCE -D_LARGEFILE64_SOURCE -D_FILE_OFFSET_BITS=64
EXTRA_CFLAGS += $(TARGET_CPPFLAGS)

CMAKE_OPTIONS += \
	-DSTATIC=ON \
	-DSTATIC_UBOX=ON \
	-DCMAKE_C_FLAGS="$(TARGET_CFLAGS) $(EXTRA_CFLAGS) -I$(STAGING_DIR)/usr/include" \
	-DBUILD_TESTS=OFF \
	-DHOST_CPU=$(PKGARCH) \
	-DOPKGLIBDIR="/lib" \
	-DLOCK_FILE=/tmp/opkg.lock \
	-DPATH_SPEC="$(TARGET_INIT_PATH)" \
	-DVERSION="$(PKG_SOURCE_VERSION) ($(PKG_SOURCE_DATE))"

CMAKE_HOST_OPTIONS += \
	-DSTATIC_UBOX=ON \
	-DBUILD_TESTS=OFF \
	-DHOST_CPU=$(PKGARCH) \
	-DLOCK_FILE=/tmp/opkg.lock \
	-DVERSION="$(PKG_SOURCE_VERSION) ($(PKG_SOURCE_DATE))"

define Package/opkg/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/bin/opkg-cl $(1)/usr/bin/opkg
	$(INSTALL_DIR) $(1)/etc/opkg
	$(INSTALL_DATA) ./files/opkg.conf $(1)/etc/opkg.conf
endef

define Host/Install
	$(INSTALL_BIN) $(HOST_BUILD_DIR)/src/opkg-cl $(STAGING_DIR_HOST)/bin/opkg
endef

$(eval $(call BuildPackage,opkg))
$(eval $(call HostBuild))
