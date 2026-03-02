;(function() {
    'use strict';
    var $ = App.$, escHtml = App.escHtml, actionAttr = App.actionAttr;

    var _scanning = false;
    var _networks = [];

    function renderWiFiExtender(container) {
        container.innerHTML =
            '<h2>WiFi Extender</h2>' +
            '<div class="card" id="wext-status">' +
                '<div class="page-loading"><div class="spinner"></div> Loading...</div>' +
            '</div>' +
            '<div class="card mt-2" id="wext-scan">' +
                '<h3>Available Networks</h3>' +
                '<div class="action-bar">' +
                    '<button ' + actionAttr('wextScan') + '>Scan</button>' +
                '</div>' +
                '<div id="wext-hotspots"><p class="text-muted">Press Scan to search for nearby WiFi networks</p></div>' +
            '</div>';

        _loadStatus();

        App.setCleanup(function() {
            _scanning = false;
            _networks = [];
        });
    }

    function _loadStatus() {
        var el = $('#wext-status');
        if (!el) return;

        // Use GetWIFIExtenderCurrentStatus (working) instead of GetWIFIExtenderSettings (broken: error -1)
        API.webapi('GetWIFIExtenderCurrentStatus').then(function(data) {
            var connected = data.HotspotConnectStatus === 1 || data.HotspotConnectStatus === '1';
            var ssid = data.HotspotSSID || '';
            var signal = data.Signal || 0;

            el.innerHTML =
                '<h3>WiFi Extender</h3>' +
                (connected ?
                    '<div class="stat-row"><span class="label">Status</span><span class="value text-success">Connected</span></div>' +
                    '<div class="stat-row"><span class="label">SSID</span><span class="value">' + escHtml(ssid) + '</span></div>' +
                    (signal ? '<div class="stat-row"><span class="label">Signal</span><span class="value">' + escHtml(String(signal)) + ' dBm</span></div>' : '') +
                    (data.IPV4Addr ? '<div class="stat-row"><span class="label">IPv4</span><span class="value">' + escHtml(data.IPV4Addr) + '</span></div>' : '') +
                    '<div class="form-actions">' +
                        '<button class="btn-outline" ' + actionAttr('wextDisconnect') + '>Disconnect</button>' +
                    '</div>'
                :
                    '<div class="stat-row"><span class="label">Status</span><span class="value text-muted">Not connected</span></div>' +
                    '<p class="text-muted">Scan for nearby networks and connect to extend your WiFi range.</p>'
                );
        }).catch(function() {
            el.innerHTML = '<h3>WiFi Extender</h3><p class="text-muted">Failed to load status</p>';
        });
    }

    function _wextScan() {
        if (_scanning) return;
        _scanning = true;
        var el = $('#wext-hotspots');
        if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Scanning...</div>';

        // Use CGI scan (iw dev wlan0 scan) — firmware SearchHotspot API returns error -1
        API.cgiGet('wifi_ext.cgi', { action: 'scan' }).then(function(data) {
            _scanning = false;
            if (!data.ok) {
                if (el) el.innerHTML = '<p class="text-danger">Scan failed: ' + escHtml(data.error || 'unknown') + '</p>';
                return;
            }
            _networks = (data.networks || []).sort(function(a, b) { return b.signal - a.signal; });
            _renderNetworks();
        }).catch(function(e) {
            _scanning = false;
            if (el) el.innerHTML = '<p class="text-danger">Scan failed: ' + escHtml(e.message || 'network error') + '</p>';
        });
    }

    function _renderNetworks() {
        var el = $('#wext-hotspots');
        if (!el) return;
        if (!_networks.length) {
            el.innerHTML = '<p class="text-muted">No networks found</p>';
            return;
        }
        var html = '<table class="data-table"><thead><tr>' +
            '<th>SSID</th><th>Signal</th><th>Channel</th><th>Security</th><th></th>' +
            '</tr></thead><tbody>';
        _networks.forEach(function(n, i) {
            var ch = _freqToChannel(n.freq);
            html += '<tr>' +
                '<td>' + escHtml(n.ssid || '(hidden)') + '</td>' +
                '<td>' + _signalBar(n.signal) + ' ' + n.signal + ' dBm</td>' +
                '<td>' + ch + '</td>' +
                '<td>' + escHtml(n.security) + '</td>' +
                '<td><button class="btn-small" ' + actionAttr('wextConnect', [i]) + '>Connect</button></td>' +
                '</tr>';
        });
        html += '</tbody></table>';
        el.innerHTML = html;
    }

    function _freqToChannel(freq) {
        freq = parseInt(freq, 10);
        if (freq >= 2412 && freq <= 2484) return (freq - 2407) / 5;
        if (freq >= 5170 && freq <= 5825) return (freq - 5000) / 5;
        return freq;
    }

    function _signalBar(dbm) {
        dbm = parseInt(dbm, 10);
        var pct = Math.min(100, Math.max(0, (dbm + 100) * 2));
        var bars = pct > 75 ? 4 : pct > 50 ? 3 : pct > 25 ? 2 : 1;
        var s = '';
        for (var i = 1; i <= 4; i++) {
            s += '<span style="display:inline-block;width:3px;height:' + (i * 4) + 'px;' +
                 'background:' + (i <= bars ? 'var(--color-primary)' : 'var(--text-tertiary)') +
                 ';margin-right:1px;vertical-align:bottom"></span>';
        }
        return s;
    }

    function _wextConnect(idx) {
        var n = _networks[idx];
        if (!n) return;

        var isOpen = n.security === 'Open';

        if (!isOpen) {
            _showPasswordRow(idx, n);
            return;
        }

        _doConnect(idx, n, '');
    }

    function _showPasswordRow(idx, n) {
        // Remove any existing password row
        var old = document.getElementById('wext-pw-row');
        if (old) old.parentNode.removeChild(old);

        var btn = document.querySelector('[data-action="wextConnect"][data-args="[' + idx + ']"]');
        var row = btn ? btn.closest('tr') : null;
        if (!row) return;

        var pwRow = document.createElement('tr');
        pwRow.id = 'wext-pw-row';
        pwRow.innerHTML = '<td colspan="5"><div class="form-row" style="margin:4px 0">' +
            '<span style="white-space:nowrap">Password for ' + escHtml(n.ssid || '') + ':</span>' +
            '<input type="password" id="wext-pw-input" style="flex:1;min-width:120px" placeholder="WiFi password">' +
            '<button class="btn-small" id="wext-pw-ok">Connect</button>' +
            '<button class="btn-small btn-outline" id="wext-pw-cancel">Cancel</button>' +
            '</div></td>';
        row.parentNode.insertBefore(pwRow, row.nextSibling);

        var inp = document.getElementById('wext-pw-input');
        if (inp) inp.focus();

        document.getElementById('wext-pw-ok').onclick = function() {
            var key = inp ? inp.value : '';
            _removePwRow();
            _doConnect(idx, n, key);
        };
        document.getElementById('wext-pw-cancel').onclick = _removePwRow;
        if (inp) inp.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); document.getElementById('wext-pw-ok').click(); }
            if (e.key === 'Escape') _removePwRow();
        });
    }

    function _removePwRow() {
        var row = document.getElementById('wext-pw-row');
        if (row) row.parentNode.removeChild(row);
    }

    function _doConnect(idx, n, key) {
        var isOpen = n.security === 'Open';
        var params = {
            HotspotId: String(idx),
            SecurityMode: isOpen ? '0' : '4',
            SSID: n.ssid || '',
            Key: key
        };

        var btn = document.querySelector('[data-action="wextConnect"][data-args="[' + idx + ']"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Connecting...'; }

        // Clear any previous error messages
        _clearErrors();

        API.webapi('ConnectHotspot', params).then(function() {
            _pollConnect(0);
        }).catch(function() {
            _resetConnectButtons();
            _showError('Connection failed. The firmware WiFi Extender connect may not be supported.');
        });
    }

    function _pollConnect(attempt) {
        if (attempt > 8) {
            _resetConnectButtons();
            var el = $('#wext-hotspots');
            if (el) {
                var msg = document.createElement('p');
                msg.className = 'text-danger mt-1';
                msg.textContent = 'Connection timed out — firmware WiFi Extender connect is not functional on this device.';
                el.appendChild(msg);
            }
            _loadStatus();
            return;
        }
        setTimeout(function() {
            API.webapi('GetConnectHotspotState').then(function(r) {
                var state = r.ConnectState || r.State;
                if (state === 2 || state === '2') {
                    _resetConnectButtons();
                    _loadStatus();
                } else if (state === 3 || state === '3' || state === 4 || state === '4') {
                    _resetConnectButtons();
                    var el = $('#wext-hotspots');
                    if (el) {
                        var msg = document.createElement('p');
                        msg.className = 'text-danger mt-1';
                        msg.textContent = 'Connection failed (state: ' + state + ')';
                        el.appendChild(msg);
                    }
                    _loadStatus();
                } else {
                    _pollConnect(attempt + 1);
                }
            }).catch(function() {
                _pollConnect(attempt + 1);
            });
        }, 2000);
    }

    function _resetConnectButtons() {
        var btns = document.querySelectorAll('[data-action="wextConnect"]');
        for (var i = 0; i < btns.length; i++) {
            btns[i].disabled = false;
            btns[i].textContent = 'Connect';
        }
    }

    function _wextDisconnect() {
        API.webapi('DisConnectHotspot').then(function() {
            setTimeout(_loadStatus, 2000);
        }).catch(function(e) {
            _showError('Disconnect failed: ' + e.message);
        });
    }

    function _showError(msg) {
        _clearErrors();
        var el = $('#wext-hotspots') || $('#wext-status');
        if (!el) return;
        var p = document.createElement('p');
        p.className = 'text-danger mt-1 wext-error';
        p.textContent = msg;
        el.appendChild(p);
    }

    function _clearErrors() {
        var errs = document.querySelectorAll('.wext-error');
        for (var i = 0; i < errs.length; i++) errs[i].parentNode.removeChild(errs[i]);
    }

    App.registerPage('wifi-extender', renderWiFiExtender);
    App._wextScan = _wextScan;
    App._wextConnect = _wextConnect;
    App._wextDisconnect = _wextDisconnect;
})();
