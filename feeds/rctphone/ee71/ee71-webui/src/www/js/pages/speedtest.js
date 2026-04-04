;(function() {
    'use strict';

    function renderSpeedtest(container) {
        container.innerHTML =
            '<h2>Speed Test</h2>' +
            '<div class="card" style="text-align:center;padding:40px 20px">' +
                '<p style="margin-bottom:16px">Yandex Internetometer</p>' +
                '<a href="https://yandex.ru/internet" target="_blank" ' +
                    'style="display:inline-block;padding:12px 32px;background:var(--color-primary);color:#fff;' +
                    'border-radius:8px;text-decoration:none;font-size:1.1rem">' +
                    'Измерить скорость \u2197' +
                '</a>' +
            '</div>';
    }

    App.registerPage('speedtest', renderSpeedtest);
})();
