#
# EE71 pre-built kernel modules: TUN + WireGuard
#
# These .ko files are cross-compiled externally with Linaro GCC 4.9
# (kernel 3.10 requires GCC <8 for inline asm compatibility).
# Source: docker/kernel-modules/build_host.sh
#
# This package just installs pre-built binaries + init script.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=kmod-wireguard
PKG_VERSION:=3.10.49
PKG_RELEASE:=1

PKG_LICENSE:=GPL-2.0
PKG_FLAGS:=nonshared

include $(INCLUDE_DIR)/package.mk

# --- kmod-tun ---

define Package/kmod-tun
  SECTION:=kernel
  CATEGORY:=Kernel modules
  SUBMENU:=Network Support
  TITLE:=TUN/TAP kernel module (pre-built)
  VERSION:=$(PKG_VERSION)-$(PKG_RELEASE)
endef

define Package/kmod-tun/description
  Pre-built TUN/TAP kernel module for EE71 (kernel 3.10.49).
  Required by WireGuard and other VPN software.
endef

define Package/kmod-tun/install
	$(INSTALL_DIR) $(1)/lib/modules/3.10.49/kernel/drivers/net
	$(INSTALL_DATA) ./files/tun.ko $(1)/lib/modules/3.10.49/kernel/drivers/net/
endef

define Package/kmod-tun/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || depmod -a 2>/dev/null
mkdir -p /dev/net
[ -c /dev/net/tun ] || mknod /dev/net/tun c 10 200
endef

# --- kmod-wireguard ---

define Package/kmod-wireguard
  SECTION:=kernel
  CATEGORY:=Kernel modules
  SUBMENU:=Network Support
  TITLE:=WireGuard kernel module (pre-built)
  DEPENDS:=+kmod-tun
  VERSION:=$(PKG_VERSION)-$(PKG_RELEASE)
endef

define Package/kmod-wireguard/description
  Pre-built WireGuard kernel module for EE71 (kernel 3.10.49).
  WireGuard is a fast, modern VPN using ChaCha20/Poly1305 cryptography.
endef

define Package/kmod-wireguard/install
	$(INSTALL_DIR) $(1)/lib/modules/3.10.49/kernel/drivers/net
	$(INSTALL_DATA) ./files/wireguard.ko $(1)/lib/modules/3.10.49/kernel/drivers/net/
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/wireguard_modules $(1)/etc/init.d/wireguard_modules
	$(INSTALL_DIR) $(1)/etc/rc5.d
	ln -sf ../init.d/wireguard_modules $(1)/etc/rc5.d/S12wireguard_modules
endef

define Package/kmod-wireguard/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
    depmod -a 2>/dev/null
    /etc/init.d/wireguard_modules start
}
endef

define Package/kmod-wireguard/prerm
#!/bin/sh
/etc/init.d/wireguard_modules stop 2>/dev/null
endef

# No source to compile — pre-built binaries
define Build/Prepare
	true
endef

define Build/Compile
	true
endef

$(eval $(call BuildPackage,kmod-tun))
$(eval $(call BuildPackage,kmod-wireguard))
