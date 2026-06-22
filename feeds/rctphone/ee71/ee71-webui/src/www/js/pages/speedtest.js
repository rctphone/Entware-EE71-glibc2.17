;(function() {
    'use strict';

    var $ = App.$, $$ = App.$$, actionAttr = App.actionAttr;

    // Engines are optional opkg packages (installed from the feed on demand).
    // The gauge page (/internetometer/index.html) is part of core webui; each
    // engine provides its measurement CGI:
    //   yandex -> ee71-internetometer  (browser-side real-time, internetometer.cgi proxy)
    //   ookla  -> ee71-speedtest-cli   (device CLI, speedtest_cli.cgi)
    var ENGINES = {
        yandex: { label: 'Yandex Internetometer', pkg: 'ee71-internetometer', sk: 'internetometer', full: 'Yandex Internetometer' },
        ookla:  { label: 'Speedtest',      pkg: 'ee71-speedtest-cli',  sk: 'ookla',          full: 'Ookla Speedtest' }
    };
    var _engine = 'yandex';
    var _status = null;

    function _styleOnce() {
        if ($('#st-style')) return;
        var s = document.createElement('style');
        s.id = 'st-style';
        s.textContent =
            '.st-engines{display:inline-flex;background:var(--surface-2,rgba(127,127,127,.1));border-radius:10px;padding:3px}' +
            '.st-engines button{border:0;background:transparent;color:var(--text-secondary);padding:7px 18px;border-radius:8px;font-size:.9rem;cursor:pointer;font:inherit}' +
            '.st-engines button.active{background:var(--color-primary);color:#fff}' +
            '.st-install{text-align:center;padding:48px 20px}' +
            '.st-install button[disabled]{opacity:.6;cursor:default}';
        document.head.appendChild(s);
    }

    function _frameSrc() {
        var theme = document.documentElement.getAttribute('data-theme') || 'dark';
        return '/internetometer/index.html?engine=' + _engine + '&theme=' + theme + '&v=' + Date.now();
    }

    function _showEngine() {
        var box = $('#st-box');
        if (!box) return;
        var e = ENGINES[_engine];
        var installed = _status && _status[e.sk];
        if (installed) {
            box.innerHTML = '<iframe id="st-frame" title="Speed Test" ' +
                'style="width:100%;height:680px;border:0;border-radius:12px;display:block" src="' + _frameSrc() + '"></iframe>';
        } else {
            box.innerHTML = '<div class="st-install">' +
                '<div class="alert alert-info" style="text-align:center">' +
                    '<b>' + e.full + '</b> is not installed.<br>Click Install to add this engine from the repository.' +
                '</div>' +
                '<button ' + actionAttr('stInstall', e.sk) + ' id="st-inst-btn">Install</button>' +
                '<div class="alert alert-danger" id="st-inst-err" style="display:none;text-align:left;white-space:pre-wrap;margin-top:14px"></div>' +
            '</div>';
        }
    }

    function renderSpeedtest(container) {
        _styleOnce();
        _engine = ENGINES[_engine] ? _engine : 'yandex';
        container.innerHTML =
            '<h2>Speed Test</h2>' +
            '<div class="card" style="padding:14px">' +
                '<div style="text-align:center;margin-bottom:10px">' +
                    '<div class="st-engines" id="st-engines">' +
                        '<button data-eng="yandex"' + (_engine === 'yandex' ? ' class="active"' : '') + '>Yandex Internetometer</button>' +
                        '<button data-eng="ookla"' + (_engine === 'ookla' ? ' class="active"' : '') + '>Speedtest</button>' +
                    '</div>' +
                '</div>' +
                '<div id="st-box"><div class="page-loading"><div class="spinner"></div> Loading…</div></div>' +
            '</div>';

        $$('#st-engines button').forEach(function(b) {
            b.addEventListener('click', function() {
                _engine = b.dataset.eng;
                $$('#st-engines button').forEach(function(x) { x.classList.remove('active'); });
                b.classList.add('active');
                _showEngine();
            });
        });

        API.cgiGet('speedtest_status.cgi').then(function(s) {
            _status = s || {};
        }).catch(function() {
            _status = {};
        }).then(function() {
            _showEngine();
        });
    }

    function _stInstall(sk) {
        var e = ENGINES[_engine];
        if (sk) { for (var k in ENGINES) { if (ENGINES[k].sk === sk) { e = ENGINES[k]; break; } } }
        var btn = $('#st-inst-btn');
        var err = $('#st-inst-err');
        if (err) err.style.display = 'none';
        if (btn) { btn.disabled = true; btn.textContent = 'Installing… (up to a minute)'; }
        API.cgiPost('speedtest_install.cgi', { pkg: e.pkg }).then(function(r) {
            if (r && r.ok) {
                _status[e.sk] = true;
                _showEngine();
            } else {
                if (btn) { btn.disabled = false; btn.textContent = 'Retry'; }
                if (err) { err.style.display = ''; err.textContent = 'Install failed.\n' + ((r && (r.log || r.error)) || ''); }
            }
        }).catch(function(ex) {
            if (btn) { btn.disabled = false; btn.textContent = 'Retry'; }
            if (err) { err.style.display = ''; err.textContent = 'Error: ' + ex.message; }
        });
    }

    App.registerPage('speedtest', renderSpeedtest);
    App._stInstall = _stInstall;
})();
