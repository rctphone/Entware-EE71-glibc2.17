;(function() {
    'use strict';
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;

    var _lanData = null;
    var _dnsData = null;

    var DNS_PRESETS = [
        { label: 'Auto (from carrier)', v1: '', v2: '' },
        { label: 'Google', v1: '8.8.8.8', v2: '8.8.4.4' },
        { label: 'Cloudflare', v1: '1.1.1.1', v2: '1.0.0.1' },
        { label: 'Yandex', v1: '77.88.8.8', v2: '77.88.8.1' },
    ];

    var MASKS = [
        ['255.255.255.0', '/24'],
        ['255.255.255.128', '/25'],
        ['255.255.254.0', '/23'],
        ['255.255.252.0', '/22'],
        ['255.255.248.0', '/21'],
        ['255.255.240.0', '/20'],
        ['255.255.0.0', '/16'],
    ];

    function renderLan(container) {
        container.innerHTML =
            '<h2>LAN</h2>' +
            '<div id="lan-content"><div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div></div>';
        _loadLan();
    }

    // Dotted-quad check — the CGI/webapi accepts anything and then fails opaquely.
    function _isIPv4(v) {
        var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v || '');
        if (!m) return false;
        for (var i = 1; i <= 4; i++) if (Number(m[i]) > 255) return false;
        return true;
    }

    function _loadLan() {
        return Promise.all([
            API.webapi('GetLanSettings').catch(function() { return null; }),
            API.webapi('getDNSInfo').catch(function() { return null; }),
            API.cgiGet('system.cgi', { action: 'interfaces' }).catch(function() { return null; }),
        ]).then(function(results) {
            _lanData = results[0];
            _dnsData = results[1];
            var sysIfaces = results[2];
            var el = $('#lan-content');
            if (!el) return;

            var lan = _lanData || {};
            var dhcpOn = lan.DHCPServerStatus === 1 || lan.DHCPServerStatus === '1';

            var html = '<div class="card">' +
                '<h3>IP Settings</h3>' +

                // Hostname
                '<div class="float-field">' +
                    '<label>Hostname</label>' +
                    '<input type="text" id="lan-hostname" value="' + escHtml(lan.host_name || '') + '" placeholder="4gee.wifi" maxlength="63">' +
                '</div>' +

                // IP Address
                '<div class="float-field">' +
                    '<label>IP address</label>' +
                    '<input type="text" id="lan-ip" value="' + escHtml(lan.IPv4IPAddress || '192.168.1.1') + '">' +
                '</div>' +

                // Subnet mask (dropdown)
                '<div class="float-field">' +
                    '<label>Subnet mask</label>' +
                    '<select id="lan-mask">' +
                        MASKS.map(function(m) {
                            return '<option value="' + m[0] + '"' +
                                ((lan.SubnetMask || '255.255.255.0') === m[0] ? ' selected' : '') +
                                '>' + m[0] + ' (' + m[1] + ')</option>';
                        }).join('') +
                    '</select>' +
                '</div>' +

                // DHCP server radio
                '<div class="radio-row">' +
                    '<span class="radio-label">DHCP server</span>' +
                    '<label class="radio-opt"><input type="radio" name="dhcp-mode" value="1"' + (dhcpOn ? ' checked' : '') + '> Enabled</label>' +
                    '<label class="radio-opt"><input type="radio" name="dhcp-mode" value="0"' + (!dhcpOn ? ' checked' : '') + '> Disabled</label>' +
                '</div>' +

                // DHCP settings link (opens slide-in panel)
                '<div class="wifi-adv-link">' +
                    '<a ' + actionAttr('showDhcpPanel') + '>DHCP settings \u203a</a>' +
                '</div>' +

                // Save
                '<div class="form-actions">' +
                    '<button id="lan-save" ' + actionAttr('saveLan') + '>Save</button>' +
                '</div>' +
            '</div>';

            // IPv6 section (read-only — device has no IPv6 config API)
            var ifaceList = Array.isArray(sysIfaces) ? sysIfaces : [];
            var v6rows = '';
            for (var i = 0; i < ifaceList.length; i++) {
                var iface = ifaceList[i];
                var allAddrs = iface.addrs || [];
                var addrs6 = [];
                for (var j = 0; j < allAddrs.length; j++) {
                    var a = typeof allAddrs[j] === 'string' ? allAddrs[j] : '';
                    if (a.indexOf(':') !== -1) addrs6.push(a);
                }
                if (addrs6.length > 0) {
                    v6rows += '<div class="stat-row"><span class="label">' + escHtml(iface.name || '') + '</span>' +
                        '<span class="value text-mono text-small">' + addrs6.map(escHtml).join('<br>') + '</span></div>';
                }
            }

            html += '<div class="card mt-2">' +
                '<h3>IPv6</h3>' +
                (v6rows || '<p class="text-muted">No IPv6 addresses</p>') +
                '<p class="text-muted text-small" style="margin-top:0.5rem">IPv6 is managed by the modem firmware and cannot be configured via this interface.</p>' +
            '</div>';

            el.innerHTML = html;
        }).catch(function() {});
    }

    function _poolSize(startIP, endIP) {
        if (!startIP || !endIP) return 101;
        var s = startIP.split('.').map(Number);
        var e = endIP.split('.').map(Number);
        if (s.length !== 4 || e.length !== 4) return 101;
        return Math.max(1, (e[3] - s[3]) + 1);
    }

    function _endIPFromPool(startIP, size) {
        var parts = startIP.split('.').map(Number);
        if (parts.length !== 4) return startIP;
        parts[3] = Math.min(254, parts[3] + size - 1);
        return parts.join('.');
    }

    // --- DHCP slide-in panel ---

    function _showDhcpPanel() {
        var lan = _lanData || {};
        var dns = _dnsData || {};
        var startIP = lan.StartIPAddress || '';
        var endIP = lan.EndIPAddress || '';
        var poolSize = _poolSize(startIP, endIP);
        var leaseHours = parseInt(lan.DHCPLeaseTime || 24, 10);
        var leaseSec = leaseHours * 3600;

        var curDns1 = dns.DNSAddress1 || lan.DNSAddress1 || '';
        var curDns2 = dns.DNSAddress2 || lan.DNSAddress2 || '';

        // Find matching preset
        var presetIdx = -1;
        for (var pi = 0; pi < DNS_PRESETS.length; pi++) {
            if (DNS_PRESETS[pi].v1 === curDns1 && DNS_PRESETS[pi].v2 === curDns2) { presetIdx = pi; break; }
        }

        var presetOpts = DNS_PRESETS.map(function(p, i) {
            return '<option value="' + i + '"' + (i === presetIdx ? ' selected' : '') + '>' +
                escHtml(p.label) + (p.v1 ? ' (' + p.v1 + ')' : '') + '</option>';
        }).join('') +
        '<option value="custom"' + (presetIdx === -1 && (curDns1 || curDns2) ? ' selected' : '') + '>Custom</option>';

        var fieldsHTML =
            '<div class="float-field">' +
                '<label>Starting IP of the pool</label>' +
                '<input type="text" id="lan-dhcp-start" value="' + escHtml(startIP) + '" placeholder="192.168.1.100">' +
            '</div>' +
            '<div class="float-field">' +
                '<label>Address pool size</label>' +
                '<input type="number" id="lan-pool-size" value="' + poolSize + '" min="1" max="254">' +
            '</div>' +
            '<div class="float-field">' +
                '<label>Lease time, sec</label>' +
                '<input type="number" id="lan-lease" value="' + leaseSec + '" min="60" max="2592000">' +
            '</div>' +
            '<div class="float-field">' +
                '<label>DNS preset</label>' +
                '<select id="lan-dns-preset">' + presetOpts + '</select>' +
            '</div>' +
            '<div class="float-field">' +
                '<label>DNS server 1</label>' +
                '<input type="text" id="lan-dns1" value="' + escHtml(curDns1) + '" placeholder="Auto">' +
            '</div>' +
            '<div class="float-field">' +
                '<label>DNS server 2</label>' +
                '<input type="text" id="lan-dns2" value="' + escHtml(curDns2) + '" placeholder="Auto">' +
            '</div>';

        _showPanel('DHCP Settings', fieldsHTML, _saveDhcp);

        // Wire up DNS preset dropdown
        var presetSel = $('#lan-dns-preset');
        var dns1Input = $('#lan-dns1');
        var dns2Input = $('#lan-dns2');
        if (presetSel) {
            _syncDnsInputs(presetSel, dns1Input, dns2Input);
            presetSel.addEventListener('change', function() {
                _syncDnsInputs(presetSel, dns1Input, dns2Input);
            });
            // When user edits DNS inputs manually, switch to Custom
            dns1Input.addEventListener('input', function() { _markDnsCustom(presetSel, dns1Input, dns2Input); });
            dns2Input.addEventListener('input', function() { _markDnsCustom(presetSel, dns1Input, dns2Input); });
        }
    }

    function _syncDnsInputs(sel, inp1, inp2) {
        var val = sel.value;
        if (val === 'custom') {
            inp1.readOnly = false;
            inp2.readOnly = false;
            return;
        }
        var idx = parseInt(val, 10);
        var preset = DNS_PRESETS[idx];
        if (preset) {
            inp1.value = preset.v1;
            inp2.value = preset.v2;
            inp1.readOnly = true;
            inp2.readOnly = true;
        }
    }

    function _markDnsCustom(sel, inp1, inp2) {
        // Check if current values still match selected preset
        var val = sel.value;
        if (val === 'custom') return;
        var idx = parseInt(val, 10);
        var preset = DNS_PRESETS[idx];
        if (preset && (inp1.value !== preset.v1 || inp2.value !== preset.v2)) {
            sel.value = 'custom';
            inp1.readOnly = false;
            inp2.readOnly = false;
        }
    }

    function _saveDhcp() {
        App.clearFieldErrors('#rule-panel-overlay');

        var startIP = (($('#lan-dhcp-start') || {}).value || '').trim();
        if (!_isIPv4(startIP)) {
            return App.renderFieldError('#lan-dhcp-start', 'Enter a valid IPv4 address, e.g. 192.168.1.100');
        }

        var poolSize = parseInt(($('#lan-pool-size') || {}).value, 10);
        if (isNaN(poolSize) || poolSize < 1 || poolSize > 254) {
            return App.renderFieldError('#lan-pool-size', 'Pool size must be between 1 and 254');
        }

        var leaseSec = parseInt(($('#lan-lease') || {}).value, 10);
        if (isNaN(leaseSec) || leaseSec < 60) {
            return App.renderFieldError('#lan-lease', 'Lease time must be at least 60 seconds');
        }

        var dns1 = (($('#lan-dns1') || {}).value || '').trim();
        var dns2 = (($('#lan-dns2') || {}).value || '').trim();
        if (dns1 && !_isIPv4(dns1)) return App.renderFieldError('#lan-dns1', 'Enter a valid IPv4 address or leave blank');
        if (dns2 && !_isIPv4(dns2)) return App.renderFieldError('#lan-dns2', 'Enter a valid IPv4 address or leave blank');

        var params = {
            StartIPAddress: startIP,
            EndIPAddress: _endIPFromPool(startIP, poolSize),
            DHCPLeaseTime: String(Math.max(1, Math.round(leaseSec / 3600))),
        };

        App.wrapFormSubmit('#lan-panel-save', function() {
            return API.webapi('SetLanSettings', params).then(function() {
                return API.webapi('setDNSInfo', {
                    DNSMode: (dns1 || dns2) ? '1' : '0',
                    PrimaryDNS: dns1,
                    SecondaryDNS: dns2,
                }).catch(function() {
                    // Address/lease changes did land; only the DNS override failed.
                    App.showNotification('DHCP saved, but the DNS override could not be applied', 'error');
                });
            }).then(function() {
                _hidePanel();
                return _loadLan();
            });
        }, { success: 'DHCP settings saved' });
    }

    function _showPanel(title, fieldsHTML, onSave) {
        _hidePanel();
        var overlay = document.createElement('div');
        overlay.id = 'rule-panel-overlay';
        overlay.className = 'rule-panel-overlay';
        overlay.innerHTML =
            '<div class="rule-panel">' +
                '<h3>' + escHtml(title) + '<button class="close-btn" id="lan-panel-close">\u00d7</button></h3>' +
                '<div>' + fieldsHTML + '</div>' +
                '<div class="form-actions">' +
                    '<button id="lan-panel-save">Save</button>' +
                    '<button class="btn-outline" id="lan-panel-cancel">Cancel</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);

        overlay.addEventListener('click', function(e) { if (e.target === overlay) _hidePanel(); });
        document.getElementById('lan-panel-close').addEventListener('click', _hidePanel);
        document.getElementById('lan-panel-cancel').addEventListener('click', _hidePanel);
        document.getElementById('lan-panel-save').addEventListener('click', onSave);
    }

    function _hidePanel() {
        var overlay = document.getElementById('rule-panel-overlay');
        if (overlay) overlay.remove();
    }

    // --- Save main LAN settings (hostname, IP, subnet, DHCP on/off) ---

    function _saveLan() {
        App.clearFieldErrors('#lan-content');

        var hostname = (($('#lan-hostname') || {}).value || '').trim();
        if (hostname && !/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(hostname)) {
            return App.renderFieldError('#lan-hostname',
                'Use only letters, digits, dots and hyphens, starting with a letter or digit');
        }

        var ip = (($('#lan-ip') || {}).value || '').trim();
        if (!_isIPv4(ip)) {
            return App.renderFieldError('#lan-ip', 'Enter a valid IPv4 address, e.g. 192.168.1.1');
        }

        var dhcpMode = '1';
        var radios = document.querySelectorAll('input[name="dhcp-mode"]');
        for (var i = 0; i < radios.length; i++) {
            if (radios[i].checked) { dhcpMode = radios[i].value; break; }
        }

        var params = {
            host_name: hostname,
            IPv4IPAddress: ip,
            SubnetMask: ($('#lan-mask') || {}).value,
            DHCPServerStatus: dhcpMode,
        };

        App.wrapFormSubmit('#lan-save', function() {
            return API.webapi('SetLanSettings', params).then(function() {
                // Networking restarts; give it a moment before reading back.
                return new Promise(function(r) { setTimeout(r, 2000); });
            }).then(_loadLan);
        }, {
            pending: 'Applying\u2026',
            success: 'LAN settings saved - networking is restarting'
        });
    }

    App.registerPage('lan', renderLan);
    App._showDhcpPanel = _showDhcpPanel;
    App._saveLan = _saveLan;
})();
