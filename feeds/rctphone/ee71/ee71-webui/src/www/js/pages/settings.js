;(function() {
    'use strict';
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;

    function renderSettings(container) {
        container.innerHTML =
            '<h2>Settings</h2>' +
            '<div class="tabs" id="set-tabs">' +
                '<button class="active" data-tab="system">General</button>' +
                '<button data-tab="admin">Admin</button>' +
                '<button data-tab="sim">SIM</button>' +
                '<button data-tab="power">Power</button>' +
                '<button data-tab="usb">USB</button>' +
            '</div>' +
            '<div class="tab-content active" id="set-tab-system"></div>' +
            '<div class="tab-content" id="set-tab-admin"></div>' +
            '<div class="tab-content" id="set-tab-sim"></div>' +
            '<div class="tab-content" id="set-tab-power"></div>' +
            '<div class="tab-content" id="set-tab-usb"></div>';

        var _loadedTabs = {};
        var _tabLoaders = {
            system: _loadSystem, admin: _loadAdmin,
            sim: _loadSIM, power: _loadPower, usb: _loadUSB
        };

        function _activateTab(name) {
            $$('#set-tabs button').forEach(function(b) { b.classList.remove('active'); });
            var btn = document.querySelector('#set-tabs button[data-tab="' + name + '"]');
            if (btn) btn.classList.add('active');
            $$('#set-tabs ~ .tab-content').forEach(function(tc) { tc.classList.remove('active'); });
            var target = document.getElementById('set-tab-' + name);
            if (target) target.classList.add('active');
            if (!_loadedTabs[name] && _tabLoaders[name]) {
                _loadedTabs[name] = true;
                _tabLoaders[name]();
            }
        }

        $$('#set-tabs button').forEach(function(btn) {
            btn.addEventListener('click', function() {
                _activateTab(btn.dataset.tab);
            });
        });

        _activateTab('system');
    }

    // --- System tab ---
    function _loadSystem() {
        var tab = $('#set-tab-system');
        if (!tab) return;
        tab.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';

        API.webapi('GetSystemInfo').then(function(info) {
            tab.innerHTML =
                '<div class="card">' +
                    '<h3>Device</h3>' +
                    '<div class="form-group">' +
                        '<label>Device Name</label>' +
                        '<input type="text" id="s-devname" value="' + escHtml(info.DeviceName || '') + '" maxlength="32">' +
                    '</div>' +
                    '<div class="stat-row"><span class="label">Firmware</span><span class="value">' + escHtml((info.SwVersion || info.SWversion || info.FWversion || '').replace(/\n/g, '')) + '</span></div>' +
                    '<div class="form-actions">' +
                        '<button ' + actionAttr('setDeviceName') + '>Save Name</button>' +
                    '</div>' +
                '</div>' +
                '<div class="card mt-2">' +
                    '<h3>Actions</h3>' +
                    '<div class="form-row">' +
                        '<button class="btn-warn" ' + actionAttr('setReboot') + '>Reboot Device</button>' +
                        '<button class="btn-danger" ' + actionAttr('setFactoryReset') + '>Factory Reset</button>' +
                    '</div>' +
                '</div>' +
                '<div class="card mt-2">' +
                    '<h3>FOTA Update</h3>' +
                    '<div class="stat-row"><span class="label">Current FW</span><span class="value">' + escHtml((info.SwVersion || info.SWversion || '').replace(/\n/g, '')) + '</span></div>' +
                    '<button ' + actionAttr('setCheckUpdate') + '>Check for Updates</button>' +
                    '<div id="s-fota-result" class="mt-1"></div>' +
                '</div>';
        }).catch(function() {
            tab.innerHTML = '<div class="card"><p class="text-muted">Failed to load system info</p></div>';
        });
    }

    function _setDeviceName() {
        var name = ($('#s-devname') || {}).value;
        if (!name) { alert('Name required'); return; }
        API.webapi('SetDeviceName', { DeviceName: name }).then(function() {
            alert('Device name saved.');
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    function _setReboot() {
        if (!confirm('Reboot the device? This will disconnect all clients.')) return;
        API.webapi('SetDeviceReboot').then(function() {
            alert('Rebooting... Please wait 30-60 seconds.');
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    function _setFactoryReset() {
        if (!confirm('WARNING: Factory reset will erase ALL settings and restore stock firmware defaults. Continue?')) return;
        if (!confirm('Are you sure? This cannot be undone.')) return;
        API.webapi('SetDeviceReset').then(function() {
            alert('Factory reset initiated. Device will restart.');
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    function _setCheckUpdate() {
        var el = $('#s-fota-result');
        if (el) el.textContent = 'Checking...';
        API.webapi('SetCheckNewVersion').then(function() {
            setTimeout(function() {
                API.webapi('GetDeviceUpgradeState').then(function(r) {
                    if (el) el.textContent = 'State: ' + (r.State || r.status || JSON.stringify(r));
                }).catch(function() {
                    if (el) el.textContent = 'No update available';
                });
            }, 3000);
        }).catch(function(e) { if (el) el.textContent = 'Error: ' + e.message; });
    }

    // --- Admin tab ---
    function _loadAdmin() {
        var tab = $('#set-tab-admin');
        if (!tab) return;
        tab.innerHTML =
            '<div class="card">' +
                '<h3>Change Password</h3>' +
                '<div class="form-group">' +
                    '<label>Current Password</label>' +
                    '<div class="pass-field"><input type="password" id="s-pw-old">' +
                    '<button class="pass-eye" ' + actionAttr('togglePassVis', ['s-pw-old']) + ' title="Show password">' + icon('ic-eye-off') + '</button></div>' +
                '</div>' +
                '<div class="form-group">' +
                    '<label>New Password</label>' +
                    '<div class="pass-field"><input type="password" id="s-pw-new">' +
                    '<button class="pass-eye" ' + actionAttr('togglePassVis', ['s-pw-new']) + ' title="Show password">' + icon('ic-eye-off') + '</button></div>' +
                '</div>' +
                '<div class="form-group">' +
                    '<label>Confirm New Password</label>' +
                    '<div class="pass-field"><input type="password" id="s-pw-confirm">' +
                    '<button class="pass-eye" ' + actionAttr('togglePassVis', ['s-pw-confirm']) + ' title="Show password">' + icon('ic-eye-off') + '</button></div>' +
                '</div>' +
                '<div class="form-actions">' +
                    '<button ' + actionAttr('setChangePassword') + '>Change Password</button>' +
                '</div>' +
            '</div>';
    }

    function _setChangePassword() {
        var oldPw = ($('#s-pw-old') || {}).value;
        var newPw = ($('#s-pw-new') || {}).value;
        var confirmPw = ($('#s-pw-confirm') || {}).value;
        if (!oldPw || !newPw) { alert('All fields required'); return; }
        if (newPw !== confirmPw) { alert('Passwords do not match'); return; }
        if (newPw.length < 4) { alert('Password too short (min 4 chars)'); return; }

        // Get salt, hash passwords with PBKDF2-SHA512, XOR-encrypt username
        API.webapi('GetDeviceSt').then(function(st) {
            var salt = st.Salt || '';
            return Promise.all([
                API._pbkdf2Sha512(oldPw, salt),
                API._pbkdf2Sha512(newPw, salt)
            ]).then(function(hashes) {
                return API.webapi('ChangePassword', {
                    UserName: API._xorEncrypt('admin'),
                    CurrPassword: hashes[0],
                    NewPassword: hashes[1]
                });
            });
        }).then(function() {
            alert('Password changed. Please log in again.');
            App.navigate('login');
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    // --- Power tab ---
    function _loadPower() {
        var tab = $('#set-tab-power');
        if (!tab) return;
        tab.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';

        API.cgiGet('power.cgi', { action: 'status' }).then(function(p) {
            tab.innerHTML =
                '<div class="card">' +
                    '<h3>Power Management</h3>' +
                    '<div class="form-group">' +
                        '<label><input type="checkbox" id="s-pwr-autooff"' + (p.auto_off_enable == 1 ? ' checked' : '') + '> Auto power-off when idle</label>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>Auto-off timeout (minutes)</label>' +
                        '<input type="number" id="s-pwr-autooff-time" value="' + Math.round((p.auto_off_time || 1800) / 60) + '" min="1" max="120">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label><input type="checkbox" id="s-pwr-wifioff"' + (p.wifi_off_enable == 1 ? ' checked' : '') + '> WiFi off when no clients</label>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>WiFi-off timeout (minutes)</label>' +
                        '<input type="number" id="s-pwr-wifioff-time" value="' + Math.round((p.wifi_off_time || 600) / 60) + '" min="1" max="120">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label><input type="checkbox" id="s-pwr-led"' + (p.led_off_no_client == 1 ? ' checked' : '') + '> LEDs off when no clients</label>' +
                    '</div>' +
                    '<div class="form-actions">' +
                        '<button ' + actionAttr('setPowerSave') + '>Save</button>' +
                    '</div>' +
                '</div>';
        }).catch(function() {
            tab.innerHTML = '<div class="card"><p class="text-muted">Failed to load power settings</p></div>';
        });
    }

    function _setPowerSave() {
        var params = {
            action: 'save',
            auto_off_enable: $('#s-pwr-autooff').checked ? 1 : 0,
            auto_off_time: (parseInt($('#s-pwr-autooff-time').value) || 30) * 60,
            wifi_off_enable: $('#s-pwr-wifioff').checked ? 1 : 0,
            wifi_off_time: (parseInt($('#s-pwr-wifioff-time').value) || 10) * 60,
            led_off_no_client: $('#s-pwr-led').checked ? 1 : 0,
        };
        API.cgiPost('power.cgi', params).then(function(r) {
            if (r.error) { alert(r.error); return; }
            alert('Power settings saved.');
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    // --- SIM tab ---
    var SIM_STATE_MAP = {
        '0': 'No SIM', '1': 'PIN required', '2': 'PIN verified',
        '3': 'PUK required', '4': 'SIM error', '5': 'Ready',
        '6': 'SIM locked', '255': 'Unknown'
    };

    function _loadSIM() {
        var tab = $('#set-tab-sim');
        if (!tab) return;
        tab.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';

        API.webapi('GetSimStatus').then(function(sim) {
            var simState = String(sim.SIMState || '255');
            var pinState = String(sim.PinState || '0');
            var pinEnabled = pinState === '1';
            var pinRemain = sim.PinRemainingTimes || '3';
            var pukRemain = sim.PukRemainingTimes || '10';
            var stateLabel = SIM_STATE_MAP[simState] || ('State ' + simState);
            var needsPin = simState === '1';
            var needsPuk = simState === '3';

            var html = '<div class="card">' +
                '<h3>SIM Status</h3>' +
                '<div class="stat-row"><span class="label">State</span><span class="value">' + escHtml(stateLabel) + '</span></div>' +
                '<div class="stat-row"><span class="label">PIN Enabled</span><span class="value">' + (pinEnabled ? 'Yes' : 'No') + '</span></div>' +
                '<div class="stat-row"><span class="label">PIN Attempts</span><span class="value">' + escHtml(String(pinRemain)) + '</span></div>' +
                '<div class="stat-row"><span class="label">PUK Attempts</span><span class="value">' + escHtml(String(pukRemain)) + '</span></div>' +
            '</div>';

            // PIN unlock form
            if (needsPin) {
                html += '<div class="card mt-2">' +
                    '<h3>Unlock PIN</h3>' +
                    '<div class="form-group">' +
                        '<label>PIN Code</label>' +
                        '<input type="password" id="s-pin-code" maxlength="8" placeholder="Enter PIN">' +
                    '</div>' +
                    '<div class="form-actions">' +
                        '<button ' + actionAttr('simUnlockPin') + '>Unlock</button>' +
                    '</div>' +
                '</div>';
            }

            // PUK unlock form
            if (needsPuk) {
                html += '<div class="card mt-2">' +
                    '<h3>Unlock PUK</h3>' +
                    '<div class="form-group">' +
                        '<label>PUK Code</label>' +
                        '<input type="password" id="s-puk-code" maxlength="8" placeholder="Enter PUK">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>New PIN</label>' +
                        '<input type="password" id="s-puk-newpin" maxlength="8" placeholder="New PIN">' +
                    '</div>' +
                    '<div class="form-actions">' +
                        '<button ' + actionAttr('simUnlockPuk') + '>Unlock</button>' +
                    '</div>' +
                '</div>';
            }

            // Enable/Disable PIN + Change PIN (only when SIM is ready)
            if (!needsPin && !needsPuk && simState !== '0' && simState !== '4') {
                html += '<div class="card mt-2">' +
                    '<h3>' + (pinEnabled ? 'Disable' : 'Enable') + ' PIN</h3>' +
                    '<div class="form-group">' +
                        '<label>Current PIN</label>' +
                        '<input type="password" id="s-pin-toggle" maxlength="8" placeholder="Enter current PIN">' +
                    '</div>' +
                    '<div class="form-actions">' +
                        '<button ' + actionAttr('simTogglePin', [pinEnabled ? '0' : '1']) + '>' + (pinEnabled ? 'Disable PIN' : 'Enable PIN') + '</button>' +
                    '</div>' +
                '</div>';

                if (pinEnabled) {
                    html += '<div class="card mt-2">' +
                        '<h3>Change PIN</h3>' +
                        '<div class="form-group">' +
                            '<label>Current PIN</label>' +
                            '<input type="password" id="s-pin-old" maxlength="8">' +
                        '</div>' +
                        '<div class="form-group">' +
                            '<label>New PIN</label>' +
                            '<input type="password" id="s-pin-new" maxlength="8">' +
                        '</div>' +
                        '<div class="form-actions">' +
                            '<button ' + actionAttr('simChangePin') + '>Change PIN</button>' +
                        '</div>' +
                    '</div>';
                }
            }

            tab.innerHTML = html;
        }).catch(function() {
            tab.innerHTML = '<div class="card"><p class="text-muted">Failed to load SIM status</p></div>';
        });
    }

    function _simUnlockPin() {
        var pin = ($('#s-pin-code') || {}).value;
        if (!pin) { alert('Enter PIN'); return; }
        API.webapi('UnlockPin', { Pin: pin, State: 1 }).then(function() {
            alert('PIN verified.');
            _loadSIM();
        }).catch(function(e) { alert('Error: ' + e.message); _loadSIM(); });
    }

    function _simUnlockPuk() {
        var puk = ($('#s-puk-code') || {}).value;
        var pin = ($('#s-puk-newpin') || {}).value;
        if (!puk || !pin) { alert('Enter PUK and new PIN'); return; }
        API.webapi('UnlockPuk', { Puk: puk, Pin: pin }).then(function() {
            alert('PUK verified, new PIN set.');
            _loadSIM();
        }).catch(function(e) { alert('Error: ' + e.message); _loadSIM(); });
    }

    function _simTogglePin(newState) {
        var pin = ($('#s-pin-toggle') || {}).value;
        if (!pin) { alert('Enter current PIN'); return; }
        API.webapi('ChangePinState', { Pin: pin, State: parseInt(newState, 10) }).then(function() {
            alert(newState === '1' ? 'PIN enabled.' : 'PIN disabled.');
            _loadSIM();
        }).catch(function(e) { alert('Error: ' + e.message); _loadSIM(); });
    }

    function _simChangePin() {
        var old = ($('#s-pin-old') || {}).value;
        var nw = ($('#s-pin-new') || {}).value;
        if (!old || !nw) { alert('Enter current and new PIN'); return; }
        if (nw.length < 4) { alert('PIN must be at least 4 digits'); return; }
        API.webapi('ChangePinCode', { CurrentPin: old, NewPin: nw }).then(function() {
            alert('PIN changed.');
            _loadSIM();
        }).catch(function(e) { alert('Error: ' + e.message); _loadSIM(); });
    }

    // --- USB tab ---
    var USB_FUNC_MAP = {
        0: 'ADB', 2: 'ECM (QC)', 7: 'DIAG', 9: 'Serial',
        15: 'RNDIS', 16: 'ECM', 18: 'Mass Storage'
    };

    var USB_SYSFS_NAMES = {
        'ffs': 'ADB', 'diag': 'DIAG', 'serial': 'Serial',
        'rndis_qc': 'RNDIS', 'ecm': 'ECM', 'ecm_qc': 'ECM (QC)',
        'mass_storage': 'Mass Storage', 'rmnet': 'RMNET', 'ncm': 'NCM'
    };

    function _humanFuncs(funcs) {
        if (!funcs) return '';
        return funcs.split(',').map(function(f) {
            f = f.trim();
            return USB_SYSFS_NAMES[f] || f;
        }).join(', ');
    }

    // Parse active function IDs from 8 kernel table slots
    function _parseActiveFuncs(slots) {
        var last = -1;
        for (var i = slots.length - 1; i >= 0; i--) {
            if (slots[i] !== 0 && slots[i] < 4294967295) { last = i; break; }
        }
        var active = [];
        for (var i = 0; i <= last; i++) {
            if (slots[i] < 4294967295) active.push(slots[i]);
        }
        return active;
    }

    function _funcLabel(id) { return USB_FUNC_MAP[id] || ('func_' + id); }

    // Network modes (slot 0)
    var USB_NET_MODES = [
        { id: 16, name: 'ECM',      desc: 'Ethernet Control Model (macOS, Linux)' },
        { id: 15, name: 'RNDIS',    desc: 'Remote NDIS (Windows)' },
        { id: 2,  name: 'ECM (QC)', desc: 'Qualcomm ECM variant' },
    ];

    // Function presets (slots 1-7, appended after network mode)
    var USB_PRESETS = [
        { key: 'adb',       label: 'ADB + DIAG + Serial + MS',  funcs: [7, 0, 9, 18] },
        { key: 'adb_only',  label: 'ADB + MS',                   funcs: [0, 18] },
        { key: 'diag_only', label: 'DIAG + MS (QXDM)',           funcs: [7, 18] },
        { key: 'stock',     label: 'Stock (MS only)',             funcs: [18] },
        { key: 'custom',    label: 'Custom...',                   funcs: [] },
    ];

    // Functions available in custom mode (slots 1-7)
    var USB_CUSTOM_FUNCS = [
        { id: 7,  name: 'DIAG',         desc: 'Qualcomm DIAG (QXDM)' },
        { id: 0,  name: 'ADB',          desc: 'Android Debug Bridge' },
        { id: 9,  name: 'Serial',       desc: 'AT command port' },
        { id: 18, name: 'Mass Storage',  desc: 'USB mass storage' },
    ];

    function _detectPreset(extraFuncs) {
        for (var i = 0; i < USB_PRESETS.length; i++) {
            var p = USB_PRESETS[i];
            if (p.key === 'custom') continue;
            if (p.funcs.length !== extraFuncs.length) continue;
            var match = true;
            for (var j = 0; j < p.funcs.length; j++) {
                if (p.funcs[j] !== extraFuncs[j]) { match = false; break; }
            }
            if (match) return p.key;
        }
        return 'custom';
    }

    function _renderKernelEntry(osLabel, entry) {
        var pid = entry.pid;
        var pidHex = ('0000' + pid.toString(16).toUpperCase()).slice(-4);
        var active = _parseActiveFuncs(entry.funcs);
        var funcLabels = active.map(_funcLabel).join(', ');
        var idx = entry.index;

        // Slot 0 = network mode, slots 1+ = extra functions
        var netMode = active.length > 0 ? active[0] : 16;
        var extra = active.slice(1);
        var preset = _detectPreset(extra);

        // Network mode dropdown
        var netHtml = '';
        for (var i = 0; i < USB_NET_MODES.length; i++) {
            var m = USB_NET_MODES[i];
            netHtml += '<option value="' + m.id + '"' + (m.id === netMode ? ' selected' : '') + '>' +
                escHtml(m.name) + ' \u2014 ' + escHtml(m.desc) + '</option>';
        }

        // Preset dropdown
        var presetHtml = '';
        for (var i = 0; i < USB_PRESETS.length; i++) {
            var p = USB_PRESETS[i];
            presetHtml += '<option value="' + p.key + '"' + (preset === p.key ? ' selected' : '') + '>' +
                escHtml(p.label) + '</option>';
        }

        // Custom checkboxes
        var customHtml = '<div id="s-usb-custom-' + idx + '" class="usb-custom-funcs"' +
            (preset !== 'custom' ? ' style="display:none"' : '') + '>';
        for (var i = 0; i < USB_CUSTOM_FUNCS.length; i++) {
            var f = USB_CUSTOM_FUNCS[i];
            var checked = extra.indexOf(f.id) !== -1 ? ' checked' : '';
            customHtml += '<label class="usb-func-check">' +
                '<input type="checkbox" id="s-usb-f' + f.id + '-' + idx + '" value="' + f.id + '"' + checked +
                ' data-onchange="usbSelChange" data-args="[' + idx + ']"> ' +
                escHtml(f.name) + ' <span class="text-muted text-small">' + escHtml(f.desc) + '</span></label>';
        }
        customHtml += '</div>';

        return '<div class="card mt-2">' +
            '<h3>' + escHtml(osLabel) + ' <span class="text-mono text-small text-muted">(entry ' + idx + ')</span></h3>' +
            '<div class="stat-row"><span class="label">Current Functions</span><span class="value text-small">' + escHtml(funcLabels || 'none') + '</span></div>' +
            '<div class="stat-row"><span class="label">Matching PID</span><span class="value text-mono" id="s-usb-pid-' + idx + '">0x' + pidHex + '</span></div>' +
            '<div class="form-group">' +
                '<label>Network Mode</label>' +
                '<select id="s-usb-net-' + idx + '" data-onchange="usbSelChange" data-args="[' + idx + ']">' + netHtml + '</select>' +
            '</div>' +
            '<div class="form-group">' +
                '<label>Functions</label>' +
                '<select id="s-usb-preset-' + idx + '" data-onchange="usbSelChange" data-args="[' + idx + ']">' +
                    presetHtml +
                '</select>' +
            '</div>' +
            customHtml +
            '<div class="form-actions">' +
                '<button ' + actionAttr('setUSBPatch', [idx]) + '>Apply Patch</button>' +
            '</div>' +
        '</div>';
    }

    function _usbPresetChange(idx) {
        var sel = $('#s-usb-preset-' + idx);
        var box = $('#s-usb-custom-' + idx);
        if (!sel || !box) return;
        box.style.display = sel.value === 'custom' ? '' : 'none';
    }

    function _usbSelChange(idx) {
        _usbPresetChange(idx);
        _updateUSBPreview(idx);
    }

    // Store kernel table for PID lookup
    var _ktEntries = null;

    function _findMatchingPID(funcs) {
        if (!_ktEntries) return null;
        for (var i = 0; i < _ktEntries.length; i++) {
            var e = _ktEntries[i];
            var active = _parseActiveFuncs(e.funcs);
            if (active.length !== funcs.length) continue;
            var match = true;
            for (var j = 0; j < active.length; j++) {
                if (active[j] !== funcs[j]) { match = false; break; }
            }
            if (match) return e.pid;
        }
        return null;
    }

    function _updateUSBPreview(idx) {
        var netSel = $('#s-usb-net-' + idx);
        var presetSel = $('#s-usb-preset-' + idx);
        var pidEl = $('#s-usb-pid-' + idx);
        if (!netSel || !presetSel || !pidEl) return;

        var netId = parseInt(netSel.value);
        var preset = presetSel.value;
        var extraIds;

        if (preset === 'custom') {
            extraIds = [];
            for (var i = 0; i < USB_CUSTOM_FUNCS.length; i++) {
                var cb = $('#s-usb-f' + USB_CUSTOM_FUNCS[i].id + '-' + idx);
                if (cb && cb.checked) extraIds.push(USB_CUSTOM_FUNCS[i].id);
            }
        } else {
            for (var i = 0; i < USB_PRESETS.length; i++) {
                if (USB_PRESETS[i].key === preset) { extraIds = USB_PRESETS[i].funcs; break; }
            }
        }
        if (!extraIds) return;

        var allFuncs = [netId].concat(extraIds);
        var matchPID = _findMatchingPID(allFuncs);
        var labels = allFuncs.map(_funcLabel).join(', ');
        if (matchPID) {
            var pidHex = ('0000' + matchPID.toString(16).toUpperCase()).slice(-4);
            pidEl.innerHTML = '0x' + pidHex;
        } else {
            pidEl.innerHTML = 'custom';
        }
    }

    function _loadUSB() {
        var tab = $('#set-tab-usb');
        if (!tab) return;
        tab.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';

        Promise.all([
            API.cgiGet('usbcomp.cgi', { action: 'status' }).catch(function() { return null; }),
            API.cgiGet('usbcomp.cgi', { action: 'kernel_table' }).catch(function() { return null; }),
        ]).then(function(results) {
            var status = results[0] || {};
            var kt = results[1];

            var html = '<div class="card">' +
                '<h3>USB Status</h3>' +
                '<div class="stat-row"><span class="label">Active PID</span><span class="value text-mono">0x' + escHtml(status.pid || '?') + '</span></div>' +
                '<div class="stat-row"><span class="label">Functions</span><span class="value text-small">' + _humanFuncs(status.functions) + '</span></div>' +
                '<div class="stat-row"><span class="label">Enabled</span><span class="value">' + (status.enabled == 1 ? 'Yes' : 'No') + '</span></div>' +
            '</div>';

            var patchableEntries = [];
            if (kt && !kt.error && kt.entries) {
                _ktEntries = kt.entries;
                var macEntry = null, winEntry = null;
                for (var i = 0; i < kt.entries.length; i++) {
                    if (kt.entries[i].index === 14) macEntry = kt.entries[i];
                    if (kt.entries[i].index === 5) winEntry = kt.entries[i];
                }
                if (macEntry) { html += _renderKernelEntry('macOS', macEntry); patchableEntries.push(14); }
                if (winEntry) { html += _renderKernelEntry('Windows / Linux', winEntry); patchableEntries.push(5); }
            } else {
                html += '<div class="card mt-2"><p class="text-muted">Kernel table not available' +
                    (kt && kt.error ? ': ' + escHtml(kt.error) : '') + '</p></div>';
            }

            tab.innerHTML = html;
            // Sync custom div visibility after DOM is set
            for (var i = 0; i < patchableEntries.length; i++) {
                _usbPresetChange(patchableEntries[i]);
            }
        }).catch(function(e) {
            tab.innerHTML = '<div class="card"><p class="text-muted">Failed to load USB info: ' + escHtml(e.message) + '</p></div>';
        });
    }

    function _setUSBPatch(entryIdx) {
        var netSel = $('#s-usb-net-' + entryIdx);
        var presetSel = $('#s-usb-preset-' + entryIdx);
        if (!netSel || !presetSel) return;

        var netId = parseInt(netSel.value);
        var preset = presetSel.value;
        var extraIds, presetLabel;

        if (preset === 'custom') {
            extraIds = [];
            for (var i = 0; i < USB_CUSTOM_FUNCS.length; i++) {
                var cb = $('#s-usb-f' + USB_CUSTOM_FUNCS[i].id + '-' + entryIdx);
                if (cb && cb.checked) extraIds.push(USB_CUSTOM_FUNCS[i].id);
            }
            if (extraIds.length === 0) { alert('Select at least one function.'); return; }
            presetLabel = 'Custom (' + extraIds.map(_funcLabel).join(' + ') + ')';
        } else {
            for (var i = 0; i < USB_PRESETS.length; i++) {
                if (USB_PRESETS[i].key === preset) { extraIds = USB_PRESETS[i].funcs; presetLabel = USB_PRESETS[i].label; break; }
            }
            if (!extraIds) return;
        }

        // Combine: slot 0 = network mode, slots 1+ = extra functions
        var allFuncs = [netId].concat(extraIds);
        var funcsStr = allFuncs.join(',');
        var netName = _funcLabel(netId);
        var label = netName + ' + ' + presetLabel;

        var osName = entryIdx === 14 ? 'macOS' : 'Windows / Linux';
        if (!confirm('Set ' + osName + ' USB mode to ' + label + '?\nTakes effect on next USB reconnect.')) return;

        API.cgiPost('usbcomp.cgi', { action: 'patch_entry', index: entryIdx, funcs: funcsStr }).then(function(r) {
            if (r.error) { alert('Error: ' + r.error); return; }
            _loadUSB();
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    App.registerPage('settings', renderSettings);
    App._setReboot = _setReboot;
    App._setFactoryReset = _setFactoryReset;
    App._setCheckUpdate = _setCheckUpdate;
    App._setDeviceName = _setDeviceName;
    App._setChangePassword = _setChangePassword;
    App._simUnlockPin = _simUnlockPin;
    App._simUnlockPuk = _simUnlockPuk;
    App._simTogglePin = _simTogglePin;
    App._simChangePin = _simChangePin;
    App._setPowerSave = _setPowerSave;
    App._setUSBPatch = _setUSBPatch;
    App._usbPresetChange = _usbPresetChange;
    App._usbSelChange = _usbSelChange;
})();
