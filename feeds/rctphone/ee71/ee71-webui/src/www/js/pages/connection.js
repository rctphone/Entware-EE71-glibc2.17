;(function() {
    'use strict';
    var $$ = App.$$, icon = App.icon, actionAttr = App.actionAttr;

    var _connTimer = null;
    var _signalChart = null;
    var _signalHistory = { t: [], rsrp: [], sinr: [] };

    // This page used to carry a second tab, "Network", that was a verbatim copy
    // of Mobile > Settings > Network — same controls, same API calls, two
    // independent copies of the same bugs (the browser audit caught them
    // disagreeing with each other because only one copy had been rebuilt).
    // Settings is the canonical home for network mode, operator selection,
    // connection settings and the data plan: those are settings, and Settings
    // is also where APN and the AT terminal already live, so all the
    // modem-configuration controls are in one place. The Connection page keeps
    // what its name promises — the live state of the mobile link — and no
    // longer mixes a 5-second polling view with forms the user is typing into.
    function renderConnection(container) {
        container.innerHTML =
            '<h2>Connection</h2>' +
            _renderSignalCards();

        _refreshSignal();
        _connTimer = setInterval(_refreshSignal, 5000);

        App.setCleanup(function() {
            if (_connTimer) { clearInterval(_connTimer); _connTimer = null; }
            if (_signalChart) { _signalChart.destroy(); _signalChart = null; }
            _signalHistory = { t: [], rsrp: [], sinr: [] };
        });
    }

    // --- Page HTML ---

    function _renderSignalCards() {
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
                var fallbackBand = App.formatBand(netInfo.Band) || App.formatBand(sigData && sigData.Band) || '\u2014';
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

            // signal.cgi?action=current is a passthrough of the KEY=VALUE file
            // traffic_stats writes, and it keeps the firmware's own spelling:
            // RSRP, RSRQ, SINR, RSSI, Band, EARFCN, CellId, eNBID, TAC, TxPWR
            // (ee71-traffic-stats/src/traffic_stats.c, write_signal_current()).
            // Reading them lower-cased made every one of these undefined, so
            // every value silently came from the GetNetworkInfo fallback — and
            // the RSSI fallback was SignalStrength, the 0-5 bar count, which is
            // what rendered as "5 dBm" next to a real RSSI of -55.
            // GetNetworkInfo carries a proper RSSI string of its own; that is
            // the correct fallback, and SignalStrength is not a dBm value at
            // all (stock mock, build.formatted.js:41006 — SignalStrength: 3
            // alongside RSSI: "").
            var rsrp = (sigData && sigData.RSRP) || (netInfo && netInfo.RSRP);
            var rsrq = (sigData && sigData.RSRQ) || (netInfo && netInfo.RSRQ);
            var sinr = (sigData && sigData.SINR) || (netInfo && netInfo.SINR);
            var rssi = (sigData && sigData.RSSI) || (netInfo && netInfo.RSSI);
            var earfcn = (sigData && sigData.EARFCN) || (netInfo && netInfo.DL_channel) || '';
            var cellid = (sigData && sigData.CellId) || (netInfo && netInfo.CellId) || '';
            var tac = (sigData && sigData.TAC) || (netInfo && netInfo.LAC) || '';

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


    App.registerPage('connection', renderConnection);
    App._connSignalZoom = _connSignalZoom;
})();
