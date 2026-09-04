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
            '<div class="login-notice" id="login-notice" hidden></div>' +
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
        var notice = $('#login-notice');

        // Where to go back to once the user is in again. A session that ended
        // by itself remembers the page the user was on; a deliberate logout
        // does not, and lands on the dashboard.
        var returnRoute = '';

        var ended = API.takeSessionEndNotice && API.takeSessionEndNotice();
        if (ended && notice) {
            returnRoute = ended.route && ended.route !== 'login' ? ended.route : '';
            notice.hidden = false;
            notice.textContent = ended.reason === 'idle'
                ? 'You were signed out after a long period of inactivity.'
                : 'Your session ended. The router signs a session out after about five minutes ' +
                  'idle, and it allows only one session at a time - signing in from another ' +
                  'device or browser ends this one.';
        }

        // 5 failed logins lock the interface for 300 s server-side. Show the
        // countdown instead of repeating "wrong password" at a locked door.
        var lockTimer = null;

        function stopLockCountdown() {
            if (lockTimer) { clearInterval(lockTimer); lockTimer = null; }
        }

        function startLockCountdown(seconds) {
            stopLockCountdown();
            var left = seconds;
            btn.disabled = true;
            passInput.disabled = true;

            function tick() {
                if (left <= 0) {
                    stopLockCountdown();
                    btn.disabled = false;
                    passInput.disabled = false;
                    btn.textContent = 'Log in';
                    err.textContent = 'You can try again now.';
                    return;
                }
                var mm = Math.floor(left / 60);
                var ss = left % 60;
                err.textContent = 'Too many failed attempts. Try again in ' +
                    mm + ':' + (ss < 10 ? '0' : '') + ss + '.';
                btn.textContent = 'Locked';
                left--;
            }

            tick();
            lockTimer = setInterval(tick, 1000);
        }

        App.setCleanup(stopLockCountdown);

        function doLogin() {
            if (lockTimer) return; // locked out; the countdown is the answer
            var pw = passInput.value.trim();
            if (!pw) { err.textContent = 'Enter the admin password'; return; }

            btn.disabled = true;
            btn.textContent = 'Logging in...';
            err.textContent = '';
            if (notice) notice.hidden = true;

            API.login('admin', pw).then(function() {
                App.startStatusPolling();
                window.location.hash = '#/' + (returnRoute || 'dashboard');
            }).catch(function(e) {
                if (e instanceof API.ApiError) {
                    if (e.code === API.ERR_LOGIN_LOCKED) {
                        startLockCountdown(API.LOGIN_LOCKOUT_SECONDS);
                        return;
                    }
                    if (e.code === '010102') {
                        err.textContent = 'Wrong password. After five failed attempts in a row ' +
                            'the interface locks for five minutes.';
                    } else {
                        err.textContent = e.apiMessage;
                    }
                } else {
                    err.textContent = 'Could not reach the router.';
                }
            }).then(function() {
                if (lockTimer) return; // the countdown owns the button now
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
