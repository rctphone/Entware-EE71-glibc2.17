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
        if (!el) return;
        Promise.all([
            API.webapi('GetUpnpSettings'),
            API.cgiGet('system.cgi', { action: 'iptables' }).catch(function() { return null; }),
        ]).then(function(results) {
            var data = results[0], iptData = results[1];
            var enabled = data && (data.UpnpEnable === 1 || data.UpnpEnable === '1');

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
                    '<button class="toggle-btn ' + (enabled ? 'on' : '') + '" id="upnp-toggle">' +
                        icon('ic-power') + ' ' + (enabled ? 'Enabled' : 'Disabled') +
                    '</button>' +
                '</div>' +
                '<p class="text-small text-muted">UPnP allows applications on your network to automatically set up port forwarding rules.</p>' +
                mappingsHtml +
            '</div>';

            $('#upnp-toggle').addEventListener('click', function() {
                API.webapi('SetUpnpSettings', { UpnpEnable: enabled ? '0' : '1' }).then(function() {
                    setTimeout(_loadUpnp, 1000);
                }).catch(function(e) { alert('Error: ' + e.message); });
            });
        }).catch(function(e) { el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(e.message) + '</p></div>'; });
    }

    App.registerPage('upnp', renderUpnp);
})();
