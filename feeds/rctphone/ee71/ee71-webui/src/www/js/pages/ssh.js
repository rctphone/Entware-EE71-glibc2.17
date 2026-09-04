;(function() {
    'use strict';
    var $ = App.$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;

    function renderSSH(container) {
        container.innerHTML =
            '<h2>SSH</h2>' +
            '<div id="ssh-content"><div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div></div>';
        _loadSSH();
    }

    function _loadSSH() {
        var el = $('#ssh-content');
        if (!el) return Promise.resolve();
        el.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';

        return Promise.all([
            API.cgiGet('ssh.cgi', { action: 'status' }).catch(function() { return null; }),
            API.cgiGet('ssh.cgi', { action: 'keys' }).catch(function() { return null; }),
        ]).then(function(results) {
            var status = results[0], keys = results[1];
            var s = status || {};

            var keysHtml = '';
            if (keys && keys.length) {
                keysHtml = '<table class="data-table"><thead><tr><th>#</th><th>Type</th><th>Key</th><th>Comment</th><th></th></tr></thead><tbody>' +
                    keys.map(function(k, i) {
                        return '<tr><td>' + i + '</td><td>' + escHtml(k.type) + '</td>' +
                            '<td class="text-mono text-small">' + escHtml(k.key_prefix) + '</td>' +
                            '<td>' + escHtml(k.comment) + '</td>' +
                            '<td><button class="btn-small btn-danger" ' + actionAttr('sshRemoveKey', [i]) + '>Remove</button></td></tr>';
                    }).join('') +
                    '</tbody></table>';
            } else {
                keysHtml = '<p class="text-muted">No authorized keys</p>';
            }

            el.innerHTML =
                '<div class="card">' +
                    '<h3>Dropbear SSH</h3>' +
                    '<div class="stat-row"><span class="label">Status</span><span class="value">' + (s.running ? 'Running (PID ' + escHtml(s.pid) + ')' : 'Stopped') + '</span></div>' +
                    '<div class="stat-row"><span class="label">Port</span><span class="value">' + (s.port || 22) + '</span></div>' +
                    (s.host_keys ? s.host_keys.map(function(hk) {
                        return '<div class="stat-row"><span class="label">' + escHtml(hk.type) + ' key</span><span class="value text-mono text-small">' + escHtml(hk.fingerprint) + '</span></div>';
                    }).join('') : '') +
                '</div>' +
                '<div class="card mt-2">' +
                    '<h3>Authorized Keys</h3>' +
                    keysHtml +
                    '<div class="mt-2">' +
                        App.createFormField('Add SSH Key', 'text', 'ssh-newkey', '',
                            { placeholder: 'ssh-ed25519 AAAA...' }) +
                    '</div>' +
                    '<button id="ssh-add-btn" ' + actionAttr('sshAddKey') + '>Add Key</button>' +
                '</div>';
        }).catch(function() {
            el = $('#ssh-content');
            if (el) el.innerHTML = '<div class="card"><p class="text-muted">Failed to load SSH status</p></div>';
        });
    }

    // The CGI reports a refusal in the JSON body rather than as an HTTP error,
    // so turn that into a rejection and let wrapFormSubmit report it once.
    function _sshPost(params) {
        return API.cgiPost('ssh.cgi', params).then(function(r) {
            if (r && r.error) throw new Error(r.error);
            return r;
        });
    }

    function _sshAddKey() {
        App.clearFieldErrors('#ssh-content');
        var key = (($('#ssh-newkey') || {}).value || '').trim();
        if (!key) return App.renderFieldError('#ssh-newkey', 'Paste a public key first');
        if (!/^(ssh-|ecdsa-|sk-)/.test(key)) {
            return App.renderFieldError('#ssh-newkey', 'Not a public key: expected it to start with ssh-, ecdsa- or sk-');
        }
        App.wrapFormSubmit('#ssh-add-btn', function() {
            return _sshPost({ action: 'add_key', key: key }).then(_loadSSH);
        }, { pending: 'Adding\u2026', success: 'SSH key added' });
    }

    function _sshRemoveKey(idx) {
        App.confirmDialog('Remove this SSH key? Anything using it will lose access.', function() {
            App.wrapFormSubmit(null, function() {
                return _sshPost({ action: 'remove_key', index: idx }).then(_loadSSH);
            }, { key: 'ssh-remove', success: 'SSH key removed' });
        }, null, { title: 'Remove SSH key', confirmText: 'Remove', danger: true });
    }

    App.registerPage('ssh', renderSSH);
    App._sshAddKey = _sshAddKey;
    App._sshRemoveKey = _sshRemoveKey;
})();
