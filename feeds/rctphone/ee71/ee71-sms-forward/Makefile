include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-sms-forward
PKG_VERSION:=1.0.9
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_BUILD_FLAGS:=lto gc-sections

include $(INCLUDE_DIR)/package.mk

define Package/ee71-sms-forward
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=SMS to Telegram forwarding daemon (IPC)
  DEPENDS:=+libstdcpp +libcurl
endef

define Package/ee71-sms-forward/description
  Polls core_app via IPC for new SMS messages and forwards
  received messages to Telegram. Single daemon replaces
  sms_watchd + sms_notify + sms_forward.sh.
endef

define Package/ee71-sms-forward/conffiles
/etc/sms_forward.conf
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) ./files/* $(PKG_BUILD_DIR)/
endef

define Build/Compile
	$(TARGET_CC) $(TARGET_CFLAGS) $(TARGET_CPPFLAGS) \
		-isystem $(STAGING_DIR)/usr/include \
		-c -o $(PKG_BUILD_DIR)/cJSON.o \
		$(PKG_BUILD_DIR)/cJSON.c
	$(TARGET_CXX) $(TARGET_CXXFLAGS) $(TARGET_CPPFLAGS) \
		-isystem $(STAGING_DIR)/usr/include \
		-std=c++11 \
		-o $(PKG_BUILD_DIR)/sms_forward \
		$(PKG_BUILD_DIR)/sms_forward.cpp \
		$(PKG_BUILD_DIR)/cJSON.o \
		$(TARGET_LDFLAGS) \
		-L$(STAGING_DIR)/usr/lib \
		-ldl -lpthread -lcurl
endef

define Package/ee71-sms-forward/preinst
#!/bin/sh
# Stop daemon before upgrade
[ -x /etc/init.d/sms_forward ] && /etc/init.d/sms_forward stop 2>/dev/null
exit 0
endef

define Package/ee71-sms-forward/postinst
#!/bin/sh
# Create rc5.d symlink (after core_app S65, after ee71_webui S75)
ln -sf ../init.d/sms_forward /etc/rc5.d/S76sms_forward
# Start daemon
/etc/init.d/sms_forward start 2>/dev/null
exit 0
endef

define Package/ee71-sms-forward/prerm
#!/bin/sh
# Stop daemon before removal
[ -x /etc/init.d/sms_forward ] && /etc/init.d/sms_forward stop 2>/dev/null
exit 0
endef

define Package/ee71-sms-forward/postrm
#!/bin/sh
# Remove rc5.d symlink
rm -f /etc/rc5.d/S76sms_forward
exit 0
endef

define Package/ee71-sms-forward/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/sms_forward $(1)/usr/sbin/
	$(INSTALL_DIR) $(1)/etc
	$(INSTALL_CONF) $(PKG_BUILD_DIR)/sms_forward.conf $(1)/etc/
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/sms_forward.init $(1)/etc/init.d/sms_forward
endef

$(eval $(call BuildPackage,ee71-sms-forward))
