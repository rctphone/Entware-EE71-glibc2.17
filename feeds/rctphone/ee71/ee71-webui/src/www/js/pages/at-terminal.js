;(function() {
    'use strict';
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;

    var _atTerm = null;
    var _atTemplates = null;

    function renderATTerminal(container) {
        container.innerHTML =
            '<div class="at-card">' +
                '<div class="at-toolbar">' +
                    '<span class="at-toolbar-title">' + icon('ic-terminal') + ' AT Terminal</span>' +
                    '<button class="btn-icon" ' + actionAttr('atClear') + ' title="Clear output">' + icon('ic-delete') + '</button>' +
                '</div>' +
                '<div id="at-terminal" class="at-terminal">' +
                    '<pre><code class="termino-console"></code></pre>' +
                    '<div class="at-input-row">' +
                        '<div class="at-combo">' +
                            '<textarea class="termino-input" rows="1" wrap="hard" placeholder="Type AT command..."></textarea>' +
                            '<button class="at-combo-btn" ' + actionAttr('atDropdown') + ' data-stop tabindex="-1">\u25BC</button>' +
                            '<div class="at-dropdown" id="at-dropdown"></div>' +
                        '</div>' +
                        '<button class="at-send-btn" ' + actionAttr('atSend') + '>Send</button>' +
                    '</div>' +
                '</div>' +
                '<div class="at-footer-note"><svg class="at-warn-icon" viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg> Direct modem access. Write commands may change device behavior.</div>' +
            '</div>';

        // Init Termino.js AT terminal
        var termEl = document.getElementById('at-terminal');
        if (termEl && typeof Termino === 'function') {
            _atTerm = Termino(termEl, null, {
                allow_scroll: true,
                prompt: 'AT> ',
                command_key: 13,
                terminal_killed_placeholder: 'TERMINAL DISABLED',
                terminal_output: '.termino-console',
                terminal_input: '.termino-input',
                disable_terminal_input: false,
            });
            _atLoop();
        }

        _loadATTemplates();

        App.setCleanup(function() {
            if (_atTerm) { _atTerm.kill(); _atTerm = null; }
        });
    }

    function _atLoop() {
        if (!_atTerm) return;
        _atTerm.input('').then(function(cmd) {
            if (!cmd || !cmd.trim()) { _atLoop(); return; }
            cmd = cmd.trim();
            if (!/^AT/i.test(cmd)) {
                _atTerm.output('Error: command must start with AT');
                _atLoop();
                return;
            }
            _atTerm.disable_input();
            API.cgiPost('at.cgi', { action: 'send', cmd: cmd }).then(function(r) {
                if (r.error) {
                    // Termino renders output with innerHTML, so escape here too.
                    _atTerm.output('Error: ' + escHtml(r.error));
                } else {
                    _atTerm.output(escHtml(r.output || '(no response)'));
                }
            }).catch(function(e) {
                _atTerm.output('Error: ' + escHtml(App.errorText(e)));
            }).then(function() {
                _atTerm.enable_input();
                _atLoop();
            });
        });
    }

    function _loadATTemplates() {
        API.cgiGet('at.cgi', { action: 'templates' }).then(function(data) {
            _atTemplates = (data && data.templates) || [];
            var dd = $('#at-dropdown');
            if (!dd || !_atTemplates.length) return;

            var cats = {};
            _atTemplates.forEach(function(t) {
                var cat = t.cat || 'other';
                if (!cats[cat]) cats[cat] = [];
                cats[cat].push(t);
            });

            var catNames = { info: 'Info', signal: 'Signal', network: 'Network', status: 'Status', imei: 'IMEI', band: 'Band Lock', mode: 'Mode', ca: 'Carrier Agg', system: 'System' };
            var html = '';
            Object.keys(cats).forEach(function(cat) {
                html += '<div class="at-dd-cat">' + escHtml(catNames[cat] || cat) + '</div>';
                cats[cat].forEach(function(t) {
                    html += '<div class="at-dd-item" data-cmd="' + escHtml(t.cmd) + '"' +
                        (t.warn ? ' data-warn="' + escHtml(t.warn) + '"' : '') + '>' +
                        '<span class="at-dd-cmd">' + escHtml(t.cmd) + '</span>' +
                        '<span class="at-dd-desc">' + escHtml(t.desc) + (t.warn ? ' \u26a0' : '') + '</span>' +
                    '</div>';
                });
            });
            dd.innerHTML = html;

            dd.addEventListener('click', function(e) {
                var item = e.target.closest('.at-dd-item');
                if (!item) return;
                var cmd = item.dataset.cmd;
                if (item.dataset.warn && _atTerm) {
                    _atTerm.output('\u26a0 Warning: ' + escHtml(item.dataset.warn));
                }
                var termInput = document.querySelector('#at-terminal .termino-input');
                if (termInput) { termInput.value = cmd; termInput.focus(); }
                dd.classList.remove('open');
            });
        }).catch(function() {});
    }

    function _atDropdown() {
        var dd = $('#at-dropdown');
        if (!dd) return;
        var opening = !dd.classList.contains('open');
        dd.classList.toggle('open');
        if (opening) {
            var _close = function(ev) {
                if (!ev.target.closest('.at-combo')) {
                    dd.classList.remove('open');
                    document.removeEventListener('click', _close);
                }
            };
            setTimeout(function() { document.addEventListener('click', _close); }, 0);
        }
    }

    function _atSend() {
        var termInput = document.querySelector('#at-terminal .termino-input');
        if (!termInput || !termInput.value.trim()) return;
        var evt = new KeyboardEvent('keypress', { keyCode: 13, which: 13, bubbles: true });
        termInput.dispatchEvent(evt);
    }

    function _atClear() {
        if (_atTerm) _atTerm.clear();
    }

    App.registerPage('at-terminal', renderATTerminal);
    App._atClear = _atClear;
    App._atSend = _atSend;
    App._atDropdown = _atDropdown;
})();
