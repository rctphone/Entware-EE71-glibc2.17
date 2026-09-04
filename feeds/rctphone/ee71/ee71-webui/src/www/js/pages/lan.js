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

    // DHCPLeaseTime is expressed in hours; these are the only values the stock
    // UI offers (build.formatted.js:10043 `DHCPLeaseTime: [[1],[6],[12],[24]]`,
    // rendered with an "ids_lanSettings_hours" suffix).
    var LEASE_HOURS = [1, 6, 12, 24];

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

    // The pool used to be measured in the last octet alone, which is only right
    // for /24 and narrower — the mask dropdown offers up to /16, where a pool
    // can legitimately span several octets. All of the arithmetic below is done
    // on the full 32-bit address instead. `>>> 0` keeps every intermediate
    // unsigned: JavaScript's bitwise operators are signed, so an address in
    // 128.0.0.0/1 or a /16 mask would otherwise come out negative.

    function _ipToInt(ip) {
        var p = String(ip || '').split('.');
        if (p.length !== 4) return null;
        var v = 0;
        for (var i = 0; i < 4; i++) {
            var n = Number(p[i]);
            if (!isFinite(n) || n < 0 || n > 255) return null;
            v = ((v << 8) | n) >>> 0;
        }
        return v;
    }

    function _intToIp(v) {
        v = v >>> 0;
        return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].join('.');
    }

    // First and last address a DHCP pool may use inside `mask`, anchored on the
    // router's own address: network and broadcast are both excluded.
    function _subnetRange(routerIP, mask) {
        var ip = _ipToInt(routerIP), m = _ipToInt(mask);
        if (ip === null || m === null || m === 0xFFFFFFFF) return null;
        var net = (ip & m) >>> 0;
        var bcast = (net | (~m >>> 0)) >>> 0;
        if (bcast - net < 2) return null;
        return { first: (net + 1) >>> 0, last: (bcast - 1) >>> 0 };
    }

    function _poolSize(startIP, endIP) {
        var s = _ipToInt(startIP), e = _ipToInt(endIP);
        if (s === null || e === null || e < s) return 101;
        return (e - s) + 1;
    }

    function _endIPFromPool(startIP, size, routerIP, mask) {
        var s = _ipToInt(startIP);
        if (s === null) return startIP;
        var end = s + Math.max(1, size) - 1;
        var range = _subnetRange(routerIP, mask);
        if (range && end > range.last) end = range.last;
        if (end < s) end = s;
        return _intToIp(end);
    }

    // Largest pool that still fits between `startIP` and the end of the subnet.
    function _maxPoolSize(startIP, routerIP, mask) {
        var s = _ipToInt(startIP);
        var range = _subnetRange(routerIP, mask);
        if (s === null || !range || s > range.last) return 254;
        return (range.last - s) + 1;
    }

    // --- DHCP slide-in panel ---

    function _showDhcpPanel() {
        var lan = _lanData || {};
        var dns = _dnsData || {};
        var startIP = lan.StartIPAddress || '';
        var endIP = lan.EndIPAddress || '';
        var routerIP = lan.IPv4IPAddress || '';
        var mask = lan.SubnetMask || '255.255.255.0';
        var poolSize = _poolSize(startIP, endIP);
        var maxPool = _maxPoolSize(startIP, routerIP, mask);
        var leaseHours = parseInt(lan.DHCPLeaseTime, 10);
        if (!(leaseHours > 0)) leaseHours = 12;

        // GetLanSettings is the authority: the stock LAN page reads the whole
        // object from it and posts the same object straight back to
        // SetLanSettings (mobile build.formatted.js:66137-66152), DNS fields
        // included. getDNSInfo is only a fallback for a firmware that leaves
        // them out of GetLanSettings.
        var curDns1 = lan.DNSAddress1 || dns.DNSAddress1 || '';
        var curDns2 = lan.DNSAddress2 || dns.DNSAddress2 || '';

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
                '<input type="number" id="lan-pool-size" value="' + poolSize + '" min="1" max="' + maxPool + '">' +
            '</div>' +
            // DHCPLeaseTime is in HOURS, and the firmware takes only these four
            // values (stock formOptions, build.formatted.js:10043). The field
            // used to be a free seconds entry that was divided by 3600 on save,
            // so 600 was rounded to 0, forced to 1, and read back as 3600.
            '<div class="float-field">' +
                '<label>Lease time</label>' +
                '<select id="lan-lease">' +
                    LEASE_HOURS.map(function(h) {
                        return '<option value="' + h + '"' + (h === leaseHours ? ' selected' : '') + '>' +
                            h + (h === 1 ? ' hour' : ' hours') + '</option>';
                    }).join('') +
                    (LEASE_HOURS.indexOf(leaseHours) === -1 ?
                        '<option value="' + leaseHours + '" selected>' + leaseHours + ' hours (current)</option>' : '') +
                '</select>' +
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

    // Every LAN save carries all of these, with the edited ones merged in, so a
    // save from one half of the page cannot drop what the other half set — the
    // pool and the DNS servers used to vanish from an IP/mask save, and the
    // IP/mask from a DHCP save. The stock LAN page achieves the same by posting
    // the entire GetLanSettings response back to SetLanSettings verbatim (mobile
    // build.formatted.js:66137-66152).
    //
    // This is a whitelist and not that verbatim echo on purpose. Echoing the
    // whole response would also write back fields the page never shows and the
    // user cannot control (the stock response shape carries MacAddress,
    // VPNPassthrough and DHCPLeaseTimeType), and a field the device reports in
    // one form but accepts in another is a way to corrupt the LAN config —
    // which is a way to lose the router. Nine of the names below sit together
    // in one contiguous string cluster in core_app (offsets 2553016-2553143),
    // i.e. one struct. `host_name` does NOT: it occurs elsewhere, beside
    // snake_case names that look like a different subsystem. It is kept because
    // it was already being sent before this whitelist existed -- this is
    // pre-existing behaviour, not a claim that it belongs to that table.
    // Every name is a field this page displays and the user can set.
    var LAN_FIELDS = [
        'host_name', 'IPv4IPAddress', 'SubnetMask', 'DHCPServerStatus',
        'StartIPAddress', 'EndIPAddress', 'DHCPLeaseTime',
        'DNSMode', 'DNSAddress1', 'DNSAddress2'
    ];

    function _lanPayload(changes) {
        var params = {};
        var base = _lanData || {};
        for (var i = 0; i < LAN_FIELDS.length; i++) {
            var k = LAN_FIELDS[i];
            if (base[k] !== undefined) params[k] = base[k];
        }
        for (var c in changes) {
            if (changes.hasOwnProperty(c)) params[c] = changes[c];
        }
        return params;
    }

    function _saveDhcp() {
        App.clearFieldErrors('#rule-panel-overlay');

        var lan = _lanData || {};
        var routerIP = lan.IPv4IPAddress || '';
        var mask = lan.SubnetMask || '255.255.255.0';

        var startIP = (($('#lan-dhcp-start') || {}).value || '').trim();
        if (!_isIPv4(startIP)) {
            return App.renderFieldError('#lan-dhcp-start', 'Enter a valid IPv4 address, e.g. 192.168.1.100');
        }

        var range = _subnetRange(routerIP, mask);
        var startInt = _ipToInt(startIP);
        if (range && (startInt < range.first || startInt > range.last)) {
            return App.renderFieldError('#lan-dhcp-start',
                'The pool must start inside ' + _intToIp(range.first) + ' - ' + _intToIp(range.last));
        }
        // The router's own address is inside the range and is usually range.first,
        // so it passes the check above. Handing it out to a client would give two
        // machines the same IP and take the web UI with it.
        if (startInt === _ipToInt(routerIP)) {
            return App.renderFieldError('#lan-dhcp-start',
                'The pool cannot start at the router\'s own address (' + routerIP + ')');
        }

        var maxPool = _maxPoolSize(startIP, routerIP, mask);
        var poolSize = parseInt(($('#lan-pool-size') || {}).value, 10);
        if (isNaN(poolSize) || poolSize < 1 || poolSize > maxPool) {
            return App.renderFieldError('#lan-pool-size', 'Pool size must be between 1 and ' + maxPool);
        }

        var leaseHours = parseInt(($('#lan-lease') || {}).value, 10);
        if (isNaN(leaseHours) || leaseHours < 1) {
            return App.renderFieldError('#lan-lease', 'Choose a lease time');
        }

        var dns1 = (($('#lan-dns1') || {}).value || '').trim();
        var dns2 = (($('#lan-dns2') || {}).value || '').trim();
        if (dns1 && !_isIPv4(dns1)) return App.renderFieldError('#lan-dns1', 'Enter a valid IPv4 address or leave blank');
        if (dns2 && !_isIPv4(dns2)) return App.renderFieldError('#lan-dns2', 'Enter a valid IPv4 address or leave blank');

        // DNS travels inside SetLanSettings as DNSMode/DNSAddress1/DNSAddress2 —
        // the names GetLanSettings hands back, and the only DNS parameter names
        // core_app contains. The old setDNSInfo{PrimaryDNS,SecondaryDNS} call
        // used the key names from the (unrelated) wired-WAN page: neither
        // "PrimaryDNS" nor "SecondaryDNS" appears anywhere in the core_app
        // binary, so that write could not have taken effect.
        var params = _lanPayload({
            StartIPAddress: startIP,
            EndIPAddress: _endIPFromPool(startIP, poolSize, routerIP, mask),
            DHCPLeaseTime: leaseHours,
            DNSMode: (dns1 || dns2) ? 1 : 0,
            DNSAddress1: dns1,
            DNSAddress2: dns2
        });

        App.wrapFormSubmit('#lan-panel-save', function() {
            return API.webapi('SetLanSettings', params).then(function() {
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

        var mask = ($('#lan-mask') || {}).value || '255.255.255.0';
        var range = _subnetRange(ip, mask);
        if (!range) {
            return App.renderFieldError('#lan-mask', 'That mask leaves no usable addresses');
        }
        var ipInt = _ipToInt(ip);
        if (ipInt < range.first || ipInt > range.last) {
            return App.renderFieldError('#lan-ip',
                'That is the network or broadcast address of ' + mask + ', not a host address');
        }

        var dhcpMode = '1';
        var radios = document.querySelectorAll('input[name="dhcp-mode"]');
        for (var i = 0; i < radios.length; i++) {
            if (radios[i].checked) { dhcpMode = radios[i].value; break; }
        }

        var params = _lanPayload({
            host_name: hostname,
            IPv4IPAddress: ip,
            SubnetMask: mask,
            DHCPServerStatus: parseInt(dhcpMode, 10) || 0,
        });

        // The payload carries the whole LAN object, so a pool left over from the
        // previous subnet would be sent back as if it were still valid. Move it
        // into the new range whenever the address or mask has taken it outside.
        var poolStart = _ipToInt(params.StartIPAddress);
        var poolEnd = _ipToInt(params.EndIPAddress);
        if (poolStart === null || poolEnd === null ||
            poolStart < range.first || poolEnd > range.last || poolEnd < poolStart) {
            var size = (poolStart !== null && poolEnd !== null && poolEnd >= poolStart)
                ? (poolEnd - poolStart) + 1 : 101;
            var newStart = Math.min(range.first + 99, range.last);
            if (newStart === ipInt) newStart = Math.min(newStart + 1, range.last);
            params.StartIPAddress = _intToIp(newStart);
            params.EndIPAddress = _endIPFromPool(params.StartIPAddress, size, ip, mask);
        }

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
