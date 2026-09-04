;(function() {
    'use strict';
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;

    function renderDiagnostics(container) {
        container.innerHTML =
            '<h2>Diagnostics</h2>' +
            '<div class="tabs" id="diag-tabs">' +
                '<button class="active" data-tab="sysinfo">System Info</button>' +
                '<button data-tab="ports">Open Ports</button>' +
                '<button data-tab="snapshot">LTE Snapshot</button>' +
            '</div>' +
            '<div class="tab-content active" id="diag-tab-sysinfo"></div>' +
            '<div class="tab-content" id="diag-tab-ports"></div>' +
            '<div class="tab-content" id="diag-tab-snapshot"></div>';

        $$('#diag-tabs button').forEach(function(btn) {
            btn.addEventListener('click', function() {
                $$('#diag-tabs button').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                $$('#diag-tabs ~ .tab-content').forEach(function(tc) { tc.classList.remove('active'); });
                var target = document.getElementById('diag-tab-' + btn.dataset.tab);
                if (target) target.classList.add('active');
            });
        });

        _renderSysInfo();
        _renderOpenPorts();
        _renderSnapshot();
    }

    // --- System Info tab ---

    function _renderSysInfo() {
        var tab = $('#diag-tab-sysinfo');
        if (!tab) return;
        tab.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';

        // Three of the six rows on this card were blank because they read
        // fields GetSystemInfo does not have. Checked against core_app's device
        // parameter table (0x2ce824) and the request map in
        // jrdcfg/json_req_config_file:
        //   - IMEI is spelled IMEI (id 7). "Imei" is in no device binary.
        //   - the model lives at id 14 of the same table, but GetSystemInfo
        //     asks for ids 0,1,2,3,17 and 6,7,8 only. GetFeatureList is the
        //     request that asks for it ({"module":9,"act":1,"id":[6,7,8,12,14]}
        //     -> DeviceName, IMEI, sn, manufacturer, model), so the model comes
        //     from there. "DeviceModel"/"ProductName" are in no device binary.
        //   - no usage-module or device-module parameter is an uptime, in any
        //     spelling; system.cgi?action=uptime reads /proc/uptime and is what
        //     the rest of this page already uses.
        Promise.all([
            API.webapi('GetSystemInfo').catch(function() { return null; }),
            API.cgiGet('system.cgi', { action: 'memory' }).catch(function() { return null; }),
            API.cgiGet('system.cgi', { action: 'cpu' }).catch(function() { return null; }),
            API.cgiGet('system.cgi', { action: 'storage' }).catch(function() { return null; }),
            API.cgiGet('system.cgi', { action: 'uptime' }).catch(function() { return null; }),
            API.webapi('GetFeatureList').catch(function() { return null; }),
        ]).then(function(results) {
            var info = results[0] || {};
            var mem = results[1] || {};
            var cpu = results[2] || {};
            var storage = results[3] || {};
            var up = results[4] || {};
            var feat = results[5] || {};

            var html = '<div class="card">' +
                '<h3>Hardware &amp; Firmware</h3>' +
                '<div class="stat-row"><span class="label">Device Name</span><span class="value">' + escHtml(info.DeviceName || '') + '</span></div>' +
                '<div class="stat-row"><span class="label">Model</span><span class="value">' + escHtml(feat.model || '') + '</span></div>' +
                '<div class="stat-row"><span class="label">Manufacturer</span><span class="value">' + escHtml(feat.manufacturer || '') + '</span></div>' +
                '<div class="stat-row"><span class="label">IMEI</span><span class="value text-mono">' + escHtml(info.IMEI || '') + '</span></div>' +
                '<div class="stat-row"><span class="label">Firmware</span><span class="value">' + escHtml((info.SwVersion || '').replace(/\n/g, '')) + '</span></div>' +
                '<div class="stat-row"><span class="label">Hardware Rev</span><span class="value">' + escHtml(info.HwVersion || '') + '</span></div>' +
                '<div class="stat-row"><span class="label">Uptime</span><span class="value">' + App.formatUptime(up.seconds) + '</span></div>' +
            '</div>';

            if (mem.total || cpu.load) {
                html += '<div class="card mt-2"><h3>Resources</h3>';
                if (cpu.load != null) {
                    html += '<div class="stat-row"><span class="label">CPU Load</span><span class="value">' + escHtml(String(cpu.load)) + '%</span></div>';
                }
                if (mem.total) {
                    var memUsed = (mem.total - (mem.free || 0) - (mem.buffers || 0) - (mem.cached || 0));
                    var memPct = mem.total > 0 ? Math.round(memUsed / mem.total * 100) : 0;
                    html += '<div class="stat-row"><span class="label">Memory</span><span class="value">' +
                        App.formatBytes(memUsed) + ' / ' + App.formatBytes(mem.total) + ' (' + memPct + '%)</span></div>';
                }
                if (storage.partitions) {
                    var parts = storage.partitions;
                    for (var i = 0; i < parts.length; i++) {
                        var p = parts[i];
                        html += '<div class="stat-row"><span class="label">' + escHtml(p.mount || p.name || '') + '</span>' +
                            '<span class="value">' + App.formatBytes(p.used) + ' / ' + App.formatBytes(p.total) + '</span></div>';
                    }
                }
                html += '</div>';
            }

            // Network tools section
            html += _buildToolsHtml();

            // Syslog section
            html += _buildSyslogHtml();

            // Dmesg section
            html += _buildDmesgHtml();

            tab.innerHTML = html;
            _diagSyslog();
            _diagDmesg();
        }).catch(function() {
            tab.innerHTML = '<div class="card"><p class="text-muted">Failed to load system info</p></div>' +
                _buildToolsHtml() + _buildSyslogHtml() + _buildDmesgHtml();
            _diagSyslog();
            _diagDmesg();
        });
    }

    // --- Network tools ---

    var _diagSettingsOpen = false;

    function _buildToolsHtml() {
        return '<div class="card mt-2">' +
            '<h3>Network Tools</h3>' +
            '<div class="diag-util-row">' +
                '<span class="diag-util-label">Utility</span>' +
                '<label class="diag-radio"><input type="radio" name="d-util" value="ping" checked data-onchange="diagUtilChange"> Ping</label>' +
                '<label class="diag-radio"><input type="radio" name="d-util" value="traceroute" data-onchange="diagUtilChange"> Traceroute</label>' +
                '<label class="diag-radio"><input type="radio" name="d-util" value="iperf3" data-onchange="diagUtilChange"> iPerf3</label>' +
            '</div>' +
            '<div class="form-group">' +
                '<label for="d-host">Host address</label>' +
                '<input type="text" id="d-host" placeholder="8.8.8.8 or hostname" maxlength="253">' +
            '</div>' +
            '<a href="#" class="diag-settings-link" ' + actionAttr('diagToggleSettings') + '>' +
                '<span id="d-settings-label">Show settings</span> <span id="d-settings-arrow">\u25BE</span>' +
            '</a>' +
            '<div id="d-settings" class="diag-settings" style="display:none">' +
                '<div id="d-set-ping">' +
                    '<div class="form-row">' +
                        '<div class="form-group" style="flex:1">' +
                            '<label>Count</label>' +
                            '<input type="number" id="d-ping-count" value="4" min="1" max="20">' +
                        '</div>' +
                        '<div class="form-group" style="flex:2"></div>' +
                    '</div>' +
                '</div>' +
                '<div id="d-set-trace" style="display:none">' +
                    '<div class="form-row">' +
                        '<div class="form-group" style="flex:1">' +
                            '<label>Max hops</label>' +
                            '<input type="number" id="d-trace-hops" value="30" min="1" max="30">' +
                        '</div>' +
                        '<div class="form-group" style="flex:2"></div>' +
                    '</div>' +
                '</div>' +
                '<div id="d-set-iperf" style="display:none">' +
                    '<div class="form-row">' +
                        '<div class="form-group" style="flex:1">' +
                            '<label>Port</label>' +
                            '<input type="number" id="d-iperf-port" value="5201" min="1" max="65535">' +
                        '</div>' +
                        '<div class="form-group" style="flex:1">' +
                            '<label>Duration (s)</label>' +
                            '<input type="number" id="d-iperf-dur" value="10" min="1" max="30">' +
                        '</div>' +
                        '<div class="form-group" style="flex:1">' +
                            '<label>Protocol</label>' +
                            '<div style="display:flex;gap:12px;padding-top:4px">' +
                                '<label class="diag-radio"><input type="radio" name="d-iperf-proto" value="tcp" checked> TCP</label>' +
                                '<label class="diag-radio"><input type="radio" name="d-iperf-proto" value="udp"> UDP</label>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<pre id="d-output" class="code-block diag-output" style="display:none"></pre>' +
            '<button ' + actionAttr('diagRun') + '>' +
                '\u25B6 Start the test' +
            '</button>' +
        '</div>';
    }

    function _diagUtilChange() {
        var util = _getSelectedUtil();
        var host = $('#d-host');
        if (host) {
            host.placeholder = util === 'iperf3' ? 'iperf.example.com' : '8.8.8.8 or hostname';
        }
        var sets = { ping: $('#d-set-ping'), trace: $('#d-set-trace'), iperf: $('#d-set-iperf') };
        if (sets.ping) sets.ping.style.display = util === 'ping' ? '' : 'none';
        if (sets.trace) sets.trace.style.display = util === 'traceroute' ? '' : 'none';
        if (sets.iperf) sets.iperf.style.display = util === 'iperf3' ? '' : 'none';
    }

    function _diagToggleSettings() {
        _diagSettingsOpen = !_diagSettingsOpen;
        var el = $('#d-settings');
        var label = $('#d-settings-label');
        var arrow = $('#d-settings-arrow');
        if (el) el.style.display = _diagSettingsOpen ? '' : 'none';
        if (label) label.textContent = _diagSettingsOpen ? 'Hide settings' : 'Show settings';
        if (arrow) arrow.textContent = _diagSettingsOpen ? '\u25B4' : '\u25BE';
    }

    function _getSelectedUtil() {
        var radios = document.querySelectorAll('input[name="d-util"]');
        for (var i = 0; i < radios.length; i++) {
            if (radios[i].checked) return radios[i].value;
        }
        return 'ping';
    }

    function _diagRun() {
        var util = _getSelectedUtil();
        if (util === 'ping') _diagPing();
        else if (util === 'traceroute') _diagTrace();
        else if (util === 'iperf3') _diagIperf();
    }

    function _showOutput(text) {
        var pre = $('#d-output');
        if (pre) { pre.style.display = ''; pre.textContent = text; }
    }

    function _diagPing() {
        var target = ($('#d-host') || {}).value;
        var count = parseInt(($('#d-ping-count') || {}).value) || 4;
        if (!target) return;
        _showOutput('Running ping...');
        API.cgiPost('diag.cgi', { action: 'ping', target: target, count: count }).then(function(r) {
            _showOutput(r.output || r.error || 'No output');
        }).catch(function(e) { _showOutput('Error: ' + e.message); });
    }

    function _diagTrace() {
        var target = ($('#d-host') || {}).value;
        var maxhops = parseInt(($('#d-trace-hops') || {}).value) || 30;
        if (!target) return;
        _showOutput('Running traceroute...');
        API.cgiPost('diag.cgi', { action: 'traceroute', target: target, maxhops: maxhops }).then(function(r) {
            _showOutput(r.output || r.error || 'No output');
        }).catch(function(e) { _showOutput('Error: ' + e.message); });
    }

    function _diagIperf() {
        var server = ($('#d-host') || {}).value;
        var port = parseInt(($('#d-iperf-port') || {}).value) || 5201;
        var dur = parseInt(($('#d-iperf-dur') || {}).value) || 10;
        var proto = 'tcp';
        var radios = document.querySelectorAll('input[name="d-iperf-proto"]');
        for (var i = 0; i < radios.length; i++) {
            if (radios[i].checked) proto = radios[i].value;
        }
        if (!server) return;
        _showOutput('Running iperf3 (' + proto + ', ' + dur + 's)...');
        API.cgiPost('diag.cgi', { action: 'iperf3', server: server, port: port, duration: dur, proto: proto }).then(function(r) {
            _showOutput(r.output || r.error || 'No output');
        }).catch(function(e) { _showOutput('Error: ' + e.message); });
    }

    // --- Syslog ---

    function _buildSyslogHtml() {
        return '<div class="card mt-2">' +
            '<h3>Syslog</h3>' +
            '<div class="form-row">' +
                '<div class="form-group" style="flex:2">' +
                    '<input type="text" id="d-syslog-filter" placeholder="Filter (fixed string)">' +
                '</div>' +
                '<div class="form-group" style="flex:1">' +
                    '<input type="number" id="d-syslog-lines" value="50" min="1" max="1000">' +
                '</div>' +
                '<div class="form-group">' +
                    '<button ' + actionAttr('diagSyslog') + '>Load</button>' +
                '</div>' +
            '</div>' +
            '<pre id="d-syslog" class="text-small" style="max-height:500px;overflow:auto;white-space:pre-wrap">Loading...</pre>' +
        '</div>';
    }

    function _diagSyslog() {
        var filter = ($('#d-syslog-filter') || {}).value || '';
        var lines = parseInt(($('#d-syslog-lines') || {}).value) || 50;
        var pre = $('#d-syslog');
        if (pre) pre.textContent = 'Loading...';
        var params = { action: 'syslog', lines: lines };
        if (filter) params.filter = filter;
        API.cgiGet('diag.cgi', params).then(function(r) {
            if (pre) pre.textContent = r.output || '(empty)';
        }).catch(function(e) { if (pre) pre.textContent = 'Error: ' + e.message; });
    }

    // --- Dmesg ---

    function _buildDmesgHtml() {
        return '<div class="card mt-2">' +
            '<h3>Dmesg</h3>' +
            '<div class="form-row">' +
                '<div class="form-group" style="flex:1">' +
                    '<input type="number" id="d-dmesg-lines" value="100" min="1" max="1000">' +
                '</div>' +
                '<div class="form-group">' +
                    '<button ' + actionAttr('diagDmesg') + '>Load</button>' +
                '</div>' +
            '</div>' +
            '<pre id="d-dmesg" class="text-small" style="max-height:500px;overflow:auto;white-space:pre-wrap">Loading...</pre>' +
        '</div>';
    }

    function _diagDmesg() {
        var lines = parseInt(($('#d-dmesg-lines') || {}).value) || 50;
        var pre = $('#d-dmesg');
        if (pre) pre.textContent = 'Loading...';
        API.cgiGet('diag.cgi', { action: 'dmesg', lines: lines }).then(function(r) {
            if (pre) pre.textContent = r.output || '(empty)';
        }).catch(function(e) { if (pre) pre.textContent = 'Error: ' + e.message; });
    }

    // --- Open Ports tab ---

    function _renderOpenPorts() {
        var tab = $('#diag-tab-ports');
        if (!tab) return;
        tab.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';
        _diagLoadPorts();
    }

    function _diagLoadPorts() {
        var tab = $('#diag-tab-ports');
        if (!tab) return;
        API.cgiGet('system.cgi', { action: 'open_ports' }).then(function(data) {
            var ports = Array.isArray(data) ? data : (data && data.ports ? data.ports : []);
            if (ports.length === 0) {
                tab.innerHTML = '<div class="card"><h3>Listening Ports</h3><p class="text-muted">No open ports found</p>' +
                    '<div class="form-actions"><button ' + actionAttr('diagRefreshPorts') + '>' + icon('ic-refresh') + ' Refresh</button></div></div>';
                return;
            }
            tab.innerHTML = '<div class="card">' +
                '<h3>Listening Ports</h3>' +
                '<table class="data-table"><thead><tr><th>Proto</th><th>Address</th><th>Port</th><th>PID</th><th>Process</th></tr></thead><tbody>' +
                ports.map(function(p) {
                    var addr = p.addr || p.address || '';
                    var port = p.port || '';
                    if (!addr && !port && p.local) {
                        var loc = p.local;
                        var li = loc.lastIndexOf(':');
                        if (li > 0) { addr = loc.substring(0, li); port = loc.substring(li + 1); }
                        else { addr = loc; }
                    }
                    return '<tr><td>' + escHtml(p.proto || '') + '</td>' +
                        '<td class="text-mono text-small">' + escHtml(addr) + '</td>' +
                        '<td>' + escHtml(String(port)) + '</td>' +
                        '<td>' + escHtml(String(p.pid || '')) + '</td>' +
                        '<td>' + escHtml(p.process || p.program || '') + '</td></tr>';
                }).join('') +
                '</tbody></table>' +
                '<div class="form-actions mt-1"><button ' + actionAttr('diagRefreshPorts') + '>' + icon('ic-refresh') + ' Refresh</button></div>' +
            '</div>';
        }).catch(function(e) {
            tab.innerHTML = '<div class="card"><h3>Listening Ports</h3><p class="text-danger">Error: ' + escHtml(e.message) + '</p>' +
                '<div class="form-actions"><button ' + actionAttr('diagRefreshPorts') + '>' + icon('ic-refresh') + ' Refresh</button></div></div>';
        });
    }

    function _diagRefreshPorts() {
        _diagLoadPorts();
    }

    // --- LTE Snapshot tab ---

    function _renderSnapshot() {
        var tab = $('#diag-tab-snapshot');
        if (!tab) return;
        tab.innerHTML = '<div class="card">' +
            '<h3>LTE Connection Snapshot</h3>' +
            '<p class="text-muted text-small">Captures LTE state, thermal, WiFi, dmesg and syslog in one shot.</p>' +
            '<div class="form-actions mb-1"><button ' + actionAttr('diagSnapshot') + '>Take Snapshot</button></div>' +
            '<div id="snap-result"></div>' +
        '</div>';
    }

    var _lastSnapshot = '';

    function _snapText(s) {
        var lte = s.lte || {};
        var bat = s.battery || {};
        var wifi = s.wifi || {};
        var sys = s.system || {};
        var lines = [
            '=== EE71 LTE Snapshot ' + new Date().toISOString() + ' ===',
            'Status:    ' + (lte.ping_ok ? 'ONLINE' : 'OFFLINE'),
            'Uptime:    ' + (s.uptime || '') + 's',
            'LTE:       state=' + (lte.state || 'N/A') + ' ip=' + (lte.ip || 'none'),
            'Signal:    ' + (lte.signal || 'N/A'),
            'RSRP:      ' + (lte.rsrp || 'N/A') + ' dBm',
            'LTE RX/TX: ' + (lte.rx_bytes || '0') + ' / ' + (lte.tx_bytes || '0'),
            'DNS:       ' + (s.dns || 'none'),
            'Route:     ' + (sys.def_route || 'none'),
            'Battery:   ' + (bat.capacity || '?') + '% ' + (bat.status || ''),
            'Thermal:   ' + (s.thermal || ''),
            'Load:      ' + (sys.load || ''),
            'Conntrack: ' + (sys.conntrack || 0),
            'WiFi:      ' + (wifi.hostapd || '') + ' ' + (wifi.channel || '') + ' 2G:' + (wifi.clients_2g || 0) + ' 5G:' + (wifi.clients_5g || 0),
            '',
            '--- dmesg (modem/wlan) ---',
            s.dmesg || '(empty)',
            '',
            '--- syslog (last 30) ---',
            s.syslog || '(empty)',
        ];
        if (s.monitor_log) {
            lines.push('', '--- LTE Monitor Log ---', s.monitor_log);
        }
        return lines.join('\n');
    }

    function _diagSnapshot() {
        var el = document.getElementById('snap-result');
        if (!el) return;
        el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Collecting...</div>';

        API.cgiGet('diag.cgi', { action: 'snapshot' }).then(function(s) {
            var lte = s.lte || {};
            var bat = s.battery || {};
            var wifi = s.wifi || {};
            var sys = s.system || {};
            var stateClass = lte.ping_ok ? 'text-success' : 'text-danger';
            var stateText = lte.ping_ok ? 'ONLINE' : 'OFFLINE';

            _lastSnapshot = _snapText(s);

            var html = '<div class="form-actions mb-1"><button ' + actionAttr('diagSnapCopy') + '>Copy to clipboard</button></div>' +
                '<div class="stat-row"><span class="label">Status</span><span class="value ' + stateClass + '">' + stateText + '</span></div>' +
                '<div class="stat-row"><span class="label">Uptime</span><span class="value">' + escHtml(s.uptime || '') + 's</span></div>' +
                '<div class="stat-row"><span class="label">LTE State</span><span class="value">' + escHtml(lte.state || 'N/A') + '</span></div>' +
                '<div class="stat-row"><span class="label">LTE IP</span><span class="value text-mono">' + escHtml(lte.ip || 'none') + '</span></div>' +
                '<div class="stat-row"><span class="label">Signal</span><span class="value text-small">' + escHtml(lte.signal || 'N/A') + '</span></div>' +
                '<div class="stat-row"><span class="label">LTE RX/TX</span><span class="value text-mono">' + escHtml(lte.rx_bytes || '0') + ' / ' + escHtml(lte.tx_bytes || '0') + '</span></div>' +
                '<div class="stat-row"><span class="label">DNS</span><span class="value text-mono">' + escHtml(s.dns || 'none') + '</span></div>' +
                '<div class="stat-row"><span class="label">Default Route</span><span class="value text-mono text-small">' + escHtml(sys.def_route || 'none') + '</span></div>' +
                '<div class="stat-row"><span class="label">Battery</span><span class="value">' + escHtml(bat.capacity || '?') + '% ' + escHtml(bat.status || '') + '</span></div>' +
                '<div class="stat-row"><span class="label">Thermal</span><span class="value text-small">' + escHtml(s.thermal || '') + '</span></div>' +
                '<div class="stat-row"><span class="label">Load</span><span class="value">' + escHtml(sys.load || '') + '</span></div>' +
                '<div class="stat-row"><span class="label">Conntrack</span><span class="value">' + (sys.conntrack || 0) + '</span></div>' +
                '<div class="stat-row"><span class="label">WiFi</span><span class="value">' + escHtml(wifi.hostapd || '') + ', 2G:' + (wifi.clients_2g || 0) + ' 5G:' + (wifi.clients_5g || 0) + ' clients</span></div>';

            if (s.dmesg) {
                html += '<h4 class="mt-1">dmesg (modem/wlan)</h4>' +
                    '<pre class="log-output" style="max-height:300px;overflow:auto;font-size:0.7rem">' + escHtml(s.dmesg) + '</pre>';
            }
            if (s.syslog) {
                html += '<h4 class="mt-1">syslog (last 30)</h4>' +
                    '<pre class="log-output" style="max-height:300px;overflow:auto;font-size:0.7rem">' + escHtml(s.syslog) + '</pre>';
            }
            if (s.monitor_log) {
                html += '<h4 class="mt-1">LTE Monitor Log</h4>' +
                    '<pre class="log-output" style="max-height:300px;overflow:auto;font-size:0.7rem">' + escHtml(s.monitor_log) + '</pre>';
            }

            el.innerHTML = html;
        }).catch(function(e) {
            el.innerHTML = '<p class="text-danger">Error: ' + escHtml(e.message) + '</p>';
        });
    }

    function _diagSnapCopy() {
        if (!_lastSnapshot) return;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(_lastSnapshot).then(function() {
                _snapToast('Copied to clipboard');
            }).catch(function() { _snapFallbackCopy(); });
        } else {
            _snapFallbackCopy();
        }
    }
    function _snapFallbackCopy() {
        var ta = document.createElement('textarea');
        ta.value = _lastSnapshot;
        ta.style.cssText = 'position:fixed;left:-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        _snapToast('Copied to clipboard');
    }
    function _snapToast(msg) {
        var btn = document.querySelector('[data-action="diagSnapCopy"]');
        if (btn) { var orig = btn.textContent; btn.textContent = msg; setTimeout(function() { btn.textContent = orig; }, 2000); }
    }

    App.registerPage('diagnostics', renderDiagnostics);
    App._diagRun = _diagRun;
    App._diagUtilChange = _diagUtilChange;
    App._diagToggleSettings = _diagToggleSettings;
    App._diagPing = _diagPing;
    App._diagTrace = _diagTrace;
    App._diagIperf = _diagIperf;
    App._diagSyslog = _diagSyslog;
    App._diagDmesg = _diagDmesg;
    App._diagRefreshPorts = _diagRefreshPorts;
    App._diagSnapshot = _diagSnapshot;
    App._diagSnapCopy = _diagSnapCopy;
})();
