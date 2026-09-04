include $(TOPDIR)/rules.mk

PKG_NAME:=jq
PKG_VERSION:=1.8.2
PKG_RELEASE:=1

PKG_SOURCE:=jq-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=https://github.com/jqlang/jq/releases/download/jq-$(PKG_VERSION)/
PKG_HASH:=71b8d6e8f5fe81f6c6d0d110e3892251f6ce76ed095abd315e26e6e1193af3af

PKG_LICENSE:=MIT
PKG_INSTALL:=1
PKG_BUILD_PARALLEL:=1
PKG_BUILD_FLAGS:=lto gc-sections
PKG_FIXUP:=autoreconf

include $(INCLUDE_DIR)/package.mk

define Package/jq
  SECTION:=utils
  CATEGORY:=Utilities
  TITLE:=Lightweight command-line JSON processor
  DEPENDS:=+libc
  URL:=https://jqlang.github.io/jq/
endef

define Package/jq/description
  jq is like sed for JSON data — you can use it to slice, filter, map,
  and transform structured data with the same ease that sed, awk, grep
  and friends let you play with text.
endef

CONFIGURE_ARGS += \
	--disable-docs \
	--disable-valgrind \
	--disable-maintainer-mode \
	--disable-shared \
	--without-oniguruma

define Package/jq/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/bin/jq $(1)/usr/bin/
endef

$(eval $(call BuildPackage,jq))
