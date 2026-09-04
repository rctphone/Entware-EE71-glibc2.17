;(function() {
    'use strict';
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml;
    var formatBytes = App.formatBytes, actionAttr = App.actionAttr;

    var _fwTab = 'portfwd';
    var _pfRules = [];
    var _ipfBlacklist = [];
    var _ipfAllowlist = [];
    var _ipfRules = [];
    var _ipfPolicy = '0';

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
                    '<button class="btn-small" id="fw-save-switches" ' + actionAttr('fwSaveSwitches') + '>Save</button>' +
                '</div>';
        }).catch(function() {
            el.innerHTML = '';
        });
    }

    function _fwSaveSwitches() {
        App.wrapFormSubmit('#fw-save-switches', function() {
            return API.webapi('setFirewallSwitch', {
                firewall_status: $('#fw-sw-fw').checked ? 1 : 0,
                ipflt_status: $('#fw-sw-ipf').checked ? 1 : 0,
                port_forward_status: $('#fw-sw-pf').checked ? 1 : 0,
                wan_ping_status: $('#fw-sw-wan').checked ? 1 : 0
            });
        }, { success: 'Firewall switches saved' });
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

    function _isIPv4(v) {
        var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v || '');
        if (!m) return false;
        for (var i = 1; i <= 4; i++) if (Number(m[i]) > 255) return false;
        return true;
    }

    function _isPort(v) {
        return /^\d{1,5}$/.test(v || '') && Number(v) >= 1 && Number(v) <= 65535;
    }

    function _pfProtoLabel(value) {
        var raw = String(value == null ? '' : value).toUpperCase();
        if (raw === '6') return 'TCP';
        if (raw === '17') return 'UDP';
        if (raw === '253') return 'TCP+UDP';
        return raw || 'TCP';
    }

    function _pfProtoCode(label) {
        return parseInt(label, 10) || 0;
    }

    function _normalizePortFwdRule(rule, index) {
        return {
            list_id: rule && rule.list_id != null ? String(rule.list_id) : String(index),
            portfwd_name: rule ? (rule.portfwd_name || '') : '',
            fwding_protocol: String(rule && rule.fwding_protocol != null ? rule.fwding_protocol : 6),
            global_port: String(rule && rule.global_port != null ? rule.global_port : ''),
            private_ip: rule ? (rule.private_ip || '') : '',
            private_port: String(rule && rule.private_port != null ? rule.private_port : ''),
            fwding_status: String(rule && rule.fwding_status != null ? rule.fwding_status : 0)
        };
    }

    function _portFwdPayload(rule) {
        return {
            list_id: rule.list_id,
            portfwd_name: rule.portfwd_name,
            private_ip: rule.private_ip,
            private_port: Number(rule.private_port),
            global_port: Number(rule.global_port),
            fwding_protocol: Number(rule.fwding_protocol),
            fwding_status: Number(rule.fwding_status)
        };
    }

    function _normalizeIpFilterRule(rule, index) {
        return {
            list_id: rule && rule.list_id != null ? String(rule.list_id) : String(index),
            lan_ip: rule ? (rule.lan_ip || '') : '',
            lan_port: String(rule && rule.lan_port != null ? rule.lan_port : ''),
            wan_ip: rule ? (rule.wan_ip || '') : '',
            wan_port: String(rule && rule.wan_port != null ? rule.wan_port : ''),
            ip_protocol: String(rule && rule.ip_protocol != null ? rule.ip_protocol : 17),
            ip_status: String(rule && rule.ip_status != null ? rule.ip_status : 1)
        };
    }

    function _serializeIpFilterRule(rule, index) {
        return {
            list_id: rule.list_id != null && rule.list_id !== '' ? String(rule.list_id) : String(index),
            lan_ip: rule.lan_ip,
            lan_port: Number(rule.lan_port),
            wan_ip: rule.wan_ip,
            wan_port: Number(rule.wan_port),
            ip_protocol: Number(rule.ip_protocol),
            ip_status: Number(rule.ip_status)
        };
    }

    function _getActiveIpFilterRules(policy) {
        return String(policy) === '1' ? _ipfBlacklist : _ipfAllowlist;
    }

    function _setActiveIpFilterRules(policy, rules) {
        if (String(policy) === '1') {
            _ipfBlacklist = rules;
        } else {
            _ipfAllowlist = rules;
        }
        _ipfRules = _getActiveIpFilterRules(policy).slice();
    }

    function _savePortFwdRules(rules) {
        return API.webapi('SetPortFwding', {
            portfwd_list: rules.map(_portFwdPayload)
        });
    }

    function _saveIpFilterRules(policy) {
        var rules = _getActiveIpFilterRules(policy);
        return API.webapi('SetIPFilter', {
            filter_policy: parseInt(policy, 10) || 0,
            ipFilter_list: rules.map(_serializeIpFilterRule)
        });
    }

    // --- Port Forwarding ---

    function _loadPortFwd() {
        var el = $('#fw-tab-portfwd');
        if (!el) return Promise.resolve();
        return API.webapi('getPortFwding').then(function(data) {
            var rules = data && data.portfwd_list;
            if (!Array.isArray(rules)) rules = [];
            rules = rules.map(_normalizePortFwdRule);
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
                    var enabled = r.fwding_status === '1';
                    html += '<tr>' +
                        '<td class="drag-handle">\u2807</td>' +
                        '<td><label class="switch"><input type="checkbox"' + (enabled ? ' checked' : '') + ' ' + actionAttr('togglePF', [i]) + '><span class="slider"></span></label></td>' +
                        '<td>' + escHtml(_pfProtoLabel(r.fwding_protocol)) + '</td>' +
                        '<td>' + escHtml(r.global_port || '') + '</td>' +
                        '<td>' + escHtml(r.private_ip || '') + '</td>' +
                        '<td>' + escHtml(r.private_port || '') + '</td>' +
                        '<td>' + escHtml(r.portfwd_name || '') + '</td>' +
                        '<td>' +
                            '<button class="btn-icon" ' + actionAttr('showPFPanel', [i]) + '>\u270e</button>' +
                            '<button class="btn-icon" ' + actionAttr('delPortFwd', [i]) + '>' + icon('ic-delete') + '</button>' +
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
            '<div class="float-field"><label>Name</label><input type="text" id="pf-name" value="' + escHtml(r.portfwd_name || '') + '" placeholder="HTTP"></div>' +
            '<div class="float-field"><label>Protocol</label>' +
                '<select id="pf-proto">' +
                    '<option value="6"' + (String(r.fwding_protocol || '6') === '6' ? ' selected' : '') + '>TCP</option>' +
                    '<option value="17"' + (String(r.fwding_protocol || '') === '17' ? ' selected' : '') + '>UDP</option>' +
                    '<option value="253"' + (String(r.fwding_protocol || '') === '253' ? ' selected' : '') + '>TCP+UDP</option>' +
                '</select>' +
            '</div>' +
            '<div class="float-field"><label>External Port</label><input type="text" id="pf-ext" value="' + escHtml(r.global_port || '') + '" placeholder="8080"></div>' +
            '<div class="float-field"><label>Internal IP</label><input type="text" id="pf-ip" value="' + escHtml(r.private_ip || '') + '" placeholder="192.168.1."></div>' +
            '<div class="float-field"><label>Internal Port</label><input type="text" id="pf-int" value="' + escHtml(r.private_port || '') + '" placeholder="80"></div>';

        _showRulePanel(title, fields, function() {
            App.clearFieldErrors('#rule-panel');

            var rule = {
                list_id: editing ? r.list_id : String(_pfRules.length),
                portfwd_name: ($('#pf-name').value || '').trim(),
                fwding_protocol: $('#pf-proto').value,
                global_port: ($('#pf-ext').value || '').trim(),
                private_ip: ($('#pf-ip').value || '').trim(),
                private_port: ($('#pf-int').value || '').trim(),
                fwding_status: '1'
            };
            if (!rule.portfwd_name) return App.renderFieldError('#pf-name', 'Name is required');
            if (!_isPort(rule.global_port)) return App.renderFieldError('#pf-ext', 'Enter a port between 1 and 65535');
            if (!_isIPv4(rule.private_ip)) return App.renderFieldError('#pf-ip', 'Enter a valid LAN IPv4 address');
            if (!_isPort(rule.private_port)) return App.renderFieldError('#pf-int', 'Enter a port between 1 and 65535');

            var nextRules = _pfRules.slice();
            if (editing) nextRules[index] = rule; else nextRules.push(rule);

            App.wrapFormSubmit('#rule-panel-save', function() {
                return _savePortFwdRules(nextRules).then(function() {
                    _hideRulePanel();
                    return _loadPortFwd();
                });
            }, { success: editing ? 'Rule updated' : 'Rule added' });
        });
    }

    function _togglePF(i) {
        var r = _pfRules[i];
        if (!r) return;
        var enable = r.fwding_status !== '1';
        var nextRules = _pfRules.slice();
        nextRules[i] = Object.assign({}, r, { fwding_status: enable ? '1' : '0' });
        App.wrapFormSubmit(null, function() {
            return _savePortFwdRules(nextRules).then(_loadPortFwd);
        }, {
            key: 'pf-toggle-' + i,
            success: 'Rule "' + (r.portfwd_name || i) + '" ' + (enable ? 'enabled' : 'disabled')
        });
    }

    function _delPortFwd(index) {
        var rule = _pfRules[index];
        var name = rule ? rule.portfwd_name : String(index);
        App.confirmDialog('Delete port forward rule "' + name + '"?', function() {
            var nextRules = _pfRules.slice();
            nextRules.splice(index, 1);
            App.wrapFormSubmit(null, function() {
                return _savePortFwdRules(nextRules).then(_loadPortFwd);
            }, { key: 'pf-del', success: 'Rule deleted' });
        }, null, { title: 'Delete rule', confirmText: 'Delete', danger: true });
    }

    function _deleteAllPF() {
        App.confirmDialog(
            'Delete all ' + _pfRules.length + ' port forwarding rules? This cannot be undone.',
            function() {
                App.wrapFormSubmit(null, function() {
                    return _savePortFwdRules([]).then(_loadPortFwd);
                }, { key: 'pf-del-all', success: 'All port forwarding rules deleted' });
            }, null,
            { title: 'Delete all rules', confirmText: 'Delete all', danger: true });
    }

    // --- IP Filter ---

    function _loadIpFilter() {
        var el = $('#fw-tab-ipfilter');
        if (!el) return Promise.resolve();
        return API.webapi('getIPFilterList').then(function(data) {
            _ipfPolicy = data && data.filter_policy != null ? String(data.filter_policy) : '0';
            var blacklist = data && data.ipFilter_list;
            var allowlist = data && data.ipFilterAllowlist;
            if (!Array.isArray(blacklist)) blacklist = [];
            if (!Array.isArray(allowlist)) allowlist = [];
            _ipfBlacklist = blacklist.map(_normalizeIpFilterRule);
            _ipfAllowlist = allowlist.map(_normalizeIpFilterRule);
            _ipfRules = _getActiveIpFilterRules(_ipfPolicy).slice();
            var rules = _ipfRules;

            var html = '<div class="card">' +
                '<h3>IP Filter Rules</h3>' +
                '<div class="form-group">' +
                    '<label>Filter Mode</label>' +
                    '<select id="ipf-policy">' +
                        '<option value="0"' + (_ipfPolicy === '0' ? ' selected' : '') + '>Disabled</option>' +
                        '<option value="1"' + (_ipfPolicy === '1' ? ' selected' : '') + '>Blacklist</option>' +
                        '<option value="2"' + (_ipfPolicy === '2' ? ' selected' : '') + '>Whitelist</option>' +
                    '</select>' +
                '</div>' +
                '<div class="action-bar">' +
                    '<button ' + actionAttr('showIPFPanel', [-1]) + '>+ Add rule</button>' +
                    '<button class="btn-outline" id="ipf-save-policy" ' + actionAttr('saveIpFilterPolicy') + '>Save Mode</button>' +
                    (rules.length > 0 ? '<button class="btn-outline-danger" ' + actionAttr('deleteAllIPF') + '>Delete all rules</button>' : '') +
                '</div>';

            if (rules.length === 0) {
                html += '<p class="text-muted">No rules configured</p>';
            } else {
                html += '<table class="data-table"><thead><tr>' +
                    '<th></th><th>#</th><th>Proto</th><th>LAN IP</th><th>LAN Port</th><th>WAN IP</th><th>WAN Port</th><th></th>' +
                    '</tr></thead><tbody>';
                for (var i = 0; i < rules.length; i++) {
                    var r = rules[i];
                    html += '<tr>' +
                        '<td class="drag-handle">\u2807</td>' +
                        '<td>' + (i + 1) + '</td>' +
                        '<td>' + escHtml(_pfProtoLabel(r.ip_protocol)) + '</td>' +
                        '<td>' + (r.lan_ip ? escHtml(r.lan_ip) : '<span class="text-muted">Any</span>') + '</td>' +
                        '<td>' + (r.lan_port ? escHtml(r.lan_port) : '<span class="text-muted">Any</span>') + '</td>' +
                        '<td>' + (r.wan_ip ? escHtml(r.wan_ip) : '<span class="text-muted">Any</span>') + '</td>' +
                        '<td>' + (r.wan_port ? escHtml(r.wan_port) : '<span class="text-muted">Any</span>') + '</td>' +
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
            '<div class="float-field"><label>Protocol</label>' +
                '<select id="ipf-proto">' +
                    '<option value="6"' + (String(r.ip_protocol || '') === '6' ? ' selected' : '') + '>TCP</option>' +
                    '<option value="17"' + (String(r.ip_protocol || '17') === '17' ? ' selected' : '') + '>UDP</option>' +
                    '<option value="253"' + (String(r.ip_protocol || '') === '253' ? ' selected' : '') + '>TCP+UDP</option>' +
                '</select>' +
            '</div>' +
            '<div class="float-field"><label>LAN IP</label><input type="text" id="ipf-sip" value="' + escHtml(r.lan_ip || '') + '" placeholder="192.168.1.x"></div>' +
            '<div class="float-field"><label>LAN Port</label><input type="text" id="ipf-sport" value="' + escHtml(r.lan_port || '') + '" placeholder="Any"></div>' +
            '<div class="float-field"><label>WAN IP</label><input type="text" id="ipf-eip" value="' + escHtml(r.wan_ip || '') + '" placeholder="Any"></div>' +
            '<div class="float-field"><label>WAN Port</label><input type="text" id="ipf-eport" value="' + escHtml(r.wan_port || '') + '" placeholder="Any"></div>';

        _showRulePanel(title, fields, function() {
            var nextRules = _ipfRules.slice();
            var nextRule = {
                list_id: editing ? r.list_id : String(nextRules.length),
                lan_ip: $('#ipf-sip').value,
                wan_ip: $('#ipf-eip').value,
                lan_port: $('#ipf-sport').value,
                wan_port: $('#ipf-eport').value,
                ip_protocol: $('#ipf-proto').value,
                ip_status: '1'
            };
            if (editing) {
                nextRules[index] = nextRule;
            } else {
                nextRules.push(nextRule);
            }
            _setActiveIpFilterRules(_ipfPolicy, nextRules);
            App.wrapFormSubmit('#rule-panel-save', function() {
                return _saveIpFilterRules(_ipfPolicy).then(function() {
                    _hideRulePanel();
                    return _loadIpFilter();
                });
            }, { success: editing ? 'Rule updated' : 'Rule added' });
        });
    }

    function _delIpFilter(index) {
        App.confirmDialog('Delete this IP filter rule?', function() {
            var nextRules = _ipfRules.slice();
            nextRules.splice(index, 1);
            _setActiveIpFilterRules(_ipfPolicy, nextRules);
            App.wrapFormSubmit(null, function() {
                return _saveIpFilterRules(_ipfPolicy).then(_loadIpFilter);
            }, { key: 'ipf-del', success: 'Rule deleted' });
        }, null, { title: 'Delete rule', confirmText: 'Delete', danger: true });
    }

    function _deleteAllIPF() {
        App.confirmDialog(
            'Delete all ' + _ipfRules.length + ' IP filter rules? This cannot be undone.',
            function() {
                _setActiveIpFilterRules(_ipfPolicy, []);
                App.wrapFormSubmit(null, function() {
                    return _saveIpFilterRules(_ipfPolicy).then(_loadIpFilter);
                }, { key: 'ipf-del-all', success: 'All IP filter rules deleted' });
            }, null,
            { title: 'Delete all rules', confirmText: 'Delete all', danger: true });
    }

    function _saveIpFilterPolicy() {
        var sel = $('#ipf-policy');
        _ipfPolicy = sel ? String(sel.value) : _ipfPolicy;
        _ipfRules = _getActiveIpFilterRules(_ipfPolicy).slice();
        App.wrapFormSubmit('#ipf-save-policy', function() {
            return _saveIpFilterRules(_ipfPolicy).then(_loadIpFilter);
        }, { success: 'Filter mode saved' });
    }

    // --- MAC Filter ---
    //
    // The API is filter_policy + two parallel lists, exactly as the stock SPA
    // drives it (build.formatted.js:53905-54000): GetMacFilterSettings returns
    // {filter_policy, MacAllowList, MacDenyList} and SetMacFilterSettings takes
    // all three back. filter_policy is 0=disabled, 1=whitelist (MacAllowList),
    // 2=blacklist (MacDenyList) — the order in the stock option table
    // (build.formatted.js:10920) is disabled/blacklist/whitelist, which is why
    // 2 is the blacklist and not the whitelist.
    //
    // Both lists are always sent back so that editing one never truncates the
    // other, and the policy is read through String() because core_app returns
    // it as a number and a strict compare against '1' would otherwise fail and
    // silently render "Disabled".

    var _mfPolicy = '0';
    var _mfAllowList = [];
    var _mfDenyList = [];

    function _mfActiveList() {
        return _mfPolicy === '1' ? _mfAllowList : _mfDenyList;
    }

    // Stock stores these as bare strings; tolerate an object form rather than
    // rendering "[object Object]" if a firmware wraps them.
    function _macText(m) {
        return typeof m === 'string' ? m : ((m && (m.MacAddress || m.Address)) || '');
    }

    // Both lists travel on every write; `allow`/`deny` default to the cached
    // copies so a mode-only save cannot truncate either of them.
    function _saveMacFilterSettings(policy, allow, deny) {
        return API.webapi('SetMacFilterSettings', {
            filter_policy: parseInt(policy, 10) || 0,
            MacAllowList: allow || _mfAllowList,
            MacDenyList: deny || _mfDenyList
        });
    }

    function _loadMacFilter() {
        var tab = $('#fw-tab-macfilter');
        if (!tab) return Promise.resolve();

        return API.webapi('GetMacFilterSettings').then(function(data) {
            data = data || {};
            _mfPolicy = data.filter_policy != null ? String(data.filter_policy) : '0';
            _mfAllowList = Array.isArray(data.MacAllowList) ? data.MacAllowList.slice() : [];
            _mfDenyList = Array.isArray(data.MacDenyList) ? data.MacDenyList.slice() : [];

            var entries = _mfActiveList();
            var listLabel = _mfPolicy === '1' ? 'Allowed MAC addresses' : 'Blocked MAC addresses';

            tab.innerHTML = '<div class="card">' +
                '<h3>MAC Address Filter</h3>' +
                '<div class="form-group">' +
                    '<label>Filter Mode</label>' +
                    '<select id="mf-mode">' +
                        '<option value="0"' + (_mfPolicy === '0' ? ' selected' : '') + '>Disabled</option>' +
                        '<option value="1"' + (_mfPolicy === '1' ? ' selected' : '') + '>Whitelist (allow only listed)</option>' +
                        '<option value="2"' + (_mfPolicy === '2' ? ' selected' : '') + '>Blacklist (block listed)</option>' +
                    '</select>' +
                    '<p class="text-muted text-small">Each mode keeps its own list. Switching mode does not move addresses between them.</p>' +
                '</div>' +
                '<div class="form-actions mb-2">' +
                    '<button id="mf-save-mode" ' + actionAttr('saveMacFilterMode') + '>Save Mode</button>' +
                '</div>' +
                '<h3>' + listLabel + '</h3>' +
                '<div id="mf-list">' +
                    (entries.length === 0 ? '<p class="text-muted">No entries</p>' :
                    '<table class="data-table"><thead><tr><th>MAC Address</th><th></th></tr></thead><tbody>' +
                    entries.map(function(mac, i) {
                        return '<tr><td class="text-mono">' + escHtml(_macText(mac)) + '</td>' +
                            '<td><button class="toggle-btn" ' + actionAttr('delMacFilter', [i]) + '>' + icon('ic-delete') + '</button></td></tr>';
                    }).join('') + '</tbody></table>') +
                '</div>' +
                '<div class="form-row mt-2">' +
                    '<div class="form-group">' +
                        '<label>Add MAC</label>' +
                        '<input type="text" id="mf-mac" placeholder="AA:BB:CC:DD:EE:FF" maxlength="17">' +
                    '</div>' +
                '</div>' +
                '<div class="form-actions">' +
                    '<button id="mf-add" ' + actionAttr('addMacFilter') + '>Add</button>' +
                '</div>' +
            '</div>';
        }).catch(function(e) {
            tab.innerHTML = '<div class="card"><h3>MAC Address Filter</h3>' +
                '<p class="text-danger">Error: ' + escHtml((e && e.message) || 'failed to load') + '</p></div>';
        });
    }

    function _saveMacFilterMode() {
        var mode = ($('#mf-mode') || {}).value || '0';
        App.wrapFormSubmit('#mf-save-mode', function() {
            return _saveMacFilterSettings(mode).then(_loadMacFilter);
        }, { success: 'MAC filter mode saved' });
    }

    function _addMacFilter() {
        App.clearFieldErrors('#fw-tab-macfilter');
        var mac = (($('#mf-mac') || {}).value || '').trim();
        if (!/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(mac)) {
            return App.renderFieldError('#mf-mac', 'Expected a MAC address like AA:BB:CC:DD:EE:FF');
        }
        mac = mac.toUpperCase();

        var list = _mfActiveList();
        for (var i = 0; i < list.length; i++) {
            if (_macText(list[i]).toUpperCase() === mac) {
                return App.renderFieldError('#mf-mac', 'That address is already in the list');
            }
        }
        // Build the new list off to the side: a failed save must not leave the
        // cached copy holding an address the device never accepted.
        var next = list.concat([mac]);

        App.wrapFormSubmit('#mf-add', function() {
            return _saveMacFilterSettings(_mfPolicy, _mfPolicy === '1' ? next : null,
                _mfPolicy === '1' ? null : next).then(_loadMacFilter);
        }, { pending: 'Adding\u2026', success: 'MAC filter entry added' });
    }

    function _delMacFilter(index) {
        App.confirmDialog('Remove this MAC filter entry?', function() {
            App.wrapFormSubmit(null, function() {
                var next = _mfActiveList().slice();
                next.splice(index, 1);
                return _saveMacFilterSettings(_mfPolicy, _mfPolicy === '1' ? next : null,
                    _mfPolicy === '1' ? null : next).then(_loadMacFilter);
            }, { key: 'mf-del', success: 'MAC filter entry removed' });
        }, null, { title: 'Remove entry', confirmText: 'Remove', danger: true });
    }

    // --- Feature 7: URL Filter ---

    // The URL filter has exactly two policies on this firmware: 0 = disabled and
    // 2 = blacklist. The stock option table (build.formatted.js:10942) lists no
    // whitelist, so the old "Allow only listed URLs" = 1 option sent a value the
    // firmware has no case for, while "Block listed URLs" = 0 quietly turned the
    // filter off. UrlAllowList still exists in the API and is carried through
    // untouched so nothing already stored there is lost.

    var _ufPolicy = '0';
    var _ufDenyList = [];
    var _ufAllowList = [];

    function _urlText(u) {
        return typeof u === 'string' ? u : ((u && (u.Url || u.url)) || '');
    }

    function _saveUrlFilter(policy, denyList) {
        return API.webapi('SetUrlFilterSettings', {
            filter_policy: parseInt(policy, 10) || 0,
            UrlDenyList: denyList || _ufDenyList,
            UrlAllowList: _ufAllowList
        });
    }

    function _loadUrlFilter() {
        var el = $('#fw-tab-urlfilter');
        if (!el) return Promise.resolve();

        return API.webapi('getUrlFilterSettings').then(function(data) {
            data = data || {};
            // String() because core_app returns filter_policy as a number and a
            // strict compare against '2' would otherwise never match.
            _ufPolicy = data.filter_policy != null ? String(data.filter_policy) : '0';
            _ufDenyList = Array.isArray(data.UrlDenyList) ? data.UrlDenyList.slice() : [];
            _ufAllowList = Array.isArray(data.UrlAllowList) ? data.UrlAllowList.slice() : [];

            var html = '<div class="card">' +
                '<h3>URL Filter</h3>' +
                '<div class="form-group">' +
                    '<label>Filter Policy</label>' +
                    '<select id="uf-policy">' +
                        '<option value="0"' + (_ufPolicy === '0' ? ' selected' : '') + '>Disabled</option>' +
                        '<option value="2"' + (_ufPolicy === '2' ? ' selected' : '') + '>Blacklist (block listed URLs)</option>' +
                    '</select>' +
                '</div>' +
                '<div class="form-actions mb-2">' +
                    '<button id="uf-save-policy" ' + actionAttr('fwSaveUrlPolicy') + '>Save Policy</button>' +
                '</div>';

            if (_ufDenyList.length === 0) {
                html += '<p class="text-muted">No URLs configured</p>';
            } else {
                html += '<table class="data-table"><thead><tr><th>URL</th><th></th></tr></thead><tbody>';
                _ufDenyList.forEach(function(u, i) {
                    html += '<tr><td>' + escHtml(_urlText(u)) + '</td>' +
                        '<td><button class="btn-icon" ' + actionAttr('fwDelUrl', [i]) + '>' + icon('ic-delete') + '</button></td></tr>';
                });
                html += '</tbody></table>';
            }

            html += '<div class="form-row mt-2">' +
                    '<div class="form-group" style="flex:1">' +
                        '<input type="text" id="uf-url" placeholder="example.com" maxlength="256">' +
                    '</div>' +
                    '<button id="uf-add" ' + actionAttr('fwAddUrl') + '>Add URL</button>' +
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

    // The policy dropdown used to reach the device only as a passenger on an
    // add or a delete, so choosing a policy on its own did nothing.
    function _fwSaveUrlPolicy() {
        var policy = ($('#uf-policy') || {}).value || '0';
        App.wrapFormSubmit('#uf-save-policy', function() {
            return _saveUrlFilter(policy).then(_loadUrlFilter);
        }, { success: 'URL filter policy saved' });
    }

    function _fwAddUrl() {
        App.clearFieldErrors('#fw-tab-urlfilter');
        var inp = $('#uf-url');
        var policy = ($('#uf-policy') || {}).value || '0';
        if (!inp || !inp.value.trim()) return App.renderFieldError('#uf-url', 'Enter a URL or domain');
        var url = inp.value.trim();

        for (var i = 0; i < _ufDenyList.length; i++) {
            if (_urlText(_ufDenyList[i]) === url) {
                return App.renderFieldError('#uf-url', 'That URL is already in the list');
            }
        }

        App.wrapFormSubmit('#uf-add', function() {
            return _saveUrlFilter(policy, _ufDenyList.concat([url])).then(_loadUrlFilter);
        }, { pending: 'Adding\u2026', success: 'URL added to the filter list' });
    }

    function _fwDelUrl(index) {
        var policy = ($('#uf-policy') || {}).value || '0';

        App.confirmDialog('Remove this URL from the filter list?', function() {
            App.wrapFormSubmit(null, function() {
                var next = _ufDenyList.slice();
                next.splice(index, 1);
                return _saveUrlFilter(policy, next).then(_loadUrlFilter);
            }, { key: 'uf-del', success: 'URL removed' });
        }, null, { title: 'Remove URL', confirmText: 'Remove', danger: true });
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
    App._saveIpFilterPolicy = _saveIpFilterPolicy;
    App._fwSaveUrlPolicy = _fwSaveUrlPolicy;
    App._fwAddUrl = _fwAddUrl;
    App._fwDelUrl = _fwDelUrl;
    App._saveMacFilterMode = _saveMacFilterMode;
    App._addMacFilter = _addMacFilter;
    App._delMacFilter = _delMacFilter;
})();
