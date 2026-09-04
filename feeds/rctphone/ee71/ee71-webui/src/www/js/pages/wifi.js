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
                '<button id="w-save-all" ' + actionAttr('saveWifiAll') + '>Save</button>' +
            '</div>';

        _loadWifiSettings();
    }

    var SEC_MAP = {0:'OPEN',1:'WEP',2:'WPA-PSK',3:'WPA2-PSK',4:'WPA/WPA2-PSK'};
    var SEC_REV = {'OPEN':0,'WEP':1,'WPA-PSK':2,'WPA2-PSK':3,'WPA/WPA2-PSK':4};

    // --- Enums -------------------------------------------------------------
    //
    // ONE table per field, values numeric, and the <select> carries the number
    // itself — so there is no reverse map to disagree with the forward one.
    // The pair of tables this replaced disagreed: WMODE_2G_REV mapped both
    // 'g/n' and 'b/g/n' to 3, so picking "g/n" saved and read back as "b/g/n".
    // That is the same failure class as the old ENC_SET WPA bug. Do not
    // reintroduce a second table, and do not "correct" these values from any
    // source other than the stock SPA.
    //
    // Authority for every value below: docs/ee71-wifi-values.md, which cites
    // the stock SPA's EE override block (build.formatted.js:32205-32240).
    // Our own older docs carried an invented 5 GHz table (5=a, 6=a/n/ac,
    // 7=a/n, 8=n/ac, 9=ac); 7/8/9 have never existed in any firmware artefact.
    //
    // *_MAP is the READ table — every value the firmware can legitimately
    // report, so the current setting can always be displayed truthfully.
    // *_OFFER is the WRITE list — the values this UI is willing to send,
    // in display order. They differ on purpose: the EE build drops the
    // generic "auto" (0) from both mode lists, but the shipped device really
    // does hold Guest5GPhyMode=0, so 0 must be readable without being offered.
    var WMODE_2G       = {0:'Auto', 1:'802.11 b', 2:'802.11 b/g', 3:'802.11 b/g/n'};
    var WMODE_2G_OFFER = [3, 2, 1];
    var WMODE_5G       = {0:'Auto (a/n/ac)', 4:'802.11 a', 5:'802.11 n', 6:'802.11 ac'};
    var WMODE_5G_OFFER = [6, 5, 4];

    // Bandwidth labels state what the device actually produces, not what the
    // number looks like it should mean. On 5 GHz the old BW_5G[0] said
    // "20/40/80" while qcmap_wifi_ctl maps 0 to vht_oper_chwidth=0 — 20/40 —
    // so choosing "80" showed "20/40/80" and got 40.
    // 4 is the stock "auto" of the 802.11ac bandwidth list and 0 the "auto" of
    // the 802.11n one; qcmap_wifi_ctl treats both identically, and 0 is the
    // value this device is known to store, so 0 is the one we write.
    var BW_2G = {0:'20/40 (auto)', 1:'20', 2:'40'};
    var BW_5G = {0:'20/40 (auto)', 1:'20', 2:'40', 3:'80', 4:'20/40 (auto)'};

    // Which widths each standard can ACTUALLY deliver, keyed by WMode.
    //
    // Not cosmetic. 802.11a has neither HT nor VHT, so qcmap_wifi_ctl writes
    // no ht_capab and no vht_oper_chwidth for WMode 4 and the radio runs at 20
    // whatever the width says; 802.11n has no VHT, so 80 silently becomes 40.
    // Offering those widths would be a control showing a value the device does
    // not hold — the exact defect this whole audit exists to remove.
    //
    // Stock does the same thing: it swaps BandwidthA / BandwidthN / BandwidthAc
    // by WMode (build.formatted.js:55146, and :55150 for 2.4 GHz).
    //
    // `fallback` is where the width lands when the chosen standard cannot keep
    // the current one — "auto" wherever it exists, because it is the only value
    // that cannot over-promise. An unknown mode gets the permissive list, which
    // mirrors qcmap_wifi_ctl treating an unrecognised WMode as ac.
    var BW_BY_MODE_5G = {
        4: {offer: [1],          fallback: 1},   // 802.11a  — 20 only
        5: {offer: [0, 1, 2],    fallback: 0},   // 802.11n  — no VHT, so no 80
        6: {offer: [0, 1, 2, 3], fallback: 0},   // 802.11ac
        0: {offer: [0, 1, 2, 3], fallback: 0},   // auto == ac
    };
    var BW_BY_MODE_2G = {
        1: {offer: [1],    fallback: 1},         // 802.11b   — 20 only
        2: {offer: [1],    fallback: 1},         // 802.11b/g — 20 only
        3: {offer: [0, 1], fallback: 0},         // 802.11b/g/n
        0: {offer: [0, 1], fallback: 0},
    };
    function _bwFor(is5g, wmode) {
        var table = is5g ? BW_BY_MODE_5G : BW_BY_MODE_2G;
        return table[wmode] != null ? table[wmode] : table[is5g ? 6 : 3];
    }

    // 5 GHz: auto plus UNII-1 only. Two separate exclusions, both deliberate.
    //
    // 149-165 are outside the GB regulatory domain this device sets
    // (country_code=GB), so hostapd would refuse them outright.
    //
    // 52-64 and 100-140 are every DFS channel in ETSI, and we do not offer
    // them because we do not support them: generate_hostapd_wlan1 writes
    // `ieee80211d=1` and no `ieee80211h` at all, and `ieee80211h=1` is the
    // hostapd switch that enables DFS/TPC. So the key that would make a DFS
    // channel work is definitively not written — this is not "untested".
    // Choosing one would cost a silent minute of channel-availability check
    // at best, and leave 5 GHz down until someone SSHes in at worst. The
    // channel only became reachable at all in this release (it never left
    // wifi.js before — see _fullParams), so nothing is being taken away.
    //
    // This is a UI restriction, not a retreat: the channel geometry in
    // qcmap_wifi_ctl still covers every GB channel and is what a later DFS
    // test would build on. A device already sitting on a DFS channel keeps
    // it — _enumOptions/_channelOptions surface a current value that is not
    // in this list rather than dropping it.
    //
    // Stock offers the DFS channels (build.formatted.js:11222-11240), which
    // is not evidence for this interface: stock compiles the guest-AP panel
    // off entirely, so its list was never exercised on wlan1.
    var CHANNELS_5G = [0,36,40,44,48];
    var CHANNELS_2G = [0,1,2,3,4,5,6,7,8,9,10,11,12,13];

    function _int(v, def) {
        if (v == null || v === '') return def;
        var n = parseInt(v, 10);
        return isNaN(n) ? def : n;
    }

    // Return the value only when the device reported one this UI understands;
    // null otherwise, so the caller can omit the field instead of inventing a
    // number. Validated against the READ table, so a legitimate firmware value
    // we do not offer still survives a save untouched.
    function _enumVal(map, v) {
        var n = _int(v, null);
        return (n != null && map[n] != null) ? n : null;
    }

    // Build a <select> body. If the device currently holds a value that is not
    // in the offered list, it is added rather than dropped: a <select> with no
    // matching option silently shows its FIRST option, and the next Save then
    // writes that. That is how a radio on 802.11b would read as "b/g/n" and be
    // converted to it by an unrelated save.
    function _enumOptions(map, offered, current) {
        var vals = offered.slice();
        if (current != null && vals.indexOf(current) === -1) vals.unshift(current);
        return vals.map(function(v) {
            var label = map[v] != null ? map[v] : ('Unknown (' + v + ')');
            return '<option value="' + v + '"' + (v === current ? ' selected' : '') +
                   '>' + escHtml(label) + '</option>';
        }).join('');
    }

    function _channelOptions(list, current) {
        var vals = list.slice();
        if (current != null && vals.indexOf(current) === -1) vals.push(current);
        return vals.map(function(ch) {
            return '<option value="' + ch + '"' + (ch === current ? ' selected' : '') +
                   '>' + (ch === 0 ? 'Auto' : ch) + '</option>';
        }).join('');
    }


    // Last fetched settings, kept for advanced panel access
    var _wifiSettings = null;
    // The raw AP2G / 5 GHz sub-objects exactly as GetWlanSettings returned
    // them. Everything a save must preserve is read from here, never from a
    // display label: a label round trip cannot represent a value we do not
    // offer, and turns "unknown" into "the first option".
    var _raw2g = null;
    var _raw5g = null;
    var _currentMode = '2g'; // '2g', '5g', or 'dual'

    // Detect WiFi mode from settings + CGI status.
    // In dual mode, 5GAPStatus=0 in DB (5G via our watchdog, not core_app),
    // so Wlan5gState may be 0 even though wlan1 is running.
    // Use _cgiStatus.wlan1 + wlan_mode as ground truth for dual-band.
    var _cgiStatus = null;
    function _flagOn(value) {
        return value === 1 || value === '1' || value === true;
    }

    function _wifiState(settings, state) {
        var dualConfigured = !!(_cgiStatus && _cgiStatus.wlan_mode === 'AP-AP');
        var running2g = _flagOn(settings && settings.Wlan2gState) ||
            (!_flagOn(settings && settings.Wlan2gState) && state && _flagOn(state.WlanState));
        var running5g = _flagOn(settings && settings.Wlan5gState) || _flagOn(settings && settings.WlanAPEnable_5G);

        if (dualConfigured) {
            if (_cgiStatus && typeof _cgiStatus.wlan0 === 'boolean') running2g = _cgiStatus.wlan0;
            if (_cgiStatus && typeof _cgiStatus.wlan1 === 'boolean') running5g = _cgiStatus.wlan1;
            return {
                mode: 'dual',
                configured2g: true,
                configured5g: true,
                running2g: running2g,
                running5g: running5g,
                degradedDual: !running5g
            };
        }

        var configured5g = _flagOn(settings && settings.Wlan5gState) || _flagOn(settings && settings.WlanAPEnable_5G);
        if (configured5g) {
            if (_cgiStatus && typeof _cgiStatus.wlan0 === 'boolean') running5g = _cgiStatus.wlan0 || running5g;
            return {
                mode: '5g',
                configured2g: false,
                configured5g: true,
                running2g: false,
                running5g: running5g,
                degradedDual: false
            };
        }
        if (_cgiStatus && typeof _cgiStatus.wlan0 === 'boolean') running2g = _cgiStatus.wlan0;
        return {
            mode: '2g',
            configured2g: true,
            configured5g: false,
            running2g: running2g,
            running5g: false,
            degradedDual: false
        };
    }

    // _currentMode feeds the apply body, and '5g' is not a mode we can send any
    // more. But there are two very different ways _wifiState() reports '5g',
    // and they must NOT be collapsed into one answer:
    //
    //  a) _cgiStatus is null — the status CGI failed, so wlan_mode is unknown
    //     and dualConfigured defaulted to false. That is a MISSING READING, not
    //     evidence of anything. This device is always AP-AP, so 'dual' is the
    //     right assumption and the save proceeds normally.
    //
    //  b) the status call SUCCEEDED and honestly reports wlan_mode !== 'AP-AP'
    //     with 5 GHz on — a genuinely single-AP, 5 GHz-only device (an
    //     unprovisioned unit, or one restored from a pre-2026 backup). Here
    //     'dual' would be a lie: an unrelated save, like renaming an SSID,
    //     would flip a working single-band device toward dual-band behind the
    //     user's back. Equally, mapping it to '2g' would move it to 2.4 GHz and
    //     lose their 5 GHz. Neither is neutral, so we refuse in _applyWifi
    //     rather than silently pick a band layout for them.
    //
    // DO NOT collapse these back into one clamp. Without case (a) one failed
    // status request latches _currentMode to '5g' for the rest of the page's
    // life and every later save is refused, including ones with nothing to do
    // with 5 GHz. The symptom the user reports is "WiFi settings randomly stop
    // saving", with nothing to connect it to a status request.
    function _detectMode(s, state) {
        var m = _wifiState(s, state).mode;
        if (m === '5g' && !_cgiStatus) return 'dual';  // (a) unknown, assume AP-AP
        return m;                                       // (b) trust a real reading
    }

    // Compute mode from desired toggle states.
    //
    // Never returns '5g'. That mode is the 5GAPStatus band-switch — it moves
    // wlan0 itself to 5 GHz — and on this device wlan1 is already a 5 GHz AP
    // in AP-AP, so it would put two 5 GHz APs on one radio (the QCA6174 does
    // 2.4+5, not 5+5). wifi.cgi rejects it outright. 2.4 GHz is therefore not
    // a real degree of freedom: want2g is accepted for call-site symmetry but
    // ignored, and the 2.4 GHz switch guards the off case itself.
    function _modeFromToggles(want2g, want5g) {
        return want5g ? 'dual' : '2g';
    }

    // Build full WiFi params — firmware resets omitted fields to empty.
    // SecurityMode 4 (WPA/WPA2) and 2 (WPA) generate broken hostapd config — clamp to safe values
    function _safeSecMode(mode) { return (mode === 0) ? 0 : 3; }

    // max_numsta reaches hostapd's max_num_sta through core_app, and an
    // omitted field lands there as 0 — which the QCA driver reads as "admit
    // zero clients", the historic "WiFi is up but nobody can connect" bug.
    // So it is always sent. A stored 0 is that bug, not a user choice, and is
    // replaced; anything else the device reports is the user's and is kept.
    // (This used to be hard-coded to 15, which reset the value on every save.)
    var MAX_STA_DEFAULT = 15;
    function _safeMaxSta(v) {
        var n = _int(v, 0);
        return (n >= 1 && n <= 32) ? n : MAX_STA_DEFAULT;
    }

    // WpaType is 0=TKIP, 1=AES/CCMP, 2=auto on BOTH get and set
    // (docs/ee71-wifi-values.md §4, corroborated by core_app's hostapd writer
    // at 0x1e87b4). There is no off-by-one — a past "fix" that added one is
    // what produced the WPA pairwise bug, so do not shift these. AES is only
    // the fallback for a device that reported nothing usable; it used to be
    // hard-coded, which silently converted TKIP and Auto on every save.
    function _safeWpaType(v) {
        var n = _int(v, 1);
        return (n === 0 || n === 1 || n === 2) ? n : 1;
    }

    function _addIf(obj, key, val) { if (val != null) obj[key] = val; }

    // Carry a field through a save only if the device gave us a value we can
    // vouch for. Omitting beats guessing: an omitted field is at worst
    // unchanged, whereas a guessed one is a silent write of something the user
    // never chose.
    function _carryRadioFields(dst, raw, wmodeMap, bwMap) {
        _addIf(dst, 'WMode', _enumVal(wmodeMap, raw.WMode));
        _addIf(dst, 'Channel', _int(raw.Channel, null));
        _addIf(dst, 'Bandwidth', _enumVal(bwMap, raw.Bandwidth));
        _addIf(dst, 'SsidHidden',
               raw.SsidHidden != null ? (_flagOn(raw.SsidHidden) ? 1 : 0) : null);
    }

    // Apply WiFi settings via wifi.cgi → qcmap_wifi_ctl.
    function _applyWifi(params) {
        // Case (b) from _detectMode: the device really is in a single-AP,
        // 5 GHz-only layout, which this UI can no longer express — sending
        // either 'dual' or '2g' would silently change the user's bands. Refuse,
        // and point at the band switches, which send an explicit mode via
        // _modeFromToggles and so remain the way out of this state.
        //
        // The guidance lives in the Error's message, not in a _toast() here, on
        // purpose. App.showNotification is one shared element whose textContent
        // each call overwrites, and every caller re-toasts on the rejection in
        // the next microtask — the switch handlers via
        // _toast('Error: ' + App.errorText(e)) and wrapFormSubmit via its own
        // handler (app-core.js:385-388). Both read err.message, so a short
        // internal string here would be the only thing the user ever sees and
        // the way out would be invisible. Keep this message self-contained and
        // readable after an "Error: " prefix.
        if (_currentMode === '5g') {
            return Promise.reject(new Error(
                'this device is in a 5 GHz-only band layout that this page ' +
                'cannot change. Use the 2.4/5 GHz switches to move it to ' +
                'dual-band first.'));
        }
        var data = { action: 'apply', mode: _currentMode };
        if (params.AP2G) data.AP2G = params.AP2G;
        if (params.AP5G) data.AP5G = params.AP5G;
        if (params.AP2G_guest) data.AP2G_guest = params.AP2G_guest;
        if (params.AP5G_guest) data.AP5G_guest = params.AP5G_guest;
        return API.cgiPost('wifi.cgi', data).then(function(r) {
            // The device was not provisioned for dual-band (wifi_config.GuestAP
            // was 0 — the factory value). qcmap_wifi_ctl has just set it to 1,
            // but QCMAP is running single-AP with no wlan1 interface until
            // core_app re-asserts the mode at its next start, so 5 GHz cannot
            // appear before a reboot. Say so rather than reporting plain success.
            if (r && r.reboot_required) {
                _toast('Dual-band provisioned — reboot for 5 GHz to start', true);
            }
            // wifi.cgi sets this when qcmap_wifi_ctl could not write
            // wifi_config.GuestAP: 5 GHz is up now but will not survive a
            // reboot. The caller's own success toast fires after this one, so
            // say it here or the user is told only "5 GHz on".
            if (r && r.warning) {
                _toast(r.warning, true);
            }
            return r;
        });
    }

    function _fullParams(overrides2g, overrides5g) {
        var s = _wifiSettings || {};
        var sec2g = _safeSecMode(SEC_REV[s.WlanAuthMode] != null ? SEC_REV[s.WlanAuthMode] : 3);
        var sec5g = _safeSecMode(SEC_REV[s.WlanAuthMode_5G] != null ? SEC_REV[s.WlanAuthMode_5G] : 3);
        var r2 = _raw2g || {};
        var r5 = _raw5g || {};
        var ap2g = { ApStatus: 1, Ssid: s.WlanSSID || '', WpaKey: s.WlanAPPwd || '', SecurityMode: sec2g,
                     WpaType: _safeWpaType(r2.WpaType), max_numsta: _safeMaxSta(r2.max_numsta) };
        var ap5g = { ApStatus: 0, Ssid: s.WlanSSID_5G || '', WpaKey: s.WlanAPPwd_5G || '', SecurityMode: sec5g,
                     WpaType: _safeWpaType(r5.WpaType), max_numsta: _safeMaxSta(r5.max_numsta) };
        _carryRadioFields(ap2g, r2, WMODE_2G, BW_2G);
        _carryRadioFields(ap5g, r5, WMODE_5G, BW_5G);
        if (overrides2g) Object.keys(overrides2g).forEach(function(k) { ap2g[k] = overrides2g[k]; });
        if (overrides5g) Object.keys(overrides5g).forEach(function(k) { ap5g[k] = overrides5g[k]; });

        // Set ApStatus based on mode.
        // In dual mode: AP2G.ApStatus=1 (2.4G on wlan0), AP5G.ApStatus=0 (not band-switch),
        //               guest.ApStatus=1 (5G on wlan1 via AP2G_guest/AP5G_guest)
        // In 2g mode:   AP2G.ApStatus=1, AP5G.ApStatus=0, guest.ApStatus=0
        //
        // There is deliberately no '5g' branch any more. It set AP5G.ApStatus=1
        // — the band-switch that moves wlan0 to 5 GHz — which on this always-AP-AP
        // device stacks a second 5 GHz AP on the one radio. AP5G.ApStatus stays 0
        // on every path, so that body can no longer be constructed at all; an
        // unexpected _currentMode now falls into the safe 2.4 GHz case.
        if (_currentMode === 'dual') {
            ap2g.ApStatus = 1;
            ap5g.ApStatus = 0;
        } else {
            ap2g.ApStatus = 1;
            ap5g.ApStatus = 0;
        }

        // AP2G_guest mirrors 5GHz settings — in AP-AP mode, wlan1 is the "guest AP"
        var guestSsid = ap5g.Ssid || (ap2g.Ssid ? ap2g.Ssid + '_5G' : 'EE71_5G');
        var guestKey = ap5g.WpaKey || ap2g.WpaKey || '12345678';
        var guest = {
            ApStatus: _currentMode === 'dual' ? 1 : 0,
            Ssid: guestSsid,
            WpaKey: guestKey,
            SecurityMode: ap5g.SecurityMode,
            WpaType: ap5g.WpaType,
            max_numsta: ap5g.max_numsta
        };
        // wlan1's whole hostapd config is generated from THIS object and
        // nothing else (qcmap_wifi_ctl generate_hostapd_wlan1). A field left
        // out of it is not "unchanged" — it falls back to that tool's own
        // default: channel 36, 20/40, SSID broadcast. So every 5 GHz radio
        // field has to be copied across, or a save that only renames the SSID
        // also drags the channel back to 36 and un-hides the network. It is
        // copied from ap5g rather than r5 so the 5 GHz advanced panel's
        // overrides (applied to ap5g above) land here too.
        ['WMode', 'Channel', 'Bandwidth', 'SsidHidden'].forEach(function(k) {
            _addIf(guest, k, ap5g[k]);
        });
        return { AP2G: ap2g, AP5G: ap5g, AP2G_guest: guest, AP5G_guest: guest };
    }

    // Kept as a thin alias so the surrounding progress messages read the same;
    // the toast itself is now the shared App.showNotification component.
    var _toast = App.showNotification;

    function _loadWifiSettings() {
        return Promise.all([
            API.webapi('GetWlanSettings').catch(function() { return null; }),
            API.webapi('GetWlanState').catch(function() { return null; }),
            API.webapi('GetWlanSupportMode').catch(function() { return null; }),
            API.cgiGet('wifi.cgi', { action: 'status' }).catch(function() { return null; }),
        ]).then(function(results) {
            var settings = results[0], state = results[1];
            _cgiStatus = results[3];

            // Map nested AP2G/AP5G/AP2G_guest to flat names for display.
            // In AP-AP mode, wlan1 (5GHz) is the "guest AP" — prefer AP2G_guest
            // over AP5G for 5GHz data since that's what controls wlan1 hostapd.
            if (settings) {
                var ap2g = settings.AP2G || {};
                var ap5g = settings.AP5G || {};
                var guest = settings.AP2G_guest || {};
                // Use AP2G_guest for 5GHz display when available (it maps to Guest5G* DB fields)
                var src5g = (guest.Ssid && guest.ApStatus != null) ? guest : ap5g;
                // Keep the sub-objects themselves. The flat names below stay
                // because the two band cards read them, but the radio enums
                // (WMode / Bandwidth / Channel / SsidHidden) are deliberately
                // NOT flattened into label strings any more: the advanced panel
                // and _fullParams read _raw2g/_raw5g, so there is one
                // representation of a value instead of a number and a label
                // that could drift apart.
                _raw2g = ap2g;
                _raw5g = src5g;
                if (!settings.WlanSSID && ap2g.Ssid) settings.WlanSSID = ap2g.Ssid;
                if (!settings.WlanAPPwd && ap2g.WpaKey) settings.WlanAPPwd = ap2g.WpaKey;
                if (settings.WlanAuthMode == null && ap2g.SecurityMode != null) settings.WlanAuthMode = SEC_MAP[ap2g.SecurityMode] || '';
                if (!settings.WlanSSID_5G && src5g.Ssid) settings.WlanSSID_5G = src5g.Ssid;
                if (!settings.WlanAPPwd_5G && src5g.WpaKey) settings.WlanAPPwd_5G = src5g.WpaKey;
                if (settings.WlanAuthMode_5G == null && src5g.SecurityMode != null) settings.WlanAuthMode_5G = SEC_MAP[src5g.SecurityMode] || '';
                if (settings.Wlan2gState == null && ap2g.ApStatus != null) settings.Wlan2gState = String(ap2g.ApStatus);
                if (settings.Wlan5gState == null && src5g.ApStatus != null) settings.Wlan5gState = String(src5g.ApStatus);
            }

            _wifiSettings = settings;
            if (settings) _currentMode = _detectMode(settings, state);

            // --- 2.4 GHz ---
            _render2g(settings, state);

            // --- 5 GHz ---
            _render5g(settings, state);
        }).catch(function() {});
    }

    function _render2g(settings, state) {
        var tab2g = $('#wifi-tab-2g');
        if (!tab2g || !settings) return;
        var wifi = _wifiState(settings, state);
        var wifiOn = wifi.running2g;
        var configured = wifi.configured2g;

        tab2g.innerHTML = '<div class="card">' +
            '<h3>' +
                '2.4 GHz <span class="status-dot ' + (wifiOn ? 'green' : 'red') + '"></span>' +
                '<span class="flex-spacer"></span>' +
                '<label class="switch"><input type="checkbox" id="wifi-2g-sw"' + (configured ? ' checked' : '') + '><span class="slider"></span></label>' +
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
            var want2g = this.checked;
            var cur = _wifiState(_wifiSettings || {}, state);
            var cur5g = cur.configured5g;
            // 2.4 GHz is wlan0 — the primary AP core_app owns and QCMAP
            // brings up at boot. Switching it off is not representable here:
            // with 5 GHz also off it leaves no WiFi at all, and with 5 GHz on
            // it would mean the 5GAPStatus band-switch stacked on the guest AP
            // already using 5 GHz (two 5 GHz APs, one radio), which wifi.cgi
            // now refuses. Fail honestly in the UI instead of sending a
            // request the CGI will reject.
            if (!want2g) {
                _toast(cur5g
                    ? '2.4 GHz cannot be switched off while 5 GHz is on'
                    : 'Cannot disable both bands', true);
                this.checked = true;
                return;
            }
            _currentMode = _modeFromToggles(want2g, cur5g);
            var params = _fullParams(null, null);
            _applyWifi(params).then(function() {
                _toast(want2g ? '2.4 GHz on' : '2.4 GHz off');
                setTimeout(_loadWifiSettings, 8000);
            }).catch(function(e) { _toast('Error: ' + App.errorText(e), true); });
        });
    }

    function _render5g(settings, state) {
        var tab5g = $('#wifi-tab-5g');
        if (!tab5g || !settings) return;
        var wifi = _wifiState(settings, state);
        var ap5on = wifi.running5g;
        var configured = wifi.configured5g;

        tab5g.innerHTML = '<div class="card">' +
            '<h3>' +
                '5 GHz <span class="status-dot ' + (ap5on ? 'green' : 'red') + '"></span>' +
                '<span class="flex-spacer"></span>' +
                '<label class="switch"><input type="checkbox" id="wifi-5g-sw"' + (configured ? ' checked' : '') + '><span class="slider"></span></label>' +
            '</h3>' +
            (wifi.degradedDual ? '<div class="form-actions mb-1"><button class="btn-outline" ' + actionAttr('repairWifi5g') + '>Repair 5 GHz</button></div>' : '') +
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
            var want5g = this.checked;
            var cur = _wifiState(_wifiSettings || {}, state);
            var cur2g = cur.configured2g;
            if (!want5g && !cur2g) {
                _toast('Cannot disable both bands', true);
                this.checked = true;
                return;
            }
            _currentMode = _modeFromToggles(cur2g, want5g);
            var params = _fullParams(null, null);
            _applyWifi(params).then(function() {
                _toast(want5g ? '5 GHz on' : '5 GHz off');
                setTimeout(_loadWifiSettings, 8000);
            }).catch(function(e) { _toast('Error: ' + App.errorText(e), true); });
        });
    }

    function _needs5gRepair() {
        return _wifiState(_wifiSettings || {}, null).degradedDual;
    }

    function _schedule5gRepairCheck(retriesLeft) {
        setTimeout(function() {
            _loadWifiSettings();
            setTimeout(function() {
                if (_needs5gRepair()) {
                    if (retriesLeft > 0) {
                        _toast('5 GHz still down, retrying...');
                        API.cgiPost('wifi.cgi', { action: 'restart', target: 'guest' }).then(function() {
                            _schedule5gRepairCheck(retriesLeft - 1);
                        }).catch(function(e) { _toast('Error: ' + App.errorText(e), true); });
                        return;
                    }
                    _toast('5 GHz is still down after repair', true);
                    return;
                }
                _toast('5 GHz is back');
            }, 1500);
        }, 8000);
    }

    function _repairWifi5g() {
        _toast('Restarting 5 GHz...');
        API.cgiPost('wifi.cgi', { action: 'restart', target: 'guest' }).then(function() {
            _toast('5 GHz restart requested');
            _schedule5gRepairCheck(1);
        }).catch(function(e) { _toast('Error: ' + App.errorText(e), true); });
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

        var raw = (is5g ? _raw5g : _raw2g) || {};
        var legacyHide = is5g ? (s['5GHiddenSSID'] || s.WlanHideSSID_5G) : (s['2GHiddenSSID'] || s.WlanHideSSID);
        var hidden = _flagOn(raw.SsidHidden != null ? raw.SsidHidden : legacyHide);

        var modeMap  = is5g ? WMODE_5G : WMODE_2G;
        var modeOffer = is5g ? WMODE_5G_OFFER : WMODE_2G_OFFER;
        var bwMap    = is5g ? BW_5G : BW_2G;
        var chanList = is5g ? CHANNELS_5G : CHANNELS_2G;

        var mode    = _enumVal(modeMap, raw.WMode);
        var bw      = _enumVal(bwMap, raw.Bandwidth);
        var channel = _int(raw.Channel, 0);
        // Constrained by the STORED standard on first render too. If the device
        // holds a width that standard cannot deliver, _enumOptions still shows
        // it (selected), so the inconsistency is visible rather than hidden —
        // and leaving the panel alone preserves it. Touching Standard
        // re-evaluates and drops it.
        var bwOffer = _bwFor(is5g, mode).offer;

        var fieldsHTML =
            '<label class="check-field"><input type="checkbox" id="' + prefix + '-hide"' + (hidden ? ' checked' : '') + '> Hide SSID</label>' +
            '<div class="float-field"><label>Standard</label>' +
                '<select id="' + prefix + '-mode">' +
                    _enumOptions(modeMap, modeOffer, mode) +
                '</select>' +
            '</div>' +
            '<div class="float-field"><label>Channel</label>' +
                '<select id="' + prefix + '-channel">' +
                    _channelOptions(chanList, channel) +
                '</select>' +
            '</div>' +
            '<div class="float-field"><label>Channel width (MHz)</label>' +
                '<select id="' + prefix + '-bw">' +
                    _enumOptions(bwMap, bwOffer, bw) +
                '</select>' +
            '</div>';

        _showPanel(title, fieldsHTML, function() {
            // No `|| 3` / `|| 0` fallbacks here: those turn a legitimate 0 into
            // something else. The <select> can only hold values this page put
            // in it, so _int's null is a genuinely broken read and the field is
            // omitted rather than guessed.
            var advFields = { SsidHidden: $('#' + prefix + '-hide').checked ? 1 : 0 };
            _addIf(advFields, 'Channel', _int($('#' + prefix + '-channel').value, null));
            _addIf(advFields, 'WMode', _int($('#' + prefix + '-mode').value, null));
            _addIf(advFields, 'Bandwidth', _int($('#' + prefix + '-bw').value, null));

            var params = is5g ? _fullParams(null, advFields) : _fullParams(advFields, null);
            App.wrapFormSubmit('#wifi-panel-save', function() {
                return _applyWifi(params).then(function() {
                    _hidePanel();
                    return new Promise(function(r) { setTimeout(r, 3000); });
                }).then(_loadWifiSettings);
            }, { pending: 'Applying\u2026', success: 'Advanced settings saved' });
        });

        // Re-evaluate the width list when Standard changes. _showPanel appends
        // synchronously, so the elements exist by the time it returns.
        var modeSel = document.getElementById(prefix + '-mode');
        var bwSel = document.getElementById(prefix + '-bw');
        if (modeSel && bwSel) {
            modeSel.addEventListener('change', function() {
                var rule = _bwFor(is5g, _int(this.value, null));
                var cur = _int(bwSel.value, null);
                // Keep the width if the new standard can still deliver it;
                // otherwise take that standard's fallback. Never leave the
                // select displaying a width the standard cannot produce.
                var keep = (cur != null && rule.offer.indexOf(cur) !== -1) ? cur : rule.fallback;
                bwSel.innerHTML = _enumOptions(bwMap, rule.offer, keep);
            });
        }
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

    // hostapd restarts on apply and takes several seconds to come back; hold the
    // pending state until then so the page does not look finished while the radio
    // is still down.
    var WIFI_SETTLE_MS = 8000;

    function _applyAndReload(params) {
        return _applyWifi(params).then(function() {
            return new Promise(function(r) { setTimeout(r, WIFI_SETTLE_MS); });
        }).then(_loadWifiSettings);
    }

    function _validateBand(prefix, label) {
        var pw = (($('#' + prefix + '-pass') || {}).value) || '';
        var security = (($('#' + prefix + '-security') || {}).value) || 'WPA2-PSK';
        var ssid = (($('#' + prefix + '-ssid') || {}).value) || '';
        if (!ssid.trim()) {
            App.renderFieldError('#' + prefix + '-ssid', label + ' network name is required');
            return null;
        }
        if (security !== 'OPEN' && pw.length < 8) {
            App.renderFieldError('#' + prefix + '-pass', label + ' password must be at least 8 characters');
            return null;
        }
        return {
            Ssid: ssid,
            WpaKey: pw,
            SecurityMode: SEC_REV[security] != null ? SEC_REV[security] : 3
        };
    }

    function _saveWifi24() {
        App.clearFieldErrors();
        var band = _validateBand('w', '2.4 GHz');
        if (!band) return;
        App.wrapFormSubmit('#w-save-all', function() {
            return _applyAndReload(_fullParams(band, null));
        }, { pending: 'Applying\u2026', success: '2.4 GHz settings saved' });
    }

    function _saveWifi5g() {
        App.clearFieldErrors();
        var band = _validateBand('w5', '5 GHz');
        if (!band) return;
        App.wrapFormSubmit('#w-save-all', function() {
            return _applyAndReload(_fullParams(null, band));
        }, { pending: 'Applying\u2026', success: '5 GHz settings saved' });
    }

    function _saveWifiAll() {
        App.clearFieldErrors();
        var b2 = _validateBand('w', '2.4 GHz');
        if (!b2) return;
        var b5 = _validateBand('w5', '5 GHz');
        if (!b5) return;
        App.wrapFormSubmit('#w-save-all', function() {
            return _applyAndReload(_fullParams(b2, b5));
        }, { pending: 'Applying\u2026', success: 'WiFi settings saved on both bands' });
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
    App._repairWifi5g = _repairWifi5g;
})();
