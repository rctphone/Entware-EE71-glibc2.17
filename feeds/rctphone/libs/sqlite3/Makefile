include $(TOPDIR)/rules.mk

PKG_NAME:=sqlite3
PKG_VERSION:=3.53.4
PKG_RELEASE:=1

PKG_SOURCE:=sqlite-autoconf-3530400.tar.gz
PKG_SOURCE_URL:=https://www.sqlite.org/2026/
PKG_HASH:=0e9483900e92cd5de8fd48d16bf9200145a61f7fd5be542a5ac81d8a9516eb9c

PKG_LICENSE:=Public-Domain
PKG_INSTALL:=1
PKG_BUILD_PARALLEL:=1
PKG_BUILD_FLAGS:=lto gc-sections
PKG_FLAGS:=essential

PKG_BUILD_DIR:=$(BUILD_DIR)/sqlite-autoconf-3530400

include $(INCLUDE_DIR)/package.mk

define Package/sqlite3
  SECTION:=libs
  CATEGORY:=Libraries
  TITLE:=SQLite3 database engine
  DEPENDS:=+libc +libpthread
  PROVIDES:=libsqlite3 sqlite3-cli
  URL:=https://www.sqlite.org/
endef

TARGET_CFLAGS += \
	-DHAVE_ISNAN -DHAVE_MALLOC_USABLE_SIZE \
	-DSQLITE_ENABLE_UNLOCK_NOTIFY \
	-DSQLITE_ENABLE_JSON1 \
	-DSQLITE_ENABLE_FTS5 \
	-DSQLITE_ENABLE_MATH_FUNCTIONS \
	-DSQLITE_ENABLE_FTS4 \
	-DSQLITE_ENABLE_RTREE \
	-DSQLITE_ENABLE_GEOPOLY \
	-DSQLITE_DQS=0 \
	-DSQLITE_OMIT_LOAD_EXTENSION \
	-DSQLITE_THREADSAFE=1

CONFIGURE_ARGS = \
	--host=$(GNU_TARGET_NAME) \
	--build=$(GNU_HOST_NAME) \
	--prefix=$(CONFIGURE_PREFIX) \
	--disable-static \
	--disable-static-shell \
	--disable-readline \
	--disable-rpath \
	--soname=legacy \
	--fts4 \
	--fts5 \
	--rtree \
	--geopoly

define Build/InstallDev
	$(INSTALL_DIR) $(1)/usr/include
	$(CP) $(PKG_INSTALL_DIR)/usr/include/sqlite3*.h $(1)/usr/include/
	$(INSTALL_DIR) $(1)/usr/lib
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/libsqlite3.so* $(1)/usr/lib/
	$(INSTALL_DIR) $(1)/usr/lib/pkgconfig
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/pkgconfig/sqlite3.pc $(1)/usr/lib/pkgconfig/
endef

define Package/sqlite3/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/libsqlite3.so* $(1)/usr/lib/
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/bin/sqlite3 $(1)/usr/bin/
endef

$(eval $(call BuildPackage,sqlite3))
