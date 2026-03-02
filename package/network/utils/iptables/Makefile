#
# Copyright (C) 2006-2016 OpenWrt.org
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#
# Entware specific: keep 1.4.21 version
# Do not split extensions into separate packages, do not install dev headers

include $(TOPDIR)/rules.mk
include $(INCLUDE_DIR)/kernel.mk

PKG_NAME:=iptables
PKG_VERSION:=1.4.21

ifndef CONFIG_PACKAGE_opt-ndmsv2
  PKG_RELEASE:=6
else
  PKG_RELEASE:=6
endif

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.bz2
PKG_SOURCE_URL:=http://www.netfilter.org/projects/iptables/files \
	ftp://ftp.be.netfilter.org/pub/netfilter/iptables/ \
	ftp://ftp.de.netfilter.org/pub/netfilter/iptables/ \
	ftp://ftp.no.netfilter.org/pub/netfilter/iptables/
PKG_HASH:=52004c68021da9a599feed27f65defcfb22128f7da2c0531c0f75de0f479d3e0

PKG_FIXUP:=autoreconf

PKG_INSTALL:=1
PKG_BUILD_FLAGS:=gc-sections no-lto
PKG_FLAGS:=essential
PKG_BUILD_PARALLEL:=1
PKG_LICENSE:=GPL-2.0
PKG_CPE_ID:=cpe:/a:netfilter:iptables

ifdef CONFIG_PACKAGE_opt-ndmsv2
PATCH_DIR:=./patches_kn
endif

include $(INCLUDE_DIR)/package.mk

define Package/iptables
  TITLE:=IP firewall administration tool
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=Firewall
  URL:=https://netfilter.org/
  ALTERNATIVES:=\
    200:/usr/bin/iptables-xml:/usr/sbin/xtables-multi \
    200:/usr/sbin/iptables:/usr/sbin/xtables-multi \
    200:/usr/sbin/iptables-restore:/usr/sbin/xtables-multi \
    200:/usr/sbin/iptables-save:/usr/sbin/xtables-multi \
    200:/usr/sbin/ip6tables:/usr/sbin/xtables-multi \
    200:/usr/sbin/ip6tables-restore:/usr/sbin/xtables-multi \
    200:/usr/sbin/ip6tables-save:/usr/sbin/xtables-multi
ifdef CONFIG_PACKAGE_opt-ndmsv2
  PKGARCH:=$(BOARD)_kn
endif
endef

define Package/iptables/description
IP firewall administration tool.

 Matches:
  - icmp
  - tcp
  - udp
  - comment
  - conntrack
  - limit
  - mac
  - mark
  - multiport
  - set
  - state
  - time

 Targets:
  - ACCEPT
  - CT
  - DNAT
  - DROP
  - REJECT
  - LOG
  - MARK
  - MASQUERADE
  - REDIRECT
  - SET
  - SNAT
  - TCPMSS

 Tables:
  - filter
  - mangle
  - nat
  - raw

endef

TARGET_CPPFLAGS := \
	-I$(PKG_BUILD_DIR)/include \
	-I$(LINUX_DIR)/user_headers/include \
	$(TARGET_CPPFLAGS)

TARGET_CFLAGS += \
	-I$(PKG_BUILD_DIR)/include \
	-I$(LINUX_DIR)/user_headers/include \
	-DNO_LEGACY

TARGET_LDFLAGS += -lm

CONFIGURE_ARGS += \
	--enable-shared \
	--enable-static \
	--enable-devel \
	--with-kernel="$(LINUX_DIR)/user_headers" \
	--with-xtlibdir=/usr/lib/iptables \
	$(if $(CONFIG_IPV6),,--disable-ipv6)

MAKE_FLAGS := \
	$(TARGET_CONFIGURE_OPTS) \
	COPT_FLAGS="$(TARGET_CFLAGS)" \
	KERNEL_DIR="$(LINUX_DIR)/user_headers/" PREFIX=/opt \
	KBUILD_OUTPUT="$(LINUX_DIR)"

ifndef CONFIG_PACKAGE_opt-ndmsv2
  define Build/InstallDev
	$(INSTALL_DIR) $(1)/usr/include
	$(INSTALL_DIR) $(1)/usr/include/iptables
	$(INSTALL_DIR) $(1)/usr/include/net/netfilter

	# XXX: iptables header fixup, some headers are not installed by iptables anymore
	$(CP) $(PKG_BUILD_DIR)/include/iptables/*.h $(1)/usr/include/iptables/
	$(CP) $(PKG_BUILD_DIR)/include/iptables.h $(1)/usr/include/
	$(CP) $(PKG_BUILD_DIR)/include/ip6tables.h $(1)/usr/include/
	$(CP) $(PKG_BUILD_DIR)/include/libipulog $(1)/usr/include/
	$(CP) $(PKG_BUILD_DIR)/include/libiptc $(1)/usr/include/

	$(CP) $(PKG_INSTALL_DIR)/usr/include/* $(1)/usr/include/
	$(INSTALL_DIR) $(1)/usr/lib
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/libxtables.so* $(1)/usr/lib/
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/libip*tc.so* $(1)/usr/lib/
	$(INSTALL_DIR) $(1)/usr/lib/pkgconfig
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/pkgconfig/xtables.pc $(1)/usr/lib/pkgconfig/
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/pkgconfig/libip*tc.pc $(1)/usr/lib/pkgconfig/

	# XXX: needed by firewall3
	$(CP) $(PKG_BUILD_DIR)/extensions/libiptext*.so $(1)/usr/lib/
  endef
endif

define Package/iptables/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(CP) $(PKG_INSTALL_DIR)/usr/sbin/xtables-multi $(1)/usr/sbin/
	$(INSTALL_DIR) $(1)/usr/lib
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/libip*tc.so* $(1)/usr/lib/
	$(CP) $(PKG_BUILD_DIR)/extensions/libiptext{,4,6}.so $(1)/usr/lib/
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/libxtables.so* $(1)/usr/lib/
	$(INSTALL_DIR) $(1)/usr/lib/iptables
	$(CP) $(PKG_BUILD_DIR)/extensions/libxt_*.so $(1)/usr/lib/iptables/
endef

$(eval $(call BuildPackage,iptables))
