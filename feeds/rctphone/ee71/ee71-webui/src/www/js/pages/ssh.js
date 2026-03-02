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
        if (!el) return;
        el.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';

        Promise.all([
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
                    '<div class="form-group mt-2">' +
                        '<label>Add SSH Key</label>' +
                        '<input type="text" id="ssh-newkey" placeholder="ssh-ed25519 AAAA...">' +
                    '</div>' +
                    '<button ' + actionAttr('sshAddKey') + '>Add Key</button>' +
                '</div>';
        }).catch(function() {
            el.innerHTML = '<div class="card"><p class="text-muted">Failed to load SSH status</p></div>';
        });
    }

    function _sshAddKey() {
        var key = ($('#ssh-newkey') || {}).value;
        if (!key) return;
        API.cgiPost('ssh.cgi', { action: 'add_key', key: key }).then(function(r) {
            if (r.error) { alert(r.error); return; }
            _loadSSH();
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    function _sshRemoveKey(idx) {
        if (!confirm('Remove this SSH key?')) return;
        API.cgiPost('ssh.cgi', { action: 'remove_key', index: idx }).then(function(r) {
            if (r.error) { alert(r.error); return; }
            _loadSSH();
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    App.registerPage('ssh', renderSSH);
    App._sshAddKey = _sshAddKey;
    App._sshRemoveKey = _sshRemoveKey;
})();
