;(function() {
    'use strict';
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;

    function renderWifi(container) {
        container.innerHTML =
            '<h2>WiFi</h2>' +
            '<div class="wifi-grid">' +
                '<div id="wifi-tab-2g">' +
                    '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>' +
                '</div>' +
                '<div id="wifi-tab-5g">' +
                    '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>' +
                '</div>' +
            '</div>' +
            '<div class="wifi-save-row">' +
                '<button ' + actionAttr('saveWifiAll') + '>Save</button>' +
            '</div>';

        _loadWifiSettings();
    }

    var SEC_MAP = {0:'OPEN',1:'WEP',2:'WPA-PSK',3:'WPA2-PSK',4:'WPA/WPA2-PSK'};
    var SEC_REV = {'OPEN':0,'WEP':1,'WPA-PSK':2,'WPA2-PSK':3,'WPA/WPA2-PSK':4};
    var WMODE_2G = {0:'b',1:'g',2:'b/g',3:'b/g/n',4:'n only'};
    var WMODE_5G = {5:'a',6:'a/n/ac',7:'a/n',8:'n/ac',9:'ac only'};
    var WMODE_2G_REV = {'b':0,'g':1,'b/g':2,'b/g/n':3,'g/n':3,'n only':4};
    var WMODE_5G_REV = {'a':5,'a/n/ac':6,'a/n':7,'n/ac':8,'ac only':9};
    var BW_2G = {0:'20/40',1:'20',2:'40'};
    var BW_5G = {0:'20/40/80',1:'20',2:'40',3:'80',4:'20/40/80'};
    var BW_2G_REV = {'20/40':0,'20':1,'40':2};
    var BW_5G_REV = {'20/40/80':0,'20':1,'40':2,'80':3};


    // Last fetched settings, kept for advanced panel access
    var _wifiSettings = null;

    // Build full SetWlanSettings params — firmware resets omitted fields to empty.
    // Three sections needed:
    //   AP2G       — 2.4GHz primary (wlan0)
    //   AP5G       — 5GHz settings (band-switch mode, kept in sync)
    //   AP2G_guest — Guest AP = wlan1 in AP-AP mode (the actual 5GHz interface)
    // SecurityMode 4 (WPA/WPA2) and 2 (WPA) generate broken hostapd config — clamp to safe values
    function _safeSecMode(mode) { return (mode === 0) ? 0 : 3; }

    function _fullParams(overrides2g, overrides5g) {
        var s = _wifiSettings || {};
        var raw2g = s.AP2G || {};
        var raw5g = s.AP5G || {};
        var rawGuest = s.AP2G_guest || {};

        var st2g = (s.Wlan2gState === 1 || s.Wlan2gState === '1') ? 1 : 0;
        var st5g = (s.Wlan5gState === 1 || s.Wlan5gState === '1') ? 1 : 0;
        var sec2g = _safeSecMode(SEC_REV[s.WlanAuthMode] != null ? SEC_REV[s.WlanAuthMode] : (raw2g.SecurityMode != null ? raw2g.SecurityMode : 3));
        var sec5g = _safeSecMode(SEC_REV[s.WlanAuthMode_5G] != null ? SEC_REV[s.WlanAuthMode_5G] : (raw5g.SecurityMode != null ? raw5g.SecurityMode : 3));
        var ch2g = parseInt(s.WlanChannel || raw2g.Channel || 0, 10) || 0;
        var ch5g = parseInt(s.WlanChannel_5G || rawGuest.Channel || raw5g.Channel || 0, 10) || 0;
        var wmode2g = WMODE_2G_REV[s.WlanMode] != null ? WMODE_2G_REV[s.WlanMode] : (raw2g.WMode != null ? raw2g.WMode : 3);
        var wmode5g = WMODE_5G_REV[s.WlanMode_5G] != null ? WMODE_5G_REV[s.WlanMode_5G] : (rawGuest.WMode != null ? rawGuest.WMode : (raw5g.WMode != null ? raw5g.WMode : 6));
        var bw2g = BW_2G_REV[s.WlanBandwidth] != null ? BW_2G_REV[s.WlanBandwidth] : (raw2g.Bandwidth != null ? raw2g.Bandwidth : 0);
        var bw5g = BW_5G_REV[s.WlanBandwidth_5G] != null ? BW_5G_REV[s.WlanBandwidth_5G] : (rawGuest.Bandwidth != null ? rawGuest.Bandwidth : (raw5g.Bandwidth != null ? raw5g.Bandwidth : 0));
        var hide2g = (s['2GHiddenSSID'] === '1' || s['2GHiddenSSID'] === 1 || raw2g.SsidHidden === 1) ? 1 : 0;
        var hide5g = (s['5GHiddenSSID'] === '1' || s['5GHiddenSSID'] === 1 || rawGuest.SsidHidden === 1 || raw5g.SsidHidden === 1) ? 1 : 0;
        var cc = raw2g.CountryCode || raw5g.CountryCode || rawGuest.CountryCode || 'GB';

        var ap2g = {
            ApStatus: st2g, Ssid: s.WlanSSID || '', WpaKey: s.WlanAPPwd || '',
            SecurityMode: sec2g, WpaType: 1,
            Channel: ch2g, WMode: wmode2g, Bandwidth: bw2g,
            SsidHidden: hide2g, CountryCode: cc,
            ApIsolation: raw2g.ApIsolation || 0, max_numsta: raw2g.max_numsta || 15
        };
        var ap5g = {
            ApStatus: st5g, Ssid: s.WlanSSID_5G || '', WpaKey: s.WlanAPPwd_5G || '',
            SecurityMode: sec5g, WpaType: 1,
            Channel: ch5g, WMode: wmode5g, Bandwidth: bw5g,
            SsidHidden: hide5g, CountryCode: cc,
            ApIsolation: raw5g.ApIsolation || 0, max_numsta: rawGuest.max_numsta || raw5g.max_numsta || 15
        };
        if (overrides2g) Object.keys(overrides2g).forEach(function(k) { ap2g[k] = overrides2g[k]; });
        if (overrides5g) Object.keys(overrides5g).forEach(function(k) { ap5g[k] = overrides5g[k]; });

        // Guest sections = wlan1 in AP-AP mode, cascade ALL fields from 5GHz
        var guestSsid = ap5g.Ssid || (ap2g.Ssid ? ap2g.Ssid + '_5G' : 'EE71_5G');
        var guestKey = ap5g.WpaKey || ap2g.WpaKey || '12345678';
        var guestFields = {
            ApStatus: ap5g.ApStatus, Ssid: guestSsid, WpaKey: guestKey,
            SecurityMode: ap5g.SecurityMode, WpaType: ap5g.WpaType,
            Channel: ap5g.Channel, WMode: ap5g.WMode, Bandwidth: ap5g.Bandwidth,
            SsidHidden: ap5g.SsidHidden, CountryCode: ap5g.CountryCode,
            ApIsolation: 0, max_numsta: ap5g.max_numsta
        };
        return { AP2G: ap2g, AP5G: ap5g, AP2G_guest: guestFields, AP5G_guest: guestFields };
    }

    function _toast(msg, isErr) {
        var el = document.getElementById('wifi-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'wifi-toast';
            el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:8px 20px;border-radius:8px;font-size:0.85rem;z-index:9999;transition:opacity 0.3s;pointer-events:none;';
            document.body.appendChild(el);
        }
        el.style.background = isErr ? 'var(--color-danger,#c62828)' : 'var(--color-success,#2e7d32)';
        el.style.color = '#fff';
        el.textContent = msg;
        el.style.opacity = '1';
        clearTimeout(el._t);
        el._t = setTimeout(function() { el.style.opacity = '0'; }, 3000);
    }

    function _loadWifiSettings() {
        Promise.all([
            API.webapi('GetWlanSettings').catch(function() { return null; }),
            API.webapi('GetWlanState').catch(function() { return null; }),
            API.webapi('GetWlanSupportMode').catch(function() { return null; }),
        ]).then(function(results) {
            var settings = results[0], state = results[1];

            // Map nested AP2G/AP5G/AP2G_guest to flat names for display.
            // In AP-AP mode, wlan1 (5GHz) is the "guest AP" — prefer AP2G_guest
            // over AP5G for 5GHz data since that's what controls wlan1 hostapd.
            if (settings) {
                var ap2g = settings.AP2G || {};
                var ap5g = settings.AP5G || {};
                var guest = settings.AP2G_guest || {};
                // Use AP2G_guest for 5GHz display when available (it maps to Guest5G* DB fields)
                var src5g = (guest.Ssid && guest.ApStatus != null) ? guest : ap5g;
                if (!settings.WlanSSID && ap2g.Ssid) settings.WlanSSID = ap2g.Ssid;
                if (!settings.WlanAPPwd && ap2g.WpaKey) settings.WlanAPPwd = ap2g.WpaKey;
                if (settings.WlanChannel == null && ap2g.Channel != null) settings.WlanChannel = String(ap2g.Channel);
                if (settings.WlanAuthMode == null && ap2g.SecurityMode != null) settings.WlanAuthMode = SEC_MAP[ap2g.SecurityMode] || '';
                if (!settings.WlanMode && ap2g.WMode != null) settings.WlanMode = WMODE_2G[ap2g.WMode] || '';
                if (!settings.WlanBandwidth && ap2g.Bandwidth != null) settings.WlanBandwidth = BW_2G[ap2g.Bandwidth] || '';
                if (!settings.WlanSSID_5G && src5g.Ssid) settings.WlanSSID_5G = src5g.Ssid;
                if (!settings.WlanAPPwd_5G && src5g.WpaKey) settings.WlanAPPwd_5G = src5g.WpaKey;
                if (settings.WlanChannel_5G == null && src5g.Channel != null) settings.WlanChannel_5G = String(src5g.Channel);
                if (settings.WlanAuthMode_5G == null && src5g.SecurityMode != null) settings.WlanAuthMode_5G = SEC_MAP[src5g.SecurityMode] || '';
                if (!settings.WlanMode_5G && src5g.WMode != null) settings.WlanMode_5G = WMODE_5G[src5g.WMode] || '';
                if (!settings.WlanBandwidth_5G && src5g.Bandwidth != null) settings.WlanBandwidth_5G = BW_5G[src5g.Bandwidth] || '';
                if (settings.Wlan2gState == null && ap2g.ApStatus != null) settings.Wlan2gState = String(ap2g.ApStatus);
                if (settings.Wlan5gState == null && src5g.ApStatus != null) settings.Wlan5gState = String(src5g.ApStatus);
                if (settings['2GHiddenSSID'] == null && ap2g.SsidHidden != null) settings['2GHiddenSSID'] = String(ap2g.SsidHidden);
                if (settings['5GHiddenSSID'] == null && src5g.SsidHidden != null) settings['5GHiddenSSID'] = String(src5g.SsidHidden);
            }

            _wifiSettings = settings;

            // --- 2.4 GHz ---
            _render2g(settings, state);

            // --- 5 GHz ---
            _render5g(settings);
        }).catch(function() {});
    }

    function _render2g(settings, state) {
        var tab2g = $('#wifi-tab-2g');
        if (!tab2g || !settings) return;
        var wifiOn = settings.Wlan2gState === 1 || settings.Wlan2gState === '1' ||
            (!settings.Wlan2gState && state && (state.WlanState === 1 || state.WlanState === '1'));

        tab2g.innerHTML = '<div class="card">' +
            '<h3>' +
                '2.4 GHz <span class="status-dot ' + (wifiOn ? 'green' : 'red') + '"></span>' +
                '<span class="flex-spacer"></span>' +
                '<label class="switch"><input type="checkbox" id="wifi-2g-sw"' + (wifiOn ? ' checked' : '') + '><span class="slider"></span></label>' +
            '</h3>' +
            '<div class="float-field">' +
                '<label>Network name (SSID)</label>' +
                '<input type="text" id="w-ssid" value="' + escHtml(settings.WlanSSID || '') + '" maxlength="32">' +
            '</div>' +
            '<div class="float-field">' +
                '<label>Security</label>' +
                '<select id="w-security">' +
                    _securityOptions(settings.WlanAuthMode || '') +
                '</select>' +
            '</div>' +
            '<div class="float-field pass-field">' +
                '<label>Password</label>' +
                '<input type="password" id="w-pass" value="' + escHtml(settings.WlanAPPwd || '') + '">' +
                '<button class="pass-eye" ' + actionAttr('togglePassVis', ['w-pass']) + ' title="Show password">' + icon('ic-eye-off') + '</button>' +
            '</div>' +
            '<div class="wifi-adv-link">' +
                '<a ' + actionAttr('showWifiAdv', ['2g']) + '>Advanced settings \u203a</a>' +
            '</div>' +
        '</div>';

        $('#wifi-2g-sw').addEventListener('change', function() {
            var params = _fullParams({ ApStatus: wifiOn ? 0 : 1 }, null);
            API.webapi('SetWlanSettings', params).then(function() {
                _toast(wifiOn ? '2.4 GHz off' : '2.4 GHz on');
                setTimeout(_loadWifiSettings, 3000);
            }).catch(function(e) { _toast('Error: ' + e.message, true); });
        });
    }

    function _render5g(settings) {
        var tab5g = $('#wifi-tab-5g');
        if (!tab5g || !settings) return;
        var ap5on = settings.Wlan5gState === 1 || settings.Wlan5gState === '1' || settings.WlanAPEnable_5G === '1';

        tab5g.innerHTML = '<div class="card">' +
            '<h3>' +
                '5 GHz <span class="status-dot ' + (ap5on ? 'green' : 'red') + '"></span>' +
                '<span class="flex-spacer"></span>' +
                '<label class="switch"><input type="checkbox" id="wifi-5g-sw"' + (ap5on ? ' checked' : '') + '><span class="slider"></span></label>' +
            '</h3>' +
            '<div class="float-field">' +
                '<label>Network name (SSID)</label>' +
                '<input type="text" id="w5-ssid" value="' + escHtml(settings.WlanSSID_5G || settings.WlanSSID || '') + '" maxlength="32">' +
            '</div>' +
            '<div class="float-field">' +
                '<label>Security</label>' +
                '<select id="w5-security">' +
                    _securityOptions(settings.WlanAuthMode_5G || settings.WlanAuthMode || '') +
                '</select>' +
            '</div>' +
            '<div class="float-field pass-field">' +
                '<label>Password</label>' +
                '<input type="password" id="w5-pass" value="' + escHtml(settings.WlanAPPwd_5G || settings.WlanAPPwd || '') + '">' +
                '<button class="pass-eye" ' + actionAttr('togglePassVis', ['w5-pass']) + ' title="Show password">' + icon('ic-eye-off') + '</button>' +
            '</div>' +
            '<div class="wifi-adv-link">' +
                '<a ' + actionAttr('showWifiAdv', ['5g']) + '>Advanced settings \u203a</a>' +
            '</div>' +
        '</div>';

        $('#wifi-5g-sw').addEventListener('change', function() {
            var params = _fullParams(null, { ApStatus: ap5on ? 0 : 1 });
            API.webapi('SetWlanSettings', params).then(function() {
                _toast(ap5on ? '5 GHz off' : '5 GHz on');
                setTimeout(_loadWifiSettings, 3000);
            }).catch(function(e) { _toast('Error: ' + e.message, true); });
        });
    }

    function _securityOptions(current) {
        // WPA/WPA2-PSK (mode 4) removed: firmware generates broken hostapd config (TKIP CCMP)
        // WPA-PSK (mode 2) removed: TKIP not supported by this hostapd build
        return ['WPA2-PSK','OPEN'].map(function(s) {
            return '<option value="' + s + '"' + (current === s ? ' selected' : '') + '>' + s + '</option>';
        }).join('');
    }

    // --- Advanced settings panel (slide-in) ---

    function _showWifiAdv(band) {
        var s = _wifiSettings;
        if (!s) return;
        var is5g = band === '5g';
        var title = is5g ? 'Advanced 5 GHz Settings' : 'Advanced 2.4 GHz Settings';
        var prefix = is5g ? 'wa5' : 'wa2';

        var hideSsid = is5g ? (s['5GHiddenSSID'] || s.WlanHideSSID_5G || '0') : (s['2GHiddenSSID'] || s.WlanHideSSID || '0');
        var hidden = hideSsid === '1' || hideSsid === 1;

        var mode, modeOpts, channel, channelOpts, bw, bwOpts;

        if (is5g) {
            mode = s.WlanMode_5G || '';
            modeOpts = ['a/n/ac','a/n','n/ac','ac only'];
            channel = s.WlanChannel_5G || '0';
            channelOpts = [0,36,40,44,48,52,56,60,64,100,104,108,112,116,120,124,128,132,136,140,149,153,157,161,165];
            bw = s.WlanBandwidth_5G || '';
            bwOpts = ['20','40','80','20/40/80'];
        } else {
            mode = s.WlanMode || '';
            modeOpts = ['b/g/n','b/g','g/n','n only'];
            channel = s.WlanChannel || '0';
            channelOpts = [0,1,2,3,4,5,6,7,8,9,10,11,12,13];
            bw = s.WlanBandwidth || '';
            bwOpts = ['20','40','20/40'];
        }

        var fieldsHTML =
            '<label class="check-field"><input type="checkbox" id="' + prefix + '-hide"' + (hidden ? ' checked' : '') + '> Hide SSID</label>' +
            '<div class="float-field"><label>Standard</label>' +
                '<select id="' + prefix + '-mode">' +
                    modeOpts.map(function(m) {
                        return '<option value="' + m + '"' + (mode === m ? ' selected' : '') + '>' + m + '</option>';
                    }).join('') +
                '</select>' +
            '</div>' +
            '<div class="float-field"><label>Channel</label>' +
                '<select id="' + prefix + '-channel">' +
                    channelOpts.map(function(ch) {
                        return '<option value="' + ch + '"' + (String(channel) === String(ch) ? ' selected' : '') + '>' + (ch === 0 ? 'Auto' : ch) + '</option>';
                    }).join('') +
                '</select>' +
            '</div>' +
            '<div class="float-field"><label>Channel width</label>' +
                '<select id="' + prefix + '-bw">' +
                    bwOpts.map(function(b) {
                        return '<option value="' + b + '"' + (bw === b ? ' selected' : '') + '>' + b + ' MHz</option>';
                    }).join('') +
                '</select>' +
            '</div>';

        _showPanel(title, fieldsHTML, function() {
            var modeRev = is5g ? WMODE_5G_REV : WMODE_2G_REV;
            var bwRev = is5g ? BW_5G_REV : BW_2G_REV;
            var advFields = {
                Channel: parseInt($('#' + prefix + '-channel').value, 10) || 0,
                WMode: modeRev[$('#' + prefix + '-mode').value] || 3,
                Bandwidth: bwRev[$('#' + prefix + '-bw').value] || 0,
                SsidHidden: $('#' + prefix + '-hide').checked ? 1 : 0
            };

            var params = is5g ? _fullParams(null, advFields) : _fullParams(advFields, null);
            API.webapi('SetWlanSettings', params).then(function() {
                _hidePanel();
                _toast('Saved');
                setTimeout(_loadWifiSettings, 3000);
            }).catch(function(e) { _toast('Error: ' + e.message, true); });
        });
    }

    // --- Slide-in panel (reuses rule-panel CSS) ---

    function _showPanel(title, fieldsHTML, onSave) {
        _hidePanel();
        var overlay = document.createElement('div');
        overlay.id = 'rule-panel-overlay';
        overlay.className = 'rule-panel-overlay';
        overlay.innerHTML =
            '<div class="rule-panel">' +
                '<h3>' + escHtml(title) + '<button class="close-btn" id="wifi-panel-close">\u00d7</button></h3>' +
                '<div>' + fieldsHTML + '</div>' +
                '<div class="form-actions">' +
                    '<button id="wifi-panel-save">Save</button>' +
                    '<button class="btn-outline" id="wifi-panel-cancel">Cancel</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);

        overlay.addEventListener('click', function(e) { if (e.target === overlay) _hidePanel(); });
        document.getElementById('wifi-panel-close').addEventListener('click', _hidePanel);
        document.getElementById('wifi-panel-cancel').addEventListener('click', _hidePanel);
        document.getElementById('wifi-panel-save').addEventListener('click', onSave);
    }

    function _hidePanel() {
        var overlay = document.getElementById('rule-panel-overlay');
        if (overlay) overlay.remove();
    }

    // --- Save handlers (main card only: SSID + security + password) ---

    function _saveWifi24() {
        var pw = ($('#w-pass') || {}).value || '';
        var security = ($('#w-security') || {}).value || 'WPA2-PSK';
        if (security !== 'OPEN' && pw.length < 8) {
            _toast('Password must be at least 8 characters', true); return;
        }
        var params = _fullParams({ Ssid: $('#w-ssid').value, WpaKey: pw, SecurityMode: SEC_REV[security] != null ? SEC_REV[security] : 3 }, null);
        API.webapi('SetWlanSettings', params).then(function() {
            _toast('Saved');
            setTimeout(_loadWifiSettings, 3000);
        }).catch(function(e) { _toast('Error: ' + e.message, true); });
    }

    function _saveWifi5g() {
        var pw = ($('#w5-pass') || {}).value || '';
        var security = ($('#w5-security') || {}).value || 'WPA2-PSK';
        if (security !== 'OPEN' && pw.length < 8) {
            _toast('Password must be at least 8 characters', true); return;
        }
        var params = _fullParams(null, { Ssid: $('#w5-ssid').value, WpaKey: pw, SecurityMode: SEC_REV[security] != null ? SEC_REV[security] : 3 });
        API.webapi('SetWlanSettings', params).then(function() {
            _toast('Saved');
            setTimeout(_loadWifiSettings, 3000);
        }).catch(function(e) { _toast('Error: ' + e.message, true); });
    }

    function _saveWifiAll() {
        var pw2g = ($('#w-pass') || {}).value || '';
        var sec2g = ($('#w-security') || {}).value || 'WPA2-PSK';
        var pw5g = ($('#w5-pass') || {}).value || '';
        var sec5g = ($('#w5-security') || {}).value || 'WPA2-PSK';
        if (sec2g !== 'OPEN' && pw2g.length < 8) {
            _toast('2.4 GHz password must be at least 8 characters', true); return;
        }
        if (sec5g !== 'OPEN' && pw5g.length < 8) {
            _toast('5 GHz password must be at least 8 characters', true); return;
        }
        var params = _fullParams(
            { Ssid: ($('#w-ssid') || {}).value || '', WpaKey: pw2g, SecurityMode: SEC_REV[sec2g] != null ? SEC_REV[sec2g] : 3 },
            { Ssid: ($('#w5-ssid') || {}).value || '', WpaKey: pw5g, SecurityMode: SEC_REV[sec5g] != null ? SEC_REV[sec5g] : 3 }
        );
        API.webapi('SetWlanSettings', params).then(function() {
            _toast('Saved');
            setTimeout(_loadWifiSettings, 3000);
        }).catch(function(e) { _toast('Error: ' + e.message, true); });
    }

    function _togglePassVis(inputId) {
        var inp = document.getElementById(inputId);
        if (!inp) return;
        var show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        var btn = inp.parentNode && inp.parentNode.querySelector('.pass-eye');
        if (btn) btn.innerHTML = icon(show ? 'ic-eye' : 'ic-eye-off');
    }

    App.registerPage('wifi', renderWifi);
    App._saveWifi24 = _saveWifi24;
    App._saveWifi5g = _saveWifi5g;
    App._saveWifiAll = _saveWifiAll;
    App._showWifiAdv = _showWifiAdv;
    App._togglePassVis = _togglePassVis;
})();
