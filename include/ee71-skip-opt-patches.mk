# SPDX-License-Identifier: GPL-2.0-only
#
# EE71: Skip Entware /opt path patches
#
# Entware packages often include patches (e.g. 500-paths.patch) that hardcode
# /opt into source code. Since we build with /usr prefix, these patches are
# unwanted and would break the build.
#
# This hook overrides Build/Patch/Default to filter out patches containing
# added lines with /opt paths before applying them.
#

ifdef CONFIG_EE71_SKIP_OPT_PATCHES

# Check if a patch file adds /opt paths (lines starting with +)
# Returns non-empty if the patch should be SKIPPED
# 1: patch file path
define PatchHasOptPaths
$(shell \
  if grep -qE '^\+.*(/opt/etc|/opt/var|/opt/tmp|/opt/lib|/opt/bin|/opt/sbin|/opt/share|/opt/usr)' "$(1)" 2>/dev/null; then \
    echo skip; \
  fi \
)
endef

# Override Build/Patch/Default to filter /opt patches
# Original is defined in include/quilt.mk
define Build/Patch/Default
	$(if $(QUILT),rm -rf $(PKG_BUILD_DIR)/patches; mkdir -p $(PKG_BUILD_DIR)/patches)
	@if [ -d "$(PATCH_DIR)" ]; then \
		_tmp="$(PKG_BUILD_DIR)/.patches-filtered"; \
		mkdir -p "$$_tmp"; \
		for f in "$(PATCH_DIR)"/*.patch "$(PATCH_DIR)"/*.diff; do \
			[ -f "$$f" ] || continue; \
			_base="$$(basename "$$f")"; \
			if grep -qE '^\+.*(/opt/etc|/opt/var|/opt/tmp|/opt/lib|/opt/bin|/opt/sbin|/opt/share|/opt/usr)' "$$f" 2>/dev/null; then \
				echo "[SKIP-OPT] $$_base"; \
			else \
				cp "$$f" "$$_tmp/"; \
			fi; \
		done; \
		if [ -f "$(PATCH_DIR)/series" ]; then \
			while IFS= read -r line; do \
				case "$$line" in \#*|"") continue;; esac; \
				[ -f "$$_tmp/$$line" ] && echo "$$line"; \
			done < "$(PATCH_DIR)/series" > "$$_tmp/series"; \
		fi; \
	fi
	$(call PatchDir,$(PKG_BUILD_DIR),$(PKG_BUILD_DIR)/.patches-filtered,)
	$(call PatchDir,$(PKG_BUILD_DIR),$(PATCH_DIR)-$(KERNVER),)
	$(if $(QUILT),touch $(PKG_BUILD_DIR)/.quilt_used)
endef

endif # CONFIG_EE71_SKIP_OPT_PATCHES
