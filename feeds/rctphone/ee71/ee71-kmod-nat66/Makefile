include $(TOPDIR)/rules.mk

PKG_NAME:=ee71-kmod-nat66
PKG_VERSION:=3.10.49
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/ee71-kmod-nat66
  SECTION:=ee71
  CATEGORY:=EE71
  SUBMENU:=Kernel modules
  TITLE:=IPv6 NAT / NPTv6 kernel modules (pre-built)
endef

define Package/ee71-kmod-nat66/description
  IPv6 NAT (NAT66) and stateless prefix translation (NPTv6) kernel modules
  for kernel 3.10.49, which ships without CONFIG_NF_NAT_IPV6.

  Modules: nf_nat_ipv6, ip6table_nat, ip6t_MASQUERADE.
  Pre-built with Linaro GCC 4.9 (required for this kernel) from the vendor
  3.10.49 tree; see docker/kernel-modules/build.sh.

  The package ships files only. vpn_apply insmods them on demand from
  ip6_nat_available(), the same way it already loads wireguard.ko — so there
  is no boot cost, and on an IPv4-only tunnel they are never loaded at all.
  With them loaded, ip6tables gains the nat table and vpn_apply routes LAN
  IPv6 through the tunnel instead of rejecting it. This only has an effect
  once the tunnel itself carries IPv6 (an IPv6 Address and ::/0 in
  AllowedIPs); on an IPv4-only tunnel it changes nothing.

  ip6t_NPT (stateless NPTv6) is built by docker/kernel-modules/build.sh but
  deliberately NOT shipped: nothing in this project uses SNPT/DNPT, and a
  file on UBIFS that nothing references is worse than one cp away.

  Analysis: docs/plans/ipv6-nat-feasibility.md
endef

# /lib is a symlink to /usr/lib on the device, so both spellings resolve to the
# same place. Use the real path: it is what vpn_apply's NAT66_DIR looks in, and
# it avoids shipping a /lib directory entry that could shadow the symlink.
MODULE_DIR:=/usr/lib/modules/3.10.49/kernel/net/ipv6/netfilter

# The .ko files are built out of tree, not by this Makefile. Fail with a
# useful message instead of a confusing install error when they are absent.
define Build/Compile
	@for m in nf_nat_ipv6 ip6table_nat ip6t_MASQUERADE; do \
		[ -f ./files/$$$$m.ko ] && continue; \
		echo "[ERR] $(PKG_NAME): ./files/$$$$m.ko missing"; \
		echo "[ERR] build them first:"; \
		echo "[ERR]   cd docker/kernel-modules && ./build_host.sh"; \
		echo "[ERR]   cd work/out && cp nf_nat_ipv6.ko ip6table_nat.ko \\"; \
		echo "[ERR]      ip6t_MASQUERADE.ko $(CURDIR)/files/"; \
		exit 1; \
	done
endef

define Package/ee71-kmod-nat66/install
	$(INSTALL_DIR) $(1)$(MODULE_DIR)
	$(INSTALL_DATA) ./files/nf_nat_ipv6.ko $(1)$(MODULE_DIR)/
	$(INSTALL_DATA) ./files/ip6table_nat.ko $(1)$(MODULE_DIR)/
	$(INSTALL_DATA) ./files/ip6t_MASQUERADE.ko $(1)$(MODULE_DIR)/
endef

$(eval $(call BuildPackage,ee71-kmod-nat66))
