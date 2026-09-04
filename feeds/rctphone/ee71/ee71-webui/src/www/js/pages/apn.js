;(function() {
    'use strict';
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;

    var _apnList = [], _editingAPN = null;

    function _isEmptyApnValue(value) {
        var raw = value == null ? '' : String(value).trim();
        return !raw || raw.toLowerCase() === 'null';
    }

    function _isBrokenApnProfile(profile) {
        if (!profile) return false;
        return _isEmptyApnValue(profile.ProfileName) || _isEmptyApnValue(profile.APN);
    }

    function _findReplacementDefault(excludeIds) {
        return _apnList.find(function(profile) {
            var pid = parseInt(profile.ProfileID, 10);
            return !isNaN(pid) && excludeIds.indexOf(pid) === -1 && !_isBrokenApnProfile(profile);
        }) || null;
    }

    // Delete a batch of profiles one-by-one. Resilient: a failure on one
    // profile is recorded and the loop continues with the rest, instead of
    // aborting the whole sweep mid-way and leaving DB half-cleaned.
    function _deleteProfilesSequential(pending, replacement, stats) {
        stats = stats || { skipped: 0, deleted: 0, failed: 0 };
        if (!pending.length) {
            // Always report — a partial sweep used to finish in silence.
            var msg = 'Removed ' + stats.deleted + ' empty/NULL profile(s).';
            if (stats.skipped) msg += ' Skipped ' + stats.skipped + ' default profile(s): no valid replacement.';
            if (stats.failed) msg += ' Failed to delete ' + stats.failed + ' profile(s), see the browser console.';
            App.showNotification(msg, (stats.skipped || stats.failed) ? 'error' : 'success', 8000);
            _loadAPN();
            return;
        }
        var current = pending.shift();
        var next = function() { _deleteProfilesSequential(pending, replacement, stats); };
        var pid = parseInt(current.ProfileID, 10);
        if (isNaN(pid)) { next(); return; }
        var isDefault = current.Default === 1 || current.Default === '1' || current.IsDefault === 1 || current.IsDefault === '1';
        var deleteNow = function() {
            API.webapi('DeleteProfile', { ProfileID: pid }).then(function() {
                stats.deleted++;
                next();
            }).catch(function(e) {
                stats.failed++;
                if (window.console) console.error('APN delete failed (ID ' + pid + '): ' + e.message);
                next(); // keep going — don't abort the whole cleanup
            });
        };
        if (isDefault && replacement) {
            API.webapi('SetDefaultProfile', { ProfileID: parseInt(replacement.ProfileID, 10) }).then(deleteNow)
                .catch(function(e) {
                    stats.failed++;
                    if (window.console) console.error('APN switch-default failed: ' + e.message);
                    next();
                });
            return;
        }
        if (isDefault && !replacement) {
            stats.skipped++;
            next();
            return;
        }
        deleteNow();
    }

    function renderAPN(container) {
        container.innerHTML =
            '<h2>APN Profiles</h2>' +
            '<div id="apn-content"><div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div></div>';
        _loadAPN();
    }

    function _loadAPN() {
        var el = $('#apn-content');
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
                    '<button class="btn-outline-danger" ' + actionAttr('apnPurgeBroken') + '>Remove Empty/NULL Profiles (' + brokenCount + ')</button>' +
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
                            '<button class="btn-small" ' + actionAttr('apnEdit', [i]) + '>Edit</button> ' +
                            (!isDefault ? '<button class="btn-small" ' + actionAttr('apnDefault', [i]) + '>Set Default</button> ' : '') +
                            (!isDefault ? '<button class="btn-small btn-danger" ' + actionAttr('apnDelete', [i]) + '>Del</button>' : '') +
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
                '<div class="form-actions">' +
                    '<button id="apn-submit" ' + actionAttr('apnSave') + '>Add Profile</button>' +
                    '<button class="btn-small" id="apn-cancel" style="display:none" ' + actionAttr('apnCancelEdit') + '>Cancel</button>' +
                '</div>' +
            '</details></div>';
            el.innerHTML = html;
        }).catch(function() {
            el = $('#apn-content');
            if (el) el.innerHTML = '<div class="card"><p class="text-muted">Failed to load APN profiles</p></div>';
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
        App.clearFieldErrors('#apn-form');

        var name = (($('#apn-name') || {}).value || '').trim();
        var apn = (($('#apn-apn') || {}).value || '').trim();
        if (!name) return App.renderFieldError('#apn-name', 'Profile name is required');
        if (!apn) return App.renderFieldError('#apn-apn', 'APN is required');

        var params = {
            ProfileName: name,
            APN: apn,
            AuthType: ($('#apn-auth') || {}).value || '0',
            UserName: ($('#apn-user') || {}).value || '',
            Password: ($('#apn-pass') || {}).value || '',
        };
        var editing = _editingAPN !== null;
        var method = editing ? 'EditProfile' : 'AddNewProfile';
        if (editing) params.ProfileID = parseInt(_apnList[_editingAPN].ProfileID, 10);

        App.wrapFormSubmit('#apn-submit', function() {
            return API.webapi(method, params).then(_loadAPN);
        }, { success: editing ? 'Profile updated' : 'Profile added' });
    }

    function _apnDelete(i) {
        var p = _apnList[i];
        if (!p) return;
        var pid = parseInt(p.ProfileID, 10);
        var isDefault = p.Default === 1 || p.Default === '1' || p.IsDefault === 1 || p.IsDefault === '1';
        var replacement = null;

        if (isDefault && _apnList.length > 1) {
            replacement = _findReplacementDefault([pid]);
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
                        .then(_loadAPN);
                }, { key: 'apn-delete', success: 'Profile deleted' });
            }, null,
            { title: 'Delete APN profile', confirmText: 'Delete', danger: true });
    }

    function _apnDefault(i) {
        var p = _apnList[i];
        if (!p) return;
        App.wrapFormSubmit(null, function() {
            return API.webapi('SetDefaultProfile', { ProfileID: parseInt(p.ProfileID, 10) }).then(_loadAPN);
        }, { key: 'apn-default', success: 'Default profile set to "' + (p.ProfileName || p.ProfileID) + '"' });
    }

    function _apnPurgeBroken() {
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
            _deleteProfilesSequential(broken.slice(), _findReplacementDefault(brokenIds), null);
        }, null, { title: 'Remove broken profiles', confirmText: 'Delete', danger: true });
    }

    App.registerPage('apn', renderAPN);
    App._apnEdit = _apnEdit;
    App._apnCancelEdit = _apnCancelEdit;
    App._apnSave = _apnSave;
    App._apnDelete = _apnDelete;
    App._apnDefault = _apnDefault;
    App._apnPurgeBroken = _apnPurgeBroken;
})();
