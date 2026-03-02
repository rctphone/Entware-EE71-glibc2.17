include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-sms-watchd
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_BUILD_FLAGS:=lto gc-sections

include $(INCLUDE_DIR)/package.mk

define Package/ee71-sms-watchd
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=inotify-based SMS notification daemon
  DEPENDS:=+libc
endef

define Package/ee71-sms-watchd/description
  Watches /jrd-resource/resource/sqlite3/ for changes to user_info.db3
  (core_app sets new_sms_flag=1 on SMS arrival). On change, debounces
  and fork/execs /usr/sbin/sms_notify to read SMS via WebAPI and send
  Telegram notifications.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) ./src/* $(PKG_BUILD_DIR)/
endef

define Build/Compile
	$(TARGET_CC) $(TARGET_CFLAGS) $(TARGET_LDFLAGS) \
		-o $(PKG_BUILD_DIR)/sms_watchd \
		$(PKG_BUILD_DIR)/sms_watchd.c
endef

define Package/ee71-sms-watchd/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/sms_watchd $(1)/usr/sbin/
endef

$(eval $(call BuildPackage,ee71-sms-watchd))
