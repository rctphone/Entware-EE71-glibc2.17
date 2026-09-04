;(function() {
    'use strict';
    var $ = App.$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;
    var createFormField = App.createFormField, wrapFormSubmit = App.wrapFormSubmit;
    var renderFieldError = App.renderFieldError, clearFieldErrors = App.clearFieldErrors;

    var IFACE_OPTIONS = [
        { value: 'rmnet+', label: 'rmnet+ (WAN only)' },
        { value: '+', label: 'All interfaces' },
        { value: 'custom', label: 'Custom' }
    ];

    function renderTtlFix(container) {
        container.innerHTML =
            '<h2>TTL Fix</h2>' +
            '<div id="ttl-content"><div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div></div>';
        _loadTtl();
    }

    function _loadTtl() {
        var el = $('#ttl-content');
        if (!el) return Promise.resolve();
        return API.cgiGet('ttl.cgi', { action: 'status' }).then(function(data) {
            el = $('#ttl-content');
            if (!el) return;
            data = data || {};
            var active = !!data.active;
            var ttl = data.ttl == null ? 64 : data.ttl;
            var iface = data.iface || 'rmnet+';
            var isCustom = iface !== 'rmnet+' && iface !== '+';

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
                    createFormField('TTL Value', 'number', 'ttl-val', ttl, { min: 1, max: 255 }) +
                    createFormField('Interface', 'select', 'ttl-iface', isCustom ? 'custom' : iface, { options: IFACE_OPTIONS }) +
                    '<div id="ttl-custom-wrap"' + (isCustom ? '' : ' hidden') + ' style="flex:1">' +
                        createFormField('Custom Interface', 'text', 'ttl-custom', isCustom ? iface : '', { placeholder: 'wwan0' }) +
                    '</div>' +
                '</div>' +
                '<div class="form-actions">' +
                    '<button id="ttl-save" ' + actionAttr('saveTtl') + '>Save TTL</button>' +
                '</div>' +
                '<div class="mt-2 text-small text-muted">' +
                    'IPv4 rules: ' + escHtml(data.ipv4_rules == null ? '?' : data.ipv4_rules) +
                    ' | IPv6 rules: ' + escHtml(data.ipv6_rules == null ? '?' : data.ipv6_rules) +
                    (!data.init_exists ? '<br><span class="text-danger">Warning: ttl_fix init script not found</span>' : '') +
                '</div>' +
            '</div>';

            $('#ttl-iface').addEventListener('change', function() {
                var cw = $('#ttl-custom-wrap');
                if (cw) cw.hidden = this.value !== 'custom';
            });

            $('#ttl-toggle').addEventListener('change', function() {
                var enable = !active;
                wrapFormSubmit(this, function() {
                    return API.cgiPost('ttl.cgi', { action: enable ? 'enable' : 'disable' }).then(_loadTtl);
                }, {
                    key: 'ttl-toggle',
                    success: enable ? 'TTL fix enabled' : 'TTL fix disabled'
                });
            });
        }).catch(function(e) {
            el = $('#ttl-content');
            if (el) el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(App.errorText(e)) + '</p></div>';
        });
    }

    function _saveTtl() {
        clearFieldErrors('#ttl-content');

        var val = parseInt(($('#ttl-val') || {}).value, 10);
        if (isNaN(val) || val < 1 || val > 255) {
            return renderFieldError('#ttl-val', 'TTL must be between 1 and 255');
        }

        var sel = ($('#ttl-iface') || {}).value || 'rmnet+';
        var iface = sel;
        if (sel === 'custom') {
            iface = (($('#ttl-custom') || {}).value || '').trim();
            if (!iface) return renderFieldError('#ttl-custom', 'Interface name is required');
        }

        wrapFormSubmit('#ttl-save', function() {
            return API.cgiPost('ttl.cgi', { action: 'set', ttl: val, iface: iface }).then(_loadTtl);
        }, { success: 'TTL settings saved' });
    }

    App.registerPage('ttl-fix', renderTtlFix);
    App._saveTtl = _saveTtl;
})();
