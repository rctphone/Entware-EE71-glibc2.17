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
                        '<button ' + actionAttr('setDeviceName') + ' id="s-save-name">Save Name</button>' +
                    '</div>' +
                '</div>' +
                '<div class="card mt-2">' +
                    '<h3>Actions</h3>' +
                    '<div class="form-row">' +
                        '<button class="btn-warn" ' + actionAttr('setReboot') + ' id="s-reboot">Reboot Device</button>' +
                        '<button class="btn-danger" ' + actionAttr('setFactoryReset') + ' id="s-factory">Factory Reset</button>' +
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
        App.clearFieldErrors('#set-tab-system');
        var name = (($('#s-devname') || {}).value || '').trim();
        if (!name) return App.renderFieldError('#s-devname', 'Device name is required');
        App.wrapFormSubmit('#s-save-name', function() {
            return API.webapi('SetDeviceName', { DeviceName: name });
        }, { success: 'Device name saved' });
    }

    function _setReboot() {
        App.confirmDialog(
            'Reboot the device? Every connected client will be disconnected for about a minute.',
            function() {
                App.wrapFormSubmit('#s-reboot', function() {
                    return API.webapi('SetDeviceReboot');
                }, {
                    pending: 'Rebooting\u2026',
                    success: 'Reboot started - the device will be back in 30-60 seconds'
                });
            }, null,
            { title: 'Reboot device', confirmText: 'Reboot', danger: true });
    }

    function _setFactoryReset() {
        App.confirmDialog(
            'A factory reset erases every setting on this device - WiFi names and passwords, APN profiles, ' +
            'firewall and port forwarding rules, VPN configuration and the admin password - and restores the ' +
            'stock firmware defaults.\n\nThis cannot be undone.',
            function() {
                // Second gate, kept deliberately: this is the most destructive
                // action in the UI and a single mis-click should not reach it.
                App.confirmDialog('Erase all settings and restore factory defaults?', function() {
                    App.wrapFormSubmit('#s-factory', function() {
                        return API.webapi('SetDeviceReset');
                    }, {
                        pending: 'Resetting\u2026',
                        success: 'Factory reset started - the device is restarting'
                    });
                }, null, { title: 'Last chance', confirmText: 'Erase everything', danger: true });
            }, null,
            { title: 'Factory reset', confirmText: 'Continue', danger: true });
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
                    '<button ' + actionAttr('setChangePassword') + ' id="s-change-pw">Change Password</button>' +
                '</div>' +
            '</div>';
    }

    function _setChangePassword() {
        var oldPw = ($('#s-pw-old') || {}).value;
        var newPw = ($('#s-pw-new') || {}).value;
        var confirmPw = ($('#s-pw-confirm') || {}).value;
        App.clearFieldErrors('#set-tab-admin');
        if (!oldPw) return App.renderFieldError('#s-pw-old', 'Enter the current password');
        if (!newPw) return App.renderFieldError('#s-pw-new', 'Enter a new password');
        if (newPw.length < 4) return App.renderFieldError('#s-pw-new', 'Password must be at least 4 characters');
        if (newPw !== confirmPw) return App.renderFieldError('#s-pw-confirm', 'The two passwords do not match');

        App.wrapFormSubmit('#s-change-pw', function() {
            // Get salt, hash passwords with PBKDF2-SHA512, XOR-encrypt username
            return API.webapi('GetDeviceSt').then(function(st) {
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
                // The server drops the session when the password changes.
                setTimeout(function() { App.navigate('login'); }, 1500);
            });
        }, { pending: 'Changing\u2026', success: 'Password changed - log in again with the new one' });
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
                    '<p class="text-muted text-small">These are stored directly in the device database. ' +
                        'core_app caches them at startup, so a change takes effect after a reboot.</p>' +
                    '<div class="form-actions">' +
                        '<button ' + actionAttr('setPowerSave') + ' id="s-save-power">Save</button>' +
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
        // power.cgi writes the sqlite rows directly and says so: core_app keeps
        // these values in memory and never re-reads the table, so a save
        // persists but does not apply until core_app restarts. The CGI reports
        // that in `restart_required` and `note` (power.cgi:153-162); showing a
        // bare "saved" here would claim something the CGI explicitly denies.
        // `success: false` suppresses wrapFormSubmit's own toast so the CGI's
        // wording is the one the user sees.
        App.wrapFormSubmit('#s-save-power', function() {
            return API.cgiPost('power.cgi', params).then(function(r) {
                if (r && r.error) throw new Error(r.error);
                var note = (r && r.note) || 'Power settings saved';
                App.showNotification(note, (r && r.restart_required) ? 'info' : 'success',
                    (r && r.restart_required) ? 8000 : undefined);
                return r;
            });
        }, { success: false });
    }

    // --- SIM tab ---
    // Verbatim from the stock SPA's own constant block (build.formatted.js:5628
    // SIM_STATE_*, consumed by the GetSimStatus Response transform at :57101).
    // The map this replaced was invented — it had 5 as Ready, so a perfectly
    // healthy SIM rendered as the fallback "State 7", and 1/2/4/6 were all
    // shifted as well. Values not in this list are firmware states with no
    // stock label; they fall through to "State N" rather than being guessed at.
    var SIM_STATE_MAP = {
        '0': 'No SIM', '1': 'Initializing', '2': 'PIN required',
        '3': 'PUK required', '4': 'SIM locked', '5': 'PUK attempts exhausted',
        '6': 'Invalid SIM', '7': 'Ready', '11': 'Initializing',
        // Not a firmware state — the placeholder this page substitutes when
        // GetSimStatus came back without a SIMState at all.
        '255': 'Unknown'
    };

    function _loadSIM() {
        var tab = $('#set-tab-sim');
        if (!tab) return Promise.resolve();
        tab.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';

        return API.webapi('GetSimStatus').then(function(sim) {
            var simState = String(sim.SIMState != null ? sim.SIMState : '255');
            var pinState = String(sim.PinState != null ? sim.PinState : '');
            // PinState is a two-value flag in this firmware, not a 0/1 boolean:
            // stock reads exactly 2 as "PIN on" and 3 as "PIN off" and leaves
            // its own flag untouched for anything else (build.formatted.js
            // :54030). Testing for '1' matched neither, so the row always read
            // "No" whatever the SIM was doing.
            var pinEnabled = pinState === '2';
            var pinRemain = sim.PinRemainingTimes || '3';
            var pukRemain = sim.PukRemainingTimes || '10';
            var stateLabel = SIM_STATE_MAP[simState] || ('State ' + simState);
            var needsPin = simState === '2';   // SIM_STATE_PIN
            var needsPuk = simState === '3';   // SIM_STATE_PUK
            var simReady = simState === '7';   // SIM_STATE_READY

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
                        '<button ' + actionAttr('simUnlockPin') + ' id="s-pin-unlock">Unlock</button>' +
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
                        '<button ' + actionAttr('simUnlockPuk') + ' id="s-puk-unlock">Unlock</button>' +
                    '</div>' +
                '</div>';
            }

            // Enable/Disable PIN + Change PIN (only when SIM is ready). The old
            // guard listed the states to exclude, which with the corrected enum
            // would have let "PUK attempts exhausted" and "invalid SIM" through;
            // READY is the only state in which these commands can succeed.
            if (simReady) {
                html += '<div class="card mt-2">' +
                    '<h3>' + (pinEnabled ? 'Disable' : 'Enable') + ' PIN</h3>' +
                    '<div class="form-group">' +
                        '<label>Current PIN</label>' +
                        '<input type="password" id="s-pin-toggle" maxlength="8" placeholder="Enter current PIN">' +
                    '</div>' +
                    '<div class="form-actions">' +
                        '<button ' + actionAttr('simTogglePin', [pinEnabled ? '0' : '1']) + ' id="s-pin-toggle-btn">' + (pinEnabled ? 'Disable PIN' : 'Enable PIN') + '</button>' +
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
                            '<button ' + actionAttr('simChangePin') + ' id="s-pin-change">Change PIN</button>' +
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
        App.clearFieldErrors('#set-tab-sim');
        var pin = (($('#s-pin-code') || {}).value || '').trim();
        if (!pin) return App.renderFieldError('#s-pin-code', 'Enter the SIM PIN');
        App.wrapFormSubmit('#s-pin-unlock', function() {
            return API.webapi('UnlockPin', { Pin: pin, State: 1 })
                .then(_loadSIM, function(e) { _loadSIM(); throw e; });
        }, { pending: 'Verifying\u2026', success: 'PIN verified' });
    }

    function _simUnlockPuk() {
        App.clearFieldErrors('#set-tab-sim');
        var puk = (($('#s-puk-code') || {}).value || '').trim();
        var pin = (($('#s-puk-newpin') || {}).value || '').trim();
        if (!puk) return App.renderFieldError('#s-puk-code', 'Enter the PUK from your operator');
        if (!pin) return App.renderFieldError('#s-puk-newpin', 'Choose a new PIN');
        App.wrapFormSubmit('#s-puk-unlock', function() {
            return API.webapi('UnlockPuk', { Puk: puk, Pin: pin })
                .then(_loadSIM, function(e) { _loadSIM(); throw e; });
        }, { pending: 'Verifying\u2026', success: 'PUK verified and the new PIN is set' });
    }

    function _simTogglePin(newState) {
        App.clearFieldErrors('#set-tab-sim');
        var pin = (($('#s-pin-toggle') || {}).value || '').trim();
        if (!pin) return App.renderFieldError('#s-pin-toggle', 'Enter the current PIN');
        App.wrapFormSubmit('#s-pin-toggle-btn', function() {
            return API.webapi('ChangePinState', { Pin: pin, State: parseInt(newState, 10) })
                .then(_loadSIM, function(e) { _loadSIM(); throw e; });
        }, { success: newState === '1' ? 'SIM PIN enabled' : 'SIM PIN disabled' });
    }

    function _simChangePin() {
        App.clearFieldErrors('#set-tab-sim');
        var old = (($('#s-pin-old') || {}).value || '').trim();
        var nw = (($('#s-pin-new') || {}).value || '').trim();
        if (!old) return App.renderFieldError('#s-pin-old', 'Enter the current PIN');
        if (nw.length < 4) return App.renderFieldError('#s-pin-new', 'The new PIN must be at least 4 digits');
        App.wrapFormSubmit('#s-pin-change', function() {
            return API.webapi('ChangePinCode', { CurrentPin: old, NewPin: nw })
                .then(_loadSIM, function(e) { _loadSIM(); throw e; });
        }, { success: 'SIM PIN changed' });
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
        if (!tab) return Promise.resolve();
        tab.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';

        return Promise.all([
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
            if (extraIds.length === 0) {
                App.showNotification('Select at least one USB function.', 'error');
                return;
            }
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
        App.confirmDialog(
            'Set the ' + osName + ' USB mode to ' + label + '?\nThis takes effect on the next USB reconnect.',
            function() {
                App.wrapFormSubmit(null, function() {
                    return API.cgiPost('usbcomp.cgi', {
                        action: 'patch_entry', index: entryIdx, funcs: funcsStr
                    }).then(function(r) {
                        if (r && r.error) throw new Error(r.error);
                        return _loadUSB();
                    });
                }, { key: 'usb-apply-' + entryIdx, success: osName + ' USB mode set to ' + label });
            }, null,
            { title: 'Change USB mode', confirmText: 'Apply' });
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
