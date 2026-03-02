#
# Copyright (C) 2006-2015 OpenWrt.org
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#
# Entware specific:
# * opkg binary segfaults when a real package is replaced by "provided" package.
# we removed PROVIDES libncurses field in libncursesw and added a real libncurses package that
# installes symlinks. ncurses-bin packages added. Add ALTERNATIVES clear, reset.

include $(TOPDIR)/rules.mk

PKG_NAME:=ncurses
PKG_CPE_ID:=cpe:/a:gnu:ncurses
PKG_VERSION:=6.4
PKG_RELEASE:=3

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=@GNU/$(PKG_NAME)
PKG_HASH:=6931283d9ac87c5073f30b6290c4c75f21632bb4fc3603ac8100812bed248159

PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=README

PKG_INSTALL:=1
PKG_BUILD_PARALLEL:=1

PKG_BUILD_DEPENDS:=ncurses/host

include $(INCLUDE_DIR)/package.mk
include $(INCLUDE_DIR)/host-build.mk

define Package/terminfo
  SECTION:=libs
  CATEGORY:=Libraries
  TITLE:=Terminal Info Database (ncurses)
  URL:=https://www.gnu.org/software/ncurses/
endef

define Package/libncursesw
  SECTION:=libs
  CATEGORY:=Libraries
  TITLE:=Terminal handling library (Unicode)
  URL:=https://www.gnu.org/software/ncurses/
  DEPENDS:= +terminfo
  ABI_VERSION:=6
endef

define Package/libncurses
  SECTION:=libs
  CATEGORY:=Libraries
  TITLE:=Terminal handling library
  URL:=https://www.gnu.org/software/ncurses/
  DEPENDS:= +libncursesw
  ABI_VERSION:=6
endef

define Package/libncurses-dev
  SECTION:=devel
  CATEGORY:=Development
  SUBMENU:=Libraries
  DEPENDS:=zlib
  TITLE:=Development files for the ncurses library
endef

define Package/ncurses-bin
  SECTION:=utils
  CATEGORY:=Utilities
  SUBMENU:=Terminal
  TITLE:=Terminal-related programs
  URL:=https://www.gnu.org/software/ncurses/
  DEPENDS:=+libncursesw
  ALTERNATIVES:= \
		300:/usr/bin/clear:/usr/bin/clear-ncurses \
		300:/usr/bin/reset:/usr/bin/reset-ncurses
endef

TARGET_CFLAGS += $(FPIC) -std=gnu17

CONFIGURE_ARGS += \
	--enable-echo \
	--enable-const \
	--enable-overwrite \
	--enable-pc-files \
	--disable-rpath \
	--without-ada \
	--without-debug \
	--without-manpages \
	--without-profile \
	--with-progs \
	--without-tests \
	--disable-big-core \
	--disable-home-terminfo \
	--with-normal \
	--with-shared \
	--with-terminfo-dirs=/usr/share/terminfo \
	--with-default-terminfo-dir=/usr/share/terminfo \
	--with-pkg-config-libdir=/usr/lib/pkgconfig \
	--enable-widec \
	--with-build-cppflags=-D_GNU_SOURCE \
	--disable-stripping

CONFIGURE_VARS += \
	cf_try_fPIC=no

HOST_CFLAGS += $(HOST_FPIC)

HOST_CONFIGURE_ARGS += \
	--enable-pc-files \
	--without-cxx \
	--without-cxx-binding \
	--without-ada \
	--without-debug \
	--without-manpages \
	--without-profile \
	--without-tests \
	--without-curses-h


ifeq ($(HOST_OS),FreeBSD)
	CONFIGURE_ARGS +=
		--with-terminfo=/usr/share/terminfo.db 
endif

MAKE_FLAGS += \
	BUILD_CC="$(HOSTCC)" \
	HOSTCC="$(HOSTCC)" \
	HOSTCCFLAGS="" \
	PKG_CONFIG_LIBDIR=/usr/lib/pkgconfig \
	libs progs

define Build/Install/Default
	$(MAKE_VARS) \
	$(MAKE) -C $(PKG_BUILD_DIR)/$(MAKE_PATH) \
		$(MAKE_INSTALL_FLAGS) \
		$(1) install.libs install.data install.progs;
endef

define Package/ncurses-bin/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(CP) $(PKG_INSTALL_DIR)/usr/bin/* $(1)/usr/bin/
	rm -f $(1)/usr/bin/{clear,ncursesw6-config,reset}
	$(CP) $(PKG_INSTALL_DIR)/usr/bin/clear $(1)/usr/bin/clear-ncurses
	$(LN) tset $(1)/usr/bin/reset-ncurses
endef

define Package/terminfo/install
	echo ""
ifneq ($(HOST_OS),FreeBSD)
	$(INSTALL_DIR) $(1)/usr/share/terminfo
	(cd $(PKG_INSTALL_DIR)/usr/share/terminfo; \
		for dir in ??; do \
			[ -d "$$$$dir" ] || continue; \
			mv $$$$dir $$$$(echo -ne "\x$$$$dir"); \
		done \
	)
	for file in \
		a/ansi \
		a/alacritty \
		d/dumb \
		f/foot \
		l/linux \
		r/rxvt \
		r/rxvt-unicode \
		s/screen \
		s/screen-256color \
		t/tmux \
		t/tmux-256color \
		v/vt100 \
		v/vt102 \
		x/xterm \
		x/xterm-color \
		x/xterm-256color \
		x/xterm-utf8; do \
		$(INSTALL_DIR) $(1)/usr/share/terminfo/`dirname $$$$file`; \
		$(CP) $(PKG_INSTALL_DIR)/usr/share/terminfo/$$$$file \
			$(1)/usr/share/terminfo/$$$$file; \
	done
endif
endef

define Package/terminfo/postinst
#!/bin/sh

grep -q "^export TERMINFO" /etc/profile || echo "export TERMINFO=/usr/share/terminfo" >> /etc/profile
endef

define Package/libncursesw/install
	$(INSTALL_DIR) $(1)/usr/lib
	for lib in ncurses panel menu form; do \
		$(CP) $(PKG_INSTALL_DIR)/usr/lib/lib$$$${lib}w.so* $(1)/usr/lib/; \
	done
endef

define Package/libncurses-dev/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(CP) $(PKG_INSTALL_DIR)/usr/bin/ncursesw6-config $(1)/usr/bin/
	$(INSTALL_DIR) $(1)/usr/include
	$(CP) $(PKG_INSTALL_DIR)/usr/include/*.h $(1)/usr/include/
	$(INSTALL_DIR) $(1)/usr/lib
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/*.a $(1)/usr/lib/
	$(INSTALL_DIR) $(1)/usr/lib/pkgconfig
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/pkgconfig/*.pc $(1)/usr/lib/pkgconfig/
	# XXX
	$(SED) 's,$(TOOLCHAIN_DIR),/opt,g' $(1)/usr/bin/ncursesw6-config
endef

define Package/libncurses/install
	$(INSTALL_DIR) $(1)/usr/lib
	ln -s libncurses.so.$(PKG_VERSION) $(1)/usr/lib/libcurses.so
	for lib in ncurses panel menu form; do \
		ln -s lib$$$${lib}w.so $(1)/usr/lib/lib$$$${lib}.so; \
		ln -s lib$$$${lib}w.so.6 $(1)/usr/lib/lib$$$${lib}.so.6; \
		ln -s lib$$$${lib}w.so.$(PKG_VERSION) $(1)/usr/lib/lib$$$${lib}.so.$(PKG_VERSION); \
	done
endef

define Build/InstallDev
	$(CP) $(PKG_INSTALL_DIR)/* $(1)
	for lib in ncurses panel menu form; do \
		for so in $(1)/usr/lib/lib$$$${lib}w.so*; do \
			ln -s $$$${so##*/} $$$${so%w.so*}.so$$$${so##*w.so}; \
		done; \
	done
	ln -s . $(1)/usr/include/ncursesw
	$(TARGET_CROSS)ar rc $(1)/usr/lib/libtinfo.a
	$(INSTALL_DIR) $(2)/bin
	$(CP) $(PKG_INSTALL_DIR)/usr/bin/ncursesw6-config $(2)/bin/
	$(SED) 's,^\(prefix\|exec_prefix\)=.*,\1=$(STAGING_DIR)/opt,g' -e 's/$$$$INCS //g' \
		$(2)/bin/ncursesw6-config
	ln -sf $(STAGING_DIR)/host/bin/ncursesw6-config $(1)/usr/bin/ncursesw6-config
	$(SED) 's,$(TOOLCHAIN_DIR),$(STAGING_DIR),g' \
		$(1)/usr/lib/pkgconfig/ncursesw.pc
endef

define Host/Compile
	$(MAKE) -C $(HOST_BUILD_DIR) libs
	$(MAKE) -C $(HOST_BUILD_DIR)/progs tic
endef

$(eval $(call HostBuild))
$(eval $(call BuildPackage,terminfo))
$(eval $(call BuildPackage,libncurses))
$(eval $(call BuildPackage,libncursesw))
$(eval $(call BuildPackage,libncurses-dev))
$(eval $(call BuildPackage,ncurses-bin))
