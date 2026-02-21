# SPDX-License-Identifier: GPL-2.0-only
#
# Copyright (C) 2016-2026 Entware

include $(TOPDIR)/rules.mk

PKG_NAME:=go-bootstrap
PKG_VERSION:=1.24.13
PKG_RELEASE:=1

OS=$(shell uname | tr '[:upper:]' '[:lower:]')
BINTYPE=$(shell uname -m | sed 's/aarch64/arm64/;s/i[3-6]86/386/;s/x86_64/amd64/')

PKG_SOURCE:=go$(PKG_VERSION).$(OS)-$(BINTYPE).tar.gz
PKG_SOURCE_URL:= \
		https://dl.google.com/go/ \
		https://storage.googleapis.com/golang \
		https://mirrors.ustc.edu.cn/golang/ \
		https://mirrors.nju.edu.cn/golang/
ifeq ($(BINTYPE),arm64)
PKG_HASH:=74d97be1cc3a474129590c67ebf748a96e72d9f3a2b6fef3ed3275de591d49b3
else
PKG_HASH:=bbca37cc395c974ffa4893ee35819ad23ebb27426df87af92e93a9ec66ef8712
endif

BOOTSTRAP_VERSION:=$(subst $(space),.,$(wordlist 1,2,$(subst .,$(space),$(PKG_VERSION))))

HOST_BUILD_DIR:=$(STAGING_DIR_HOST)/go$(BOOTSTRAP_VERSION)
HOST_UNPACK:=gzip -dc $(DL_DIR)/$(PKG_SOURCE) | tar -C $(HOST_BUILD_DIR) --strip-components=1 -xf -

include $(INCLUDE_DIR)/host-build.mk

#build go for all architetures - in case gccgo does not work

define Host/Configure
endef

define Host/Compile
endef

define Host/Install
endef

define Host/Clean
	rm -rf $(STAGING_DIR_HOST)/go1*
endef

$(eval $(call HostBuild))
