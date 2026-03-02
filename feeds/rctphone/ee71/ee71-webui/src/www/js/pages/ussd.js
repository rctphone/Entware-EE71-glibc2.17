;(function() {
    'use strict';
    var $ = App.$, escHtml = App.escHtml, actionAttr = App.actionAttr;

    var OPERATORS = [
        { name: 'MegaFon', codes: [
            { label: 'Balance', code: '*100#' },
            { label: 'Packages', code: '*558#' },
            { label: 'Own Number', code: '*205#' }
        ]},
        { name: 'MTS', codes: [
            { label: 'Balance', code: '*100#' },
            { label: 'Packages', code: '*100*1#' },
            { label: 'Own Number', code: '*111*0887#' }
        ]},
        { name: 'Beeline', codes: [
            { label: 'Balance', code: '*102#' },
            { label: 'Own Number', code: '*110*10#' }
        ]},
        { name: 'Tele2', codes: [
            { label: 'Balance', code: '*105#' },
            { label: 'Packages', code: '*155*0#' },
            { label: 'Own Number', code: '*201#' }
        ]},
        { name: 'Yota', codes: [
            { label: 'Balance', code: '*100#' },
            { label: 'Packages', code: '*101#' },
            { label: 'Own Number', code: '*103#' }
        ]}
    ];

    var _pollTimer = null;
    var _sessionActive = false;

    function renderUSSD(container) {
        var quickHtml = '<div class="ussd-quick-grid">';
        OPERATORS.forEach(function(op) {
            quickHtml += '<button class="ussd-quick-btn" ' +
                actionAttr('ussdSend', [op.codes[0].code]) + '>' +
                escHtml(op.name) + '<span class="ussd-quick-code">' + escHtml(op.codes[0].code) + '</span></button>';
        });
        quickHtml += '</div>';

        var moreHtml = '<details class="ussd-more"><summary>More codes</summary><div class="ussd-codes-table">';
        OPERATORS.forEach(function(op) {
            moreHtml += '<div class="ussd-op-row"><span class="ussd-op-name">' + escHtml(op.name) + '</span><div class="ussd-op-btns">';
            op.codes.forEach(function(c) {
                moreHtml += '<button class="btn-small" ' + actionAttr('ussdSend', [c.code]) + '>' +
                    escHtml(c.label) + ' <span class="text-muted">' + escHtml(c.code) + '</span></button>';
            });
            moreHtml += '</div></div>';
        });
        moreHtml += '</div></details>';

        container.innerHTML =
            '<h2>USSD</h2>' +
            '<div class="card">' +
                '<h3>Quick Balance</h3>' +
                quickHtml +
            '</div>' +
            '<div class="card mt-2">' +
                moreHtml +
            '</div>' +
            '<div class="card mt-2">' +
                '<h3>Custom USSD</h3>' +
                '<div class="form-row">' +
                    '<div class="form-group" style="flex:1">' +
                        '<input type="text" id="ussd-input" placeholder="*100#" maxlength="64">' +
                    '</div>' +
                    '<button ' + actionAttr('ussdSendCustom') + '>Send</button>' +
                '</div>' +
            '</div>' +
            '<div class="card mt-2" id="ussd-result-card" style="display:none">' +
                '<h3>Response</h3>' +
                '<pre id="ussd-response" class="code-block ussd-response"></pre>' +
                '<div id="ussd-session" style="display:none">' +
                    '<div class="form-row mt-1">' +
                        '<div class="form-group" style="flex:1">' +
                            '<input type="text" id="ussd-reply" placeholder="Reply...">' +
                        '</div>' +
                        '<button ' + actionAttr('ussdSendReply') + '>Reply</button>' +
                        '<button class="btn-outline" ' + actionAttr('ussdEnd') + '>End Session</button>' +
                    '</div>' +
                '</div>' +
            '</div>';

        // Enter key sends
        var inp = $('#ussd-input');
        if (inp) inp.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); _ussdSendCustom(); }
        });

        App.setCleanup(function() {
            if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
            _sessionActive = false;
        });
    }

    function _ussdSend(code) {
        _doSend(code);
    }

    function _ussdSendCustom() {
        var inp = $('#ussd-input');
        if (!inp || !inp.value.trim()) return;
        _doSend(inp.value.trim());
    }

    function _ussdSendReply() {
        var inp = $('#ussd-reply');
        if (!inp || !inp.value.trim()) return;
        _doSend(inp.value.trim());
        inp.value = '';
    }

    function _doSend(code) {
        var card = $('#ussd-result-card');
        var resp = $('#ussd-response');
        if (card) card.style.display = '';
        if (resp) resp.textContent = 'Sending ' + code + '...';
        _showSession(false);

        if (_pollTimer) clearInterval(_pollTimer);

        API.webapi('SendUSSD', { UssdContent: code }).then(function() {
            _pollResult(0);
        }).catch(function(e) {
            if (resp) resp.textContent = 'Error: ' + e.message;
        });
    }

    function _pollResult(attempt) {
        if (attempt > 15) {
            var resp = $('#ussd-response');
            if (resp) resp.textContent = 'No response — USSD may not work on LTE.\nTry switching to 3G mode in Connection > Network Mode.';
            return;
        }
        _pollTimer = setTimeout(function() {
            API.webapi('GetUSSDSendResult').then(function(r) {
                var resp = $('#ussd-response');
                if (!r || !r.UssdContent) {
                    // Not ready yet
                    _pollResult(attempt + 1);
                    return;
                }
                if (resp) resp.textContent = r.UssdContent || '(empty response)';
                // UssdType 1 = interactive session, 0 = final
                if (r.UssdType === 1 || r.UssdType === '1') {
                    _sessionActive = true;
                    _showSession(true);
                } else {
                    _sessionActive = false;
                    _showSession(false);
                }
            }).catch(function(e) {
                _pollResult(attempt + 1);
            });
        }, 1000);
    }

    function _showSession(show) {
        var el = $('#ussd-session');
        if (el) el.style.display = show ? '' : 'none';
    }

    function _ussdEnd() {
        API.webapi('SetUSSDEnd').then(function() {
            _sessionActive = false;
            _showSession(false);
            var resp = $('#ussd-response');
            if (resp) resp.textContent += '\n--- Session ended ---';
        }).catch(function(e) {
            var resp = $('#ussd-response');
            if (resp) resp.textContent += '\nError ending session: ' + e.message;
        });
    }

    App.registerPage('ussd', renderUSSD);
    App._ussdSend = _ussdSend;
    App._ussdSendCustom = _ussdSendCustom;
    App._ussdSendReply = _ussdSendReply;
    App._ussdEnd = _ussdEnd;
})();
