# SPDX-License-Identifier: GPL-2.0-only
#
# EE71 (MDM9640, Cortex-A7, kernel 3.10.49)

include $(TOPDIR)/rules.mk

ARCH:=arm
BOARD:=armv7-3.10
BOARDNAME:=Entware (armv7, Linux 3.10.49)
CPU_TYPE:=cortex-a7+neon-vfpv4
FEATURES:=gpio usb
KERNEL_PATCHVER:=3.10

include $(INCLUDE_DIR)/target.mk

define Target/Description
  Build Software Repository for EE71 (MDM9640, Cortex-A7, glibc 2.17).
endef

$(eval $(call BuildTarget))
