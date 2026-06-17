include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-wrtc
PKG_VERSION:=0.1.0
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

# Бинарь — pure-Go static (CGO_ENABLED=0), собирается host-Go под armv7.
# C-toolchain Entware ему не нужен. Исходник — проект wrtc-tunnel (out-of-tree).
# Путь переопределяется: make opkg-build PKG=ee71-wrtc WRTC_SRC=/path/to/wrtc-tunnel
WRTC_SRC ?= $(TOPDIR)/../../../../../wrtc-tunnel
GO ?= go

define Package/ee71-wrtc
  SECTION:=ee71
  CATEGORY:=EE71
  TITLE:=Covert WireGuard tunnel over whitelisted WebRTC carriers (EXPERIMENTAL)
  DEPENDS:=+ee71-kmod-wireguard +wireguard-tools
endef

define Package/ee71-wrtc/description
  covert-туннель: plain WireGuard (штатный kernel-WG) поверх SFU DataChannel /
  video-stego реальных видео-карьеров (Jazz/Telemost). pure-Go covert joiner.
  ЭКСПЕРИМЕНТАЛЬНО (Phase 6, gated) — см. wrtc-tunnel/ee71/STRUCTURE.md.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

# Out-of-tree host-Go cross-build (pure-Go static, armv7-softfp)
define Build/Compile
	cd $(WRTC_SRC)/go-core && CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7 \
		$(GO) build -trimpath -ldflags="-s -w" -o $(PKG_BUILD_DIR)/ee71-wrtc ./cmd/wrtc-client
endef

define Package/ee71-wrtc/conffiles
/etc/wrtc/config
endef

define Package/ee71-wrtc/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/ee71-wrtc $(1)/usr/sbin/ee71-wrtc
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/wrtc.init $(1)/etc/init.d/wrtc
	$(INSTALL_DIR) $(1)/etc/wrtc
	$(INSTALL_CONF) ./files/wrtc.config $(1)/etc/wrtc/config
endef

define Package/ee71-wrtc/preinst
#!/bin/sh
[ -x /etc/init.d/wrtc ] && /etc/init.d/wrtc stop 2>/dev/null
exit 0
endef

define Package/ee71-wrtc/postinst
#!/bin/sh
ln -sf ../init.d/wrtc /etc/rc5.d/S95wrtc
echo "ee71-wrtc: конфиг /etc/wrtc/config (wrtc:// URL), PSK /etc/wrtc/psk (chmod 0600)."
exit 0
endef

define Package/ee71-wrtc/prerm
#!/bin/sh
[ -x /etc/init.d/wrtc ] && /etc/init.d/wrtc stop 2>/dev/null
exit 0
endef

define Package/ee71-wrtc/postrm
#!/bin/sh
rm -f /etc/rc5.d/S95wrtc
exit 0
endef

$(eval $(call BuildPackage,ee71-wrtc))
