;(function() {
    'use strict';
    var $ = App.$, icon = App.icon, escHtml = App.escHtml;

    function renderUpnp(container) {
        container.innerHTML =
            '<h2>UPnP</h2>' +
            '<div id="upnp-content"><div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div></div>';
        _loadUpnp();
    }

    function _loadUpnp() {
        var el = $('#upnp-content');
        if (!el) return Promise.resolve();
        return Promise.all([
            API.webapi('GetUpnpSettings'),
            API.cgiGet('system.cgi', { action: 'iptables' }).catch(function() { return null; }),
        ]).then(function(results) {
            var data = results[0], iptData = results[1];
            // The field is upnp_switch, an int, not "UpnpEnable" — that name is
            // in no device binary. core_app's parameter table has upnp_switch
            // as type 3 (int) id 45 at 0x2caac0, and json_req_config_file wires
            // GetUpnpSettings to exactly {"module":8,"act":15,"id":[45]}; the
            // stock SPA reads and writes upnp_switch too (build.formatted.js
            // :41319, :53288). So the page read undefined and always rendered
            // "Disabled", and the toggle posted a key core_app ignores — the
            // request succeeded and changed nothing, which is the worst of the
            // three possible outcomes.
            var enabled = data && (data.upnp_switch === 1 || data.upnp_switch === '1');

            var mappingsHtml = '';
            if (iptData && iptData.nat) {
                var miniChain = iptData.nat.MINIUPNPD;
                if (miniChain && miniChain.rules && miniChain.rules.length > 0) {
                    mappingsHtml = '<h4 class="mt-2">Active Mappings</h4>' +
                        '<table class="data-table"><thead><tr><th>Proto</th><th>Destination</th><th>Target</th><th>Extra</th></tr></thead><tbody>' +
                        miniChain.rules.map(function(r) {
                            return '<tr><td>' + escHtml(r.proto || '') + '</td>' +
                                '<td>' + escHtml(r.dst || '') + '</td>' +
                                '<td>' + escHtml(r.target || '') + '</td>' +
                                '<td class="text-small">' + escHtml(r.extra || '') + '</td></tr>';
                        }).join('') + '</tbody></table>';
                } else {
                    mappingsHtml = '<p class="text-muted mt-1">No active UPnP mappings</p>';
                }
            }

            el.innerHTML = '<div class="card">' +
                '<div class="flex-between mb-2">' +
                    '<h3>UPnP / NAT-PMP</h3>' +
                    '<div style="display:flex;align-items:center;gap:8px">' +
                        '<span class="text-small" id="upnp-status">' + (enabled ? 'Enabled' : 'Disabled') + '</span>' +
                        '<label class="switch"><input type="checkbox" id="upnp-toggle"' + (enabled ? ' checked' : '') + '><span class="slider"></span></label>' +
                    '</div>' +
                '</div>' +
                '<p class="text-small text-muted">UPnP allows applications on your network to automatically set up port forwarding rules.</p>' +
                mappingsHtml +
            '</div>';

            $('#upnp-toggle').addEventListener('change', function() {
                var enable = !enabled;
                App.wrapFormSubmit(this, function() {
                    // Stock posts a number here, not a string
                    // (build.formatted.js:53292).
                    return API.webapi('SetUpnpSettings', { upnp_switch: enable ? 1 : 0 })
                        .then(function() {
                            // miniupnpd needs a moment before its chain reflects the change.
                            return new Promise(function(r) { setTimeout(r, 1000); });
                        })
                        .then(_loadUpnp);
                }, {
                    key: 'upnp-toggle',
                    success: enable ? 'UPnP enabled' : 'UPnP disabled'
                });
            });
        }).catch(function(e) {
            el = $('#upnp-content');
            if (el) el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(App.errorText(e)) + '</p></div>';
        });
    }

    App.registerPage('upnp', renderUpnp);
})();
