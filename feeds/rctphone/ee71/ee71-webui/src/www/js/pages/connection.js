;(function() {
    'use strict';
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;

    var _connTimer = null;
    var _signalChart = null;
    var _signalHistory = { t: [], rsrp: [], sinr: [] };

    function renderConnection(container) {
        container.innerHTML =
            '<h2>Connection</h2>' +
            '<div class="tabs" id="conn-tabs">' +
                '<button class="active" data-tab="signal">Signal</button>' +
                '<button data-tab="network">Network</button>' +
            '</div>' +
            '<div class="tab-content active" id="conn-tab-signal">' +
                _renderSignalTab() +
            '</div>' +
            '<div class="tab-content" id="conn-tab-network">' +
                '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>' +
            '</div>';

        $$('#conn-tabs button').forEach(function(btn) {
            btn.addEventListener('click', function() {
                $$('#conn-tabs button').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                $$('#conn-tabs ~ .tab-content').forEach(function(tc) { tc.classList.remove('active'); });
                var target = document.getElementById('conn-tab-' + btn.dataset.tab);
                if (target) target.classList.add('active');
            });
        });

        _refreshSignal();
        _loadNetwork();
        _connTimer = setInterval(_refreshSignal, 5000);

        App.setCleanup(function() {
            if (_connTimer) { clearInterval(_connTimer); _connTimer = null; }
            if (_netSearchTimer) { clearTimeout(_netSearchTimer); _netSearchTimer = null; }
            if (_signalChart) { _signalChart.destroy(); _signalChart = null; }
            _signalHistory = { t: [], rsrp: [], sinr: [] };
        });
    }

    // --- Signal tab HTML ---

    function _renderSignalTab() {
        return '<div class="cards-grid">' +
            '<div class="card" id="conn-connection">' +
                '<h3>' + icon('ic-mobile') + ' Connection</h3>' +
                '<div class="stat-row"><span class="label">Operator</span><span class="value" id="m-operator">\u2014</span></div>' +
                '<div class="stat-row"><span class="label">Technology</span><span class="value" id="m-tech">\u2014</span></div>' +
                '<div class="stat-row"><span class="label">Band</span><span class="value" id="m-band">\u2014</span></div>' +
                '<div class="stat-row"><span class="label">EARFCN</span><span class="value" id="m-earfcn">\u2014</span></div>' +
                '<div class="stat-row"><span class="label">Cell ID</span><span class="value text-mono" id="m-cellid">\u2014</span></div>' +
                '<div class="stat-row"><span class="label">TAC</span><span class="value text-mono" id="m-tac">\u2014</span></div>' +
                '<div class="stat-row" style="border-bottom:none;padding-bottom:2px"><span class="label">Public IP Address</span></div>' +
                '<div class="stat-row"><span class="label">IPv4</span><span class="value text-mono" id="m-ip">\u2014</span></div>' +
                '<div class="stat-row" id="m-ip6-row" style="display:none"><span class="label">IPv6</span><span class="value text-mono" id="m-ip6" style="font-size:0.65rem">\u2014</span></div>' +
            '</div>' +
            '<div class="card" id="conn-signal">' +
                '<h3>' + icon('ic-mobile') + ' Signal Quality</h3>' +
                '<div class="stat-row"><span class="label">Quality</span><span class="value" id="m-quality">\u2014</span></div>' +
                '<div class="signal-bars">' +
                    _signalMetricBar('RSRP', 'm-rsrp', 'dBm') +
                    _signalMetricBar('RSRQ', 'm-rsrq', 'dB') +
                    _signalMetricBar('SINR', 'm-sinr', 'dB') +
                    _signalMetricBar('RSSI', 'm-rssi', 'dBm') +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div class="card mt-2">' +
            '<div class="flex-between mb-1">' +
                '<h3>Signal History</h3>' +
                '<div class="zoom-btns">' +
                    '<button class="btn-small active" ' + actionAttr('connSignalZoom', [0]) + '>3m</button>' +
                    '<button class="btn-small" ' + actionAttr('connSignalZoom', [1]) + '>1h</button>' +
                    '<button class="btn-small" ' + actionAttr('connSignalZoom', [2]) + '>3h</button>' +
                    '<button class="btn-small" ' + actionAttr('connSignalZoom', [3]) + '>1d</button>' +
                '</div>' +
            '</div>' +
            '<div class="chart-container" id="m-signal-chart" style="min-height:180px"></div>' +
        '</div>';
    }

    function _signalMetricBar(label, id, unit) {
        return '<div class="signal-metric">' +
            '<span class="signal-label">' + label + '</span>' +
            '<div class="signal-bar-track">' +
                '<div class="signal-bar-fill" id="' + id + '-bar"></div>' +
            '</div>' +
            '<span class="signal-value" id="' + id + '">\u2014 ' + unit + '</span>' +
        '</div>';
    }

    // --- Signal refresh ---

    function _refreshSignal() {
        Promise.all([
            API.webapi('GetNetworkInfo').catch(function() { return null; }),
            API.webapi('GetConnectionState').catch(function() { return null; }),
            API.cgiGet('signal.cgi', { action: 'current' }).catch(function() { return null; }),
        ]).then(function(results) {
            var netInfo = results[0], connSt = results[1], sigData = results[2];
            var el = function(id) { return document.getElementById(id); };

            if (netInfo) {
                if (el('m-operator')) el('m-operator').textContent = netInfo.NetworkName || netInfo.Domestic || '\u2014';
                if (el('m-tech')) el('m-tech').textContent = App.techLabel(netInfo.NetworkType) || '\u2014';
                // Band + EARFCN — prefer CA data, fallback to GetNetworkInfo
                var fallbackBand = App.formatBand(netInfo.Band) || App.formatBand(sigData && sigData.band) || '\u2014';
                API.cgiGet('signal.cgi', { action: 'ca' }).then(function(ca) {
                    if (!el('m-band')) return;
                    if (ca && ca.ca && ca.bands && ca.bands.length > 1) {
                        el('m-band').textContent = ca.bands.map(function(b) { return 'B' + b; }).join('+');
                        if (el('m-earfcn') && ca.cells && ca.cells.length) {
                            var pcc = ca.cells[0];
                            el('m-earfcn').textContent = pcc.earfcn || earfcn || '\u2014';
                        }
                    } else if (ca && ca.bands && ca.bands.length === 1) {
                        el('m-band').textContent = 'LTE B' + ca.bands[0];
                    } else {
                        el('m-band').textContent = fallbackBand;
                    }
                }).catch(function() {
                    if (el('m-band')) el('m-band').textContent = fallbackBand;
                });
            }

            if (connSt) {
                if (el('m-ip')) el('m-ip').textContent = connSt.IPv4Adrress || connSt.IPAddress || '\u2014';
                var ipv6 = connSt.IPv6Adrress || '';
                if (el('m-ip6')) el('m-ip6').textContent = ipv6 || '\u2014';
                if (el('m-ip6-row')) el('m-ip6-row').style.display = ipv6 ? '' : 'none';
            }

            var rsrp = (sigData && sigData.rsrp) || (netInfo && netInfo.RSRP);
            var rsrq = (sigData && sigData.rsrq) || (netInfo && netInfo.RSRQ);
            var sinr = (sigData && sigData.sinr) || (netInfo && netInfo.SINR);
            var rssi = (sigData && sigData.rssi) || (netInfo && netInfo.SignalStrength);
            var earfcn = (sigData && sigData.earfcn) || (netInfo && netInfo.DL_channel) || '';
            var cellid = (sigData && sigData.cell_id) || (netInfo && netInfo.CellId) || '';
            var tac = (sigData && sigData.tac) || (netInfo && netInfo.LAC) || '';

            if (el('m-earfcn')) el('m-earfcn').textContent = earfcn || '\u2014';
            if (el('m-cellid')) el('m-cellid').textContent = cellid || '\u2014';
            if (el('m-tac')) el('m-tac').textContent = tac || '\u2014';

            _updateSignalMetric('m-rsrp', rsrp, 'dBm', -140, -44, [-80, -100, -110]);
            _updateSignalMetric('m-rsrq', rsrq, 'dB', -20, -3, [-10, -15, -17]);
            _updateSignalMetric('m-sinr', sinr, 'dB', -5, 30, [13, 0, -5]);
            _updateSignalMetric('m-rssi', rssi, 'dBm', -110, -50, [-65, -85, -95]);

            var quality = _signalQuality(rsrp);
            if (el('m-quality')) {
                el('m-quality').textContent = quality.text;
                el('m-quality').className = 'value ' + quality.cls;
            }

            if (rsrp != null) {
                var now = Math.floor(Date.now() / 1000);
                _signalHistory.t.push(now);
                _signalHistory.rsrp.push(parseFloat(rsrp) || 0);
                _signalHistory.sinr.push(parseFloat(sinr) || 0);
                var MAX = 120;
                if (_signalHistory.t.length > MAX) {
                    _signalHistory.t = _signalHistory.t.slice(-MAX);
                    _signalHistory.rsrp = _signalHistory.rsrp.slice(-MAX);
                    _signalHistory.sinr = _signalHistory.sinr.slice(-MAX);
                }
                _updateSignalChart();
            }
        }).catch(function() {});
    }

    function _updateSignalMetric(id, value, unit, min, max, thresholds) {
        var el = document.getElementById(id);
        var bar = document.getElementById(id + '-bar');
        if (!el) return;
        if (value == null || value === '') {
            el.textContent = '\u2014 ' + unit;
            if (bar) { bar.style.width = '0%'; bar.className = 'signal-bar-fill'; }
            return;
        }
        var v = parseFloat(value);
        el.textContent = v + ' ' + unit;
        var pct = Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
        if (bar) {
            bar.style.width = pct + '%';
            var cls = 'signal-bar-fill';
            if (v >= thresholds[0]) cls += ' signal-excellent';
            else if (v >= thresholds[1]) cls += ' signal-good';
            else if (v >= thresholds[2]) cls += ' signal-fair';
            else cls += ' signal-poor';
            bar.className = cls;
        }
    }

    function _signalQuality(rsrp) {
        if (rsrp == null) return { text: '\u2014', cls: '' };
        var v = parseFloat(rsrp);
        if (isNaN(v) || v >= -1 || v === 0) return { text: '\u2014', cls: '' };
        if (v >= -80) return { text: 'Excellent', cls: 'text-success' };
        if (v >= -90) return { text: 'Good', cls: 'text-success' };
        if (v >= -100) return { text: 'Fair', cls: 'text-warn' };
        if (v >= -110) return { text: 'Poor', cls: 'text-warn' };
        return { text: 'Very Poor', cls: 'text-danger' };
    }

    function _updateSignalChart() {
        var chartEl = document.getElementById('m-signal-chart');
        if (!chartEl || _signalHistory.t.length < 2) return;

        var data = [_signalHistory.t, _signalHistory.rsrp, _signalHistory.sinr];
        if (_signalChart) {
            var w = chartEl.clientWidth || 400;
            _signalChart.setSize({ width: w, height: 180 });
            _signalChart.setData(data);
        } else {
            _signalChart = new uPlot({
                width: chartEl.clientWidth || 400,
                height: 180,
                cursor: { show: true },
                legend: { show: true },
                scales: {
                    x: { time: true },
                    rsrp: { auto: true, range: [-140, -44] },
                    sinr: { auto: true, range: [-5, 30] },
                },
                axes: [
                    {},
                    { scale: 'rsrp', label: 'RSRP (dBm)', stroke: '#0077cc', grid: { show: true } },
                    { scale: 'sinr', label: 'SINR (dB)', stroke: '#2e7d32', side: 1, grid: { show: false } },
                ],
                series: [
                    {},
                    { label: 'RSRP', scale: 'rsrp', stroke: '#0077cc', width: 2, fill: 'rgba(0,119,204,0.1)' },
                    { label: 'SINR', scale: 'sinr', stroke: '#2e7d32', width: 2, fill: 'rgba(46,125,50,0.1)' },
                ],
            }, data, chartEl);
        }
    }

    function _connSignalZoom(level) {
        $$('.zoom-btns .btn-small').forEach(function(b, i) { b.classList.toggle('active', i === level); });
        API.cgiGet('signal.cgi', { action: 'history' }).then(function(hist) {
            if (!Array.isArray(hist) || !hist.length) return;
            _signalHistory = { t: [], rsrp: [], sinr: [] };
            hist.forEach(function(pt) {
                if (pt.t) {
                    _signalHistory.t.push(pt.t);
                    _signalHistory.rsrp.push(pt.rsrp || 0);
                    _signalHistory.sinr.push(pt.sinr || 0);
                }
            });
            if (_signalChart) _signalChart.destroy();
            _signalChart = null;
            _updateSignalChart();
        }).catch(function() {});
    }

    // --- Network tab ---

    var _netSearchTimer = null;
    var _connPdpType = '3'; // cached from GetConnectionSettings

    function _loadNetwork() {
        var tab = $('#conn-tab-network');
        if (!tab) return;

        Promise.all([
            API.webapi('GetConnectionSettings').catch(function() { return null; }),
            API.webapi('GetNetworkSettings').catch(function() { return null; }),
            API.webapi('GetNetworkInfo').catch(function() { return null; }),
            API.webapi('GetConnectionState').catch(function() { return null; }),
            API.webapi('GetUsageSettings').catch(function() { return null; }),
        ]).then(function(results) {
            var connSettings = results[0], networkSettings = results[1], netInfo = results[2], connSt = results[3], usage = results[4];
            var cs = connSettings || {};
            var ns = networkSettings || {};
            var us = usage || {};

            var currentMode = ns.NetworkMode != null ? String(ns.NetworkMode) : '0';
            var netSelMode = ns.NetselectionMode != null ? String(ns.NetselectionMode) : '0';
            var connMode = cs.ConnectMode != null ? String(cs.ConnectMode) : '1';
            var roaming = cs.RoamingConnect || '0';
            var idleTime = cs.IdleTime != null ? cs.IdleTime : '0';
            var pdpType = String(cs.PdpType != null ? cs.PdpType : '3');
            _connPdpType = pdpType;
            var connected = connSt && (connSt.ConnectionStatus === 2 || connSt.ConnectionStatus === '2');

            tab.innerHTML =
                '<div class="card">' +
                    '<h3>Network Mode</h3>' +
                    '<div class="form-group">' +
                        '<label>Preferred Mode</label>' +
                        '<select id="m-netmode">' +
                            '<option value="auto"' + (currentMode === 'auto' || currentMode === '0' ? ' selected' : '') + '>Auto (4G/3G/2G)</option>' +
                            '<option value="4g3g"' + (currentMode === '4g3g' || currentMode === '0302' ? ' selected' : '') + '>4G + 3G</option>' +
                            '<option value="4g"' + (currentMode === '4g' || currentMode === '03' ? ' selected' : '') + '>4G Only (LTE)</option>' +
                            '<option value="3g"' + (currentMode === '3g' || currentMode === '02' ? ' selected' : '') + '>3G Only (WCDMA)</option>' +
                            '<option value="2g"' + (currentMode === '2g' || currentMode === '01' ? ' selected' : '') + '>2G Only (GSM)</option>' +
                        '</select>' +
                    '</div>' +
                    '<div class="form-actions">' +
                        '<button ' + actionAttr('connSetMode') + '>Apply Mode</button>' +
                    '</div>' +
                '</div>' +

                // Operator Selection (Feature 3)
                '<div class="card mt-2">' +
                    '<h3>Operator Selection</h3>' +
                    '<div class="form-group">' +
                        '<label><input type="radio" name="netsel" id="m-netsel-auto" value="0"' + (netSelMode === '0' || netSelMode === 0 ? ' checked' : '') + '> Automatic</label>' +
                        '<label><input type="radio" name="netsel" id="m-netsel-manual" value="1"' + (netSelMode === '1' || netSelMode === 1 ? ' checked' : '') + '> Manual</label>' +
                    '</div>' +
                    '<div class="form-actions">' +
                        '<button ' + actionAttr('connSearchNet') + '>Search Networks</button>' +
                    '</div>' +
                    '<div id="m-netsearch"></div>' +
                '</div>' +

                // Connection Settings (Feature 5)
                '<div class="card mt-2">' +
                    '<h3>Connection</h3>' +
                    '<div class="form-group">' +
                        '<label>Connect Mode</label>' +
                        '<select id="m-connmode">' +
                            '<option value="1"' + (connMode === '1' || connMode === 1 ? ' selected' : '') + '>Auto</option>' +
                            '<option value="0"' + (connMode === '0' || connMode === 0 ? ' selected' : '') + '>Manual</option>' +
                        '</select>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>Idle Timeout (min)</label>' +
                        '<input type="number" id="m-idle" value="' + (parseInt(idleTime, 10) || 0) + '" min="0" max="120">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>IP Type</label>' +
                        '<select id="m-pdptype">' +
                            '<option value="3"' + (pdpType === '3' || pdpType === 3 ? ' selected' : '') + '>IPv4v6</option>' +
                            '<option value="0"' + (pdpType === '0' || pdpType === 0 ? ' selected' : '') + '>IPv4</option>' +
                            '<option value="2"' + (pdpType === '2' || pdpType === 2 ? ' selected' : '') + '>IPv6</option>' +
                        '</select>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label><input type="checkbox" id="m-roaming"' + (roaming === '1' || roaming === 1 ? ' checked' : '') + '> Connect while roaming</label>' +
                    '</div>' +
                    '<div class="form-actions">' +
                        '<button ' + actionAttr('connSaveConn') + '>Save</button>' +
                        (connected ?
                            '<button class="btn-outline" ' + actionAttr('connDisconnect') + '>Disconnect</button>' :
                            '<button class="btn-outline" ' + actionAttr('connConnect') + '>Connect</button>') +
                    '</div>' +
                '</div>' +

                // Data Plan (Feature 4)
                '<div class="card mt-2">' +
                    '<h3>Data Plan</h3>' +
                    '<div class="stat-row"><span class="label">Used</span><span class="value">' +
                        App.formatBytes(us.UsedData || 0) + ' / ' + App.formatBytes((us.MonthlyPlan || 0) * 1048576) +
                    '</span></div>' +
                    '<div class="form-group">' +
                        '<label>Monthly Limit (MB)</label>' +
                        '<input type="number" id="m-planlimit" value="' + (parseInt(us.MonthlyPlan, 10) || 0) + '" min="0" max="999999">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>Billing Day (1-31)</label>' +
                        '<input type="number" id="m-billday" value="' + (parseInt(us.BillingDay, 10) || 1) + '" min="1" max="31">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label><input type="checkbox" id="m-autodisconn"' + (us.AutoDisconnFlag === '1' || us.AutoDisconnFlag === 1 ? ' checked' : '') + '> Auto-disconnect at limit</label>' +
                    '</div>' +
                    '<div class="form-actions">' +
                        '<button ' + actionAttr('connSavePlan') + '>Save Plan</button>' +
                        '<button class="btn-outline" ' + actionAttr('connResetCounters') + '>Reset Counters</button>' +
                    '</div>' +
                '</div>' +

                '<div class="card mt-2">' +
                    '<h3>IP Addresses</h3>' +
                    '<div class="stat-row"><span class="label">IPv4</span><span class="value" id="m-ipv4">' + escHtml((connSt && (connSt.IPv4Adrress || connSt.IPAddress)) || '\u2014') + '</span></div>' +
                    '<div class="stat-row"><span class="label">IPv6</span><span class="value text-mono text-small" id="m-ipv6">' + escHtml((connSt && connSt.IPv6Adrress) || '\u2014') + '</span></div>' +
                '</div>' +
                '<div class="card mt-2">' +
                    '<h3>Data Counters</h3>' +
                    '<div class="stat-row"><span class="label">Session RX</span><span class="value" id="m-rx">' + App.formatBytes((connSt && connSt.DlBytes) || 0) + '</span></div>' +
                    '<div class="stat-row"><span class="label">Session TX</span><span class="value" id="m-tx">' + App.formatBytes((connSt && connSt.UlBytes) || 0) + '</span></div>' +
                    '<div class="stat-row"><span class="label">Duration</span><span class="value" id="m-dur">' + App.formatUptime((connSt && connSt.ConnectionTime) || 0) + '</span></div>' +
                '</div>';
        }).catch(function() {
            tab.innerHTML = '<div class="card"><p class="text-muted">Failed to load network info</p></div>';
        });
    }

    // Feature 3: Network search
    function _connSearchNet() {
        var el = $('#m-netsearch');
        if (!el) return;
        el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Searching (up to 60s)...</div>';

        // Set manual mode first
        API.webapi('SetNetworkSettings', { NetselectionMode: 1 }).then(function() {
            return API.webapi('SearchNetwork', { NetworkID: '' });
        }).then(function() {
            _pollNetSearch(0);
        }).catch(function(e) {
            el.innerHTML = '<p class="text-danger">Search failed: ' + escHtml(e.message) + '</p>';
        });
    }

    function _pollNetSearch(attempt) {
        if (attempt > 30) {
            var el = $('#m-netsearch');
            if (el) el.innerHTML = '<p class="text-muted">Search timeout</p>';
            return;
        }
        _netSearchTimer = setTimeout(function() {
            API.webapi('SearchNetworkResult').then(function(r) {
                if (!r || (r.SearchState !== 2 && r.SearchState !== '2')) {
                    _pollNetSearch(attempt + 1);
                    return;
                }
                var list = r.ListNetworkItem || [];
                var el = $('#m-netsearch');
                if (!el) return;
                if (!list.length) {
                    el.innerHTML = '<p class="text-muted">No operators found</p>';
                    return;
                }
                var RAT_MAP = { '0': '2G', '2': '3G', '7': '4G' };
                var STATE_MAP = { '0': 'Unknown', '1': 'Available', '2': 'Current', '3': 'Forbidden' };
                var html = '<table class="data-table mt-1"><thead><tr><th>Operator</th><th>MCC/MNC</th><th>RAT</th><th>State</th><th></th></tr></thead><tbody>';
                list.forEach(function(op, i) {
                    var rat = RAT_MAP[String(op.Rat)] || String(op.Rat || '');
                    var state = STATE_MAP[String(op.State)] || String(op.State || '');
                    var netId = (op.mcc || '') + (op.mnc || '');
                    html += '<tr>' +
                        '<td>' + escHtml(op.NetworkName || op.Name || '') + '</td>' +
                        '<td class="text-mono">' + escHtml(op.mcc || '') + '/' + escHtml(op.mnc || '') + '</td>' +
                        '<td>' + escHtml(rat) + '</td>' +
                        '<td>' + escHtml(state) + '</td>' +
                        '<td><button class="btn-small" ' + actionAttr('connRegNet', [netId]) + '>Register</button></td>' +
                        '</tr>';
                });
                html += '</tbody></table>' +
                    '<div class="form-actions mt-1"><button class="btn-outline" ' + actionAttr('connAutoNet') + '>Back to Auto</button></div>';
                el.innerHTML = html;
            }).catch(function() {
                _pollNetSearch(attempt + 1);
            });
        }, 2000);
    }

    function _connRegNet(networkId) {
        var el = $('#m-netsearch');
        if (el) el.innerHTML += '<div class="page-loading"><div class="spinner"></div> Registering...</div>';
        API.webapi('RegisterNetwork', { NetworkID: networkId }).then(function() {
            alert('Registered on network. Reconnecting...');
            setTimeout(_loadNetwork, 3000);
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    function _connAutoNet() {
        API.webapi('SetNetworkSettings', { NetselectionMode: 0 }).then(function() {
            alert('Switched to automatic network selection.');
            setTimeout(_loadNetwork, 3000);
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    // Feature 5: Connection settings
    function _connSaveConn() {
        var pdp = parseInt($('#m-pdptype').value, 10);
        var idle = parseInt($('#m-idle').value, 10) || 0;
        var params = {
            ConnectMode: parseInt($('#m-connmode').value, 10),
            IdleTime: idle,
            RoamingConnect: $('#m-roaming').checked ? 1 : 0,
            PdpType: isNaN(pdp) ? 3 : pdp
        };
        API.webapi('SetConnectionSettings', params).then(function() {
            alert('Connection settings saved.');
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    function _connConnect() {
        API.webapi('Connect').then(function() {
            alert('Connecting...');
            setTimeout(_loadNetwork, 3000);
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    function _connDisconnect() {
        API.webapi('DisConnect').then(function() {
            alert('Disconnected.');
            setTimeout(_loadNetwork, 2000);
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    // Feature 4: Data plan
    function _connSavePlan() {
        var params = {
            MonthlyPlan: $('#m-planlimit').value || '0',
            BillingDay: $('#m-billday').value || '1',
            AutoDisconnFlag: $('#m-autodisconn').checked ? '1' : '0'
        };
        API.webapi('SetUsageSettings', params).then(function() {
            alert('Data plan saved.');
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    function _connResetCounters() {
        if (!confirm('Reset data usage counters?')) return;
        API.webapi('SetUsageRecordClear').then(function() {
            alert('Counters reset.');
            setTimeout(_loadNetwork, 1000);
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    function _connSetMode() {
        var sel = $('#m-netmode');
        if (!sel) return;
        var mode = sel.value;
        var modeMap = { 'auto': '0', '4g3g': '0302', '4g': '03', '3g': '02', '2g': '01' };
        API.webapi('SetNetworkSettings', { NetworkMode: modeMap[mode] || '0' }).then(function() {
            alert('Network mode changed. Reconnecting may take 10-30s.');
            setTimeout(_loadNetwork, 3000);
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    App.registerPage('connection', renderConnection);
    App._connSetMode = _connSetMode;
    App._connSignalZoom = _connSignalZoom;
    App._connSearchNet = _connSearchNet;
    App._connRegNet = _connRegNet;
    App._connAutoNet = _connAutoNet;
    App._connSaveConn = _connSaveConn;
    App._connConnect = _connConnect;
    App._connDisconnect = _connDisconnect;
    App._connSavePlan = _connSavePlan;
    App._connResetCounters = _connResetCounters;
})();
