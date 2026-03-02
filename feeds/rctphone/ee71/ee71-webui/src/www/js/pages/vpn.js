;(function() {
    'use strict';
    var icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;
    var formatBytes = App.formatBytes;

    // Cached state
    var _wgStatus = null;
    var _awgStatus = null;
    var _ssStatus = null;
    var _vpnTimer = null;

    function renderVpn(container) {
        container.innerHTML = '<h2>VPN</h2><div id="vpn-wg" class="vpn-card"></div><div id="vpn-awg" class="vpn-card"></div><div id="vpn-ss" class="vpn-card"></div>';
        _loadAll();
        _vpnTimer = setInterval(_refreshVpn, 3000);
        App.setCleanup(function() {
            if (_vpnTimer) { clearInterval(_vpnTimer); _vpnTimer = null; }
        });
    }

    function _loadAll() {
        _loadWg();
        _loadAwg();
        _loadSs();
    }

    function _reorderVpn() {
        var active = null;
        if (_wgStatus && _wgStatus.up) active = 'vpn-wg';
        else if (_awgStatus && _awgStatus.up) active = 'vpn-awg';
        else if (_ssStatus && _ssStatus.running) active = 'vpn-ss';
        if (!active) return;
        var el = document.getElementById(active);
        if (!el || !el.parentNode) return;
        var h2 = el.parentNode.querySelector('h2');
        var ref = h2 ? h2.nextSibling : el.parentNode.firstChild;
        if (el === ref) return;

        // FLIP animation: capture old positions
        var cards = el.parentNode.querySelectorAll('.vpn-card');
        var firstRects = {};
        for (var i = 0; i < cards.length; i++)
            firstRects[cards[i].id] = cards[i].getBoundingClientRect();

        el.parentNode.insertBefore(el, ref);

        // Animate from old position to new
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            var first = firstRects[card.id];
            if (!first) continue;
            var last = card.getBoundingClientRect();
            var dy = first.top - last.top;
            if (Math.abs(dy) < 1) continue;
            card.style.transform = 'translateY(' + dy + 'px)';
            card.style.transition = 'none';
            card.offsetHeight; // force reflow
            card.style.transition = 'transform 0.3s ease';
            card.style.transform = '';
        }
    }

    // Silent refresh — update all VPN statuses without showing loading spinner
    function _refreshVpn() {
        if (document.getElementById('vpn-wg')) {
            API.cgiGet('wireguard.cgi', { action: 'status' }).then(function(status) {
                _wgStatus = status;
                var el = document.getElementById('vpn-wg');
                if (el) _renderWg(el, status);
                _reorderVpn();
            }).catch(function() {});
        }
        if (document.getElementById('vpn-awg')) {
            API.cgiGet('amneziawg.cgi', { action: 'status' }).then(function(status) {
                _awgStatus = status;
                var el = document.getElementById('vpn-awg');
                if (el) _renderAwg(el, status);
                _reorderVpn();
            }).catch(function() {});
        }
        if (document.getElementById('vpn-ss')) {
            API.cgiGet('shadowsocks.cgi', { action: 'status' }).then(function(status) {
                _ssStatus = status;
                var el = document.getElementById('vpn-ss');
                if (el) _renderSs(el, status);
                _reorderVpn();
            }).catch(function() {});
        }
    }

    // ===== WireGuard =====

    function _loadWg() {
        var el = document.getElementById('vpn-wg');
        if (!el) return;
        el.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading WireGuard...</div></div>';

        API.cgiGet('wireguard.cgi', { action: 'status' }).then(function(status) {
            _wgStatus = status;
            _renderWg(el, status);
            _reorderVpn();
        }).catch(function(e) {
            el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(e.message) + '</p></div>';
        });
    }

    function _renderWg(el, status) {
        var up = status.up;
        var switchDisabled = !status.has_wg ? ' disabled' : '';
        var html = '<div class="card">';

        // Header with toggle
        html += '<div class="card-header">';
        html += '<h3>' + icon('ic-vpn') + ' WireGuard</h3>';
        html += '<label class="switch"><input type="checkbox" id="wg-toggle"' + (up ? ' checked' : '') + switchDisabled + '><span class="slider"></span></label>';
        html += '</div>';

        // Status line + interface details
        var peer = (status.peers && status.peers.length > 0) ? status.peers[0] : null;
        var hasPeerHandshake = peer && peer.latest_handshake && peer.latest_handshake !== 'never' && peer.latest_handshake !== '';

        if (up) {
            if (hasPeerHandshake) {
                html += '<div class="vpn-status"><span class="status-dot on"></span><span class="text-success">Connected</span></div>';
            } else if (peer) {
                html += '<div class="vpn-status"><span class="status-dot orange"></span><span class="text-warn">Interface Up</span> <span class="text-muted text-small">\u2022 awaiting handshake</span></div>';
            } else {
                html += '<div class="vpn-status"><span class="status-dot orange"></span><span class="text-warn">Interface Up</span> <span class="text-muted text-small">\u2022 no peers</span></div>';
            }

            // Interface info
            html += '<div class="vpn-info">';
            if (status.address) html += '<div class="stat-row"><span class="label">Address</span><span class="value text-mono">' + escHtml(status.address) + '</span></div>';
            if (status.interface && status.interface.listen_port && status.interface.listen_port !== '0') {
                html += '<div class="stat-row"><span class="label">Listen Port</span><span class="value">' + escHtml(status.interface.listen_port) + '</span></div>';
            }
            if (status.interface && status.interface.public_key && status.interface.public_key !== '(none)') {
                html += '<div class="stat-row"><span class="label">Public Key</span><span class="value text-mono text-small">' + escHtml(status.interface.public_key) + '</span></div>';
            }
            html += '</div>';

            // Peer details
            if (peer) {
                html += '<div class="vpn-peer-block">';
                html += '<div class="vpn-peer-title">Peer</div>';
                html += '<div class="vpn-info">';
                if (peer.endpoint && peer.endpoint !== '(none)') {
                    html += '<div class="stat-row"><span class="label">Endpoint</span><span class="value text-mono">' + escHtml(peer.endpoint) + '</span></div>';
                }
                if (peer.allowed_ips) {
                    html += '<div class="stat-row"><span class="label">Allowed IPs</span><span class="value text-mono">' + escHtml(peer.allowed_ips) + '</span></div>';
                }
                html += '<div class="stat-row"><span class="label">Handshake</span><span class="value">' + (hasPeerHandshake ? escHtml(peer.latest_handshake) : '<span class="text-muted">never</span>') + '</span></div>';
                html += '<div class="stat-row"><span class="label">Transfer</span><span class="value">\u2193 ' + formatBytes(peer.transfer_rx) + ' \u2191 ' + formatBytes(peer.transfer_tx) + '</span></div>';
                if (peer.persistent_keepalive && peer.persistent_keepalive !== 'off' && peer.persistent_keepalive !== '0') {
                    html += '<div class="stat-row"><span class="label">Keepalive</span><span class="value">' + escHtml(peer.persistent_keepalive) + 's</span></div>';
                }
                html += '</div></div>';
            }
        } else if (status.has_config) {
            html += '<div class="vpn-status"><span class="status-dot off"></span><span class="text-muted">Disconnected</span></div>';
            if (status.endpoint) {
                html += '<div class="vpn-endpoint">' + escHtml(status.endpoint) + '</div>';
            }
        } else {
            html += '<div class="text-muted">No configuration. Import a config to get started.</div>';
        }

        // Edit button
        html += '<div class="vpn-buttons">';
        html += '<button class="btn-outline" ' + actionAttr('wgEditModal') + '>Edit Config</button>';
        html += '</div>';

        html += '<div id="wg-action-status"></div>';
        html += '</div>';
        el.innerHTML = html;

        // Bind toggle events
        var wgToggle = document.getElementById('wg-toggle');
        if (wgToggle) {
            wgToggle.addEventListener('change', function() {
                if (this.checked) _wgEnable();
                else _wgDisable();
            });
        }
    }

    function _wgEnable() {
        var st = document.getElementById('wg-action-status');
        if (st) st.innerHTML = '<div class="page-loading"><div class="spinner"></div> Enabling...</div>';
        API.cgiPost('wireguard.cgi', { action: 'enable' }).then(function(r) {
            if (r.ok) { _loadAll(); } else { _wgError(r.error); }
        }).catch(function(e) { _wgError(e.message); });
    }

    function _wgDisable() {
        var st = document.getElementById('wg-action-status');
        if (st) st.innerHTML = '<div class="page-loading"><div class="spinner"></div> Disabling...</div>';
        API.cgiPost('wireguard.cgi', { action: 'disable' }).then(function(r) {
            if (r.ok) { _loadAll(); } else { _wgError(r.error); }
        }).catch(function(e) { _wgError(e.message); });
    }

    function _wgError(msg) {
        var st = document.getElementById('wg-action-status');
        if (st) st.innerHTML = '<p class="text-danger">' + escHtml(msg) + '</p>';
        // Reset toggle to match actual state
        setTimeout(_loadWg, 1500);
    }

    // ===== Slide-in Panel (reuses rule-panel CSS from WiFi) =====

    function _showPanel(title, contentHTML) {
        _vpnCloseModal();
        var overlay = document.createElement('div');
        overlay.id = 'rule-panel-overlay';
        overlay.className = 'rule-panel-overlay';
        overlay.innerHTML =
            '<div class="rule-panel">' +
                '<h3>' + escHtml(title) + '<button class="close-btn" id="vpn-panel-close">\u00d7</button></h3>' +
                contentHTML +
            '</div>';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) _vpnCloseModal(); });
        document.getElementById('vpn-panel-close').addEventListener('click', _vpnCloseModal);
    }

    function _wgImportModal() {
        var html = '<textarea id="wg-import-text" rows="14" class="text-mono text-small" placeholder="[Interface]\nPrivateKey = ...\nAddress = 10.0.0.2/24\nDNS = 1.1.1.1\n\n[Peer]\nPublicKey = ...\nEndpoint = vpn.example.com:51820\nAllowedIPs = 0.0.0.0/0\nPersistentKeepalive = 25"></textarea>';
        html += '<div id="wg-import-status"></div>';
        html += '<div class="form-actions">';
        html += '<button id="vpn-panel-save">Save & Apply</button>';
        html += '<button class="btn-outline" id="vpn-panel-genkey">Generate Keys</button>';
        html += '</div>';
        html += '<div id="wg-keygen"></div>';

        _showPanel('Import WireGuard Config', html);
        document.getElementById('vpn-panel-save').addEventListener('click', _wgSaveImport);
        document.getElementById('vpn-panel-genkey').addEventListener('click', _wgGenKey);
    }

    function _wgEditModal() {
        // Show loading panel, then fetch raw config
        var html = '<div id="wg-edit-loading"><div class="page-loading"><div class="spinner"></div> Loading config...</div></div>';
        html += '<textarea id="wg-edit-text" rows="14" class="text-mono text-small" style="display:none"></textarea>';
        html += '<div id="wg-edit-status"></div>';
        html += '<div class="form-actions">';
        html += '<button id="vpn-panel-save">Save & Apply</button>';
        html += '<button class="btn-outline" id="vpn-panel-cancel">Cancel</button>';
        html += '</div>';

        _showPanel('Edit WireGuard Config', html);
        document.getElementById('vpn-panel-save').addEventListener('click', _wgSaveEdit);
        document.getElementById('vpn-panel-cancel').addEventListener('click', _vpnCloseModal);

        API.cgiGet('wireguard.cgi', { action: 'config' }).then(function(r) {
            var loading = document.getElementById('wg-edit-loading');
            var textarea = document.getElementById('wg-edit-text');
            if (loading) loading.style.display = 'none';
            if (textarea) {
                textarea.value = r.config || '';
                textarea.style.display = '';
            }
        }).catch(function(e) {
            var loading = document.getElementById('wg-edit-loading');
            if (loading) loading.innerHTML = '<p class="text-danger">' + escHtml(e.message) + '</p>';
        });
    }

    function _wgSaveConfig(textareaId, statusId) {
        var textarea = document.getElementById(textareaId);
        var st = document.getElementById(statusId);
        if (!textarea || !textarea.value.trim()) {
            if (st) st.innerHTML = '<p class="text-danger">Config is empty</p>';
            return;
        }
        if (st) st.innerHTML = '<div class="page-loading"><div class="spinner"></div> Saving...</div>';
        API.cgiPost('wireguard.cgi', { action: 'save', config: textarea.value }).then(function(r) {
            if (r.ok) {
                _vpnCloseModal();
                _loadWg();
            } else {
                if (st) st.innerHTML = '<p class="text-danger">' + escHtml(r.error) + '</p>';
            }
        }).catch(function(e) { if (st) st.innerHTML = '<p class="text-danger">' + escHtml(e.message) + '</p>'; });
    }

    function _wgSaveImport() { _wgSaveConfig('wg-import-text', 'wg-import-status'); }
    function _wgSaveEdit() { _wgSaveConfig('wg-edit-text', 'wg-edit-status'); }

    function _wgGenKey() {
        var el = document.getElementById('wg-keygen');
        if (!el) return;
        el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
        API.cgiPost('wireguard.cgi', { action: 'generate_key' }).then(function(r) {
            if (r.private_key) {
                el.innerHTML = '<div style="margin-top:0.5rem;padding:0.5rem;background:var(--bg-surface-secondary);border-radius:8px;font-size:0.78rem">' +
                    '<div><strong>Private:</strong> <span class="text-mono">' + escHtml(r.private_key) + '</span></div>' +
                    '<div><strong>Public:</strong> <span class="text-mono">' + escHtml(r.public_key) + '</span></div>' +
                    '<p class="text-muted" style="margin:0.25rem 0 0;font-size:0.75rem">Copy private key into [Interface] PrivateKey. Share public key with peer.</p></div>';
            } else {
                el.innerHTML = '<p class="text-danger">' + escHtml(r.error || 'Failed') + '</p>';
            }
        }).catch(function(e) { el.innerHTML = '<p class="text-danger">' + escHtml(e.message) + '</p>'; });
    }

    // ===== AmneziaWG =====

    function _loadAwg() {
        var el = document.getElementById('vpn-awg');
        if (!el) return;
        el.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading AmneziaWG...</div></div>';

        API.cgiGet('amneziawg.cgi', { action: 'status' }).then(function(status) {
            _awgStatus = status;
            _renderAwg(el, status);
            _reorderVpn();
        }).catch(function(e) {
            el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(e.message) + '</p></div>';
        });
    }

    function _renderAwg(el, status) {
        var up = status.up;
        var switchDisabled = !status.has_awg ? ' disabled' : '';
        var html = '<div class="card">';

        // Header with toggle
        html += '<div class="card-header">';
        html += '<h3>' + icon('ic-vpn') + ' AmneziaWG</h3>';
        html += '<label class="switch"><input type="checkbox" id="awg-toggle"' + (up ? ' checked' : '') + switchDisabled + '><span class="slider"></span></label>';
        html += '</div>';

        // Status line + interface details
        var peer = (status.peers && status.peers.length > 0) ? status.peers[0] : null;
        var hasPeerHandshake = peer && peer.latest_handshake && peer.latest_handshake !== 'never' && peer.latest_handshake !== '';

        if (up) {
            if (hasPeerHandshake) {
                html += '<div class="vpn-status"><span class="status-dot on"></span><span class="text-success">Connected</span></div>';
            } else if (peer) {
                html += '<div class="vpn-status"><span class="status-dot orange"></span><span class="text-warn">Interface Up</span> <span class="text-muted text-small">\u2022 awaiting handshake</span></div>';
            } else {
                html += '<div class="vpn-status"><span class="status-dot orange"></span><span class="text-warn">Interface Up</span> <span class="text-muted text-small">\u2022 no peers</span></div>';
            }

            // Interface info
            html += '<div class="vpn-info">';
            if (status.address) html += '<div class="stat-row"><span class="label">Address</span><span class="value text-mono">' + escHtml(status.address) + '</span></div>';
            if (status.interface && status.interface.listen_port && status.interface.listen_port !== '0') {
                html += '<div class="stat-row"><span class="label">Listen Port</span><span class="value">' + escHtml(status.interface.listen_port) + '</span></div>';
            }
            if (status.interface && status.interface.public_key && status.interface.public_key !== '(none)') {
                html += '<div class="stat-row"><span class="label">Public Key</span><span class="value text-mono text-small">' + escHtml(status.interface.public_key) + '</span></div>';
            }
            html += '</div>';

            // Peer details
            if (peer) {
                html += '<div class="vpn-peer-block">';
                html += '<div class="vpn-peer-title">Peer</div>';
                html += '<div class="vpn-info">';
                if (peer.endpoint && peer.endpoint !== '(none)') {
                    html += '<div class="stat-row"><span class="label">Endpoint</span><span class="value text-mono">' + escHtml(peer.endpoint) + '</span></div>';
                }
                if (peer.allowed_ips) {
                    html += '<div class="stat-row"><span class="label">Allowed IPs</span><span class="value text-mono">' + escHtml(peer.allowed_ips) + '</span></div>';
                }
                html += '<div class="stat-row"><span class="label">Handshake</span><span class="value">' + (hasPeerHandshake ? escHtml(peer.latest_handshake) : '<span class="text-muted">never</span>') + '</span></div>';
                html += '<div class="stat-row"><span class="label">Transfer</span><span class="value">\u2193 ' + formatBytes(peer.transfer_rx) + ' \u2191 ' + formatBytes(peer.transfer_tx) + '</span></div>';
                if (peer.persistent_keepalive && peer.persistent_keepalive !== 'off' && peer.persistent_keepalive !== '0') {
                    html += '<div class="stat-row"><span class="label">Keepalive</span><span class="value">' + escHtml(peer.persistent_keepalive) + 's</span></div>';
                }
                html += '</div></div>';
            }
        } else if (status.has_config) {
            html += '<div class="vpn-status"><span class="status-dot off"></span><span class="text-muted">Disconnected</span></div>';
            if (status.endpoint) {
                html += '<div class="vpn-endpoint">' + escHtml(status.endpoint) + '</div>';
            }
        } else {
            html += '<div class="text-muted">No configuration. Import a config to get started.</div>';
        }

        // Edit button
        html += '<div class="vpn-buttons">';
        html += '<button class="btn-outline" ' + actionAttr('awgEditModal') + '>Edit Config</button>';
        html += '</div>';

        html += '<div id="awg-action-status"></div>';
        html += '</div>';
        el.innerHTML = html;

        // Bind toggle events
        var awgToggle = document.getElementById('awg-toggle');
        if (awgToggle) {
            awgToggle.addEventListener('change', function() {
                if (this.checked) _awgEnable();
                else _awgDisable();
            });
        }
    }

    function _awgEnable() {
        var st = document.getElementById('awg-action-status');
        if (st) st.innerHTML = '<div class="page-loading"><div class="spinner"></div> Enabling...</div>';
        API.cgiPost('amneziawg.cgi', { action: 'enable' }).then(function(r) {
            if (r.ok) { _loadAll(); } else { _awgError(r.error); }
        }).catch(function(e) { _awgError(e.message); });
    }

    function _awgDisable() {
        var st = document.getElementById('awg-action-status');
        if (st) st.innerHTML = '<div class="page-loading"><div class="spinner"></div> Disabling...</div>';
        API.cgiPost('amneziawg.cgi', { action: 'disable' }).then(function(r) {
            if (r.ok) { _loadAll(); } else { _awgError(r.error); }
        }).catch(function(e) { _awgError(e.message); });
    }

    function _awgError(msg) {
        var st = document.getElementById('awg-action-status');
        if (st) st.innerHTML = '<p class="text-danger">' + escHtml(msg) + '</p>';
        setTimeout(_loadAwg, 1500);
    }

    function _awgImportModal() {
        var html = '<textarea id="awg-import-text" rows="14" class="text-mono text-small" placeholder="[Interface]\nPrivateKey = ...\nAddress = 10.0.0.2/24\nJc = 4\nJmin = 40\nJmax = 70\nS1 = 0\nS2 = 0\nH1 = 1\nH2 = 2\nH3 = 3\nH4 = 4\n\n[Peer]\nPublicKey = ...\nEndpoint = vpn.example.com:51820\nAllowedIPs = 0.0.0.0/0\nPersistentKeepalive = 25"></textarea>';
        html += '<div id="awg-import-status"></div>';
        html += '<div class="form-actions">';
        html += '<button id="vpn-panel-save">Save & Apply</button>';
        html += '<button class="btn-outline" id="vpn-panel-genkey">Generate Keys</button>';
        html += '</div>';
        html += '<div id="awg-keygen"></div>';

        _showPanel('Import AmneziaWG Config', html);
        document.getElementById('vpn-panel-save').addEventListener('click', _awgSaveImport);
        document.getElementById('vpn-panel-genkey').addEventListener('click', _awgGenKey);
    }

    function _awgEditModal() {
        var html = '<div id="awg-edit-loading"><div class="page-loading"><div class="spinner"></div> Loading config...</div></div>';
        html += '<textarea id="awg-edit-text" rows="14" class="text-mono text-small" style="display:none"></textarea>';
        html += '<div id="awg-edit-status"></div>';
        html += '<div class="form-actions">';
        html += '<button id="vpn-panel-save">Save & Apply</button>';
        html += '<button class="btn-outline" id="vpn-panel-cancel">Cancel</button>';
        html += '</div>';

        _showPanel('Edit AmneziaWG Config', html);
        document.getElementById('vpn-panel-save').addEventListener('click', _awgSaveEdit);
        document.getElementById('vpn-panel-cancel').addEventListener('click', _vpnCloseModal);

        API.cgiGet('amneziawg.cgi', { action: 'config' }).then(function(r) {
            var loading = document.getElementById('awg-edit-loading');
            var textarea = document.getElementById('awg-edit-text');
            if (loading) loading.style.display = 'none';
            if (textarea) {
                textarea.value = r.config || '';
                textarea.style.display = '';
            }
        }).catch(function(e) {
            var loading = document.getElementById('awg-edit-loading');
            if (loading) loading.innerHTML = '<p class="text-danger">' + escHtml(e.message) + '</p>';
        });
    }

    function _awgSaveConfig(textareaId, statusId) {
        var textarea = document.getElementById(textareaId);
        var st = document.getElementById(statusId);
        if (!textarea || !textarea.value.trim()) {
            if (st) st.innerHTML = '<p class="text-danger">Config is empty</p>';
            return;
        }
        if (st) st.innerHTML = '<div class="page-loading"><div class="spinner"></div> Saving...</div>';
        API.cgiPost('amneziawg.cgi', { action: 'save', config: textarea.value }).then(function(r) {
            if (r.ok) {
                _vpnCloseModal();
                _loadAwg();
            } else {
                if (st) st.innerHTML = '<p class="text-danger">' + escHtml(r.error) + '</p>';
            }
        }).catch(function(e) { if (st) st.innerHTML = '<p class="text-danger">' + escHtml(e.message) + '</p>'; });
    }

    function _awgSaveImport() { _awgSaveConfig('awg-import-text', 'awg-import-status'); }
    function _awgSaveEdit() { _awgSaveConfig('awg-edit-text', 'awg-edit-status'); }

    function _awgGenKey() {
        var el = document.getElementById('awg-keygen');
        if (!el) return;
        el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
        API.cgiPost('amneziawg.cgi', { action: 'generate_key' }).then(function(r) {
            if (r.private_key) {
                el.innerHTML = '<div style="margin-top:0.5rem;padding:0.5rem;background:var(--bg-surface-secondary);border-radius:8px;font-size:0.78rem">' +
                    '<div><strong>Private:</strong> <span class="text-mono">' + escHtml(r.private_key) + '</span></div>' +
                    '<div><strong>Public:</strong> <span class="text-mono">' + escHtml(r.public_key) + '</span></div>' +
                    '<p class="text-muted" style="margin:0.25rem 0 0;font-size:0.75rem">Copy private key into [Interface] PrivateKey. Share public key with peer.</p></div>';
            } else {
                el.innerHTML = '<p class="text-danger">' + escHtml(r.error || 'Failed') + '</p>';
            }
        }).catch(function(e) { el.innerHTML = '<p class="text-danger">' + escHtml(e.message) + '</p>'; });
    }

    // ===== ShadowSocks =====

    function _loadSs() {
        var el = document.getElementById('vpn-ss');
        if (!el) return;
        el.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading ShadowSocks...</div></div>';

        API.cgiGet('shadowsocks.cgi', { action: 'status' }).then(function(status) {
            _ssStatus = status;
            _renderSs(el, status);
            _reorderVpn();
        }).catch(function(e) {
            el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(e.message) + '</p></div>';
        });
    }

    function _renderSs(el, status) {
        var running = status.running;
        var switchDisabled = !status.has_bin ? ' disabled' : '';
        // Disable toggle if no config and not running
        if (!status.has_config && !running) switchDisabled = ' disabled';

        var html = '<div class="card">';

        // Header with toggle
        html += '<div class="card-header">';
        html += '<h3>' + icon('ic-vpn') + ' ShadowSocks</h3>';
        html += '<label class="switch"><input type="checkbox" id="ss-toggle"' + (running ? ' checked' : '') + switchDisabled + '><span class="slider"></span></label>';
        html += '</div>';

        // Status
        if (running) {
            html += '<div class="vpn-status"><span class="status-dot on"></span><span class="text-success">Running</span>';
            if (status.name) html += ' <span class="text-muted text-small">\u2022 ' + escHtml(status.name) + '</span>';
            html += '</div>';
            if (status.server) {
                html += '<div class="vpn-endpoint">' + escHtml(status.server) + ':' + status.server_port + ' \u2022 ' + escHtml(status.method || '') + '</div>';
            }
        } else if (status.has_config) {
            html += '<div class="vpn-status"><span class="status-dot off"></span><span class="text-muted">Stopped</span>';
            if (status.name) html += ' <span class="text-muted text-small">\u2022 ' + escHtml(status.name) + '</span>';
            html += '</div>';
            if (status.server) {
                html += '<div class="vpn-endpoint">' + escHtml(status.server) + ':' + status.server_port + '</div>';
            }
        } else {
            html += '<div class="text-muted">Configure server to enable</div>';
        }

        // Configure button
        html += '<div class="vpn-buttons">';
        html += '<button class="btn-outline" ' + actionAttr('ssConfigModal') + '>Configure</button>';
        html += '</div>';

        html += '<div id="ss-action-status"></div>';
        html += '</div>';
        el.innerHTML = html;

        // Bind toggle events
        var ssToggle = document.getElementById('ss-toggle');
        if (ssToggle) {
            ssToggle.addEventListener('change', function() {
                if (this.checked) _ssEnable();
                else _ssDisable();
            });
        }
    }

    function _ssEnable() {
        var st = document.getElementById('ss-action-status');
        if (st) st.innerHTML = '<div class="page-loading"><div class="spinner"></div> Enabling...</div>';
        API.cgiPost('shadowsocks.cgi', { action: 'enable' }).then(function(r) {
            if (r.ok) { _loadAll(); } else { _ssError(r.error); }
        }).catch(function(e) { _ssError(e.message); });
    }

    function _ssDisable() {
        var st = document.getElementById('ss-action-status');
        if (st) st.innerHTML = '<div class="page-loading"><div class="spinner"></div> Disabling...</div>';
        API.cgiPost('shadowsocks.cgi', { action: 'disable' }).then(function(r) {
            if (r.ok) { _loadAll(); } else { _ssError(r.error); }
        }).catch(function(e) { _ssError(e.message); });
    }

    function _ssError(msg) {
        var st = document.getElementById('ss-action-status');
        if (st) st.innerHTML = '<p class="text-danger">' + escHtml(msg) + '</p>';
        setTimeout(_loadSs, 1500);
    }

    // ===== ShadowSocks Config Panel =====

    function _ssConfigModal() {
        var s = _ssStatus || {};
        var methods = ['chacha20-ietf-poly1305', 'aes-256-gcm', 'aes-128-gcm', 'aes-256-cfb', 'aes-128-cfb', 'chacha20-ietf', 'xchacha20-ietf-poly1305'];

        var html = '<label>Name</label>';
        html += '<input type="text" id="ss-name" value="' + escHtml(s.name || '') + '" placeholder="e.g. FR VPN">';
        html += '<label>Server Address</label>';
        html += '<input type="text" id="ss-server" value="' + escHtml(s.server || '') + '" placeholder="vpn.example.com">';
        html += '<label>Port</label>';
        html += '<input type="number" id="ss-port" value="' + (s.server_port || '') + '" placeholder="8388" min="1" max="65535">';
        html += '<label>Password</label>';
        html += '<div class="pass-field"><input type="password" id="ss-password" value="" placeholder="' + (s.password ? 'Enter new to change' : 'Password') + '">';
        html += '<button class="pass-eye" ' + actionAttr('togglePassVis', ['ss-password']) + ' title="Show password">' + icon('ic-eye-off') + '</button></div>';
        html += '<label>Encryption Method</label>';
        html += '<select id="ss-method">';
        methods.forEach(function(m) {
            html += '<option value="' + m + '"' + (m === s.method ? ' selected' : '') + '>' + m + '</option>';
        });
        html += '</select>';

        html += '<div style="border-top:1px solid var(--border-color);margin-top:1rem;padding-top:0.75rem">';
        html += '<label>Import SS / Outline URI</label>';
        html += '<div style="display:flex;gap:8px"><input type="text" id="ss-uri" placeholder="ss://... or ssconf://..." style="flex:1;margin:0">';
        html += '<button class="btn-outline" ' + actionAttr('ssParseUri') + ' style="white-space:nowrap">Import</button></div>';
        html += '<div id="ss-import-status"></div>';
        html += '</div>';

        html += '<div id="ss-save-status"></div>';
        html += '<div class="form-actions">';
        html += '<button id="vpn-panel-save">Save</button>';
        html += '<button class="btn-outline" id="vpn-panel-cancel">Cancel</button>';
        html += '</div>';

        _showPanel('ShadowSocks Configuration', html);
        document.getElementById('vpn-panel-save').addEventListener('click', _ssSave);
        document.getElementById('vpn-panel-cancel').addEventListener('click', _vpnCloseModal);
    }

    function _ssSave() {
        var st = document.getElementById('ss-save-status');
        if (st) st.innerHTML = '<div class="page-loading"><div class="spinner"></div> Saving...</div>';
        var data = {
            action: 'save',
            name: (document.getElementById('ss-name') || {}).value || '',
            server: (document.getElementById('ss-server') || {}).value || '',
            server_port: parseInt((document.getElementById('ss-port') || {}).value, 10) || 0,
            password: (document.getElementById('ss-password') || {}).value || '',
            method: (document.getElementById('ss-method') || {}).value || 'chacha20-ietf-poly1305'
        };
        if (!data.server || !data.server_port) {
            if (st) st.innerHTML = '<p class="text-danger">Server and port required</p>';
            return;
        }
        API.cgiPost('shadowsocks.cgi', data).then(function(r) {
            if (r.ok) {
                _vpnCloseModal();
                _loadSs();
            } else {
                if (st) st.innerHTML = '<p class="text-danger">' + escHtml(r.error) + '</p>';
            }
        }).catch(function(e) { if (st) st.innerHTML = '<p class="text-danger">' + escHtml(e.message) + '</p>'; });
    }

    function _ssParseUri() {
        var uriEl = document.getElementById('ss-uri');
        var st = document.getElementById('ss-import-status');
        if (!uriEl || !uriEl.value.trim()) { if (st) st.innerHTML = '<p class="text-danger">Paste an ss:// URI</p>'; return; }
        if (st) st.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
        API.cgiPost('shadowsocks.cgi', { action: 'parse_uri', uri: uriEl.value.trim() }).then(function(r) {
            if (r.ok) {
                var n = document.getElementById('ss-name'); if (n && r.name) n.value = r.name;
                var s = document.getElementById('ss-server'); if (s) s.value = r.server || '';
                var p = document.getElementById('ss-port'); if (p) p.value = r.server_port || '';
                var pw = document.getElementById('ss-password'); if (pw) pw.value = r.password || '';
                var m = document.getElementById('ss-method'); if (m) m.value = r.method || 'chacha20-ietf-poly1305';
                if (st) st.innerHTML = '<p class="text-success">Imported. Click Save to apply.</p>';
            } else {
                if (st) st.innerHTML = '<p class="text-danger">' + escHtml(r.error) + '</p>';
            }
        }).catch(function(e) { if (st) st.innerHTML = '<p class="text-danger">' + escHtml(e.message) + '</p>'; });
    }

    // ===== Panel close =====

    function _vpnCloseModal() {
        var overlay = document.getElementById('rule-panel-overlay');
        if (overlay) overlay.remove();
    }

    // ===== Register =====

    App.registerPage('vpn', renderVpn);
    App._vpnCloseModal = _vpnCloseModal;
    App._wgImportModal = _wgImportModal;
    App._wgEditModal = _wgEditModal;
    App._wgSaveImport = _wgSaveImport;
    App._wgSaveEdit = _wgSaveEdit;
    App._wgGenKey = _wgGenKey;
    App._awgImportModal = _awgImportModal;
    App._awgEditModal = _awgEditModal;
    App._awgSaveImport = _awgSaveImport;
    App._awgSaveEdit = _awgSaveEdit;
    App._awgGenKey = _awgGenKey;
    App._ssConfigModal = _ssConfigModal;
    App._ssSave = _ssSave;
    App._ssParseUri = _ssParseUri;
})();
