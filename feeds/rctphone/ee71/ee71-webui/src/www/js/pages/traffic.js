;(function() {
    'use strict';
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;
    var formatBytes = App.formatBytes, formatSpeed = App.formatSpeed, formatUptime = App.formatUptime;

    var _trafficTimer = null;
    var _trafficChart = null;
    var _trafficLevel = 0;
    var _hostHistory = {};
    var _deviceChart = null;
    var _selectedDevice = null;
    var SPARKLINE_LEN = 20;

    var TRAFFIC_LEVELS = [
        { label: '3 min', detail: 0, interval: 3000 },
        { label: '1 hr',  detail: 1, interval: 10000 },
        { label: '3 hr',  detail: 2, interval: 30000 },
        { label: '1 day', detail: 3, interval: 60000 },
    ];

    function renderTraffic(container) {
        container.innerHTML =
            '<h2>Traffic Monitor</h2>' +
            '<div class="card">' +
                '<h3>WAN Speed</h3>' +
                '<div class="chart-controls" id="tr-zoom">' +
                    TRAFFIC_LEVELS.map(function(l, i) {
                        return '<button data-level="' + i + '"' + (i === 0 ? ' class="active"' : '') + '>' + l.label + '</button>';
                    }).join('') +
                '</div>' +
                '<div class="chart-container" id="tr-wan-chart"></div>' +
            '</div>' +
            '<div class="card mt-2">' +
                '<div class="flex-between mb-1">' +
                    '<h3>' + icon('ic-clients') + ' Per-Device Traffic</h3>' +
                    '<span class="text-small text-muted" id="tr-update-time"></span>' +
                '</div>' +
                '<div id="tr-host-table">' +
                    '<div class="page-loading"><div class="spinner"></div> Loading...</div>' +
                '</div>' +
            '</div>' +
            '<div class="card mt-2" id="tr-device-detail" style="display:none">' +
                '<div class="flex-between mb-1">' +
                    '<h3 id="tr-dev-title">Device Speed</h3>' +
                    '<button class="toggle-btn" ' + actionAttr('closeDeviceChart') + '>Close</button>' +
                '</div>' +
                '<div class="chart-container" id="tr-dev-chart"></div>' +
            '</div>';

        // Zoom buttons
        $$('#tr-zoom button').forEach(function(btn) {
            btn.addEventListener('click', function() {
                _trafficLevel = parseInt(btn.dataset.level, 10);
                $$('#tr-zoom button').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                refreshTrafficChart();
            });
        });

        _trafficLevel = 0;
        refreshTrafficChart();
        refreshTrafficHosts();

        _trafficTimer = setInterval(function() {
            refreshTrafficChart();
            refreshTrafficHosts();
        }, TRAFFIC_LEVELS[_trafficLevel].interval);

        App.setCleanup(function() {
            if (_trafficTimer) { clearInterval(_trafficTimer); _trafficTimer = null; }
            if (_trafficChart) { _trafficChart.destroy(); _trafficChart = null; }
            if (_deviceChart) { _deviceChart.destroy(); _deviceChart = null; }
            _hostHistory = {};
            _selectedDevice = null;
        });
    }

    function refreshTrafficChart() {
        API.cgiGet('traffic.cgi', { action: 'chart', detail: _trafficLevel }).then(function(data) {
            if (!data || !data.data || data.data.length === 0) return;

            var points = data.data;
            var times = points.map(function(p) { return p.t; });
            var rx = points.map(function(p) { return (p.rx * 8) / 1000000; });
            var tx = points.map(function(p) { return (p.tx * 8) / 1000000; });

            var chartEl = document.getElementById('tr-wan-chart');
            if (!chartEl) return;

            var opts = {
                width: chartEl.clientWidth || 600,
                height: 220,
                cursor: { show: true },
                scales: {
                    x: { time: false },
                    y: { auto: true, range: [0, null] },
                },
                axes: [
                    {
                        stroke: 'rgba(128,128,128,0.5)',
                        grid: { stroke: 'rgba(128,128,128,0.1)' },
                        values: function(u, vals) {
                            return vals.map(function(v) {
                                if (_trafficLevel === 0) return (v - times[0]) + 's';
                                return Math.floor((v - times[0]) / 60) + 'm';
                            });
                        },
                    },
                    {
                        stroke: 'rgba(128,128,128,0.5)',
                        grid: { stroke: 'rgba(128,128,128,0.1)' },
                        values: function(u, vals) {
                            return vals.map(function(v) { return v.toFixed(1) + ' Mbps'; });
                        },
                        size: 70,
                    },
                ],
                series: [
                    {},
                    { label: 'Download', stroke: '#0077cc', fill: 'rgba(0,119,204,0.1)', width: 2 },
                    { label: 'Upload', stroke: '#2e7d32', fill: 'rgba(46,125,50,0.1)', width: 2 },
                ],
            };

            if (_trafficChart) {
                _trafficChart.setData([times, rx, tx]);
                _trafficChart.setSize({ width: chartEl.clientWidth || 600, height: 220 });
            } else {
                _trafficChart = new uPlot(opts, [times, rx, tx], chartEl);
            }
        }).catch(function() {});
    }

    function _sparkSvg(values, color) {
        if (!values || values.length < 2) return '';
        var max = 0;
        for (var i = 0; i < values.length; i++) if (values[i] > max) max = values[i];
        if (max === 0) max = 1;
        var w = 80, h = 20;
        var step = w / (values.length - 1);
        var pts = '';
        for (var j = 0; j < values.length; j++) {
            pts += (j * step).toFixed(1) + ',' + (h - (values[j] / max) * (h - 2) - 1).toFixed(1) + ' ';
        }
        return '<svg width="' + w + '" height="' + h + '" style="vertical-align:middle"><polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="1.5"/></svg>';
    }

    function _showDeviceChart(ip, name) {
        _selectedDevice = ip;
        var detail = document.getElementById('tr-device-detail');
        var title = document.getElementById('tr-dev-title');
        if (detail) detail.style.display = '';
        if (title) title.textContent = (name || ip) + ' Speed';
        _updateDeviceChart();
    }

    function _closeDeviceChart() {
        _selectedDevice = null;
        var detail = document.getElementById('tr-device-detail');
        if (detail) detail.style.display = 'none';
        if (_deviceChart) { _deviceChart.destroy(); _deviceChart = null; }
    }

    function _updateDeviceChart() {
        if (!_selectedDevice) return;
        var hist = _hostHistory[_selectedDevice];
        if (!hist || hist.length < 2) return;
        var chartEl = document.getElementById('tr-dev-chart');
        if (!chartEl) return;

        var times = hist.map(function(p, i) { return i * 3; });
        var rx = hist.map(function(p) { return (p.rx * 8) / 1000000; });
        var tx = hist.map(function(p) { return (p.tx * 8) / 1000000; });

        var opts = {
            width: chartEl.clientWidth || 600, height: 180,
            cursor: { show: true },
            scales: { x: { time: false }, y: { auto: true, range: [0, null] } },
            axes: [
                { stroke: 'rgba(128,128,128,0.5)', grid: { stroke: 'rgba(128,128,128,0.1)' },
                  values: function(u, vals) { return vals.map(function(v) { return v + 's'; }); } },
                { stroke: 'rgba(128,128,128,0.5)', grid: { stroke: 'rgba(128,128,128,0.1)' },
                  values: function(u, vals) { return vals.map(function(v) { return v.toFixed(1) + ' Mbps'; }); }, size: 70 },
            ],
            series: [
                {},
                { label: 'Download', stroke: '#0077cc', fill: 'rgba(0,119,204,0.1)', width: 2 },
                { label: 'Upload', stroke: '#2e7d32', fill: 'rgba(46,125,50,0.1)', width: 2 },
            ],
        };

        if (_deviceChart) {
            _deviceChart.setData([times, rx, tx]);
            _deviceChart.setSize({ width: chartEl.clientWidth || 600, height: 180 });
        } else {
            _deviceChart = new uPlot(opts, [times, rx, tx], chartEl);
        }
    }

    function refreshTrafficHosts() {
        Promise.all([
            API.cgiGet('traffic.cgi', { action: 'status' }).catch(function() { return null; }),
            API.webapi('GetConnectedDeviceList').catch(function() { return null; }),
        ]).then(function(results) {
            var data = results[0], devList = results[1];
            if (!data || data.error || !data.hosts) {
                var el = document.getElementById('tr-host-table');
                if (el) el.innerHTML = '<p class="text-muted">' + (data && data.error ? data.error : 'No traffic data available') + '</p>';
                return;
            }

            // Build IP→name map from connected device list
            var nameMap = {};
            if (devList && devList.ConnectedList) {
                for (var d = 0; d < devList.ConnectedList.length; d++) {
                    var dev = devList.ConnectedList[d];
                    if (dev.IpAddress) nameMap[dev.IpAddress] = dev.DeviceName || dev.HostName || '';
                }
            }

            var el = document.getElementById('tr-host-table');
            if (!el) return;

            var uptime = document.getElementById('tr-update-time');
            if (uptime && data.uptime) uptime.textContent = 'Uptime: ' + formatUptime(data.uptime);

            var hosts = data.hosts.filter(function(h) { return h.active || h.rx_total > 0 || h.tx_total > 0; });
            hosts.sort(function(a, b) { return (b.rx_speed + b.tx_speed) - (a.rx_speed + a.tx_speed); });

            // Accumulate per-host speed history for sparklines
            for (var hi = 0; hi < hosts.length; hi++) {
                var hip = hosts[hi].ip;
                if (!_hostHistory[hip]) _hostHistory[hip] = [];
                _hostHistory[hip].push({ rx: hosts[hi].rx_speed, tx: hosts[hi].tx_speed });
                if (_hostHistory[hip].length > SPARKLINE_LEN) _hostHistory[hip].shift();
            }

            if (hosts.length === 0) {
                el.innerHTML = '<p class="text-muted">No traffic data yet</p>';
                return;
            }

            var html = '<table class="data-table"><thead><tr>' +
                '<th>Name</th><th>IP</th><th>Speed</th><th>Sparkline</th>' +
                '<th>Total DL</th><th>Total UL</th><th>Conns</th>' +
                '</tr></thead><tbody>';

            for (var i = 0; i < hosts.length; i++) {
                var host = hosts[i];
                var dl = formatSpeed(host.rx_speed);
                var ul = formatSpeed(host.tx_speed);
                var hostName = nameMap[host.ip] || host.mac || '';
                var activeClass = host.active ? '' : ' class="text-muted"';
                var hist = _hostHistory[host.ip] || [];
                var sparkRx = hist.map(function(h) { return h.rx; });
                html += '<tr' + activeClass + ' style="cursor:pointer" ' + actionAttr('showDeviceChart', [host.ip, hostName]) + '>' +
                    '<td>' + escHtml(hostName) + '</td>' +
                    '<td>' + escHtml(host.ip) + '</td>' +
                    '<td class="text-small">' + dl.value + ' ' + dl.unit + ' / ' + ul.value + ' ' + ul.unit + '</td>' +
                    '<td>' + _sparkSvg(sparkRx, '#0077cc') + '</td>' +
                    '<td>' + formatBytes(host.rx_total) + '</td>' +
                    '<td>' + formatBytes(host.tx_total) + '</td>' +
                    '<td>' + (host.connections || 0) + '</td>' +
                    '</tr>';
            }

            // WAN totals row
            if (data.wan) {
                var wdl = formatSpeed(data.wan.rx_speed);
                var wul = formatSpeed(data.wan.tx_speed);
                html += '<tr style="font-weight:600;border-top:2px solid var(--pico-muted-border-color)">' +
                    '<td colspan="2">WAN Total</td>' +
                    '<td>' + wdl.value + ' ' + wdl.unit + '</td>' +
                    '<td>' + wul.value + ' ' + wul.unit + '</td>' +
                    '<td>' + formatBytes(data.wan.rx_total) + '</td>' +
                    '<td>' + formatBytes(data.wan.tx_total) + '</td>' +
                    '<td></td></tr>';
            }

            html += '</tbody></table>';
            el.innerHTML = html;

            // Update device detail chart if open
            _updateDeviceChart();
        }).catch(function() {});
    }

    App.registerPage('traffic', renderTraffic);
    App._showDeviceChart = _showDeviceChart;
    App._closeDeviceChart = _closeDeviceChart;
})();
