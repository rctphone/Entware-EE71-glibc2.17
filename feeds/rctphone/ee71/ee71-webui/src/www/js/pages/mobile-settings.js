;(function() {
    'use strict';
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;

    // --- State ---
    var _atTerm = null;
    var _atTemplates = null;
    var _apnList = [];
    var _editingAPN = null;

    function _isEmptyApnValue(value) {
        var raw = value == null ? '' : String(value).trim();
        return !raw || raw.toLowerCase() === 'null';
    }

    function _isBrokenApnProfile(profile) {
        if (!profile) return false;
        return _isEmptyApnValue(profile.ProfileName) || _isEmptyApnValue(profile.APN);
    }

    function _findReplacementApnDefault(excludeIds) {
        return _apnList.find(function(profile) {
            var pid = parseInt(profile.ProfileID, 10);
            return !isNaN(pid) && excludeIds.indexOf(pid) === -1 && !_isBrokenApnProfile(profile);
        }) || null;
    }

    function _deleteBrokenApnProfiles(pending, replacement, skipped) {
        skipped = skipped || 0;
        if (!pending.length) {
            if (skipped) {
                App.showNotification('Skipped ' + skipped +
                    ' default broken profile(s): no valid replacement to make default first.', 'error', 8000);
            } else {
                App.showNotification('Broken APN profiles removed', 'success');
            }
            _loadAPNContent();
            return;
        }
        var current = pending.shift();
        var pid = parseInt(current.ProfileID, 10);
        if (isNaN(pid)) {
            _deleteBrokenApnProfiles(pending, replacement, skipped);
            return;
        }
        var isDefault = current.Default === 1 || current.Default === '1' || current.IsDefault === 1 || current.IsDefault === '1';
        var deleteNow = function() {
            API.webapi('DeleteProfile', { ProfileID: pid }).then(function() {
                _deleteBrokenApnProfiles(pending, replacement, skipped);
            }).catch(function(e) {
                App.showNotification('Delete failed: ' + App.errorText(e), 'error');
            });
        };
        if (isDefault && replacement) {
            API.webapi('SetDefaultProfile', { ProfileID: parseInt(replacement.ProfileID, 10) }).then(deleteNow)
                .catch(function(e) {
                    App.showNotification('Could not switch the default profile: ' + App.errorText(e), 'error');
                });
            return;
        }
        if (isDefault && !replacement) {
            _deleteBrokenApnProfiles(pending, replacement, skipped + 1);
            return;
        }
        deleteNow();
    }

    function renderMobileSettings(container) {
        container.innerHTML =
            '<h2>Settings</h2>' +
            '<div class="tabs" id="mset-tabs">' +
                '<button class="active" data-tab="network">Network</button>' +
                '<button data-tab="apn">APN</button>' +
                '<button data-tab="at">AT Terminal</button>' +
            '</div>' +
            '<div class="tab-content active" id="mset-tab-network"></div>' +
            '<div class="tab-content" id="mset-tab-apn"></div>' +
            '<div class="tab-content" id="mset-tab-at"></div>';

        var _loadedTabs = {};
        var _tabLoaders = {
            network: _loadNetwork,
            apn: _loadAPN,
            at: _loadAT
        };

        function _activateTab(name) {
            $$('#mset-tabs button').forEach(function(b) { b.classList.remove('active'); });
            var btn = document.querySelector('#mset-tabs button[data-tab="' + name + '"]');
            if (btn) btn.classList.add('active');
            $$('#mset-tabs ~ .tab-content').forEach(function(tc) { tc.classList.remove('active'); });
            var target = document.getElementById('mset-tab-' + name);
            if (target) target.classList.add('active');
            if (!_loadedTabs[name] && _tabLoaders[name]) {
                _loadedTabs[name] = true;
                _tabLoaders[name]();
            }
        }

        $$('#mset-tabs button').forEach(function(btn) {
            btn.addEventListener('click', function() {
                _activateTab(btn.dataset.tab);
            });
        });

        _activateTab('network');

        App.setCleanup(function() {
            if (_atTerm) { _atTerm.kill(); _atTerm = null; }
            if (_msNetSearchTimer) { clearTimeout(_msNetSearchTimer); _msNetSearchTimer = null; }
            _atTemplates = null;
            _apnList = [];
            _editingAPN = null;
        });
    }

    // NetworkMode enum, from the EE-specific override the stock SPA applies to
    // this device (build.formatted.js:32211 —  the same block that sets
    // titleName = "4GEE WiFi Mini"). The generic table is
    // [0 auto, 1 2G, 2 3G, 3 4G]; on the EE71 the override cuts it to the two
    // values below, so 2G-only and 3G-only are not offered. The previous option
    // list used strings ('auto', '0302', '03', ...) that match nothing the API
    // returns, which is why a 4G-only device always rendered as "Auto".
    var NETWORK_MODES = [
        ['0', 'Auto'],
        ['3', '4G only (LTE)']
    ];
    var NETWORK_MODE_VALUES = NETWORK_MODES.map(function(m) { return m[0]; });

    var _msPdpType = '3'; // cached from GetConnectionSettings

    // --- Network tab (from connection.js _loadNetwork) ---

    var _msNetSearchTimer = null;

    function _loadNetwork() {
        var tab = $('#mset-tab-network');
        if (!tab) return Promise.resolve();
        tab.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';

        return Promise.all([
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
            var pdpType = String(cs.PdpType != null ? cs.PdpType : '3');
            _msPdpType = pdpType;
            var connected = connSt && (connSt.ConnectionStatus === 2 || connSt.ConnectionStatus === '2');

            tab.innerHTML =
                '<div class="card">' +
                    '<h3>Network Mode</h3>' +
                    '<div class="form-group">' +
                        '<label>Preferred Mode</label>' +
                        '<select id="ms-netmode">' +
                            NETWORK_MODES.map(function(m) {
                                return '<option value="' + m[0] + '"' +
                                    (currentMode === m[0] ? ' selected' : '') + '>' + m[1] + '</option>';
                            }).join('') +
                            (NETWORK_MODE_VALUES.indexOf(currentMode) === -1 ?
                                '<option value="' + escHtml(currentMode) + '" selected>Unknown (' + escHtml(currentMode) + ')</option>' : '') +
                        '</select>' +
                    '</div>' +
                '</div>' +

                // Operator Selection
                '<div class="card mt-2">' +
                    '<h3>Operator Selection</h3>' +
                    '<div class="form-group">' +
                        '<label><input type="radio" name="ms-netsel" id="ms-netsel-auto" value="0"' + (netSelMode !== '1' ? ' checked' : '') + '> Automatic</label>' +
                        '<label><input type="radio" name="ms-netsel" id="ms-netsel-manual" value="1"' + (netSelMode === '1' ? ' checked' : '') + '> Manual</label>' +
                    '</div>' +
                    '<div class="form-actions">' +
                        '<button ' + actionAttr('msetSetMode') + ' id="ms-save-netmode">Apply</button>' +
                        '<button class="btn-outline" ' + actionAttr('msetSearchNet') + '>Search Networks</button>' +
                    '</div>' +
                    '<div id="ms-netsearch"></div>' +
                '</div>' +

                // Connection Settings
                '<div class="card mt-2">' +
                    '<h3>Connection</h3>' +
                    '<div class="form-group">' +
                        '<label>Connect Mode</label>' +
                        '<select id="ms-connmode">' +
                            '<option value="1"' + (connMode === '1' || connMode === 1 ? ' selected' : '') + '>Auto</option>' +
                            '<option value="0"' + (connMode === '0' || connMode === 0 ? ' selected' : '') + '>Manual</option>' +
                        '</select>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>IP Type</label>' +
                        '<select id="ms-pdptype">' +
                            '<option value="3"' + (pdpType === '3' || pdpType === 3 ? ' selected' : '') + '>IPv4v6</option>' +
                            '<option value="0"' + (pdpType === '0' || pdpType === 0 ? ' selected' : '') + '>IPv4</option>' +
                            '<option value="2"' + (pdpType === '2' || pdpType === 2 ? ' selected' : '') + '>IPv6</option>' +
                        '</select>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label><input type="checkbox" id="ms-roaming"' + (roaming === '1' || roaming === 1 ? ' checked' : '') + '> Connect while roaming</label>' +
                    '</div>' +
                    '<div class="form-actions">' +
                        '<button ' + actionAttr('msetSaveConn') + ' id="ms-save-conn">Save</button>' +
                        (connected ?
                            '<button class="btn-outline" ' + actionAttr('msetDisconnect') + ' id="ms-disconnect">Disconnect</button>' :
                            '<button class="btn-outline" ' + actionAttr('msetConnect') + ' id="ms-connect">Connect</button>') +
                    '</div>' +
                '</div>' +

                // Data Plan
                '<div class="card mt-2">' +
                    '<h3>Data Plan</h3>' +
                    '<div class="stat-row"><span class="label">Used</span><span class="value">' +
                        App.formatBytes(_usageNum(us.UsedData)) + ' / ' + App.formatBytes(_usageNum(us.MonthlyPlan)) +
                    '</span></div>' +
                    '<div class="form-group">' +
                        '<label>Monthly Limit (MB)</label>' +
                        '<input type="number" id="ms-planlimit" value="' + Math.round(_usageNum(us.MonthlyPlan) / MB) + '" min="0" max="999999">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>Billing Day (1-31)</label>' +
                        '<input type="number" id="ms-billday" value="' + (parseInt(us.BillingDay, 10) || 1) + '" min="1" max="31">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label><input type="checkbox" id="ms-autodisconn"' + (us.AutoDisconnFlag === '1' || us.AutoDisconnFlag === 1 ? ' checked' : '') + '> Auto-disconnect at limit</label>' +
                    '</div>' +
                    '<div class="form-actions">' +
                        '<button ' + actionAttr('msetSavePlan') + ' id="ms-save-plan">Save Plan</button>' +
                        '<button class="btn-outline" ' + actionAttr('msetResetCounters') + ' id="ms-reset-counters">Reset Counters</button>' +
                    '</div>' +
                '</div>' +

                '<div class="card mt-2">' +
                    '<h3>IP Addresses</h3>' +
                    '<div class="stat-row"><span class="label">IPv4</span><span class="value" id="ms-ipv4">' + escHtml((connSt && (connSt.IPv4Adrress || connSt.IPAddress)) || '\u2014') + '</span></div>' +
                    '<div class="stat-row"><span class="label">IPv6</span><span class="value text-mono text-small" id="ms-ipv6">' + escHtml((connSt && connSt.IPv6Adrress) || '\u2014') + '</span></div>' +
                '</div>' +
                '<div class="card mt-2">' +
                    '<h3>Data Counters</h3>' +
                    '<div class="stat-row"><span class="label">Session RX</span><span class="value" id="ms-rx">' + App.formatBytes((connSt && connSt.DlBytes) || 0) + '</span></div>' +
                    '<div class="stat-row"><span class="label">Session TX</span><span class="value" id="ms-tx">' + App.formatBytes((connSt && connSt.UlBytes) || 0) + '</span></div>' +
                    '<div class="stat-row"><span class="label">Duration</span><span class="value" id="ms-dur">' + App.formatUptime((connSt && connSt.ConnectionTime) || 0) + '</span></div>' +
                '</div>';
        }).catch(function() {
            tab.innerHTML = '<div class="card"><p class="text-muted">Failed to load network info</p></div>';
        });
    }

    // Stock sends NetworkMode and NetselectionMode together in one
    // SetNetworkSettings call (build.formatted.js:53087-53094), and follows a
    // switch to manual with a network search. The operator radios previously had
    // no handler at all: NetselectionMode only ever moved as a side effect of
    // "Search Networks" and "Back to Auto".
    function _msetSetMode() {
        var mode = ($('#ms-netmode') || {}).value || '0';
        var sel = '0';
        var radios = document.querySelectorAll('input[name="ms-netsel"]');
        for (var i = 0; i < radios.length; i++) {
            if (radios[i].checked) { sel = radios[i].value; break; }
        }

        App.wrapFormSubmit('#ms-save-netmode', function() {
            return API.webapi('SetNetworkSettings', {
                NetworkMode: parseInt(mode, 10) || 0,
                NetselectionMode: parseInt(sel, 10) || 0
            }).then(function() {
                // Manual selection is only meaningful once a scan has produced a
                // list to pick from, which is what stock does here too.
                if (sel === '1') return _msetSearchNet();
                return _loadNetwork();
            });
        }, { pending: 'Applying\u2026', success: 'Network settings applied' });
    }


    // Operator search
    function _msetSearchNet() {
        var el = $('#ms-netsearch');
        if (!el) return;
        el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Searching (up to 60s)...</div>';
        API.webapi('SetNetworkSettings', { NetselectionMode: 1 }).then(function() {
            return API.webapi('SearchNetwork', { NetworkID: '' });
        }).then(function() {
            _msPollNetSearch(0);
        }).catch(function(e) {
            el.innerHTML = '<p class="text-danger">Search failed: ' + escHtml(e.message) + '</p>';
        });
    }

    function _msPollNetSearch(attempt) {
        if (attempt > 30) {
            var el = $('#ms-netsearch');
            if (el) el.innerHTML = '<p class="text-muted">Search timeout</p>';
            return;
        }
        _msNetSearchTimer = setTimeout(function() {
            API.webapi('SearchNetworkResult').then(function(r) {
                if (!r || (r.SearchState !== 2 && r.SearchState !== '2')) {
                    _msPollNetSearch(attempt + 1);
                    return;
                }
                var list = r.ListNetworkItem || [];
                var el = $('#ms-netsearch');
                if (!el) return;
                if (!list.length) { el.innerHTML = '<p class="text-muted">No operators found</p>'; return; }
                var RAT_MAP = { '0': '2G', '2': '3G', '7': '4G' };
                var STATE_MAP = { '0': 'Unknown', '1': 'Available', '2': 'Current', '3': 'Forbidden' };
                var html = '<table class="data-table mt-1"><thead><tr><th>Operator</th><th>MCC/MNC</th><th>RAT</th><th>State</th><th></th></tr></thead><tbody>';
                list.forEach(function(op) {
                    var rat = RAT_MAP[String(op.Rat)] || String(op.Rat || '');
                    var state = STATE_MAP[String(op.State)] || String(op.State || '');
                    var netId = (op.mcc || '') + (op.mnc || '');
                    html += '<tr><td>' + escHtml(op.NetworkName || op.Name || '') + '</td>' +
                        '<td class="text-mono">' + escHtml(op.mcc || '') + '/' + escHtml(op.mnc || '') + '</td>' +
                        '<td>' + escHtml(rat) + '</td><td>' + escHtml(state) + '</td>' +
                        '<td><button class="btn-small" ' + actionAttr('msetRegNet', [netId]) + '>Register</button></td></tr>';
                });
                html += '</tbody></table><div class="form-actions mt-1"><button class="btn-outline" ' + actionAttr('msetAutoNet') + ' id="ms-auto-net">Back to Auto</button></div>';
                el.innerHTML = html;
            }).catch(function() { _msPollNetSearch(attempt + 1); });
        }, 2000);
    }

    // Several operations only take effect after the modem settles; wait, then
    // reload, so the success toast is not shown before the state is real.
    function _reloadAfter(ms) {
        return new Promise(function(r) { setTimeout(r, ms); }).then(_loadNetwork);
    }

    function _msetRegNet(networkId) {
        App.wrapFormSubmit(null, function() {
            return API.webapi('RegisterNetwork', { NetworkID: networkId })
                .then(function() { return _reloadAfter(3000); });
        }, { key: 'mset-register', success: 'Registered on the network' });
    }

    function _msetAutoNet() {
        App.wrapFormSubmit('#ms-auto-net', function() {
            return API.webapi('SetNetworkSettings', { NetselectionMode: 0 })
                .then(function() { return _reloadAfter(3000); });
        }, { pending: 'Switching\u2026', success: 'Switched to automatic network selection' });
    }

    // Connection settings
    // "IdleTime" is not a parameter this firmware has. The string occurs in no
    // device binary — not core_app, not webs, not config_manager, not any
    // library under /usr/lib — so GetConnectionSettings can never return it and
    // SetConnectionSettings can never store it. The field therefore always
    // displayed 0 whatever was entered, and the stock SPA has no idle-timeout
    // control either. Removed rather than left to lie; add it back only with a
    // firmware that names the parameter.
    function _msetSaveConn() {
        var pdp = parseInt($('#ms-pdptype').value, 10);
        App.wrapFormSubmit('#ms-save-conn', function() {
            return API.webapi('SetConnectionSettings', {
                ConnectMode: parseInt($('#ms-connmode').value, 10),
                    RoamingConnect: $('#ms-roaming').checked ? 1 : 0,
                PdpType: isNaN(pdp) ? 3 : pdp
            });
        }, { success: 'Connection settings saved' });
    }

    function _msetConnect() {
        App.wrapFormSubmit('#ms-connect', function() {
            return API.webapi('Connect').then(function() { return _reloadAfter(3000); });
        }, { pending: 'Connecting\u2026', success: 'Connecting to the mobile network' });
    }

    function _msetDisconnect() {
        App.wrapFormSubmit('#ms-disconnect', function() {
            return API.webapi('DisConnect').then(function() { return _reloadAfter(2000); });
        }, { pending: 'Disconnecting\u2026', success: 'Disconnected from the mobile network' });
    }

    // --- Data plan ---
    //
    // SetUsageSettings is NOT a partial update. json_req_config_file dispatches
    // one request into six separate usage-module setters
    // ({"req":"SetUsageSettings","info":[{22,1},{22,3},{22,7},{22,11},{22,9},
    // {22,13}]}); a setter whose field is absent fails, and one failed setter
    // fails the whole call — which is why sending only the three fields this
    // form owns always came back "070401 Set usage settings failed".
    //
    // Stock therefore posts the record whole, coerced to numbers
    // (build.formatted.js:57240): MonthlyPlan, BillingDay, UsedData,
    // TimeLimitFlag, TimeLimitTimes, UsedTimes, AutoDisconnFlag, Unit. Every
    // one of those names is in core_app's usage parameter table at 0x2ce048
    // (BillingDay id0, Unit id2, TimeLimitTimes id3, TimeLimitFlag id4,
    // AutoDisconnFlag id5, MonthlyPlan id6, UsedTimes id28, UsedData id27), so
    // these are the firmware's own spellings, not the SPA's. Stock's mock also
    // carries UnitWarn/UsedDataWarn — those two strings appear nowhere in
    // core_app, so they are not sent.
    //
    // MonthlyPlan is stored in BYTES (table type 5 = 64-bit) and Unit is only
    // the unit the user typed in: stock multiplies by 1024^1..3 for KB/MB/GB on
    // the way in and divides on the way out. This form's input is MB, so it
    // sends Unit 0 and scales by 1 MiB. Reading it back needs the same scale:
    // the old code put the raw byte count straight into a field labelled MB,
    // and then multiplied that byte count by 1 MiB again for the "Used x / y"
    // line — so the plan was reported 1048576x larger than it is.
    var MB = 1048576;

    // GetUsageSettings returns these as strings on some fields and numbers on
    // others; Number('') is 0 but Number(undefined) is NaN, and a NaN would be
    // serialised as null and fail the setter.
    function _usageNum(v) {
        var n = Number(v);
        return isNaN(n) ? 0 : n;
    }

    function _msetSavePlan() {
        var limitMb = _usageNum(($('#ms-planlimit') || {}).value);
        var billDay = _usageNum(($('#ms-billday') || {}).value) || 1;
        var autoOff = ($('#ms-autodisconn') || {}).checked ? 1 : 0;

        App.wrapFormSubmit('#ms-save-plan', function() {
            // Re-read immediately before writing: UsedData and UsedTimes are
            // live counters that go back out in the same record, and posting
            // the values this page rendered minutes ago would roll them back.
            return API.webapi('GetUsageSettings').then(function(cur) {
                var us = cur || {};
                return API.webapi('SetUsageSettings', {
                    MonthlyPlan: limitMb * MB,
                    Unit: 0,
                    BillingDay: billDay,
                    AutoDisconnFlag: autoOff,
                    UsedData: _usageNum(us.UsedData),
                    UsedTimes: _usageNum(us.UsedTimes),
                    TimeLimitFlag: _usageNum(us.TimeLimitFlag),
                    TimeLimitTimes: _usageNum(us.TimeLimitTimes)
                });
            }).then(_loadNetwork);
        }, { success: 'Data plan saved' });
    }

    function _msetResetCounters() {
        App.confirmDialog(
            'Reset the data usage counters to zero? The recorded history is discarded.',
            function() {
                App.wrapFormSubmit('#ms-reset-counters', function() {
                    return API.webapi('SetUsageRecordClear').then(function() { return _reloadAfter(1000); });
                }, { success: 'Data usage counters reset' });
            }, null,
            { title: 'Reset counters', confirmText: 'Reset', danger: true });
    }

    // --- APN tab (from apn.js) ---

    function _loadAPN() {
        var tab = $('#mset-tab-apn');
        if (!tab) return;
        tab.innerHTML = '<div id="ms-apn-content"><div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div></div>';
        _loadAPNContent();
    }

    function _loadAPNContent() {
        var el = $('#ms-apn-content');
        if (!el) return Promise.resolve();
        el.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';
        _editingAPN = null;

        return API.webapi('GetProfileList').then(function(profiles) {
            var list = profiles.ProfileList || profiles || [];
            if (!Array.isArray(list)) list = [];
            _apnList = list;
            var brokenCount = list.filter(_isBrokenApnProfile).length;

            var html = '<div class="card"><h3>APN Profiles</h3>';
            if (brokenCount > 0) {
                html += '<div class="form-actions mb-1">' +
                    '<button class="btn-outline-danger" ' + actionAttr('msetApnPurgeBroken') + '>Remove Empty/NULL Profiles (' + brokenCount + ')</button>' +
                '</div>';
            }
            if (list.length) {
                html += '<table class="data-table"><thead><tr><th>Name</th><th>APN</th><th>Auth</th><th>Default</th><th></th></tr></thead><tbody>';
                list.forEach(function(p, i) {
                    var isDefault = p.Default === 1 || p.Default === '1' || p.IsDefault === 1 || p.IsDefault === '1';
                    var isBroken = _isBrokenApnProfile(p);
                    html += '<tr' + (isDefault ? ' class="text-bold"' : '') + '>' +
                        '<td>' + escHtml(p.ProfileName || '') + (isBroken ? ' <span class="text-danger">(broken)</span>' : '') + '</td>' +
                        '<td>' + escHtml(p.APN || '') + '</td>' +
                        '<td>' + escHtml(p.AuthType == 0 ? 'None' : p.AuthType == 1 ? 'PAP' : p.AuthType == 2 ? 'CHAP' : String(p.AuthType || '')) + '</td>' +
                        '<td>' + (isDefault ? 'Yes' : '') + '</td>' +
                        '<td>' +
                            '<button class="btn-small" ' + actionAttr('msetApnEdit', [i]) + '>Edit</button> ' +
                            (!isDefault ? '<button class="btn-small" ' + actionAttr('msetApnDef', [i]) + '>Set Default</button> ' : '') +
                            (!isDefault ? '<button class="btn-small btn-danger" ' + actionAttr('msetApnDel', [i]) + '>Del</button>' : '') +
                        '</td></tr>';
                });
                html += '</tbody></table>';
            } else {
                html += '<p class="text-muted">No profiles found</p>';
            }
            html += '<details class="mt-2" id="ms-apn-form"><summary>Add Profile</summary>' +
                '<div class="form-row mt-1">' +
                    '<div class="form-group"><label>Profile Name</label><input type="text" id="ms-apn-name" placeholder="My APN"></div>' +
                    '<div class="form-group"><label>APN</label><input type="text" id="ms-apn-apn" placeholder="internet"></div>' +
                '</div>' +
                '<div class="form-row">' +
                    '<div class="form-group"><label>Auth Type</label>' +
                        '<select id="ms-apn-auth"><option value="0">None</option><option value="1">PAP</option><option value="2">CHAP</option></select>' +
                    '</div>' +
                    '<div class="form-group"><label>Username</label><input type="text" id="ms-apn-user" placeholder=""></div>' +
                    '<div class="form-group"><label>Password</label><input type="text" id="ms-apn-pass" placeholder=""></div>' +
                '</div>' +
                '<div class="form-actions">' +
                    '<button id="ms-apn-submit" ' + actionAttr('msetApnSave') + '>Add Profile</button>' +
                    '<button class="btn-small" id="ms-apn-cancel" style="display:none" ' + actionAttr('msetApnCancel') + '>Cancel</button>' +
                '</div>' +
            '</details></div>';
            el.innerHTML = html;
        }).catch(function() {
            el.innerHTML = '<div class="card"><p class="text-muted">Failed to load APN profiles</p></div>';
        });
    }

    function _msetApnEdit(i) {
        var p = _apnList[i];
        if (!p) return;
        var form = $('#ms-apn-form');
        if (form) form.open = true;
        $('#ms-apn-name').value = p.ProfileName || '';
        $('#ms-apn-apn').value = p.APN || '';
        $('#ms-apn-auth').value = String(p.AuthType || 0);
        $('#ms-apn-user').value = p.UserName || '';
        $('#ms-apn-pass').value = p.Password || '';
        _editingAPN = i;
        var btn = $('#ms-apn-submit');
        if (btn) btn.textContent = 'Update Profile';
        var cancel = $('#ms-apn-cancel');
        if (cancel) cancel.style.display = '';
    }

    function _msetApnCancel() {
        _editingAPN = null;
        var btn = $('#ms-apn-submit');
        if (btn) btn.textContent = 'Add Profile';
        var cancel = $('#ms-apn-cancel');
        if (cancel) cancel.style.display = 'none';
    }

    function _msetApnSave() {
        App.clearFieldErrors('#mset-tab-apn');
        var name = (($('#ms-apn-name') || {}).value || '').trim();
        var apn = (($('#ms-apn-apn') || {}).value || '').trim();
        if (!name) return App.renderFieldError('#ms-apn-name', 'Profile name is required');
        if (!apn) return App.renderFieldError('#ms-apn-apn', 'APN is required');

        var params = {
            ProfileName: name,
            APN: apn,
            AuthType: ($('#ms-apn-auth') || {}).value || '0',
            UserName: ($('#ms-apn-user') || {}).value || '',
            Password: ($('#ms-apn-pass') || {}).value || '',
        };
        var editing = _editingAPN !== null;
        var method = editing ? 'EditProfile' : 'AddNewProfile';
        if (editing) params.ProfileID = parseInt(_apnList[_editingAPN].ProfileID, 10);

        App.wrapFormSubmit('#ms-apn-submit', function() {
            return API.webapi(method, params).then(_loadAPNContent);
        }, { success: editing ? 'Profile updated' : 'Profile added' });
    }

    function _msetApnDel(i) {
        var p = _apnList[i];
        if (!p) return;
        var pid = parseInt(p.ProfileID, 10);
        var isDefault = p.Default === 1 || p.Default === '1' || p.IsDefault === 1 || p.IsDefault === '1';
        var replacement = null;

        if (isDefault && _apnList.length > 1) {
            replacement = _findReplacementApnDefault([pid]);
            if (!replacement) {
                App.showNotification(
                    'Cannot delete the default profile: no valid replacement to make default first.', 'error');
                return;
            }
        }

        App.confirmDialog(
            'Delete APN profile "' + (p.ProfileName || pid) + '"?' +
                (replacement ? ' "' + (replacement.ProfileName || replacement.ProfileID) + '" becomes the default.' : ''),
            function() {
                App.wrapFormSubmit(null, function() {
                    var chain = replacement
                        ? API.webapi('SetDefaultProfile', { ProfileID: parseInt(replacement.ProfileID, 10) })
                        : Promise.resolve();
                    return chain
                        .then(function() { return API.webapi('DeleteProfile', { ProfileID: pid }); })
                        .then(_loadAPNContent);
                }, { key: 'mset-apn-delete', success: 'Profile deleted' });
            }, null,
            { title: 'Delete APN profile', confirmText: 'Delete', danger: true });
    }

    function _msetApnDef(i) {
        var p = _apnList[i];
        if (!p) return;
        App.wrapFormSubmit(null, function() {
            return API.webapi('SetDefaultProfile', { ProfileID: parseInt(p.ProfileID, 10) })
                .then(_loadAPNContent);
        }, { key: 'mset-apn-default', success: 'Default profile set to "' + (p.ProfileName || p.ProfileID) + '"' });
    }

    function _msetApnPurgeBroken() {
        var broken = _apnList.filter(_isBrokenApnProfile).sort(function(a, b) {
            var aDefault = a && (a.Default === 1 || a.Default === '1' || a.IsDefault === 1 || a.IsDefault === '1');
            var bDefault = b && (b.Default === 1 || b.Default === '1' || b.IsDefault === 1 || b.IsDefault === '1');
            return aDefault === bDefault ? 0 : (aDefault ? 1 : -1);
        });
        if (!broken.length) {
            App.showNotification('No empty/NULL profiles found.', 'info');
            return;
        }
        App.confirmDialog('Delete ' + broken.length + ' empty/NULL APN profiles?', function() {
            var brokenIds = broken.map(function(profile) { return parseInt(profile.ProfileID, 10); })
                .filter(function(pid) { return !isNaN(pid); });
            _deleteBrokenApnProfiles(broken.slice(), _findReplacementApnDefault(brokenIds), 0);
        }, null, { title: 'Remove broken profiles', confirmText: 'Delete', danger: true });
    }

    // --- AT Terminal tab (from at-terminal.js) ---

    function _loadAT() {
        var tab = $('#mset-tab-at');
        if (!tab) return;
        tab.innerHTML =
            '<div class="at-card">' +
                '<div class="at-toolbar">' +
                    '<span class="at-toolbar-title">' + icon('ic-terminal') + ' AT Terminal</span>' +
                    '<button class="btn-icon" ' + actionAttr('msetAtClear') + ' title="Clear output">' + icon('ic-delete') + '</button>' +
                '</div>' +
                '<div id="ms-at-terminal" class="at-terminal">' +
                    '<pre><code class="termino-console"></code></pre>' +
                    '<div class="at-input-row">' +
                        '<div class="at-combo">' +
                            '<textarea class="termino-input" rows="1" wrap="hard" placeholder="Type AT command..."></textarea>' +
                            '<button class="at-combo-btn" ' + actionAttr('msetAtDrop') + ' data-stop tabindex="-1">\u25BC</button>' +
                            '<div class="at-dropdown" id="ms-at-dropdown"></div>' +
                        '</div>' +
                        '<button class="at-send-btn" ' + actionAttr('msetAtSend') + '>Send</button>' +
                    '</div>' +
                '</div>' +
                '<div class="at-footer-note"><svg class="at-warn-icon" viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg> Direct modem access. Write commands may change device behavior.</div>' +
            '</div>';

        var termEl = document.getElementById('ms-at-terminal');
        if (termEl && typeof Termino === 'function') {
            _atTerm = Termino(termEl, null, {
                allow_scroll: true,
                prompt: 'AT> ',
                command_key: 13,
                terminal_killed_placeholder: 'TERMINAL DISABLED',
                terminal_output: '.termino-console',
                terminal_input: '.termino-input',
                disable_terminal_input: false,
            });
            _atLoop();
        }

        _loadATTemplates();
    }

    function _atLoop() {
        if (!_atTerm) return;
        _atTerm.input('').then(function(cmd) {
            if (!cmd || !cmd.trim()) { _atLoop(); return; }
            cmd = cmd.trim();
            if (!/^AT/i.test(cmd)) {
                _atTerm.output('Error: command must start with AT');
                _atLoop();
                return;
            }
            _atTerm.disable_input();
            API.cgiPost('at.cgi', { action: 'send', cmd: cmd }).then(function(r) {
                if (r.error) {
                    // Termino renders output with innerHTML, so escape here too.
                    _atTerm.output('Error: ' + escHtml(r.error));
                } else {
                    _atTerm.output(escHtml(r.output || '(no response)'));
                }
            }).catch(function(e) {
                _atTerm.output('Error: ' + escHtml(App.errorText(e)));
            }).then(function() {
                _atTerm.enable_input();
                _atLoop();
            });
        });
    }

    function _loadATTemplates() {
        API.cgiGet('at.cgi', { action: 'templates' }).then(function(data) {
            _atTemplates = (data && data.templates) || [];
            var dd = $('#ms-at-dropdown');
            if (!dd || !_atTemplates.length) return;

            var cats = {};
            _atTemplates.forEach(function(t) {
                var cat = t.cat || 'other';
                if (!cats[cat]) cats[cat] = [];
                cats[cat].push(t);
            });

            var catNames = { info: 'Info', signal: 'Signal', network: 'Network', status: 'Status', imei: 'IMEI', band: 'Band Lock', mode: 'Mode', ca: 'Carrier Agg', system: 'System' };
            var html = '';
            Object.keys(cats).forEach(function(cat) {
                html += '<div class="at-dd-cat">' + escHtml(catNames[cat] || cat) + '</div>';
                cats[cat].forEach(function(t) {
                    html += '<div class="at-dd-item" data-cmd="' + escHtml(t.cmd) + '"' +
                        (t.warn ? ' data-warn="' + escHtml(t.warn) + '"' : '') + '>' +
                        '<span class="at-dd-cmd">' + escHtml(t.cmd) + '</span>' +
                        '<span class="at-dd-desc">' + escHtml(t.desc) + (t.warn ? ' \u26a0' : '') + '</span>' +
                    '</div>';
                });
            });
            dd.innerHTML = html;

            dd.addEventListener('click', function(e) {
                var item = e.target.closest('.at-dd-item');
                if (!item) return;
                var cmd = item.dataset.cmd;
                if (item.dataset.warn && _atTerm) {
                    _atTerm.output('\u26a0 Warning: ' + escHtml(item.dataset.warn));
                }
                var termInput = document.querySelector('#ms-at-terminal .termino-input');
                if (termInput) { termInput.value = cmd; termInput.focus(); }
                dd.classList.remove('open');
            });
        }).catch(function() {});
    }

    function _msetAtDrop() {
        var dd = $('#ms-at-dropdown');
        if (!dd) return;
        var opening = !dd.classList.contains('open');
        dd.classList.toggle('open');
        if (opening) {
            var _close = function(ev) {
                if (!ev.target.closest('.at-combo')) {
                    dd.classList.remove('open');
                    document.removeEventListener('click', _close);
                }
            };
            setTimeout(function() { document.addEventListener('click', _close); }, 0);
        }
    }

    function _msetAtSend() {
        var termInput = document.querySelector('#ms-at-terminal .termino-input');
        if (!termInput || !termInput.value.trim()) return;
        var evt = new KeyboardEvent('keypress', { keyCode: 13, which: 13, bubbles: true });
        termInput.dispatchEvent(evt);
    }

    function _msetAtClear() {
        if (_atTerm) _atTerm.clear();
    }

    // --- Register ---
    App.registerPage('mobile-settings', renderMobileSettings);
    App._msetSetMode = _msetSetMode;
    App._msetSearchNet = _msetSearchNet;
    App._msetRegNet = _msetRegNet;
    App._msetAutoNet = _msetAutoNet;
    App._msetSaveConn = _msetSaveConn;
    App._msetConnect = _msetConnect;
    App._msetDisconnect = _msetDisconnect;
    App._msetSavePlan = _msetSavePlan;
    App._msetResetCounters = _msetResetCounters;
    App._msetApnEdit = _msetApnEdit;
    App._msetApnCancel = _msetApnCancel;
    App._msetApnSave = _msetApnSave;
    App._msetApnDel = _msetApnDel;
    App._msetApnDef = _msetApnDef;
    App._msetApnPurgeBroken = _msetApnPurgeBroken;
    App._msetAtClear = _msetAtClear;
    App._msetAtSend = _msetAtSend;
    App._msetAtDrop = _msetAtDrop;
})();
