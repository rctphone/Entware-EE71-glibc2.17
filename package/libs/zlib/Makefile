#
# Copyright (C) 2006-2013 OpenWrt.org
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=zlib
PKG_VERSION:=1.3.2
PKG_RELEASE:=1

# Release tarball rather than a git checkout: PKG_MIRROR_HASH for a git source
# is the hash of a tarball this build system rolls itself, which cannot be
# checked against anything upstream publishes. The signed release tarball has a
# hash upstream stands behind, and github and zlib.net serve byte-identical
# copies of it.
PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.xz
PKG_SOURCE_URL:= \
	https://github.com/madler/zlib/releases/download/v$(PKG_VERSION) \
	https://zlib.net
PKG_HASH:=d7a0654783a4da529d1bb793b7ad9c3318020af77667bcae35f95d0e42a792f3

PKG_LICENSE:=Zlib
PKG_LICENSE_FILES:=LICENSE
PKG_CPE_ID:=cpe:/a:zlib:zlib

PKG_CONFIG_DEPENDS:= CONFIG_ZLIB_OPTIMIZE_SPEED
PKG_FLAGS:=essential

include $(INCLUDE_DIR)/package.mk
include $(INCLUDE_DIR)/cmake.mk

define Package/zlib
  SECTION:=libs
  CATEGORY:=Libraries
  TITLE:=Library implementing the deflate compression method
  URL:=https://www.zlib.net/
endef

define Package/zlib-dev
  SECTION:=devel
  CATEGORY:=Development
  SUBMENU:=Libraries
  DEPENDS:=zlib
  TITLE:=Development files for the zlib library
endef

define Package/zlib/description
 zlib is a lossless data-compression library.
 This package includes the shared library.
endef

define Package/zlib-dev/description
 zlib is a lossless data-compression library.
 This package includes the development support files.
endef

define Package/zlib/config
	source "$(SOURCE)/Config.in"
endef

TARGET_CFLAGS += $(FPIC)

ifeq ($(CONFIG_ZLIB_OPTIMIZE_SPEED),y)
	TARGET_CFLAGS := $(filter-out -O%,$(TARGET_CFLAGS)) -O3
endif

# 1.3.2 rewrote the CMake build. ZLIB_BUILD_EXAMPLES became ZLIB_BUILD_TESTING
# and still defaults to ON, so say no: the examples are host-run test programs
# that nothing here installs. The -DARMv8= line that used to sit here went with
# it — no zlib release ever defined that option, so it only ever set an unused
# cache variable.
CMAKE_OPTIONS += \
	-DZLIB_BUILD_TESTING=OFF

define Build/InstallDev
	mkdir -p $(1)/usr/include
	$(CP)	$(PKG_INSTALL_DIR)/usr/include/z{conf,lib}.h \
		$(1)/usr/include/
	mkdir -p $(1)/usr/lib
	$(CP)	$(PKG_INSTALL_DIR)/usr/lib/libz.{a,so*} \
		$(1)/usr/lib/
	mkdir -p $(1)/usr/lib/pkgconfig
	$(CP)	$(PKG_INSTALL_DIR)/usr/lib/pkgconfig/zlib.pc \
		$(1)/usr/lib/pkgconfig/
endef

# libz.so is needed for openssl (zlib-dynamic)
define Package/zlib/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/libz.so $(1)/usr/lib/
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/libz.so.* $(1)/usr/lib/
endef

define Package/zlib-dev/install
	$(INSTALL_DIR) $(1)/usr/include
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/usr/include/zconf.h \
	  $(1)/usr/include/
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/usr/include/zlib.h \
	  $(1)/usr/include/
	$(INSTALL_DIR) $(1)/usr/lib
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/libz.a $(1)/usr/lib/
	$(INSTALL_DIR) $(1)/usr/lib/pkgconfig
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/usr/lib/pkgconfig/zlib.pc \
	  $(1)/usr/lib/pkgconfig/
endef

$(eval $(call BuildPackage,zlib))
$(eval $(call BuildPackage,zlib-dev))
