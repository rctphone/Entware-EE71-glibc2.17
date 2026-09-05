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

# OpenWrt's three ARM patches (002/003/004) are deliberately NOT imported.
#
# They are not idle here for want of hardware: their own probe answers ON for
# this toolchain, because arm-openwrt-linux-gnueabi-gcc defines __ARM_NEON__ by
# default for cortex-a7+neon-vfpv4 softfp. They apply cleanly to 1.3.2. So this
# is a choice, not a limitation.
#
# What 004's ARMv8 branch installs is a fork of a PRE-1.3.0 inflate that
# upstream has never resynced: its inflateCopy does
# zmemcpy(window, state->window, wsize) across the whole 1U << wbits window,
# where 1.3.2 copies only state->whave. That is exactly the uninitialised-heap
# read this version bump was taken for, put back — and 004 swaps only inflate.c
# and inffast.c, so crc32.c and gzwrite.c stay stock and the CVE-2026-27171
# crc32_combine64 loop and the gzprintf overflow are unaffected either way.
#
# So the real trade is a NEON inflate speedup against re-opening a fixed heap
# read, on a device whose inflate is almost entirely opkg unpacking and HTTPS
# response bodies — neither of which is throughput-bound. Not worth it.
#
# Revisit only if someone rebases the chunkcopy work onto 1.3.2's inflate
# upstream. Do not rebase it here: that is writing a patch from scratch.

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

# OpenWrt passes -DARMv8=<ON if __ARM_NEON__> here and we do not, which is the
# one place this Makefile deliberately differs from theirs. ARMv8 is not a zlib
# option; it is declared by OpenWrt's own patches/004, which swaps inflate.c and
# inffast.c for contrib/arm/ copies with NEON chunkcopy. Our patches/ is empty,
# so the flag would feed nothing — but the reason we do not simply import their
# three patches is worth writing down, because our toolchain does define
# __ARM_NEON__ and the ARM path would engage:
#
#   contrib/arm/inflate.c is a fork of a pre-1.3.0 inflate (21 K&R parameter
#   declarations, inflateSync from before the 1.3.1 bit-buffer fix) that upstream
#   has never resynced. Taking it would put back the uninitialised-heap read this
#   very bump removes — its inflateCopy copies the whole 1U << wbits window
#   instead of state->whave. crc32.c and gzwrite.c are not swapped, so
#   CVE-2026-27171 and the gzprintf overflow survive either way; what is at stake
#   is the inflate-side hardening against a NEON inflate speedup.
#
# ZLIB_BUILD_TESTING is ours too, and merely saves build time: 1.3.2 renamed
# ZLIB_BUILD_EXAMPLES to it and it still defaults to ON, and nothing installs
# the test programs.
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
