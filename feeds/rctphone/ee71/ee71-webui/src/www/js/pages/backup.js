;(function() {
    'use strict';
    var $ = App.$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;

    var _backupData = null;

    function renderBackup(container) {
        container.innerHTML =
            '<h2>Backup &amp; Restore</h2>' +
            '<div class="card">' +
                '<h3>Export Config</h3>' +
                '<p class="text-small">Download all custom settings as JSON file.</p>' +
                '<button ' + actionAttr('backupExport') + '>Export Configuration</button>' +
                '<div id="backup-export-status" class="mt-1"></div>' +
            '</div>' +
            '<div class="card mt-2">' +
                '<h3>Import Config</h3>' +
                '<p class="text-small">Upload a previously exported ee71-config.json file.</p>' +
                '<input type="file" id="backup-import-file" accept=".json">' +
                '<div class="form-actions mt-1">' +
                    '<button ' + actionAttr('backupValidate') + '>Validate</button>' +
                '</div>' +
                '<div id="backup-import-result" class="mt-1"></div>' +
            '</div>';
    }

    function _backupExport() {
        var el = $('#backup-export-status');
        if (el) el.textContent = 'Gathering settings...';
        Promise.all([
            API.webapi('GetWlanSettings').catch(function() { return null; }),
            API.webapi('GetLanSettings').catch(function() { return null; }),
            API.cgiGet('ttl.cgi', { action: 'status' }).catch(function() { return null; }),
            API.cgiGet('wireguard.cgi', { action: 'config' }).catch(function() { return null; }),
            API.cgiGet('shadowsocks.cgi', { action: 'config' }).catch(function() { return null; }),
            API.cgiGet('sms_fwd.cgi', { action: 'config' }).catch(function() { return null; }),
            API.cgiGet('ssh.cgi', { action: 'status' }).catch(function() { return null; }),
            API.cgiGet('ssh.cgi', { action: 'keys' }).catch(function() { return null; }),
            API.cgiGet('usbcomp.cgi', { action: 'status' }).catch(function() { return null; }),
            API.cgiGet('power.cgi', { action: 'status' }).catch(function() { return null; }),
            API.webapi('GetProfileList').catch(function() { return null; }),
            API.webapi('GetConnectionSettings').catch(function() { return null; }),
            API.cgiGet('system.cgi', { action: 'backup-extra' }).catch(function() { return null; }),
        ]).then(function(r) {
            var wifi = r[0], lan = r[1], ttl = r[2], wg = r[3], ss = r[4];
            var sms = r[5], ssh = r[6], sshKeys = r[7], usb = r[8], power = r[9], apn = r[10], conn = r[11], extra = r[12];

            var config = {
                version: 1,
                timestamp: Math.floor(Date.now() / 1000),
            };

            if (wifi) {
                var ap2g = wifi.AP2G || {};
                var ap5g = wifi.AP5G || {};
                config.wifi = {
                    ssid_24: ap2g.Ssid || wifi.WlanSSID || '',
                    password_24: ap2g.WpaKey || wifi.WlanAPPwd || '',
                    channel_24: ap2g.Channel != null ? String(ap2g.Channel) : (wifi.WlanChannel || '0'),
                    mode_24: wifi.WlanMode || '',
                    bandwidth_24: wifi.WlanBandwidth || '',
                    ssid_5g: ap5g.Ssid || wifi.WlanSSID_5G || '',
                    password_5g: ap5g.WpaKey || wifi.WlanAPPwd_5G || '',
                    channel_5g: ap5g.Channel != null ? String(ap5g.Channel) : (wifi.WlanChannel_5G || '0'),
                    mode_5g: wifi.WlanMode_5G || '',
                    bandwidth_5g: wifi.WlanBandwidth_5G || '',
                };
            }

            if (lan) config.network = {
                gateway: lan.IPv4IPAddress || lan.GatewayIP || '',
                subnet: lan.SubnetMask || '',
                dhcp_start: lan.StartIPAddress || lan.DhcpStartIP || '',
                dhcp_end: lan.EndIPAddress || lan.DhcpEndIP || '',
                dhcp_lease: lan.DHCPLeaseTime || lan.DhcpLeaseTime || '',
                hostname: lan.host_name || '',
            };

            if (ttl) config.firewall = { ttl: ttl };
            if (wg && !wg.error) config.wireguard = wg;
            if (ss && ss.server) config.shadowsocks = ss;
            if (sms && !sms.error) config.sms_forward = sms;

            if (ssh) {
                config.ssh = { port: ssh.port || 22 };
                if (sshKeys && sshKeys.length) config.ssh.keys = sshKeys;
            }

            if (usb) config.usb = { pid: usb.pid || '', functions: usb.functions || '' };

            if (power) config.power = {
                auto_off_enable: power.auto_off_enable,
                auto_off_time: power.auto_off_time,
                wifi_off_enable: power.wifi_off_enable,
                wifi_off_time: power.wifi_off_time,
                led_off: power.led_off_no_client,
            };

            var apnList = apn && (apn.ProfileList || apn);
            if (Array.isArray(apnList) && apnList.length) config.apn = apnList;

            if (conn) config.connection = {
                ConnectMode: conn.ConnectMode,
                ConnOffTime: conn.ConnOffTime,
                RoamingConnect: conn.RoamingConnect,
                PdpType: conn.PdpType,
            };

            if (extra) {
                config.system = {};
                if (extra.wlan_mode) config.system.wlan_mode = extra.wlan_mode;
                if (extra.authorized_keys) config.system.authorized_keys = extra.authorized_keys;
                if (extra.hosts) config.system.hosts = extra.hosts;
                if (extra.wg_init) config.system.wg_init = extra.wg_init;
                if (extra.user_apn_profiles && extra.user_apn_profiles.length) config.system.user_apn_profiles = extra.user_apn_profiles;
                if (extra.disabled_inits && extra.disabled_inits.length) config.system.disabled_inits = extra.disabled_inits;
            }

            var blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'ee71-config.json';
            a.click();
            URL.revokeObjectURL(url);
            if (el) el.textContent = 'Exported.';
        }).catch(function(e) {
            if (el) el.textContent = 'Export failed: ' + e.message;
        });
    }

    function _backupValidate() {
        var input = $('#backup-import-file');
        var result = $('#backup-import-result');
        if (!input || !input.files || !input.files[0]) {
            if (result) result.textContent = 'Select a file first';
            return;
        }
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var data = JSON.parse(e.target.result);
                if (data.version !== 1) {
                    if (result) result.textContent = 'Unsupported config version: ' + (data.version || 'none');
                    return;
                }
                var sections = [];
                if (data.wifi) sections.push('wifi');
                if (data.network) sections.push('network');
                if (data.firewall) sections.push('firewall');
                if (data.wireguard) sections.push('wireguard');
                if (data.shadowsocks) sections.push('shadowsocks');
                if (data.sms_forward) sections.push('sms_forward');
                if (data.ssh) sections.push('ssh');
                if (data.usb) sections.push('usb');
                if (data.power) sections.push('power');
                if (data.apn) sections.push('apn');
                if (data.connection) sections.push('connection');
                if (data.system) sections.push('system');
                _backupData = data;
                if (result) result.innerHTML = 'Valid config v1. Sections: ' + escHtml(sections.join(', ') || 'none') +
                    '<br><button class="mt-1" ' + actionAttr('backupImport') + '>Import Now</button>';
            } catch (ex) {
                if (result) result.textContent = 'Invalid JSON file';
            }
        };
        reader.readAsText(input.files[0]);
    }

    function _backupImport() {
        var result = $('#backup-import-result');
        if (!_backupData) {
            if (result) result.textContent = 'Validate a file first';
            return;
        }
        if (!confirm('Import will overwrite current settings. Continue?')) return;
        _doImport(_backupData, result);
    }

    function _doImport(data, el) {
        var tasks = [];
        var applied = [];

        if (data.wifi) {
            var wp = {};
            var ap2g = {};
            if (data.wifi.ssid_24) ap2g.Ssid = data.wifi.ssid_24;
            if (data.wifi.password_24) ap2g.WpaKey = data.wifi.password_24;
            if (data.wifi.channel_24) ap2g.Channel = parseInt(data.wifi.channel_24) || 0;
            var ap5g = {};
            if (data.wifi.ssid_5g) ap5g.Ssid = data.wifi.ssid_5g;
            if (data.wifi.password_5g) ap5g.WpaKey = data.wifi.password_5g;
            if (data.wifi.channel_5g) ap5g.Channel = parseInt(data.wifi.channel_5g) || 0;
            if (Object.keys(ap2g).length) wp.AP2G = ap2g;
            if (Object.keys(ap5g).length) wp.AP5G = ap5g;
            tasks.push(API.webapi('SetWlanSettings', wp).then(function() { applied.push('wifi'); }));
        }

        if (data.network) {
            var np = {};
            if (data.network.gateway) np.IPv4IPAddress = data.network.gateway;
            if (data.network.subnet) np.SubnetMask = data.network.subnet;
            if (data.network.dhcp_start) np.StartIPAddress = data.network.dhcp_start;
            if (data.network.dhcp_end) np.EndIPAddress = data.network.dhcp_end;
            if (data.network.dhcp_lease) np.DHCPLeaseTime = data.network.dhcp_lease;
            tasks.push(API.webapi('SetLanSettings', np).then(function() { applied.push('network'); }));
        }

        if (data.firewall && data.firewall.ttl) {
            var t = data.firewall.ttl;
            tasks.push(API.cgiPost('ttl.cgi', {
                action: 'set', ttl: parseInt(t.value) || 64, iface: t.iface || 'rmnet+',
            }).then(function() {
                applied.push('firewall');
                if (t.active) return API.cgiPost('ttl.cgi', { action: 'enable' });
            }));
        }

        if (data.wireguard && data.wireguard.config) {
            tasks.push(API.cgiPost('wireguard.cgi', {
                action: 'save', config: data.wireguard.config,
            }).then(function() { applied.push('wireguard'); }));
        }

        if (data.shadowsocks && data.shadowsocks.server) {
            tasks.push(API.cgiPost('shadowsocks.cgi', {
                action: 'save',
                server: data.shadowsocks.server,
                server_port: data.shadowsocks.server_port,
                password: data.shadowsocks.password,
                method: data.shadowsocks.method,
            }).then(function() { applied.push('shadowsocks'); }));
        }

        if (data.sms_forward) {
            var sf = data.sms_forward;
            tasks.push(API.cgiPost('sms_fwd.cgi', {
                action: 'save',
                telegram_enabled: sf.telegram_enabled || 0,
                telegram_bot_token: sf.telegram_bot_token || '',
                telegram_chat_id: sf.telegram_chat_id || '',
                phone_enabled: sf.phone_enabled || 0,
                phone_target: sf.phone_target || '',
                poll_interval: sf.poll_interval || 30,
                filter_numbers: sf.filter_numbers || '',
            }).then(function() { applied.push('sms_forward'); }));
        }

        if (data.ssh && data.ssh.port) {
            tasks.push(API.cgiPost('ssh.cgi', {
                action: 'save', port: data.ssh.port,
            }).then(function() { applied.push('ssh'); }));
        }

        if (data.power) {
            tasks.push(API.cgiPost('power.cgi', {
                action: 'save',
                auto_off_enable: data.power.auto_off_enable,
                auto_off_time: data.power.auto_off_time,
                wifi_off_enable: data.power.wifi_off_enable,
                wifi_off_time: data.power.wifi_off_time,
                led_off_no_client: data.power.led_off,
            }).then(function() { applied.push('power'); }));
        }

        if (data.apn && Array.isArray(data.apn)) {
            data.apn.forEach(function(p) {
                if (!p.ProfileName || !p.APN) return;
                var pdp = parseInt(p.PdpType, 10);
                tasks.push(API.webapi('AddNewProfile', {
                    ProfileName: p.ProfileName, APN: p.APN,
                    AuthType: parseInt(p.AuthType, 10) || 0,
                    UserName: p.UserName || p.Username || '',
                    Password: p.Password || '',
                    PdpType: isNaN(pdp) ? 0 : pdp,
                }).then(function() { applied.push('apn'); }));
            });
        }

        if (data.connection) {
            var cp = {};
            if (data.connection.ConnectMode != null) cp.ConnectMode = parseInt(data.connection.ConnectMode, 10);
            if (data.connection.ConnOffTime != null) cp.ConnOffTime = parseInt(data.connection.ConnOffTime, 10);
            if (data.connection.RoamingConnect != null) cp.RoamingConnect = parseInt(data.connection.RoamingConnect, 10);
            if (data.connection.PdpType != null) { var pv = parseInt(data.connection.PdpType, 10); cp.PdpType = isNaN(pv) ? 3 : pv; }
            tasks.push(API.webapi('SetConnectionSettings', cp).then(function() { applied.push('connection'); }));
        }

        if (data.system) {
            // Restore system configs via ssh.cgi (has POST + CSRF)
            var sys = data.system;
            if (sys.authorized_keys) {
                tasks.push(API.cgiPost('ssh.cgi', {
                    action: 'restore-keys', keys: sys.authorized_keys,
                }).then(function() { applied.push('system:ssh_keys'); }).catch(function() {}));
            }
            if (sys.wlan_mode && sys.wlan_mode !== 'AP') {
                // Set WiFi mode via wifi.cgi apply (triggers WlanMode change)
                tasks.push(API.cgiPost('wifi.cgi', {
                    action: 'apply', mode: sys.wlan_mode === 'AP-AP' ? 'dual' : '2g',
                    AP2G: { ApStatus: 1 }, AP5G: { ApStatus: 0 },
                }).then(function() { applied.push('system:wlan_mode'); }).catch(function() {}));
            }
        }

        if (el) el.textContent = 'Importing...';
        Promise.all(tasks.map(function(t) { return t.catch(function(e) { return e; }); })).then(function() {
            _backupData = null;
            if (el) el.textContent = 'Imported: ' + (applied.join(', ') || 'none') + '. Some settings may require restart.';
        });
    }

    App.registerPage('backup', renderBackup);
    App._backupExport = _backupExport;
    App._backupValidate = _backupValidate;
    App._backupImport = _backupImport;
})();
