;(function() {
    'use strict';
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;

    var _apnList = [], _editingAPN = null;

    function renderAPN(container) {
        container.innerHTML =
            '<h2>APN Profiles</h2>' +
            '<div id="apn-content"><div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div></div>';
        _loadAPN();
    }

    function _loadAPN() {
        var el = $('#apn-content');
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
                    var isDefault = p.IsDefault === 1 || p.IsDefault === '1';
                    html += '<tr' + (isDefault ? ' class="text-bold"' : '') + '>' +
                        '<td>' + escHtml(p.ProfileName || '') + '</td>' +
                        '<td>' + escHtml(p.APN || '') + '</td>' +
                        '<td>' + escHtml(p.AuthType == 0 ? 'None' : p.AuthType == 1 ? 'PAP' : p.AuthType == 2 ? 'CHAP' : String(p.AuthType || '')) + '</td>' +
                        '<td>' + (isDefault ? 'Yes' : '') + '</td>' +
                        '<td>' +
                            '<button class="btn-small" ' + actionAttr('apnEdit', [i]) + '>Edit</button> ' +
                            (!isDefault ? '<button class="btn-small" ' + actionAttr('apnDefault', [i]) + '>Set Default</button> ' : '') +
                            '<button class="btn-small btn-danger" ' + actionAttr('apnDelete', [i]) + '>Del</button>' +
                        '</td></tr>';
                });
                html += '</tbody></table>';
            } else {
                html += '<p class="text-muted">No profiles found</p>';
            }
            html += '<details class="mt-2" id="apn-form"><summary id="apn-form-title">Add Profile</summary>' +
                '<div class="form-row mt-1">' +
                    '<div class="form-group"><label>Profile Name</label><input type="text" id="apn-name" placeholder="My APN"></div>' +
                    '<div class="form-group"><label>APN</label><input type="text" id="apn-apn" placeholder="internet"></div>' +
                '</div>' +
                '<div class="form-row">' +
                    '<div class="form-group"><label>Auth Type</label>' +
                        '<select id="apn-auth"><option value="0">None</option><option value="1">PAP</option><option value="2">CHAP</option></select>' +
                    '</div>' +
                    '<div class="form-group"><label>Username</label><input type="text" id="apn-user" placeholder=""></div>' +
                    '<div class="form-group"><label>Password</label><input type="text" id="apn-pass" placeholder=""></div>' +
                '</div>' +
                '<div class="form-row">' +
                    '<div class="form-group"><label>PDP Type</label>' +
                        '<select id="apn-pdp"><option value="0">IPv4</option><option value="2">IPv4v6</option><option value="1">IPv6</option></select>' +
                    '</div>' +
                '</div>' +
                '<div class="form-actions">' +
                    '<button id="apn-submit" ' + actionAttr('apnSave') + '>Add Profile</button>' +
                    '<button class="btn-small" id="apn-cancel" style="display:none" ' + actionAttr('apnCancelEdit') + '>Cancel</button>' +
                '</div>' +
            '</details></div>';
            el.innerHTML = html;
        }).catch(function() {
            el.innerHTML = '<div class="card"><p class="text-muted">Failed to load APN profiles</p></div>';
        });
    }

    function _apnEdit(i) {
        var p = _apnList[i];
        if (!p) return;
        var form = $('#apn-form');
        if (form) form.open = true;
        $('#apn-name').value = p.ProfileName || '';
        $('#apn-apn').value = p.APN || '';
        $('#apn-auth').value = String(p.AuthType || 0);
        $('#apn-user').value = p.UserName || '';
        $('#apn-pass').value = p.Password || '';
        $('#apn-pdp').value = String(p.IpType || 0);
        _editingAPN = i;
        var btn = $('#apn-submit');
        if (btn) btn.textContent = 'Update Profile';
        var cancel = $('#apn-cancel');
        if (cancel) cancel.style.display = '';
    }

    function _apnCancelEdit() {
        _editingAPN = null;
        var btn = $('#apn-submit');
        if (btn) btn.textContent = 'Add Profile';
        var cancel = $('#apn-cancel');
        if (cancel) cancel.style.display = 'none';
    }

    function _apnSave() {
        var params = {
            ProfileName: ($('#apn-name') || {}).value,
            APN: ($('#apn-apn') || {}).value,
            AuthType: ($('#apn-auth') || {}).value || '0',
            UserName: ($('#apn-user') || {}).value || '',
            Password: ($('#apn-pass') || {}).value || '',
            DnsMode: '0',
            DNS1: '',
            DNS2: '',
            IpType: ($('#apn-pdp') || {}).value || '0',
        };
        if (!params.ProfileName || !params.APN) { alert('Name and APN required'); return; }
        var method = _editingAPN !== null ? 'EditProfile' : 'AddNewProfile';
        if (_editingAPN !== null) params.ProfileID = String(_apnList[_editingAPN].ProfileID);
        API.webapi(method, params).then(function() {
            _loadAPN();
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    function _apnDelete(i) {
        if (!confirm('Delete APN profile?')) return;
        API.webapi('DeleteProfile', { ProfileID: String(_apnList[i].ProfileID) }).then(function() {
            _loadAPN();
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    function _apnDefault(i) {
        API.webapi('SetDefaultProfile', { ProfileID: String(_apnList[i].ProfileID) }).then(function() {
            _loadAPN();
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    App.registerPage('apn', renderAPN);
    App._apnEdit = _apnEdit;
    App._apnCancelEdit = _apnCancelEdit;
    App._apnSave = _apnSave;
    App._apnDelete = _apnDelete;
    App._apnDefault = _apnDefault;
})();
