;(function() {
    'use strict';
    var $ = App.$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;

    function renderTtlFix(container) {
        container.innerHTML =
            '<h2>TTL Fix</h2>' +
            '<div id="ttl-content"><div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div></div>';
        _loadTtl();
    }

    function _loadTtl() {
        var el = $('#ttl-content');
        if (!el) return;
        API.cgiGet('ttl.cgi', { action: 'status' }).then(function(data) {
            var active = data && data.active;
            var ttl = data ? data.ttl : 64;
            var iface = data ? (data.iface || 'rmnet+') : 'rmnet+';

            el.innerHTML = '<div class="card">' +
                '<div class="flex-between mb-2">' +
                    '<h3>TTL / Hop Limit</h3>' +
                    '<div style="display:flex;align-items:center;gap:8px">' +
                        '<span class="text-small" id="ttl-status">' + (active ? 'Active' : 'Inactive') + '</span>' +
                        '<label class="switch"><input type="checkbox" id="ttl-toggle"' + (active ? ' checked' : '') + '><span class="slider"></span></label>' +
                    '</div>' +
                '</div>' +
                '<p class="text-small text-muted mb-2">Normalizes TTL/Hop Limit on outbound traffic to prevent carrier tethering detection.</p>' +
                '<div class="form-row">' +
                    '<div class="form-group">' +
                        '<label>TTL Value</label>' +
                        '<input type="number" id="ttl-val" value="' + ttl + '" min="1" max="255">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>Interface</label>' +
                        '<select id="ttl-iface">' +
                            '<option value="rmnet+"' + (iface === 'rmnet+' ? ' selected' : '') + '>rmnet+ (WAN only)</option>' +
                            '<option value="+"' + (iface === '+' ? ' selected' : '') + '>All interfaces</option>' +
                            '<option value="custom"' + (iface !== 'rmnet+' && iface !== '+' ? ' selected' : '') + '>Custom</option>' +
                        '</select>' +
                    '</div>' +
                    '<div class="form-group" id="ttl-custom-wrap" style="' + (iface !== 'rmnet+' && iface !== '+' ? '' : 'display:none') + '">' +
                        '<label>Custom Interface</label>' +
                        '<input type="text" id="ttl-custom" value="' + escHtml(iface !== 'rmnet+' && iface !== '+' ? iface : '') + '" placeholder="wwan0">' +
                    '</div>' +
                '</div>' +
                '<div class="form-actions">' +
                    '<button ' + actionAttr('saveTtl') + '>Save TTL</button>' +
                '</div>' +
                '<div class="mt-2 text-small text-muted">' +
                    'IPv4 rules: ' + (data ? data.ipv4_rules : '?') + ' | IPv6 rules: ' + (data ? data.ipv6_rules : '?') +
                    (data && !data.init_exists ? '<br><span class="text-danger">Warning: ttl_fix init script not found</span>' : '') +
                '</div>' +
            '</div>';

            $('#ttl-iface').addEventListener('change', function() {
                var cw = $('#ttl-custom-wrap');
                if (cw) cw.style.display = this.value === 'custom' ? '' : 'none';
            });

            $('#ttl-toggle').addEventListener('change', function() {
                API.cgiPost('ttl.cgi', { action: active ? 'disable' : 'enable' }).then(function() {
                    setTimeout(_loadTtl, 1000);
                }).catch(function(e) { alert('Error: ' + e.message); });
            });
        }).catch(function(e) { el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(e.message) + '</p></div>'; });
    }

    function _saveTtl() {
        var val = parseInt($('#ttl-val').value, 10);
        if (isNaN(val) || val < 1 || val > 255) { alert('TTL must be 1-255'); return; }
        var ifaceSel = ($('#ttl-iface') || {}).value || 'rmnet+';
        var iface = ifaceSel === 'custom' ? ($('#ttl-custom') || {}).value || 'rmnet+' : ifaceSel;
        API.cgiPost('ttl.cgi', { action: 'set', ttl: val, iface: iface }).then(function() {
            _loadTtl();
        }).catch(function(e) { alert('Error: ' + e.message); });
    }

    App.registerPage('ttl-fix', renderTtlFix);
    App._saveTtl = _saveTtl;
})();
