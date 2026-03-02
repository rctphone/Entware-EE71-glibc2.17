;(function() {
    'use strict';
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;

    var _lanData = null;
    var _dnsData = null;
    var _dhcpExpanded = false;

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

    function _loadLan() {
        Promise.all([
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
            var dns = _dnsData || {};
            var dhcpOn = lan.DHCPServerStatus === 1 || lan.DHCPServerStatus === '1';

            // Pool size from start/end
            var startIP = lan.StartIPAddress || '';
            var endIP = lan.EndIPAddress || '';
            var poolSize = _poolSize(startIP, endIP);
            var leaseHours = parseInt(lan.DHCPLeaseTime || 24, 10);
            var leaseSec = leaseHours * 3600;

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

                // Expandable DHCP settings
                '<div class="expand-toggle" id="dhcp-toggle" ' + actionAttr('toggleDhcp') + '>' +
                    '<span id="dhcp-toggle-text">' + (_dhcpExpanded ? 'Hide' : 'Show') + ' DHCP settings</span>' +
                    '<span class="expand-arrow' + (_dhcpExpanded ? ' open' : '') + '" id="dhcp-arrow">\u25be</span>' +
                '</div>' +
                '<div class="expand-section' + (_dhcpExpanded ? ' open' : '') + '" id="dhcp-section">' +
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
                        '<label>DNS server 1</label>' +
                        '<input type="text" id="lan-dns1" value="' + escHtml(dns.DNSAddress1 || lan.DNSAddress1 || '') + '" placeholder="Auto">' +
                    '</div>' +
                    '<div class="float-field">' +
                        '<label>DNS server 2</label>' +
                        '<input type="text" id="lan-dns2" value="' + escHtml(dns.DNSAddress2 || lan.DNSAddress2 || '') + '" placeholder="Auto">' +
                    '</div>' +
                '</div>' +

                // Save
                '<div class="form-actions">' +
                    '<button ' + actionAttr('saveLan') + '>Save</button>' +
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

    function _toggleDhcp() {
        _dhcpExpanded = !_dhcpExpanded;
        var section = $('#dhcp-section');
        var text = $('#dhcp-toggle-text');
        var arrow = $('#dhcp-arrow');
        if (section) section.classList.toggle('open', _dhcpExpanded);
        if (text) text.textContent = _dhcpExpanded ? 'Hide DHCP settings' : 'Show DHCP settings';
        if (arrow) arrow.classList.toggle('open', _dhcpExpanded);
    }

    function _saveLan() {
        var hostname = ($('#lan-hostname') || {}).value || '';
        if (hostname && !/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(hostname)) {
            alert('Invalid hostname'); return;
        }
        var startIP = $('#lan-dhcp-start').value;
        var poolSize = parseInt($('#lan-pool-size').value, 10) || 101;
        var endIP = _endIPFromPool(startIP, poolSize);
        var leaseSec = parseInt($('#lan-lease').value, 10) || 86400;
        var leaseHours = Math.max(1, Math.round(leaseSec / 3600));

        var dhcpMode = '1';
        var radios = document.querySelectorAll('input[name="dhcp-mode"]');
        for (var i = 0; i < radios.length; i++) {
            if (radios[i].checked) { dhcpMode = radios[i].value; break; }
        }

        var params = {
            host_name: hostname,
            IPv4IPAddress: $('#lan-ip').value,
            SubnetMask: $('#lan-mask').value,
            DHCPServerStatus: dhcpMode,
            StartIPAddress: startIP,
            EndIPAddress: endIP,
            DHCPLeaseTime: String(leaseHours),
        };

        var dns1 = ($('#lan-dns1') || {}).value || '';
        var dns2 = ($('#lan-dns2') || {}).value || '';

        API.webapi('SetLanSettings', params).then(function() {
            // Save DNS if changed
            if (dns1 || dns2) {
                return API.webapi('setDNSInfo', {
                    DNSMode: (dns1 || dns2) ? '1' : '0',
                    PrimaryDNS: dns1,
                    SecondaryDNS: dns2,
                }).catch(function() {});
            }
        }).then(function() {
            alert('Settings saved. Device may restart networking.');
            setTimeout(_loadLan, 2000);
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    App.registerPage('lan', renderLan);
    App._toggleDhcp = _toggleDhcp;
    App._saveLan = _saveLan;
})();
