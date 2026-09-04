include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-amneziawg-tools
# The version the shipped files/awg actually reports:
#   strings files/awg | grep '1\.0\.2'  ->  1.0.20210914
# It was labelled 1.0.20220627, a tag matching neither this binary nor the
# kernel module shipped beside it. Nothing was rebuilt; only the label was
# corrected. Note this is LOWER than the label it replaces, so opkg treats it
# as a downgrade: an already-installed 1.0.20220627-1 needs
# `opkg install --force-downgrade` (or remove + install) once.
PKG_VERSION:=1.0.20210914
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/ee71-amneziawg-tools
  SECTION:=ee71
  CATEGORY:=EE71
  SUBMENU:=VPN
  TITLE:=AmneziaWG userspace tool (awg)
  DEPENDS:=+ee71-kmod-amneziawg
endef

define Package/ee71-amneziawg-tools/description
  AmneziaWG userspace control program (awg) for kernel 3.10.49.
  Fork of wireguard-tools with anti-DPI obfuscation support.
  Pre-built with ee71-crossoe (GCC 13.2, ARMv7-A soft-float).

  This is the AWG 1.0 generation. It cannot set the I1-I5 / S3-S4
  parameters that AmneziaWG 2.0 (2025-09) and 3.x (2026-07) introduced, and
  Amnezia states 1.0 peers do not interoperate with 2.0/3.x servers. Talking
  to a current Amnezia server needs a rebuild from the v3.1 tools tag and a
  matching kernel module, not a config change.
endef

define Build/Compile
	true
endef

define Package/ee71-amneziawg-tools/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./files/awg $(1)/usr/bin/
endef

$(eval $(call BuildPackage,ee71-amneziawg-tools))
