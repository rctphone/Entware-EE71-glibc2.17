;(function() {
    'use strict';
    var $ = App.$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;
    var formatBytes = App.formatBytes, formatSpeed = App.formatSpeed;

    var _clientsTimer = null;
    var _clientsDetail = null;
    var _clientDetailChart = null;

    function renderClients(container) {
        container.innerHTML =
            '<h2>Clients</h2>' +
            '<div class="card">' +
                '<h3 class="mb-1">Connected Devices</h3>' +
                '<div id="cl-list">' +
                    '<div class="page-loading"><div class="spinner"></div> Loading...</div>' +
                '</div>' +
            '</div>' +
            '<div class="card mt-2 hidden" id="cl-detail-card">' +
                '<div class="flex-between mb-1">' +
                    '<h3 id="cl-detail-title">Device Details</h3>' +
                    '<button class="toggle-btn" ' + actionAttr('closeClientDetail') + '>Close</button>' +
                '</div>' +
                '<div id="cl-detail"></div>' +
                '<div class="chart-container mt-1" id="cl-detail-chart" style="min-height:180px"></div>' +
            '</div>';

        // Check for ?ip= query parameter
        var hash = window.location.hash || '';
        var ipMatch = hash.match(/[?&]ip=([^&]+)/);
        if (ipMatch) _clientsDetail = decodeURIComponent(ipMatch[1]);

        _refreshClients();
        _clientsTimer = setInterval(_refreshClients, 5000);

        App.setCleanup(function() {
            if (_clientsTimer) { clearInterval(_clientsTimer); _clientsTimer = null; }
            _clientsDetail = null;
            _clientDetailChart = null;
        });
    }

    var SEC_MAP = {0:'Open',1:'WEP',2:'WPA',3:'WPA2',4:'WPA/WPA2'};
    var WMODE_2G = {0:'11b',1:'11g',2:'11b/g',3:'11b/g/n',4:'11n'};
    var WMODE_5G = {5:'11a',6:'11a/n/ac',7:'11a/n',8:'11n/ac',9:'11ac'};
    var BW_2G = {0:'20/40 MHz',1:'20 MHz',2:'40 MHz'};
    var BW_5G = {0:'20/40/80 MHz',1:'20 MHz',2:'40 MHz',3:'80 MHz',4:'20/40/80 MHz'};
    var _wifiInfo = null;

    function _refreshClients() {
        var fetches = [
            API.webapi('GetConnectedDeviceList').catch(function() { return null; }),
            API.cgiGet('traffic.cgi', { action: 'status' }).catch(function() { return null; }),
        ];
        if (!_wifiInfo) fetches.push(API.webapi('GetWlanSettings').catch(function() { return null; }));
        Promise.all(fetches).then(function(results) {
            var devList = results[0], trafficData = results[1];
            if (results[2]) {
                var s = results[2];
                var ap2g = s.AP2G || {}, ap5g = s.AP5G || {};
                _wifiInfo = {
                    sec2g: SEC_MAP[ap2g.SecurityMode] || s.WlanAuthMode || '',
                    sec5g: SEC_MAP[ap5g.SecurityMode] || '',
                    mode2g: WMODE_2G[ap2g.WMode] || s.WlanMode || '',
                    mode5g: WMODE_5G[ap5g.WMode] || s.WlanMode_5G || '',
                    bw2g: BW_2G[ap2g.Bandwidth] || s.WlanBandwidth || '',
                    bw5g: BW_5G[ap5g.Bandwidth] || s.WlanBandwidth_5G || '',
                };
            }
            var devices = (devList && devList.ConnectedList) ? devList.ConnectedList : [];
            var trafficHosts = (trafficData && trafficData.hosts) ? trafficData.hosts : [];

            var trafficMap = {};
            for (var i = 0; i < trafficHosts.length; i++) {
                trafficMap[trafficHosts[i].ip] = trafficHosts[i];
            }

            var el = document.getElementById('cl-list');
            if (!el) return;

            if (devices.length === 0) {
                el.innerHTML = '<p class="text-muted">No devices connected</p>';
                return;
            }

            var html = '<table class="data-table cl-table"><thead><tr>' +
                '<th>Client</th><th>Address</th><th>Interface</th><th>Connection</th><th></th>' +
                '</tr></thead><tbody>';

            for (var j = 0; j < devices.length; j++) {
                var dev = devices[j];
                var ip = dev.IPAddress || dev.IpAddress || '';
                var traffic = trafficMap[ip];
                var name = dev.DeviceName || dev.HostName || '';
                if (!name) name = ip || mac;
                var mac = dev.MacAddress || '\u2014';
                var cm = Number(dev.ConnectMode);

                // Interface column
                var ifaceLine1 = 'bridge0';
                var ifaceLine2 = cm === 0 ? 'USB (ecm0)' : cm === 1 ? '2.4 GHz Wi-Fi' : cm === 2 ? '5 GHz Wi-Fi' : 'Unknown';

                // Connection column
                var connLine1 = '', connLine2 = '';
                if (cm === 1 && _wifiInfo) {
                    connLine1 = _wifiInfo.sec2g;
                    connLine2 = _wifiInfo.mode2g + ' ' + _wifiInfo.bw2g;
                } else if (cm === 2 && _wifiInfo) {
                    connLine1 = _wifiInfo.sec5g;
                    connLine2 = _wifiInfo.mode5g + ' ' + _wifiInfo.bw5g;
                } else if (cm === 0) {
                    connLine1 = 'USB';
                    connLine2 = 'ecm0';
                }

                // Traffic speed for connection column
                if (traffic && (traffic.rx_speed > 0 || traffic.tx_speed > 0)) {
                    var dl = formatSpeed(traffic.rx_speed);
                    var ul = formatSpeed(traffic.tx_speed);
                    connLine1 = '\u2193' + dl.value + ' \u2191' + ul.value + ' ' + dl.unit;
                    if (cm === 1 && _wifiInfo) connLine2 = _wifiInfo.sec2g + ' ' + _wifiInfo.mode2g;
                    else if (cm === 2 && _wifiInfo) connLine2 = _wifiInfo.sec5g + ' ' + _wifiInfo.mode5g;
                }

                var isExpanded = _clientsDetail === ip;

                html += '<tr' + (isExpanded ? ' class="cl-row-active"' : '') + '>' +
                    '<td><span class="status-dot green"></span><strong>' + escHtml(name) + '</strong></td>' +
                    '<td>' +
                        '<a href="#" ' + actionAttr('showClientDetail', [ip]) + '>' + escHtml(ip) + '</a>' +
                        '<span class="cl-sub text-mono">' + escHtml(mac) + '</span>' +
                    '</td>' +
                    '<td>' + escHtml(ifaceLine1) + '<span class="cl-sub">' + escHtml(ifaceLine2) + '</span></td>' +
                    '<td>' + escHtml(connLine1) + '<span class="cl-sub">' + escHtml(connLine2) + '</span></td>' +
                    '<td class="cl-cell-actions">' +
                        '<button class="toggle-btn" ' + actionAttr('blockClient', [mac, name]) + ' title="Block device">' +
                        icon('ic-firewall') +
                        '</button>' +
                    '</td></tr>';
            }

            html += '</tbody></table>';
            el.innerHTML = html;

            if (_clientsDetail) {
                _updateClientDetail(_clientsDetail, devices, trafficData);
            }
        }).catch(function() {});
    }

    function _showClientDetail(ip) {
        _clientsDetail = ip;
        var card = document.getElementById('cl-detail-card');
        if (card) card.classList.remove('hidden');
        _refreshClients();
        _loadClientChart(ip);
    }

    function _closeClientDetail() {
        _clientsDetail = null;
        var card = document.getElementById('cl-detail-card');
        if (card) card.classList.add('hidden');
        if (_clientDetailChart) { _clientDetailChart.destroy(); _clientDetailChart = null; }
    }

    function _updateClientDetail(ip, devices, trafficData) {
        var card = document.getElementById('cl-detail-card');
        var title = document.getElementById('cl-detail-title');
        var detail = document.getElementById('cl-detail');
        if (!card || !detail) return;

        card.classList.remove('hidden');

        var dev = devices.find(function(d) { return (d.IPAddress || d.IpAddress) === ip; });
        var traffic = trafficData && trafficData.hosts ? trafficData.hosts.find(function(h) { return h.ip === ip; }) : null;

        var name = dev ? (dev.DeviceName || dev.HostName || ip) : ip;
        if (title) title.textContent = name;

        var html = '<div class="cards-grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">';

        if (dev) {
            html += '<div>' +
                '<div class="stat-row"><span class="label">IP</span><span class="value">' + escHtml(dev.IPAddress || dev.IpAddress || '') + '</span></div>' +
                '<div class="stat-row"><span class="label">MAC</span><span class="value text-mono">' + escHtml(dev.MacAddress || '') + '</span></div>' +
                '<div style="display:flex;gap:8px;margin-top:0.5rem">' +
                    '<button class="toggle-btn" ' + actionAttr('renameClient', [dev.MacAddress || '', name]) + '>' + icon('ic-settings') + ' Rename</button>' +
                    '<button class="toggle-btn" ' + actionAttr('blockClient', [dev.MacAddress || '', name]) + '>' + icon('ic-firewall') + ' Block</button>' +
                '</div>' +
                '</div>';
        }

        if (traffic) {
            var dl = formatSpeed(traffic.rx_speed);
            var ul = formatSpeed(traffic.tx_speed);
            html += '<div>' +
                '<div class="stat-row"><span class="label">Download</span><span class="value">' + dl.value + ' ' + dl.unit + '</span></div>' +
                '<div class="stat-row"><span class="label">Upload</span><span class="value">' + ul.value + ' ' + ul.unit + '</span></div>' +
                '<div class="stat-row"><span class="label">Total RX</span><span class="value">' + formatBytes(traffic.rx_total) + '</span></div>' +
                '<div class="stat-row"><span class="label">Total TX</span><span class="value">' + formatBytes(traffic.tx_total) + '</span></div>' +
                '<div class="stat-row"><span class="label">Connections</span><span class="value">' + (traffic.connections || 0) + '</span></div>' +
                '</div>';
        }

        html += '</div>';
        detail.innerHTML = html;
    }

    function _loadClientChart(ip) {
        API.cgiGet('traffic.cgi', { action: 'status' }).then(function(data) {
            if (!data || !data.host_chart || !data.host_chart[ip]) return;

            var points = data.host_chart[ip]['0'];
            if (!points || points.length === 0) return;

            var times = points.map(function(p) { return p.t; });
            var rx = points.map(function(p) { return (p.rx * 8) / 1000000; });
            var tx = points.map(function(p) { return (p.tx * 8) / 1000000; });

            var chartEl = document.getElementById('cl-detail-chart');
            if (!chartEl) return;

            var opts = {
                width: chartEl.clientWidth || 500,
                height: 180,
                cursor: { show: true },
                scales: { x: { time: false }, y: { auto: true, range: [0, null] } },
                axes: [
                    { stroke: 'rgba(128,128,128,0.5)', grid: { stroke: 'rgba(128,128,128,0.1)' } },
                    { stroke: 'rgba(128,128,128,0.5)', grid: { stroke: 'rgba(128,128,128,0.1)' },
                      values: function(u, vals) { return vals.map(function(v) { return v.toFixed(1); }); }, size: 50 },
                ],
                series: [
                    {},
                    { label: 'DL (Mbps)', stroke: '#0077cc', fill: 'rgba(0,119,204,0.1)', width: 2 },
                    { label: 'UL (Mbps)', stroke: '#2e7d32', fill: 'rgba(46,125,50,0.1)', width: 2 },
                ],
            };

            if (_clientDetailChart) {
                _clientDetailChart.setData([times, rx, tx]);
            } else {
                _clientDetailChart = new uPlot(opts, [times, rx, tx], chartEl);
            }
        }).catch(function() {});
    }

    function _blockClient(mac, name) {
        if (!confirm('Block device "' + name + '" (' + mac + ')?')) return;
        API.webapi('SetConnectedDeviceBlock', { DeviceName: name, MacAddress: mac }).then(function() {
            _refreshClients();
        }).catch(function(e) {
            alert('Failed to block: ' + (e.message || e));
        });
    }

    function _renameClient(mac, currentName) {
        var newName = prompt('Enter new name for device:', currentName);
        if (!newName || newName === currentName) return;
        API.webapi('SetDeviceName', { MacAddress: mac, DeviceName: newName }).then(function() {
            _refreshClients();
        }).catch(function(e) {
            alert('Failed to rename: ' + (e.message || e));
        });
    }

    function _unblockClient(mac, name) {
        if (!confirm('Unblock device "' + name + '" (' + mac + ')?')) return;
        API.webapi('SetDeviceUnblock', { DeviceName: name, MacAddress: mac }).then(function() {
            _refreshClients();
        }).catch(function(e) {
            alert('Failed to unblock: ' + (e.message || e));
        });
    }

    App.registerPage('clients', renderClients);
    App._refreshClients = _refreshClients;
    App._showClientDetail = _showClientDetail;
    App._closeClientDetail = _closeClientDetail;
    App._blockClient = _blockClient;
    App._unblockClient = _unblockClient;
    App._renameClient = _renameClient;
})();
