;(function() {
    'use strict';
    var $ = App.$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;
    var formatBytes = App.formatBytes, formatSpeed = App.formatSpeed, formatUptime = App.formatUptime;

    var _dashTimer = null;
    var _miniChart = null;
    var _speedHistory = { t: [], dl: [], ul: [] };

    function renderDashboard(container) {
        // Battery icon removed — just show percentage + charging indicator

        container.innerHTML =
            '<div class="cards-grid">' +
                '<div class="card" id="dash-connection">' +
                    '<h3>' + icon('ic-mobile') + ' Connection <span class="status-dot" id="d-conn-dot"></span></h3>' +
                    '<div class="stat-row"><span class="label">Operator</span><span class="value" id="d-operator">\u2014</span></div>' +
                    '<div class="stat-row"><span class="label">Technology</span><span class="value" id="d-tech">\u2014</span></div>' +
                    '<div class="stat-row"><span class="label">Signal (RSRP)</span><span class="value" id="d-rsrp">\u2014</span></div>' +
                    '<div class="stat-row"><span class="label">Band</span><span class="value" id="d-band">\u2014</span></div>' +
                    '<div class="stat-row" style="border-bottom:none;padding-bottom:2px"><span class="label">Public IP Address</span></div>' +
                    '<div class="stat-row"><span class="label">IPv4</span><span class="value text-mono" id="d-ip">\u2014</span></div>' +
                    '<div class="stat-row" id="d-ip6-row" style="display:none"><span class="label">IPv6</span><span class="value text-mono" id="d-ip6" style="font-size:0.65rem">\u2014</span></div>' +
                '</div>' +
                '<div class="card" id="dash-speed">' +
                    '<h3>' + icon('ic-traffic') + ' Speed</h3>' +
                    '<div class="speed-pair">' +
                        '<div class="speed-display">' +
                            '<div class="speed-value" id="d-dl-speed">\u2014</div>' +
                            '<div class="speed-unit" id="d-dl-unit"></div>' +
                            '<div class="speed-label">Download</div>' +
                        '</div>' +
                        '<div class="speed-display">' +
                            '<div class="speed-value" id="d-ul-speed">\u2014</div>' +
                            '<div class="speed-unit" id="d-ul-unit"></div>' +
                            '<div class="speed-label">Upload</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="chart-container" id="d-speed-chart" style="min-height:120px"></div>' +
                '</div>' +
                '<div class="card" id="dash-devices">' +
                    '<h3>' + icon('ic-clients') + ' Devices</h3>' +
                    '<div class="stat-row"><span class="label">Connected</span><span class="value" id="d-devcount">\u2014</span></div>' +
                    '<div id="d-devlist" class="mt-1 text-small"></div>' +
                '</div>' +
                '<div class="card" id="dash-usage">' +
                    '<h3>' + icon('ic-traffic') + ' Data Usage</h3>' +
                    '<div class="stat-row">' +
                        '<span class="label">Monthly</span><span class="value" id="d-usage-month">\u2014</span>' +
                        '<div class="progress-thin green" id="d-usage-month-bar"><div class="fill" style="width:0%"></div></div>' +
                    '</div>' +
                    '<div class="stat-row">' +
                        '<span class="label">Today</span><span class="value" id="d-usage-today">\u2014</span>' +
                        '<div class="progress-thin green" id="d-usage-today-bar"><div class="fill" style="width:0%"></div></div>' +
                    '</div>' +
                '</div>' +
                '<div class="card" id="dash-system">' +
                    '<h3>' + icon('ic-settings') + ' System</h3>' +
                    '<div class="stat-row"><span class="label">Uptime</span><span class="value" id="d-uptime">\u2014</span></div>' +
                    '<div class="stat-row">' +
                        '<span class="label">Battery</span>' +
                        '<span class="value" id="d-battery">\u2014</span>' +
                    '</div>' +
                    '<div class="stat-row">' +
                        '<span class="label">Load Avg</span><span class="value" id="d-cpu">\u2014</span>' +
                        '<div class="progress-thin green" id="d-cpu-bar"><div class="fill" style="width:0%"></div></div>' +
                    '</div>' +
                    '<div class="stat-row">' +
                        '<span class="label">Memory</span><span class="value" id="d-memory">\u2014</span>' +
                        '<div class="progress-thin orange" id="d-mem-bar"><div class="fill" style="width:0%"></div></div>' +
                    '</div>' +
                '</div>' +
                '<div class="card" id="dash-toggles">' +
                    '<h3>' + icon('ic-power') + ' Quick Toggles</h3>' +
                    '<div class="quick-toggles">' +
                        '<button class="toggle-btn" id="t-wifi" ' + actionAttr('toggleWifi') + '>' +
                            icon('ic-wifi') + ' WiFi' +
                        '</button>' +
                        '<button class="toggle-btn" id="t-data" ' + actionAttr('toggleData') + '>' +
                            icon('ic-globe') + ' Data' +
                        '</button>' +
                        '<button class="toggle-btn" id="t-vpn" ' + actionAttr('toggleVpn') + '>' +
                            icon('ic-vpn') + ' VPN' +
                        '</button>' +
                    '</div>' +
                '</div>' +
            '</div>';

        refreshDashboard();
        _dashTimer = setInterval(refreshDashboard, 5000);

        App.setCleanup(function() {
            if (_dashTimer) { clearInterval(_dashTimer); _dashTimer = null; }
            if (_miniChart) { _miniChart.destroy(); _miniChart = null; }
            _speedHistory = { t: [], dl: [], ul: [] };
        });
    }

    function refreshDashboard() {
        Promise.all([
            API.webapi('GetNetworkInfo').catch(function() { return null; }),
            API.webapi('GetConnectionState').catch(function() { return null; }),
            API.webapi('GetBatteryState').catch(function() { return null; }),
            API.webapi('GetConnectedDeviceList').catch(function() { return null; }),
            API.webapi('GetUsageRecord').catch(function() { return null; }),
            API.cgiGet('traffic.cgi', { action: 'status' }).catch(function() { return null; }),
            API.cgiGet('system.cgi', { action: 'cpu' }).catch(function() { return null; }),
        ]).then(function(results) {
            var netInfo = results[0], connSt = results[1], batSt = results[2];
            var devList = results[3], usage = results[4], trafficData = results[5], sysInfo = results[6];

            var el = function(id) { return document.getElementById(id); };

            // Connection card
            if (netInfo) {
                var opName = netInfo.NetworkName || netInfo.Domestic || '';
                if (el('d-operator')) el('d-operator').textContent = opName || '\u2014';
                if (el('d-tech')) el('d-tech').textContent = netInfo.NetworkType || '\u2014';
                if (el('d-rsrp')) {
                    var rsrp = netInfo.RSRP;
                    var v = parseInt(rsrp, 10);
                    if (isNaN(v) || v >= -1 || v === 0) {
                        el('d-rsrp').textContent = '\u2014';
                    } else {
                        el('d-rsrp').textContent = rsrp + ' dBm';
                        el('d-rsrp').className = 'value ' + (
                            v >= -80 ? 'text-success' :
                            v >= -100 ? 'text-warn' : 'text-danger'
                        );
                    }
                }
                if (el('d-band')) el('d-band').textContent = netInfo.Band || '\u2014';

                // Connection status dot
                var dot = el('d-conn-dot');
                if (dot) {
                    var hasConn = opName && opName !== 'N/A' && opName !== '\u2014';
                    dot.className = 'status-dot ' + (hasConn ? 'green' : 'red');
                }
            }

            if (connSt) {
                var elIp = el('d-ip');
                if (elIp) elIp.textContent = connSt.IPv4Adrress || connSt.IPAddress || '\u2014';
                var ipv6 = connSt.IPv6Adrress || '';
                var elIp6 = el('d-ip6');
                var elIp6Row = el('d-ip6-row');
                if (elIp6) elIp6.textContent = ipv6 || '\u2014';
                if (elIp6Row) elIp6Row.style.display = ipv6 ? '' : 'none';
            }

            // Speed (from traffic_stats)
            if (trafficData && trafficData.wan) {
                var dl = formatSpeed(trafficData.wan.dl_speed);
                var ul = formatSpeed(trafficData.wan.ul_speed);
                if (el('d-dl-speed')) el('d-dl-speed').textContent = dl.value;
                if (el('d-dl-unit')) el('d-dl-unit').textContent = dl.unit;
                if (el('d-ul-speed')) el('d-ul-speed').textContent = ul.value;
                if (el('d-ul-unit')) el('d-ul-unit').textContent = ul.unit;
            }

            // Devices
            if (devList) {
                var devices = devList.ConnectedList || [];
                if (el('d-devcount')) el('d-devcount').textContent = devices.length;

                var elList = el('d-devlist');
                if (elList) {
                    if (devices.length === 0) {
                        elList.textContent = 'No devices connected';
                    } else {
                        elList.innerHTML = devices.slice(0, 8).map(function(d) {
                            var name = (d.DeviceName || d.HostName || '').toLowerCase();
                            var isPhone = /iphone|ipad|android|galaxy|pixel|xiaomi|redmi|huawei|oneplus|oppo|vivo|samsung|poco|realme/.test(name);
                            var devIcon = isPhone ? 'ic-mobile' : 'ic-computer';
                            var cm = Number(d.ConnectMode);
                            var connIcon = cm === 0 ? 'ic-usb' : 'ic-wifi';
                            return '<div class="device-row">' +
                                icon(devIcon) +
                                '<span class="device-name">' + escHtml(d.DeviceName || d.HostName || d.IPAddress || d.IpAddress || d.MacAddress || '?') + '</span>' +
                                '<span class="device-ip">' + escHtml(d.IpAddress || '') + '</span>' +
                                '<span class="device-signal">' + icon(connIcon) + '</span>' +
                                '</div>';
                        }).join('');
                        if (devices.length > 8) {
                            elList.innerHTML += '<div class="text-muted text-center mt-1">+' + (devices.length - 8) + ' more</div>';
                        }
                    }
                }
            }

            // Usage
            if (usage) {
                if (el('d-usage-month')) el('d-usage-month').textContent = formatBytes(
                    (parseInt(usage.HMonthlyUpload, 10) || 0) + (parseInt(usage.HMonthlyDownload, 10) || 0)
                );
                if (el('d-usage-today')) el('d-usage-today').textContent = formatBytes(
                    (parseInt(usage.HUpload, 10) || 0) + (parseInt(usage.HDownload, 10) || 0)
                );
            }

            // Battery
            if (batSt) {
                var elBat = el('d-battery');
                if (elBat) {
                    var charging = batSt.chg_state === 1 || batSt.BatteryState === 1 || batSt.BatteryState === '1';
                    var batLvl = batSt.BatteryLevel != null ? batSt.BatteryLevel : '?';
                    elBat.innerHTML = batLvl + '%' + (charging ? ' \u26A1' : '');
                }
            }

            // System info (CPU)
            if (sysInfo) {
                if (el('d-cpu') && sysInfo.load1) {
                    el('d-cpu').textContent = sysInfo.load1;
                    var cpuPct = Math.min(Math.round(parseFloat(sysInfo.load1) * 100), 100);
                    var cpuBar = el('d-cpu-bar');
                    if (cpuBar) {
                        cpuBar.querySelector('.fill').style.width = cpuPct + '%';
                    }
                }
            }

            // Memory
            API.cgiGet('system.cgi', { action: 'memory' }).then(function(mem) {
                if (mem && mem.MemTotal && el('d-memory')) {
                    var used = mem.MemTotal - (mem.MemFree || 0) - (mem.Buffers || 0) - (mem.Cached || 0);
                    var memPct = Math.round(used / mem.MemTotal * 100);
                    el('d-memory').textContent = memPct + '%';
                    var memBar = el('d-mem-bar');
                    if (memBar) memBar.querySelector('.fill').style.width = memPct + '%';
                }
            }).catch(function() {});

            // Uptime
            API.cgiGet('system.cgi', { action: 'uptime' }).then(function(u) {
                if (u && u.seconds != null && el('d-uptime')) el('d-uptime').textContent = formatUptime(u.seconds);
            }).catch(function() {});

            // Toggle states
            API.webapi('GetWlanState').then(function(wlanSt) {
                var tWifi = el('t-wifi');
                if (tWifi && wlanSt) tWifi.classList.toggle('on', wlanSt.WlanState === 1 || wlanSt.WlanState === '1');
            }).catch(function() {});

            var tData = el('t-data');
            if (tData && connSt) {
                tData.classList.toggle('on', connSt.ConnectionStatus === 2 || connSt.ConnectionStatus === '2');
            }

            // VPN toggle state
            Promise.all([
                API.cgiGet('wireguard.cgi', { action: 'status' }).catch(function() { return {}; }),
                API.cgiGet('shadowsocks.cgi', { action: 'status' }).catch(function() { return {}; }),
            ]).then(function(vpnRes) {
                var tVpn = el('t-vpn');
                if (tVpn) tVpn.classList.toggle('on', !!(vpnRes[0].up || vpnRes[1].running));
            }).catch(function() {});

            // Mini speed chart
            _updateMiniChart(trafficData);
        }).catch(function() {
            // Dashboard refresh failed
        });
    }

    function _toggleWifi() {
        API.webapi('GetWlanState').then(function(st) {
            var isOn = st && (st.WlanState === 1 || st.WlanState === '1');
            return API.webapi(isOn ? 'SetWlanOff' : 'SetWlanOn');
        }).then(function() {
            setTimeout(refreshDashboard, 1000);
        }).catch(function() {});
    }

    function _toggleData() {
        API.webapi('GetConnectionState').then(function(st) {
            var connected = st && (st.ConnectionStatus === 2 || st.ConnectionStatus === '2');
            return API.webapi(connected ? 'DisConnect' : 'Connect');
        }).then(function() {
            setTimeout(refreshDashboard, 2000);
        }).catch(function() {});
    }

    function _toggleVpn() {
        API.cgiGet('wireguard.cgi', { action: 'status' }).then(function(wg) {
            if (wg.up) return API.cgiPost('wireguard.cgi', { action: 'disable' });
            return API.cgiGet('shadowsocks.cgi', { action: 'status' }).then(function(ss) {
                if (ss.running) return API.cgiPost('shadowsocks.cgi', { action: 'disable' });
                if (wg.has_config) return API.cgiPost('wireguard.cgi', { action: 'enable' });
                App.navigate('vpn');
            });
        }).then(function() {
            setTimeout(refreshDashboard, 1500);
        }).catch(function() {});
    }

    function _updateMiniChart(trafficData) {
        if (!trafficData || !trafficData.wan) return;
        var chartEl = document.getElementById('d-speed-chart');
        if (!chartEl) return;

        var now = Math.floor(Date.now() / 1000);
        _speedHistory.t.push(now);
        _speedHistory.dl.push((trafficData.wan.dl_speed || 0) * 8 / 1000000);
        _speedHistory.ul.push((trafficData.wan.ul_speed || 0) * 8 / 1000000);
        var MAX = 36;
        if (_speedHistory.t.length > MAX) {
            _speedHistory.t = _speedHistory.t.slice(-MAX);
            _speedHistory.dl = _speedHistory.dl.slice(-MAX);
            _speedHistory.ul = _speedHistory.ul.slice(-MAX);
        }
        if (_speedHistory.t.length < 2) return;

        var data = [_speedHistory.t, _speedHistory.dl, _speedHistory.ul];
        if (_miniChart) {
            _miniChart.setData(data);
        } else {
            _miniChart = new uPlot({
                width: chartEl.clientWidth || 300,
                height: 120,
                cursor: { show: false },
                legend: { show: false },
                scales: { x: { time: false }, y: { auto: true, range: [0, null] } },
                axes: [{ show: false }, { show: false }],
                series: [
                    {},
                    { stroke: '#0077cc', fill: 'rgba(0,119,204,0.15)', width: 1.5 },
                    { stroke: '#2e7d32', fill: 'rgba(46,125,50,0.15)', width: 1.5 },
                ],
            }, data, chartEl);
        }
    }

    App.registerPage('dashboard', renderDashboard);
    App.refreshDashboard = refreshDashboard;
    App._toggleWifi = _toggleWifi;
    App._toggleData = _toggleData;
    App._toggleVpn = _toggleVpn;
})();
