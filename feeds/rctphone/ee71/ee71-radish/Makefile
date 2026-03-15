include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-radish
PKG_VERSION:=1.3.0
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/ee71-radish
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=Full IPv6 support (radish + firewall)
  DEPENDS:=+libpthread +librt
  CONFLICTS:=ee71-ipv6
endef

define Package/ee71-radish/description
  Complete IPv6 stack for EE71. Replaces ee71-ipv6 package.

  Radish (Qualcomm v1.1 + EE71 enhancements):
  - RDNSS: wrapper adds -d flag for DNS server in RA
  - Periodic RA: cached RA every 600s on bridge
  - RS response: immediate RA reply from cache to client RS
  - Startup RS: solicits RA from modem at boot
  - Bridge IPv6: assigns prefix::1 to bridge0

  IPv6 infrastructure:
  - ip6tables INPUT DROP firewall (S38, before QCMAP)

  Binary at /usr/libexec/radish, wrapper at /usr/sbin/radish.
  Links against stock device libs.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) ./src/*.c ./src/*.h $(PKG_BUILD_DIR)/
endef

define Build/Compile
	$(TARGET_CC) $(TARGET_CFLAGS) \
		-D__packed__= \
		-DIMAGE_APPS_PROC \
		-DFEATURE_DATA_LINUX_LE \
		-DFEATURE_DATA_PREFIX_DELEGATION \
		-DRADISH_OFFLINE \
		-DRADISH_LOG_QXDM \
		-DFEATURE_DATA_LOG_SYSLOG \
		-DUSE_GLIB \
		-I./include \
		-I./include/dsutils \
		-I./include/diag \
		-I./include/glib-2.0 \
		-I$(PKG_BUILD_DIR) \
		-c -o $(PKG_BUILD_DIR)/radish.o $(PKG_BUILD_DIR)/radish.c
	$(TARGET_CC) $(TARGET_CFLAGS) \
		-D__packed__= \
		-DIMAGE_APPS_PROC \
		-DFEATURE_DATA_LINUX_LE \
		-DFEATURE_DATA_PREFIX_DELEGATION \
		-DRADISH_OFFLINE \
		-DRADISH_LOG_QXDM \
		-DFEATURE_DATA_LOG_SYSLOG \
		-DUSE_GLIB \
		-I./include \
		-I./include/dsutils \
		-I./include/diag \
		-I./include/glib-2.0 \
		-I$(PKG_BUILD_DIR) \
		-c -o $(PKG_BUILD_DIR)/config.o $(PKG_BUILD_DIR)/config.c
	$(TARGET_CC) $(TARGET_CFLAGS) \
		-D__packed__= \
		-DIMAGE_APPS_PROC \
		-DFEATURE_DATA_LINUX_LE \
		-DFEATURE_DATA_PREFIX_DELEGATION \
		-DRADISH_OFFLINE \
		-DRADISH_LOG_QXDM \
		-DFEATURE_DATA_LOG_SYSLOG \
		-DUSE_GLIB \
		-I./include \
		-I./include/dsutils \
		-I./include/diag \
		-I./include/glib-2.0 \
		-I$(PKG_BUILD_DIR) \
		-c -o $(PKG_BUILD_DIR)/icmpv6.o $(PKG_BUILD_DIR)/icmpv6.c
	$(TARGET_CC) $(TARGET_CFLAGS) \
		-c -o $(PKG_BUILD_DIR)/compat.o $(PKG_BUILD_DIR)/compat.c
	$(TARGET_CC) $(TARGET_LDFLAGS) -Wl,--allow-multiple-definition \
		-L./devlibs \
		-o $(PKG_BUILD_DIR)/radish \
		$(PKG_BUILD_DIR)/radish.o \
		$(PKG_BUILD_DIR)/config.o \
		$(PKG_BUILD_DIR)/icmpv6.o \
		$(PKG_BUILD_DIR)/compat.o \
		-ldsutils -ldiag -lglib-2.0 -lpthread -lrt
endef

# Stock device libs (libdiag, libdsutils, libglib-2.0) are not Entware packages
# Skip shared library dependency check for this package
define CheckDependencies
endef

define Package/ee71-radish/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_DIR) $(1)/usr/libexec
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/radish $(1)/usr/libexec/radish
	$(INSTALL_BIN) ./files/radish $(1)/usr/sbin/radish
	# IPv6 firewall init script
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/ip6tables_firewall $(1)/etc/init.d/
	$(INSTALL_DIR) $(1)/etc/rcS.d
	$(LN) ../init.d/ip6tables_firewall $(1)/etc/rcS.d/S38ip6tables_firewall
endef

$(eval $(call BuildPackage,ee71-radish))
