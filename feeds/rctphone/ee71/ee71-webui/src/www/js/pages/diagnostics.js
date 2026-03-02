;(function() {
    'use strict';
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;

    function renderDiagnostics(container) {
        container.innerHTML =
            '<h2>Diagnostics</h2>' +
            '<div class="tabs" id="diag-tabs">' +
                '<button class="active" data-tab="sysinfo">System Info</button>' +
                '<button data-tab="ports">Open Ports</button>' +
            '</div>' +
            '<div class="tab-content active" id="diag-tab-sysinfo"></div>' +
            '<div class="tab-content" id="diag-tab-ports"></div>';

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
    }

    // --- System Info tab ---

    function _renderSysInfo() {
        var tab = $('#diag-tab-sysinfo');
        if (!tab) return;
        tab.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';

        Promise.all([
            API.webapi('GetSystemInfo').catch(function() { return null; }),
            API.cgiGet('system.cgi', { action: 'memory' }).catch(function() { return null; }),
            API.cgiGet('system.cgi', { action: 'cpu' }).catch(function() { return null; }),
            API.cgiGet('system.cgi', { action: 'storage' }).catch(function() { return null; }),
        ]).then(function(results) {
            var info = results[0] || {};
            var mem = results[1] || {};
            var cpu = results[2] || {};
            var storage = results[3] || {};

            var html = '<div class="card">' +
                '<h3>Hardware &amp; Firmware</h3>' +
                '<div class="stat-row"><span class="label">Device Name</span><span class="value">' + escHtml(info.DeviceName || '') + '</span></div>' +
                '<div class="stat-row"><span class="label">Model</span><span class="value">' + escHtml(info.DeviceModel || info.ProductName || '') + '</span></div>' +
                '<div class="stat-row"><span class="label">IMEI</span><span class="value text-mono">' + escHtml(info.Imei || '') + '</span></div>' +
                '<div class="stat-row"><span class="label">Firmware</span><span class="value">' + escHtml((info.SwVersion || info.SWversion || info.FWversion || '').replace(/\n/g, '')) + '</span></div>' +
                '<div class="stat-row"><span class="label">Hardware Rev</span><span class="value">' + escHtml(info.HwVersion || info.HWversion || '') + '</span></div>' +
                '<div class="stat-row"><span class="label">Uptime</span><span class="value">' + App.formatUptime(info.UpTime || info.Uptime) + '</span></div>' +
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
})();
