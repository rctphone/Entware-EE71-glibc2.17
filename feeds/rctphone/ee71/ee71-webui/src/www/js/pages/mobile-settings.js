;(function() {
    'use strict';
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;

    // --- State ---
    var _atTerm = null;
    var _atTemplates = null;
    var _apnList = [];
    var _editingAPN = null;

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

    var _msPdpType = '3'; // cached from GetConnectionSettings

    // --- Network tab (from connection.js _loadNetwork) ---

    var _msNetSearchTimer = null;

    function _loadNetwork() {
        var tab = $('#mset-tab-network');
        if (!tab) return;
        tab.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';

        Promise.all([
            API.webapi('GetConnectionSettings').catch(function() { return null; }),
            API.webapi('GetNetworkInfo').catch(function() { return null; }),
            API.webapi('GetConnectionState').catch(function() { return null; }),
            API.webapi('GetUsageSettings').catch(function() { return null; }),
        ]).then(function(results) {
            var connSettings = results[0], netInfo = results[1], connSt = results[2], usage = results[3];
            var cs = connSettings || {};
            var us = usage || {};

            var currentMode = cs.NetselectionMode || cs.NetworkMode || 'auto';
            var netSelMode = cs.NetselectionMode || '0';
            var connMode = cs.ConnectMode != null ? String(cs.ConnectMode) : '1';
            var roaming = cs.RoamingConnect || '0';
            var idleTime = cs.ConnOffTime || '0';
            var pdpType = String(cs.PdpType != null ? cs.PdpType : '3');
            _msPdpType = pdpType;
            var connected = connSt && (connSt.ConnectionStatus === 2 || connSt.ConnectionStatus === '2');

            tab.innerHTML =
                '<div class="card">' +
                    '<h3>Network Mode</h3>' +
                    '<div class="form-group">' +
                        '<label>Preferred Mode</label>' +
                        '<select id="ms-netmode">' +
                            '<option value="auto"' + (currentMode === 'auto' || currentMode === '0' ? ' selected' : '') + '>Auto (4G/3G/2G)</option>' +
                            '<option value="4g3g"' + (currentMode === '4g3g' || currentMode === '0302' ? ' selected' : '') + '>4G + 3G</option>' +
                            '<option value="4g"' + (currentMode === '4g' || currentMode === '03' ? ' selected' : '') + '>4G Only (LTE)</option>' +
                            '<option value="3g"' + (currentMode === '3g' || currentMode === '02' ? ' selected' : '') + '>3G Only (WCDMA)</option>' +
                            '<option value="2g"' + (currentMode === '2g' || currentMode === '01' ? ' selected' : '') + '>2G Only (GSM)</option>' +
                        '</select>' +
                    '</div>' +
                    '<div class="form-actions">' +
                        '<button ' + actionAttr('msetNetMode') + '>Apply Mode</button>' +
                    '</div>' +
                '</div>' +

                // Operator Selection
                '<div class="card mt-2">' +
                    '<h3>Operator Selection</h3>' +
                    '<div class="form-group">' +
                        '<label><input type="radio" name="ms-netsel" id="ms-netsel-auto" value="0"' + (netSelMode === '0' || netSelMode === 0 ? ' checked' : '') + '> Automatic</label>' +
                        '<label><input type="radio" name="ms-netsel" id="ms-netsel-manual" value="1"' + (netSelMode === '1' || netSelMode === 1 ? ' checked' : '') + '> Manual</label>' +
                    '</div>' +
                    '<div class="form-actions">' +
                        '<button ' + actionAttr('msetSearchNet') + '>Search Networks</button>' +
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
                        '<label>Idle Timeout (min)</label>' +
                        '<input type="number" id="ms-idle" value="' + (parseInt(idleTime, 10) || 0) + '" min="0" max="120">' +
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
                        '<button ' + actionAttr('msetSaveConn') + '>Save</button>' +
                        (connected ?
                            '<button class="btn-outline" ' + actionAttr('msetDisconnect') + '>Disconnect</button>' :
                            '<button class="btn-outline" ' + actionAttr('msetConnect') + '>Connect</button>') +
                    '</div>' +
                '</div>' +

                // Data Plan
                '<div class="card mt-2">' +
                    '<h3>Data Plan</h3>' +
                    '<div class="stat-row"><span class="label">Used</span><span class="value">' +
                        App.formatBytes(us.UsedData || 0) + ' / ' + App.formatBytes((us.MonthlyPlan || 0) * 1048576) +
                    '</span></div>' +
                    '<div class="form-group">' +
                        '<label>Monthly Limit (MB)</label>' +
                        '<input type="number" id="ms-planlimit" value="' + (parseInt(us.MonthlyPlan, 10) || 0) + '" min="0" max="999999">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>Billing Day (1-31)</label>' +
                        '<input type="number" id="ms-billday" value="' + (parseInt(us.BillingDay, 10) || 1) + '" min="1" max="31">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label><input type="checkbox" id="ms-autodisconn"' + (us.AutoDisconnFlag === '1' || us.AutoDisconnFlag === 1 ? ' checked' : '') + '> Auto-disconnect at limit</label>' +
                    '</div>' +
                    '<div class="form-actions">' +
                        '<button ' + actionAttr('msetSavePlan') + '>Save Plan</button>' +
                        '<button class="btn-outline" ' + actionAttr('msetResetCounters') + '>Reset Counters</button>' +
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

    function _msetNetMode() {
        var sel = $('#ms-netmode');
        if (!sel) return;
        var mode = sel.value;
        var modeMap = { 'auto': '0', '4g3g': '0302', '4g': '03', '3g': '02', '2g': '01' };
        API.webapi('SetNetworkSettings', { NetworkMode: modeMap[mode] || '0' }).then(function() {
            alert('Network mode changed. Reconnecting may take 10-30s.');
            setTimeout(_loadNetwork, 3000);
        }).catch(function(e) { alert('Error: ' + e.message); });
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
                html += '</tbody></table><div class="form-actions mt-1"><button class="btn-outline" ' + actionAttr('msetAutoNet') + '>Back to Auto</button></div>';
                el.innerHTML = html;
            }).catch(function() { _msPollNetSearch(attempt + 1); });
        }, 2000);
    }

    function _msetRegNet(networkId) {
        API.webapi('RegisterNetwork', { NetworkID: networkId }).then(function() {
            alert('Registered on network.');
            setTimeout(_loadNetwork, 3000);
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    function _msetAutoNet() {
        API.webapi('SetNetworkSettings', { NetselectionMode: 0 }).then(function() {
            alert('Switched to auto.');
            setTimeout(_loadNetwork, 3000);
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    // Connection settings
    function _msetSaveConn() {
        var pdp = parseInt($('#ms-pdptype').value, 10);
        API.webapi('SetConnectionSettings', {
            ConnectMode: parseInt($('#ms-connmode').value, 10),
            ConnOffTime: parseInt($('#ms-idle').value, 10) || 0,
            RoamingConnect: $('#ms-roaming').checked ? 1 : 0,
            PdpType: isNaN(pdp) ? 3 : pdp
        }).then(function() { alert('Saved.'); }).catch(function(e) { alert('Error: ' + e.message); });
    }

    function _msetConnect() {
        API.webapi('Connect').then(function() {
            alert('Connecting...');
            setTimeout(_loadNetwork, 3000);
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    function _msetDisconnect() {
        API.webapi('DisConnect').then(function() {
            alert('Disconnected.');
            setTimeout(_loadNetwork, 2000);
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    // Data plan
    function _msetSavePlan() {
        API.webapi('SetUsageSettings', {
            MonthlyPlan: $('#ms-planlimit').value || '0',
            BillingDay: $('#ms-billday').value || '1',
            AutoDisconnFlag: $('#ms-autodisconn').checked ? '1' : '0'
        }).then(function() { alert('Saved.'); }).catch(function(e) { alert('Error: ' + e.message); });
    }

    function _msetResetCounters() {
        if (!confirm('Reset data usage counters?')) return;
        API.webapi('SetUsageRecordClear').then(function() {
            alert('Counters reset.');
            setTimeout(_loadNetwork, 1000);
        }).catch(function(e) { alert('Error: ' + e.message); });
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
        if (!el) return;
        el.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';
        _editingAPN = null;

        API.webapi('GetProfileList').then(function(profiles) {
            var list = profiles.ProfileList || profiles || [];
            if (!Array.isArray(list)) list = [];
            _apnList = list;

            var html = '<div class="card"><h3>APN Profiles</h3>';
            if (list.length) {
                html += '<table class="data-table"><thead><tr><th>Name</th><th>APN</th><th>Auth</th><th>Default</th><th></th></tr></thead><tbody>';
                list.forEach(function(p, i) {
                    var isDefault = p.Default === 1 || p.Default === '1' || p.IsDefault === 1 || p.IsDefault === '1';
                    html += '<tr' + (isDefault ? ' class="text-bold"' : '') + '>' +
                        '<td>' + escHtml(p.ProfileName || '') + '</td>' +
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
        var params = {
            ProfileName: ($('#ms-apn-name') || {}).value,
            APN: ($('#ms-apn-apn') || {}).value,
            AuthType: ($('#ms-apn-auth') || {}).value || '0',
            UserName: ($('#ms-apn-user') || {}).value || '',
            Password: ($('#ms-apn-pass') || {}).value || '',
        };
        if (!params.ProfileName || !params.APN) { alert('Name and APN required'); return; }
        var method = _editingAPN !== null ? 'EditProfile' : 'AddNewProfile';
        if (_editingAPN !== null) params.ProfileID = parseInt(_apnList[_editingAPN].ProfileID, 10);
        API.webapi(method, params).then(function() {
            _loadAPNContent();
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    function _msetApnDel(i) {
        if (!confirm('Delete APN profile?')) return;
        var p = _apnList[i];
        var pid = parseInt(p.ProfileID, 10);
        var isDefault = p.Default === 1 || p.Default === '1' || p.IsDefault === 1 || p.IsDefault === '1';
        var doDelete = function() {
            API.webapi('DeleteProfile', { ProfileID: pid }).then(function() {
                _loadAPNContent();
            }).catch(function(e) { alert('Error: ' + e.message); });
        };
        if (isDefault && _apnList.length > 1) {
            // Switch default to another profile first, then delete
            var other = _apnList.find(function(op, oi) { return oi !== i; });
            if (other) {
                API.webapi('SetDefaultProfile', { ProfileID: parseInt(other.ProfileID, 10) }).then(doDelete)
                    .catch(function(e) { alert('Error switching default: ' + e.message); });
                return;
            }
        }
        doDelete();
    }

    function _msetApnDef(i) {
        API.webapi('SetDefaultProfile', { ProfileID: parseInt(_apnList[i].ProfileID, 10) }).then(function() {
            _loadAPNContent();
        }).catch(function(e) { alert('Error: ' + e.message); });
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
                    _atTerm.output('Error: ' + r.error);
                } else {
                    _atTerm.output(escHtml(r.output || '(no response)'));
                }
            }).catch(function(e) {
                _atTerm.output('Error: ' + e.message);
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
                    _atTerm.output('\u26a0 Warning: ' + item.dataset.warn);
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
    App._msetNetMode = _msetNetMode;
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
    App._msetAtClear = _msetAtClear;
    App._msetAtSend = _msetAtSend;
    App._msetAtDrop = _msetAtDrop;
})();
