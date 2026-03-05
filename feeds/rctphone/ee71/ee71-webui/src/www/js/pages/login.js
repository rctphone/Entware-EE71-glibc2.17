;(function() {
    'use strict';
    var $ = App.$, h = App.h, icon = App.icon, actionAttr = App.actionAttr;

    function renderLogin(container) {
        container.innerHTML = '';
        var page = h('div', { id: 'login-page' });
        var box = h('div', { class: 'login-box' });

        box.innerHTML =
            '<div class="login-brand">' +
            '<div class="login-logo">' +
                '<svg viewBox="0 0 76 120" width="57" height="90">' +
                    '<circle cx="38" cy="36" r="36" fill="var(--color-primary)"/>' +
                    '<circle cx="38" cy="84" r="36" fill="var(--color-primary)"/>' +
                    /* Top E (white dots) */
                    '<circle cx="28" cy="20" r="2.6" fill="#fff"/><circle cx="35" cy="20" r="2.6" fill="#fff"/><circle cx="42" cy="20" r="2.6" fill="#fff"/><circle cx="49" cy="20" r="2.6" fill="#fff"/>' +
                    '<circle cx="28" cy="27" r="2.6" fill="#fff"/>' +
                    '<circle cx="28" cy="34" r="2.6" fill="#fff"/><circle cx="35" cy="34" r="2.6" fill="#fff"/><circle cx="42" cy="34" r="2.6" fill="#fff"/>' +
                    '<circle cx="28" cy="41" r="2.6" fill="#fff"/>' +
                    '<circle cx="28" cy="48" r="2.6" fill="#fff"/><circle cx="35" cy="48" r="2.6" fill="#fff"/><circle cx="42" cy="48" r="2.6" fill="#fff"/><circle cx="49" cy="48" r="2.6" fill="#fff"/>' +
                    /* Bottom E (white dots) */
                    '<circle cx="28" cy="68" r="2.6" fill="#fff"/><circle cx="35" cy="68" r="2.6" fill="#fff"/><circle cx="42" cy="68" r="2.6" fill="#fff"/><circle cx="49" cy="68" r="2.6" fill="#fff"/>' +
                    '<circle cx="28" cy="75" r="2.6" fill="#fff"/>' +
                    '<circle cx="28" cy="82" r="2.6" fill="#fff"/><circle cx="35" cy="82" r="2.6" fill="#fff"/><circle cx="42" cy="82" r="2.6" fill="#fff"/>' +
                    '<circle cx="28" cy="89" r="2.6" fill="#fff"/>' +
                    '<circle cx="28" cy="96" r="2.6" fill="#fff"/><circle cx="35" cy="96" r="2.6" fill="#fff"/><circle cx="42" cy="96" r="2.6" fill="#fff"/><circle cx="49" cy="96" r="2.6" fill="#fff"/>' +
                '</svg>' +
            '</div>' +
            '<h2>EE71</h2>' +
            '</div>' +
            '<div class="login-error" id="login-error"></div>' +
            '<div class="form-group">' +
                '<div class="pass-field">' +
                    '<input type="password" id="login-pass" placeholder="Admin password" autocomplete="current-password">' +
                    '<button class="pass-eye" ' + actionAttr('togglePassVis', ['login-pass']) + ' title="Show password">' + icon('ic-eye-off') + '</button>' +
                '</div>' +
            '</div>' +
            '<button id="login-btn" style="width:100%">Log in</button>';

        page.appendChild(box);
        container.appendChild(page);

        var passInput = $('#login-pass');
        var btn = $('#login-btn');
        var err = $('#login-error');

        function doLogin() {
            var pw = passInput.value.trim();
            if (!pw) { err.textContent = 'Enter password'; return; }

            btn.disabled = true;
            btn.textContent = 'Logging in...';
            err.textContent = '';

            API.login('admin', pw).then(function() {
                App.startStatusPolling();
                window.location.hash = '#/dashboard';
            }).catch(function(e) {
                if (e instanceof API.ApiError) {
                    if (e.code === '010103') {
                        err.textContent = 'Too many attempts. Locked for 5 minutes.';
                    } else if (e.code === '010102') {
                        err.textContent = 'Wrong password';
                    } else {
                        err.textContent = e.apiMessage;
                    }
                } else {
                    err.textContent = 'Connection error';
                }
            }).then(function() {
                btn.disabled = false;
                btn.textContent = 'Log in';
            });
        }

        btn.addEventListener('click', doLogin);
        passInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') doLogin();
        });

        setTimeout(function() { passInput.focus(); }, 100);
    }

    App.registerPage('login', renderLogin);
})();
