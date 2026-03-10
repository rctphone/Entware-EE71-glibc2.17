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
                '<h3 class="mb-1">Devices</h3>' +
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

        var hash = window.location.hash || '';
        var ipMatch = hash.match(/[?&]ip=([^&]+)/);
        if (ipMatch) _clientsDetail = decodeURIComponent(ipMatch[1]);

        _refreshClients();
        _clientsTimer = setInterval(_refreshClients, 3000);

        App.setCleanup(function() {
            if (_clientsTimer) { clearInterval(_clientsTimer); _clientsTimer = null; }
            _clientsDetail = null;
            _clientDetailChart = null;
        });
    }

    // Channel -> band label
    function _bandLabel(ch) {
        if (!ch) return '';
        return ch <= 14 ? '2.4GHz' : '5GHz';
    }

    // RSSI -> signal bars (0-4)
    function _signalLevel(rssi) {
        if (rssi == null) return -1;
        if (rssi > -50) return 4;
        if (rssi > -60) return 3;
        if (rssi > -70) return 2;
        if (rssi > -80) return 1;
        return 0;
    }

    // Render signal bars HTML
    function _signalBarsHtml(rssi) {
        if (rssi == null) return '<span class="text-muted">\u2014</span>';
        var level = _signalLevel(rssi);
        var html = '<span class="signal-bars signal-' + level + '">';
        for (var i = 0; i < 4; i++) {
            html += '<span></span>';
        }
        html += '</span> ' + rssi + ' dBm';
        return html;
    }

    // Convert IP to numeric for sorting (e.g. 192.168.88.100 -> 3232257124)
    function _ipNum(ip) {
        if (!ip) return 0;
        var p = ip.split('.');
        return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
    }

    // Sort: online first, then by IP address
    function _sortDevices(devices) {
        devices.sort(function(a, b) {
            var ao = a.online ? 0 : 1;
            var bo = b.online ? 0 : 1;
            if (ao !== bo) return ao - bo;
            return _ipNum(a.ip) - _ipNum(b.ip);
        });
        return devices;
    }

    // Build row HTML for a device
    function _buildRow(dev, trafficMap, isExpanded) {
        var ip = dev.ip || '';
        var mac = dev.mac || '\u2014';
        var name = dev.name || ip || mac;
        var traffic = trafficMap[ip];
        var isWifi = dev.connection === 'wifi_2g' || dev.connection === 'wifi_5g';
        var isOffline = dev.connection === 'offline' || !dev.online;

        // Connection column
        var connLine1 = '', connLine2 = '';
        if (isOffline) {
            connLine1 = 'Offline';
        } else if (isWifi) {
            connLine1 = 'WiFi ' + _bandLabel(dev.channel) +
                (dev.max_speed ? ' \u00B7 ' + dev.max_speed + ' Mbps' : '');
            var details = [];
            if (dev.wifi_mode) details.push(dev.wifi_mode);
            if (dev.bandwidth) details.push(dev.bandwidth + 'MHz');
            details.push('2\u00d72');
            connLine2 = details.join(' \u00B7 ');
        } else {
            connLine1 = 'USB';
            connLine2 = dev.interface || 'ecm0';
        }

        // Signal column
        var signalHtml = (isWifi && !isOffline) ? _signalBarsHtml(dev.rssi) : '<span class="text-muted">\u2014</span>';

        // Row classes
        var cls = [];
        if (isExpanded) cls.push('cl-row-active');
        if (isOffline) cls.push('cl-row-offline');
        var clsAttr = cls.length ? ' class="' + cls.join(' ') + '"' : '';

        // Status dot: green for online, none for offline
        var dotHtml = isOffline ? '' : '<span class="status-dot green"></span>';

        return '<tr data-mac="' + escHtml(mac) + '"' + clsAttr + '>' +
            '<td>' +
                dotHtml +
                '<strong>' + escHtml(name) + '</strong>' +
            '</td>' +
            '<td>' +
                '<a href="#" ' + actionAttr('showClientDetail', [ip]) + '>' + escHtml(ip) + '</a>' +
                '<span class="cl-sub text-mono">' + escHtml(mac) + '</span>' +
            '</td>' +
            '<td>' + escHtml(connLine1) +
                (connLine2 ? '<span class="cl-sub">' + escHtml(connLine2) + '</span>' : '') +
            '</td>' +
            '<td class="cl-cell-signal">' + signalHtml + '</td>' +
            '</tr>';
    }

    function _refreshClients() {
        Promise.all([
            API.cgiGet('clients.cgi', { action: 'list' }).catch(function() { return null; }),
            API.cgiGet('traffic.cgi', { action: 'status' }).catch(function() { return null; }),
        ]).then(function(results) {
            var clientList = results[0], trafficData = results[1];

            var devices = Array.isArray(clientList) ? clientList : [];
            _sortDevices(devices);

            var trafficHosts = (trafficData && trafficData.hosts) ? trafficData.hosts : [];
            var trafficMap = {};
            for (var i = 0; i < trafficHosts.length; i++) {
                trafficMap[trafficHosts[i].ip] = trafficHosts[i];
            }

            var el = document.getElementById('cl-list');
            if (!el) return;

            if (devices.length === 0) {
                el.innerHTML = '<p class="text-muted">No devices</p>';
                return;
            }

            // Check if table already exists for animated updates
            var tbody = el.querySelector('.cl-table tbody');
            if (tbody) {
                _updateRows(tbody, devices, trafficMap);
            } else {
                // First render — build full table
                var html = '<table class="data-table cl-table"><thead><tr>' +
                    '<th>Client</th><th>Address</th><th>Connection</th><th>Signal</th>' +
                    '</tr></thead><tbody>';
                for (var j = 0; j < devices.length; j++) {
                    html += _buildRow(devices[j], trafficMap, _clientsDetail === devices[j].ip);
                }
                html += '</tbody></table>';
                el.innerHTML = html;
            }

            if (_clientsDetail) {
                _updateClientDetail(_clientsDetail, devices, trafficData);
            }
        }).catch(function() {});
    }

    // Animated row update: reorder existing rows, add new, remove stale
    function _updateRows(tbody, devices, trafficMap) {
        var existingRows = {};
        var rows = tbody.querySelectorAll('tr[data-mac]');
        for (var i = 0; i < rows.length; i++) {
            existingRows[rows[i].getAttribute('data-mac')] = rows[i];
        }

        var newMacs = {};
        var frag = document.createDocumentFragment();

        for (var j = 0; j < devices.length; j++) {
            var dev = devices[j];
            var mac = dev.mac || '\u2014';
            newMacs[mac] = true;
            var isExpanded = _clientsDetail === dev.ip;

            var existing = existingRows[mac];
            if (existing) {
                // Update content in place
                var tmp = document.createElement('tbody');
                tmp.innerHTML = _buildRow(dev, trafficMap, isExpanded);
                var newRow = tmp.firstChild;
                // Copy inner content and classes
                existing.className = newRow.className;
                existing.innerHTML = newRow.innerHTML;
                frag.appendChild(existing);
            } else {
                // New device — create row with fade-in
                var tmp2 = document.createElement('tbody');
                tmp2.innerHTML = _buildRow(dev, trafficMap, isExpanded);
                var addedRow = tmp2.firstChild;
                addedRow.classList.add('cl-row-enter');
                frag.appendChild(addedRow);
                // Trigger animation
                (function(r) {
                    requestAnimationFrame(function() {
                        requestAnimationFrame(function() { r.classList.remove('cl-row-enter'); });
                    });
                })(addedRow);
            }
        }

        // Remove rows for devices no longer present (fade-out)
        for (var oldMac in existingRows) {
            if (!newMacs[oldMac]) {
                var oldRow = existingRows[oldMac];
                oldRow.classList.add('cl-row-exit');
                // Remove after animation
                (function(r) {
                    setTimeout(function() { if (r.parentNode) r.parentNode.removeChild(r); }, 300);
                })(oldRow);
            }
        }

        // Reorder: append in correct order
        tbody.appendChild(frag);
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

        var dev = devices.find(function(d) { return d.ip === ip; });
        var traffic = trafficData && trafficData.hosts ? trafficData.hosts.find(function(h) { return h.ip === ip; }) : null;

        var name = dev ? (dev.name || ip) : ip;
        if (title) title.textContent = name;

        var html = '<div class="cards-grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">';

        if (dev) {
            var isWifi = dev.connection === 'wifi_2g' || dev.connection === 'wifi_5g';
            html += '<div>' +
                '<div class="stat-row"><span class="label">IP</span><span class="value">' + escHtml(dev.ip || '') + '</span></div>' +
                '<div class="stat-row"><span class="label">MAC</span><span class="value text-mono">' + escHtml(dev.mac || '') + '</span></div>';
            if (isWifi) {
                html += '<div class="stat-row"><span class="label">Signal</span><span class="value">' + _signalBarsHtml(dev.rssi) + '</span></div>';
                if (dev.wifi_mode) html += '<div class="stat-row"><span class="label">WiFi</span><span class="value">' + escHtml(dev.wifi_mode + ' ' + _bandLabel(dev.channel)) + '</span></div>';
                if (dev.channel) html += '<div class="stat-row"><span class="label">Channel</span><span class="value">' + dev.channel + '</span></div>';
                if (dev.bandwidth) html += '<div class="stat-row"><span class="label">Bandwidth</span><span class="value">' + dev.bandwidth + ' MHz</span></div>';
                if (dev.max_speed) html += '<div class="stat-row"><span class="label">Max Speed</span><span class="value">' + dev.max_speed + ' Mbps</span></div>';
            }
            if (dev.connected_time > 0) {
                var ct = dev.connected_time;
                var ctStr = ct < 60 ? ct + 's' : ct < 3600 ? Math.floor(ct / 60) + 'm' : Math.floor(ct / 3600) + 'h ' + Math.floor((ct % 3600) / 60) + 'm';
                html += '<div class="stat-row"><span class="label">Connected</span><span class="value">' + ctStr + '</span></div>';
            }
            html += '<div style="display:flex;gap:8px;margin-top:0.5rem">' +
                    '<button class="toggle-btn" ' + actionAttr('renameClient', [dev.mac || '', name]) + '>' + icon('ic-settings') + ' Rename</button>' +
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

    function _renameClient(mac, currentName) {
        var newName = prompt('Enter new name for device:', currentName);
        if (!newName || newName === currentName) return;
        API.webapi('SetDeviceName', { MacAddress: mac, DeviceName: newName }).then(function() {
            _refreshClients();
        }).catch(function(e) {
            alert('Failed to rename: ' + (e.message || e));
        });
    }

    App.registerPage('clients', renderClients);
    App._refreshClients = _refreshClients;
    App._showClientDetail = _showClientDetail;
    App._closeClientDetail = _closeClientDetail;
    App._renameClient = _renameClient;
})();
