# SPDX-License-Identifier: GPL-2.0-or-later
#
# Copyright (C) 2006-2021 OpenWrt.org
#
# Entware specific: postinst/prerm; no jsonfilter as deps; no configs
# EE71: Synced with upstream Entware commit 45bfd79.
# /opt→/usr paths, dropped SELinux variant, kept lto+gc-sections.
# Skipped 500-entware-path.patch (ee71 uses /usr, not /opt).

include $(TOPDIR)/rules.mk

PKG_NAME:=busybox
# Held at 1.36.1 deliberately. Do NOT "just bump" this.
#
# 1.38.0 carries CVE-2026-38754: a heap buffer overflow in ifsbreakup() in the
# ash shell, reachable from crafted input. Red Hat's analysis is explicit that
# "the flaw is present only in BusyBox version 1.38.0" — 1.36.1 does not
# contain the affected code — and as of 2026-09-05 there is no fixed release.
# On this device ash IS /bin/sh: every init script and all 378 applet symlinks
# run through it. Upgrading would introduce a live vulnerability in the shell
# that runs everything.
#
# What the upgrade would buy, checked on the device rather than assumed:
#   - CVE-2026-29004 (udhcpc6): the applet is compiled in but NOTHING RUNS IT.
#     IPv6 on rmnet_data0 comes from the modem stack (netmgrd/QCMAP), and
#     `ps` shows no udhcpc or udhcpc6 process at all.
#   - CVE-2023-42363..42366 (awk): need an attacker-supplied awk *program*.
#   - CVE-2026-26157/26158 (archive path traversal): need us to extract an
#     untrusted archive; LAN DHCP is dnsmasq, not busybox udhcpd.
# So: nothing reachable gained, one reachable DoS added.
#
# For context, the gap worth closing already was: stock firmware ships
# BusyBox v1.20.2 (2024-07-09 build of a 2012 release), and 1.36.1 replaced it.
# Revisit when a release after 1.38.0 fixes ifsbreakup().
PKG_VERSION:=1.36.1
PKG_RELEASE:=1
PKG_FLAGS:=essential

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.bz2
PKG_SOURCE_URL:=https://www.busybox.net/downloads \
		http://sources.buildroot.net
PKG_HASH:=b8cc24c9574d809e7279c3be349795c5d5ceb6fdf19ca709f80cde50e47de314

PKG_BUILD_DEPENDS:=BUSYBOX_CONFIG_PAM:libpam
PKG_BUILD_PARALLEL:=1
PKG_BUILD_FLAGS:=lto gc-sections
PKG_CHECK_FORMAT_SECURITY:=0

PKG_LICENSE:=GPL-2.0
PKG_LICENSE_FILES:=LICENSE archival/libarchive/bz/LICENSE
PKG_CPE_ID:=cpe:/a:busybox:busybox

BUSYBOX_SYM=$(if $(CONFIG_BUSYBOX_CUSTOM),CONFIG,DEFAULT)
BUSYBOX_IF_ENABLED=$(if $(CONFIG_BUSYBOX_$(BUSYBOX_SYM)_$(1)),$(2))

ifneq ($(CONFIG_BUSYBOX_$(BUSYBOX_SYM)_FEATURE_SUID),)
  PKG_FILE_MODES:=/usr/bin/busybox:root:root:4755
endif

include $(INCLUDE_DIR)/package.mk

ifeq ($(DUMP),)
  STAMP_CONFIGURED:=$(strip $(STAMP_CONFIGURED))_$(shell grep '^CONFIG_BUSYBOX_' $(TOPDIR)/.config | $(MKHASH) md5)
endif

define Package/busybox
  SECTION:=base
  CATEGORY:=Base system
  TITLE:=Core utilities for embedded Linux
  URL:=http://busybox.net/
  DEPENDS:=+BUSYBOX_CONFIG_PAM:libpam
  USERID:=ntp=123:ntp=123
endef

define Package/busybox/description
 The Swiss Army Knife of embedded Linux.
 It slices, it dices, it makes Julian Fries.
endef

define Package/busybox/config
	source "$(SOURCE)/Config.in"
endef

ifndef CONFIG_USE_MUSL
LDLIBS:=m crypt
endif

LDLIBS += $(call BUSYBOX_IF_ENABLED,PAM,pam pam_misc pthread)

ifeq ($(CONFIG_USE_GLIBC),y)
  LDLIBS += $(call BUSYBOX_IF_ENABLED,NSLOOKUP,resolv)
endif

MAKE_VARS :=
MAKE_FLAGS += \
	EXTRA_CFLAGS="$(TARGET_CFLAGS) $(TARGET_CPPFLAGS)" \
	EXTRA_LDFLAGS="$(TARGET_LDFLAGS)" \
	LDLIBS="$(LDLIBS)" \
	LD="$(TARGET_CC)" \
	SKIP_STRIP=y
ifneq ($(findstring c,$(OPENWRT_VERBOSE)),)
  MAKE_FLAGS += V=1
endif

define Build/Configure
	rm -f $(PKG_BUILD_DIR)/.config
	$(CP) ./files/config $(PKG_BUILD_DIR)/.config
	yes 'n' | $(MAKE) -C $(PKG_BUILD_DIR) $(MAKE_FLAGS) oldconfig
endef

define Build/Compile
	$(call Build/Compile/Default, \
		CONFIG_PREFIX="$(PKG_INSTALL_DIR)/usr" \
		all install \
	)
endef

define Package/busybox/install
	$(INSTALL_DIR) $(1)/usr/{bin,sbin}
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/bin/busybox $(1)/usr/bin/
	$(INSTALL_DIR) $(1)/usr/share
	$(FIND) $(PKG_INSTALL_DIR) -lname "*" | sed "s|$(PKG_INSTALL_DIR)/usr/||g" > $(1)/usr/share/busybox_applets.lst.dist
endef

define Package/busybox/postinst
#!/usr/bin/busybox sh

bb_fc=`/usr/bin/busybox readlink -f /usr/bin/busybox`
for file in /usr/bin/*; do
    if [ -L $$file  -a "`/usr/bin/busybox readlink -f $$file`" = $$bb_fc ]; then
       /usr/bin/busybox rm -f $$file
    fi
done

for file in /usr/sbin/*; do
    if [ -L $$file  -a "`/usr/bin/busybox readlink -f $$file`" = $$bb_fc ]; then
       /usr/bin/busybox rm -f $$file
    fi
done

cd /usr
for applet in $$(/usr/bin/busybox cat share/busybox_applets.lst.dist)
do
    if [ ! -e $$applet ]
    then
       /usr/bin/busybox ln -s /usr/bin/busybox $$applet
    else
       echo "Warning: '/usr/$$applet' is already exists, skipping."
    fi
done
endef

define Package/busybox/prerm
#!/usr/bin/busybox sh

bb_fc=`/usr/bin/busybox readlink -f /usr/bin/busybox`
for file in /usr/bin/*; do
    if [ -L $$file  -a "`/usr/bin/busybox readlink -f $$file`" = $$bb_fc ]; then
       /usr/bin/busybox rm -f $$file
    fi
done

for file in /usr/sbin/*; do
    if [ -L $$file  -a "`/usr/bin/busybox readlink -f $$file`" = $$bb_fc ]; then
       /usr/bin/busybox rm -f $$file
    fi
done
endef

$(eval $(call BuildPackage,busybox))
