;(function() {
    'use strict';
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml;
    var formatBytes = App.formatBytes, actionAttr = App.actionAttr;

    var _fwTab = 'portfwd';
    var _pfRules = [];
    var _ipfRules = [];

    function renderFirewall(container) {
        container.innerHTML =
            '<h2>Firewall</h2>' +
            '<div class="card" id="fw-switches">' +
                '<div class="page-loading"><div class="spinner"></div> Loading...</div>' +
            '</div>' +
            '<div class="tabs" id="fw-tabs">' +
                '<button class="active" data-tab="portfwd">Port Forward</button>' +
                '<button data-tab="ipfilter">IP Filter</button>' +
                '<button data-tab="urlfilter">URL Filter</button>' +
                '<button data-tab="macfilter">MAC Filter</button>' +
                '<button data-tab="rules">iptables</button>' +
            '</div>' +
            '<div class="tab-content active" id="fw-tab-portfwd">' +
                '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>' +
            '</div>' +
            '<div class="tab-content" id="fw-tab-ipfilter">' +
                '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>' +
            '</div>' +
            '<div class="tab-content" id="fw-tab-urlfilter">' +
                '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>' +
            '</div>' +
            '<div class="tab-content" id="fw-tab-macfilter">' +
                '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>' +
            '</div>' +
            '<div class="tab-content" id="fw-tab-rules">' +
                '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>' +
            '</div>';

        $$('#fw-tabs button').forEach(function(btn) {
            btn.addEventListener('click', function() {
                _fwTab = btn.dataset.tab;
                $$('#fw-tabs button').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                $$('#fw-tabs ~ .tab-content').forEach(function(tc) { tc.classList.remove('active'); });
                var target = document.getElementById('fw-tab-' + _fwTab);
                if (target) target.classList.add('active');
                _loadFwTab(_fwTab);
            });
        });

        _loadFwSwitches();
        _loadFwTab('portfwd');
    }

    // --- Feature 8: Firewall Master Switches ---

    function _loadFwSwitches() {
        var el = $('#fw-switches');
        if (!el) return;

        API.webapi('getFirewallSwitch').then(function(data) {
            var fw = data.firewall_status === 1 || data.firewall_status === '1';
            var ipf = data.ipflt_status === 1 || data.ipflt_status === '1';
            var wan = data.wan_ping_status === 1 || data.wan_ping_status === '1';
            var pf = data.port_forward_status === 1 || data.port_forward_status === '1';

            el.innerHTML =
                '<div class="fw-switches-row">' +
                    '<label class="fw-switch-item"><input type="checkbox" id="fw-sw-fw"' + (fw ? ' checked' : '') + '> Firewall</label>' +
                    '<label class="fw-switch-item"><input type="checkbox" id="fw-sw-ipf"' + (ipf ? ' checked' : '') + '> IP Filter</label>' +
                    '<label class="fw-switch-item"><input type="checkbox" id="fw-sw-pf"' + (pf ? ' checked' : '') + '> Port Forward</label>' +
                    '<label class="fw-switch-item"><input type="checkbox" id="fw-sw-wan"' + (wan ? ' checked' : '') + '> WAN Ping</label>' +
                    '<button class="btn-small" ' + actionAttr('fwSaveSwitches') + '>Save</button>' +
                '</div>';
        }).catch(function() {
            el.innerHTML = '';
        });
    }

    function _fwSaveSwitches() {
        API.webapi('setFirewallSwitch', {
            firewall_status: $('#fw-sw-fw').checked ? 1 : 0,
            ipflt_status: $('#fw-sw-ipf').checked ? 1 : 0,
            port_forward_status: $('#fw-sw-pf').checked ? 1 : 0,
            wan_ping_status: $('#fw-sw-wan').checked ? 1 : 0
        }).then(function() {
            alert('Firewall switches saved.');
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    function _loadFwTab(tab) {
        switch (tab) {
            case 'portfwd': return _loadPortFwd();
            case 'ipfilter': return _loadIpFilter();
            case 'urlfilter': return _loadUrlFilter();
            case 'macfilter': return _loadMacFilter();
            case 'rules': return _loadIptables();
        }
    }

    // --- Shared: Rule slide-in panel ---

    function _showRulePanel(title, fieldsHTML, onSave) {
        _hideRulePanel();
        var overlay = document.createElement('div');
        overlay.id = 'rule-panel-overlay';
        overlay.className = 'rule-panel-overlay';
        overlay.innerHTML =
            '<div class="rule-panel" id="rule-panel">' +
                '<h3>' + escHtml(title) + '<button class="close-btn" id="rule-panel-close">\u00d7</button></h3>' +
                '<div id="rule-panel-fields">' + fieldsHTML + '</div>' +
                '<div class="form-actions">' +
                    '<button id="rule-panel-save">Save</button>' +
                    '<button class="btn-outline" id="rule-panel-cancel">Cancel</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) _hideRulePanel();
        });
        document.getElementById('rule-panel-close').addEventListener('click', _hideRulePanel);
        document.getElementById('rule-panel-cancel').addEventListener('click', _hideRulePanel);
        document.getElementById('rule-panel-save').addEventListener('click', function() {
            onSave();
        });
    }

    function _hideRulePanel() {
        var overlay = document.getElementById('rule-panel-overlay');
        if (overlay) overlay.remove();
    }

    // --- Port Forwarding ---

    function _loadPortFwd() {
        var el = $('#fw-tab-portfwd');
        if (!el) return;
        API.webapi('GetPortFwding').then(function(data) {
            var rules = data && data.PortFwdingList ? data.PortFwdingList : [];
            _pfRules = rules;

            var html = '<div class="card">' +
                '<h3>Port Forwarding Rules</h3>' +
                '<div class="action-bar">' +
                    '<button ' + actionAttr('showPFPanel', [-1]) + '>+ Add rule</button>' +
                    (rules.length > 0 ? '<button class="btn-outline-danger" ' + actionAttr('deleteAllPF') + '>Delete all rules</button>' : '') +
                '</div>';

            if (rules.length === 0) {
                html += '<p class="text-muted">No rules configured</p>';
            } else {
                html += '<table class="data-table"><thead><tr>' +
                    '<th></th><th>On</th><th>Proto</th><th>Ext Port</th><th>Int IP</th><th>Int Port</th><th>Name</th><th></th>' +
                    '</tr></thead><tbody>';
                for (var i = 0; i < rules.length; i++) {
                    var r = rules[i];
                    var enabled = r.Enable === '1' || r.Enable === 1;
                    html += '<tr>' +
                        '<td class="drag-handle">\u2807</td>' +
                        '<td><label class="switch"><input type="checkbox"' + (enabled ? ' checked' : '') + ' ' + actionAttr('togglePF', [i]) + '><span class="slider"></span></label></td>' +
                        '<td>' + escHtml(r.Protocol || '') + '</td>' +
                        '<td>' + escHtml(r.WanPort || r.ExternalPort || '') + '</td>' +
                        '<td>' + escHtml(r.LanIP || r.InternalIP || '') + '</td>' +
                        '<td>' + escHtml(r.LanPort || r.InternalPort || '') + '</td>' +
                        '<td>' + escHtml(r.PortFwdingName || '') + '</td>' +
                        '<td>' +
                            '<button class="btn-icon" ' + actionAttr('showPFPanel', [i]) + '>\u270e</button>' +
                            '<button class="btn-icon" ' + actionAttr('delPortFwd', [r.PortFwdingName || String(i)]) + '>' + icon('ic-delete') + '</button>' +
                        '</td></tr>';
                }
                html += '</tbody></table>';
            }
            html += '</div>';
            el.innerHTML = html;
        }).catch(function(e) {
            var msg = e.message || '';
            if (/parse error/i.test(msg) || /not support/i.test(msg)) {
                el.innerHTML = '<div class="card"><h3>Port Forwarding Rules</h3><p class="text-muted">Not supported by this device firmware</p></div>';
            } else {
                el.innerHTML = '<div class="card"><p class="text-danger">Error loading: ' + escHtml(msg) + '</p></div>';
            }
        });
    }

    function _showPFPanel(index) {
        var editing = index >= 0 && _pfRules[index];
        var r = editing ? _pfRules[index] : {};
        var title = editing ? 'Edit Port Forward Rule' : 'Add Port Forward Rule';
        var fields =
            '<div class="float-field"><label>Name</label><input type="text" id="pf-name" value="' + escHtml(r.PortFwdingName || '') + '" placeholder="HTTP"></div>' +
            '<div class="float-field"><label>Protocol</label>' +
                '<select id="pf-proto">' +
                    '<option' + ((r.Protocol || 'TCP') === 'TCP' ? ' selected' : '') + '>TCP</option>' +
                    '<option' + (r.Protocol === 'UDP' ? ' selected' : '') + '>UDP</option>' +
                    '<option' + (r.Protocol === 'TCP+UDP' ? ' selected' : '') + '>TCP+UDP</option>' +
                '</select>' +
            '</div>' +
            '<div class="float-field"><label>External Port</label><input type="text" id="pf-ext" value="' + escHtml(r.WanPort || r.ExternalPort || '') + '" placeholder="8080"></div>' +
            '<div class="float-field"><label>Internal IP</label><input type="text" id="pf-ip" value="' + escHtml(r.LanIP || r.InternalIP || '') + '" placeholder="192.168.1."></div>' +
            '<div class="float-field"><label>Internal Port</label><input type="text" id="pf-int" value="' + escHtml(r.LanPort || r.InternalPort || '') + '" placeholder="80"></div>';

        _showRulePanel(title, fields, function() {
            var params = {
                PortFwdingName: $('#pf-name').value,
                Protocol: $('#pf-proto').value,
                WanPort: $('#pf-ext').value,
                LanIP: $('#pf-ip').value,
                LanPort: $('#pf-int').value,
                Enable: '1',
            };
            if (!params.PortFwdingName || !params.WanPort || !params.LanIP || !params.LanPort) {
                alert('All fields required'); return;
            }
            var doAdd = function() {
                API.webapi('addPortFwding', params).then(function() {
                    _hideRulePanel();
                    _loadPortFwd();
                }).catch(function(e) { alert('Error: ' + e.message); });
            };
            if (editing) {
                API.webapi('deletePortFwding', { PortFwdingName: r.PortFwdingName }).then(doAdd).catch(doAdd);
            } else {
                doAdd();
            }
        });
    }

    function _togglePF(i) {
        var r = _pfRules[i];
        if (!r) return;
        var newEnable = (r.Enable === '1' || r.Enable === 1) ? '0' : '1';
        API.webapi('SetPortFwding', {
            PortFwdingName: r.PortFwdingName,
            Enable: newEnable
        }).then(_loadPortFwd).catch(function(e) { alert('Error: ' + e.message); });
    }

    function _delPortFwd(name) {
        if (!confirm('Delete port forward rule "' + name + '"?')) return;
        API.webapi('deletePortFwding', { PortFwdingName: name }).then(function() {
            _loadPortFwd();
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    function _deleteAllPF() {
        if (!confirm('Delete ALL port forwarding rules?')) return;
        var chain = Promise.resolve();
        _pfRules.forEach(function(r) {
            chain = chain.then(function() {
                return API.webapi('deletePortFwding', { PortFwdingName: r.PortFwdingName });
            });
        });
        chain.then(_loadPortFwd).catch(function(e) { alert('Error: ' + e.message); });
    }

    // --- IP Filter ---

    function _loadIpFilter() {
        var el = $('#fw-tab-ipfilter');
        if (!el) return;
        API.webapi('GetIPFilterList').then(function(data) {
            var rules = data && data.IPFilterList ? data.IPFilterList : [];
            _ipfRules = rules;

            var html = '<div class="card">' +
                '<h3>IP Filter Rules</h3>' +
                '<div class="action-bar">' +
                    '<button ' + actionAttr('showIPFPanel', [-1]) + '>+ Add rule</button>' +
                    (rules.length > 0 ? '<button class="btn-outline-danger" ' + actionAttr('deleteAllIPF') + '>Delete all rules</button>' : '') +
                '</div>';

            if (rules.length === 0) {
                html += '<p class="text-muted">No rules configured</p>';
            } else {
                html += '<table class="data-table"><thead><tr>' +
                    '<th></th><th>#</th><th>Action</th><th>Proto</th><th>Source IP</th><th>Src Port</th><th>Dest IP</th><th>Dst Port</th><th></th>' +
                    '</tr></thead><tbody>';
                for (var i = 0; i < rules.length; i++) {
                    var r = rules[i];
                    html += '<tr>' +
                        '<td class="drag-handle">\u2807</td>' +
                        '<td>' + (i + 1) + '</td>' +
                        '<td>' + escHtml(r.FilterAction || '') + '</td>' +
                        '<td>' + escHtml(r.Protocol || '') + '</td>' +
                        '<td>' + (r.StartIP ? escHtml(r.StartIP) : '<span class="text-muted">Any</span>') + '</td>' +
                        '<td>' + (r.StartPort ? escHtml(r.StartPort) : '<span class="text-muted">Any</span>') + '</td>' +
                        '<td>' + (r.EndIP ? escHtml(r.EndIP) : '<span class="text-muted">Any</span>') + '</td>' +
                        '<td>' + (r.EndPort ? escHtml(r.EndPort) : '<span class="text-muted">Any</span>') + '</td>' +
                        '<td>' +
                            '<button class="btn-icon" ' + actionAttr('showIPFPanel', [i]) + '>\u270e</button>' +
                            '<button class="btn-icon" ' + actionAttr('delIpFilter', [i]) + '>' + icon('ic-delete') + '</button>' +
                        '</td></tr>';
                }
                html += '</tbody></table>';
            }
            html += '</div>';
            el.innerHTML = html;
        }).catch(function(e) {
            var msg = e.message || '';
            if (/parse error/i.test(msg) || /not support/i.test(msg)) {
                el.innerHTML = '<div class="card"><h3>IP Filter Rules</h3><p class="text-muted">Not supported by this device firmware</p></div>';
            } else {
                el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(msg) + '</p></div>';
            }
        });
    }

    function _showIPFPanel(index) {
        var editing = index >= 0 && _ipfRules[index];
        var r = editing ? _ipfRules[index] : {};
        var title = editing ? 'Edit Firewall Rule' : 'Add Firewall Rule';
        var fields =
            '<div class="float-field"><label>Action</label>' +
                '<select id="ipf-action">' +
                    '<option value="Accept"' + ((r.FilterAction || 'Accept') === 'Accept' ? ' selected' : '') + '>Accept</option>' +
                    '<option value="Deny"' + (r.FilterAction === 'Deny' ? ' selected' : '') + '>Deny</option>' +
                '</select>' +
            '</div>' +
            '<div class="float-field"><label>Protocol</label>' +
                '<select id="ipf-proto">' +
                    '<option' + ((r.Protocol || 'TCP') === 'TCP' ? ' selected' : '') + '>TCP</option>' +
                    '<option' + (r.Protocol === 'UDP' ? ' selected' : '') + '>UDP</option>' +
                    '<option' + (r.Protocol === 'TCP+UDP' ? ' selected' : '') + '>TCP+UDP</option>' +
                '</select>' +
            '</div>' +
            '<div class="float-field"><label>Source IP</label><input type="text" id="ipf-sip" value="' + escHtml(r.StartIP || '') + '" placeholder="Any"></div>' +
            '<div class="float-field"><label>Source Port</label><input type="text" id="ipf-sport" value="' + escHtml(r.StartPort || '') + '" placeholder="Any"></div>' +
            '<div class="float-field"><label>Destination IP</label><input type="text" id="ipf-eip" value="' + escHtml(r.EndIP || '') + '" placeholder="Any"></div>' +
            '<div class="float-field"><label>Destination Port</label><input type="text" id="ipf-eport" value="' + escHtml(r.EndPort || '') + '" placeholder="Any"></div>';

        _showRulePanel(title, fields, function() {
            var params = {
                StartIP: $('#ipf-sip').value,
                EndIP: $('#ipf-eip').value,
                StartPort: $('#ipf-sport').value,
                EndPort: $('#ipf-eport').value,
                Protocol: $('#ipf-proto').value,
                FilterAction: $('#ipf-action').value,
            };
            var doAdd = function() {
                API.webapi('addIPFilter', params).then(function() {
                    _hideRulePanel();
                    _loadIpFilter();
                }).catch(function(e) { alert('Error: ' + e.message); });
            };
            if (editing) {
                API.webapi('deleteIPFilter', { Index: String(index) }).then(doAdd).catch(doAdd);
            } else {
                doAdd();
            }
        });
    }

    function _delIpFilter(index) {
        if (!confirm('Delete IP filter rule?')) return;
        API.webapi('deleteIPFilter', { Index: String(index) }).then(function() {
            _loadIpFilter();
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    function _deleteAllIPF() {
        if (!confirm('Delete ALL IP filter rules?')) return;
        var chain = Promise.resolve();
        for (var i = _ipfRules.length - 1; i >= 0; i--) {
            (function(idx) {
                chain = chain.then(function() {
                    return API.webapi('deleteIPFilter', { Index: String(idx) });
                });
            })(i);
        }
        chain.then(_loadIpFilter).catch(function(e) { alert('Error: ' + e.message); });
    }

    // --- MAC Filter (unchanged) ---

    function _loadMacFilter() {
        var tab = $('#fw-tab-macfilter');
        if (!tab) return;

        Promise.all([
            API.webapi('GetMacFilterSettings').catch(function() { return null; }),
            API.webapi('GetMacFilterObjectSettings').catch(function() { return null; }),
        ]).then(function(results) {
            var filterSt = results[0], filterObj = results[1];
            var mode = filterSt ? (filterSt.MacFilterMode || '0') : '0';
            var entries = (filterObj && filterObj.MacFilterList) ? filterObj.MacFilterList : [];

            tab.innerHTML = '<div class="card">' +
                '<h3>MAC Address Filter</h3>' +
                '<div class="form-group">' +
                    '<label>Filter Mode</label>' +
                    '<select id="mf-mode">' +
                        '<option value="0"' + (mode === '0' ? ' selected' : '') + '>Disabled</option>' +
                        '<option value="1"' + (mode === '1' ? ' selected' : '') + '>Whitelist (allow only listed)</option>' +
                        '<option value="2"' + (mode === '2' ? ' selected' : '') + '>Blacklist (block listed)</option>' +
                    '</select>' +
                '</div>' +
                '<div class="form-actions mb-2">' +
                    '<button ' + actionAttr('saveMacFilterMode') + '>Save Mode</button>' +
                '</div>' +
                '<h3>MAC Addresses</h3>' +
                '<div id="mf-list">' +
                    (entries.length === 0 ? '<p class="text-muted">No entries</p>' :
                    '<table class="data-table"><thead><tr><th>MAC Address</th><th>Name</th><th></th></tr></thead><tbody>' +
                    entries.map(function(e, i) {
                        return '<tr><td class="text-mono">' + escHtml(e.MacAddress || '') + '</td>' +
                            '<td>' + escHtml(e.DeviceName || '') + '</td>' +
                            '<td><button class="toggle-btn" ' + actionAttr('delMacFilter', [i]) + '>' + icon('ic-delete') + '</button></td></tr>';
                    }).join('') + '</tbody></table>') +
                '</div>' +
                '<div class="form-row mt-2">' +
                    '<div class="form-group">' +
                        '<label>Add MAC</label>' +
                        '<input type="text" id="mf-mac" placeholder="AA:BB:CC:DD:EE:FF" maxlength="17">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>Name (optional)</label>' +
                        '<input type="text" id="mf-name" placeholder="Device name">' +
                    '</div>' +
                '</div>' +
                '<div class="form-actions">' +
                    '<button ' + actionAttr('addMacFilter') + '>Add</button>' +
                '</div>' +
            '</div>';
        }).catch(function() {});
    }

    function _saveMacFilterMode() {
        var mode = $('#mf-mode').value;
        API.webapi('SetMacFilterSettings', { MacFilterMode: mode }).then(function() {
            _loadMacFilter();
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    function _addMacFilter() {
        var mac = ($('#mf-mac') || {}).value || '';
        var name = ($('#mf-name') || {}).value || '';
        if (!/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(mac)) {
            alert('Invalid MAC format (AA:BB:CC:DD:EE:FF)');
            return;
        }
        API.webapi('SetMacFilterObjectSettings', {
            MacAddress: mac.toUpperCase(),
            DeviceName: name,
            Action: 'add'
        }).then(function() {
            _loadMacFilter();
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    function _delMacFilter(index) {
        if (!confirm('Remove this MAC filter entry?')) return;
        API.webapi('SetMacFilterObjectSettings', {
            Index: String(index),
            Action: 'delete'
        }).then(function() {
            _loadMacFilter();
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    // --- Feature 7: URL Filter ---

    function _loadUrlFilter() {
        var el = $('#fw-tab-urlfilter');
        if (!el) return;

        API.webapi('getUrlFilterSettings').then(function(data) {
            var policy = data.filter_policy || '0';
            var denyList = data.UrlDenyList || [];
            var allowList = data.UrlAllowList || [];
            var activeList = policy === '1' ? allowList : denyList;

            var html = '<div class="card">' +
                '<h3>URL Filter</h3>' +
                '<div class="form-group">' +
                    '<label>Filter Policy</label>' +
                    '<select id="uf-policy">' +
                        '<option value="0"' + (policy === '0' ? ' selected' : '') + '>Block listed URLs</option>' +
                        '<option value="1"' + (policy === '1' ? ' selected' : '') + '>Allow only listed URLs</option>' +
                    '</select>' +
                '</div>';

            if (activeList.length === 0) {
                html += '<p class="text-muted">No URLs configured</p>';
            } else {
                html += '<table class="data-table"><thead><tr><th>URL</th><th></th></tr></thead><tbody>';
                activeList.forEach(function(u, i) {
                    var url = typeof u === 'string' ? u : (u.Url || u.url || '');
                    html += '<tr><td>' + escHtml(url) + '</td>' +
                        '<td><button class="btn-icon" ' + actionAttr('fwDelUrl', [i]) + '>' + icon('ic-delete') + '</button></td></tr>';
                });
                html += '</tbody></table>';
            }

            html += '<div class="form-row mt-2">' +
                    '<div class="form-group" style="flex:1">' +
                        '<input type="text" id="uf-url" placeholder="example.com" maxlength="256">' +
                    '</div>' +
                    '<button ' + actionAttr('fwAddUrl') + '>Add URL</button>' +
                '</div>' +
            '</div>';
            el.innerHTML = html;
        }).catch(function(e) {
            var msg = e.message || '';
            if (/parse error/i.test(msg) || /not support/i.test(msg)) {
                el.innerHTML = '<div class="card"><h3>URL Filter</h3><p class="text-muted">Not supported by this device firmware</p></div>';
            } else {
                el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(msg) + '</p></div>';
            }
        });
    }

    function _fwAddUrl() {
        var inp = $('#uf-url');
        var policy = ($('#uf-policy') || {}).value || '0';
        if (!inp || !inp.value.trim()) { alert('Enter a URL'); return; }

        // Re-fetch current settings, add URL, save
        API.webapi('getUrlFilterSettings').then(function(data) {
            var denyList = data.UrlDenyList || [];
            var allowList = data.UrlAllowList || [];
            var url = inp.value.trim();

            if (policy === '1') {
                allowList.push(url);
            } else {
                denyList.push(url);
            }

            return API.webapi('SetUrlFilterSettings', {
                filter_policy: policy,
                UrlDenyList: denyList,
                UrlAllowList: allowList
            });
        }).then(function() {
            _loadUrlFilter();
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    function _fwDelUrl(index) {
        var policy = ($('#uf-policy') || {}).value || '0';

        API.webapi('getUrlFilterSettings').then(function(data) {
            var denyList = data.UrlDenyList || [];
            var allowList = data.UrlAllowList || [];

            if (policy === '1') {
                allowList.splice(index, 1);
            } else {
                denyList.splice(index, 1);
            }

            return API.webapi('SetUrlFilterSettings', {
                filter_policy: policy,
                UrlDenyList: denyList,
                UrlAllowList: allowList
            });
        }).then(function() {
            _loadUrlFilter();
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    // --- iptables rules view (unchanged) ---

    function _loadIptables() {
        var el = $('#fw-tab-rules');
        if (!el) return;
        API.cgiGet('system.cgi', { action: 'iptables' }).then(function(data) {
            if (!data) {
                el.innerHTML = '<div class="card"><p class="text-muted">No data</p></div>';
                return;
            }

            var tables = data.tables || data;
            var html = '';
            var hasAny = false;
            for (var tableName in tables) {
                if (!tables.hasOwnProperty(tableName)) continue;
                if (tableName === 'error') continue;
                var chains = tables[tableName];
                if (typeof chains !== 'object') continue;
                hasAny = true;
                html += '<div class="card mb-2"><h3>Table: ' + escHtml(tableName) + '</h3>';
                for (var chainName in chains) {
                    if (!chains.hasOwnProperty(chainName)) continue;
                    var chain = chains[chainName];
                    var policy = chain.policy ? ' (policy: ' + escHtml(chain.policy) + ')' : '';
                    html += '<h4 class="text-small mt-1">' + escHtml(chainName) + policy + '</h4>';
                    if (!chain.rules || chain.rules.length === 0) {
                        html += '<p class="text-muted text-small">No rules</p>';
                        continue;
                    }
                    html += '<table class="data-table"><thead><tr>' +
                        '<th>#</th><th>Target</th><th>Proto</th><th>In</th><th>Out</th><th>Src</th><th>Dst</th><th>Extra</th><th>Pkts</th><th>Bytes</th>' +
                        '</tr></thead><tbody>';
                    for (var k = 0; k < chain.rules.length; k++) {
                        var r = chain.rules[k];
                        html += '<tr><td>' + (r.num || '') + '</td>' +
                            '<td><strong>' + escHtml(r.target || '') + '</strong></td>' +
                            '<td>' + escHtml(r.proto || '') + '</td>' +
                            '<td>' + escHtml(r.in || '*') + '</td>' +
                            '<td>' + escHtml(r.out || '*') + '</td>' +
                            '<td>' + escHtml(r.src || '') + '</td>' +
                            '<td>' + escHtml(r.dst || '') + '</td>' +
                            '<td class="text-small">' + escHtml(r.extra || '') + '</td>' +
                            '<td class="text-right">' + escHtml(r.pkts || '') + '</td>' +
                            '<td class="text-right">' + escHtml(r.bytes || '') + '</td></tr>';
                    }
                    html += '</tbody></table>';
                }
                html += '</div>';
            }

            el.innerHTML = (hasAny && html) ? html : '<div class="card"><p class="text-muted">No tables</p></div>';
        }).catch(function(e) { el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(e.message) + '</p></div>'; });
    }

    App.registerPage('firewall', renderFirewall);
    App._fwSaveSwitches = _fwSaveSwitches;
    App._showPFPanel = _showPFPanel;
    App._togglePF = _togglePF;
    App._delPortFwd = _delPortFwd;
    App._deleteAllPF = _deleteAllPF;
    App._showIPFPanel = _showIPFPanel;
    App._delIpFilter = _delIpFilter;
    App._deleteAllIPF = _deleteAllIPF;
    App._fwAddUrl = _fwAddUrl;
    App._fwDelUrl = _fwDelUrl;
    App._saveMacFilterMode = _saveMacFilterMode;
    App._addMacFilter = _addMacFilter;
    App._delMacFilter = _delMacFilter;
})();
