;(function() {
    'use strict';

    var BASE_URL = 'http://ee71.speedtestcustom.com:8877/cgi-bin/speedtest.cgi';

    function renderSpeedtest(container) {
        var theme = document.documentElement.getAttribute('data-theme') || 'light';
        var accent = getComputedStyle(document.documentElement)
            .getPropertyValue('--color-primary').trim();
        var url = BASE_URL + '?theme=' + encodeURIComponent(theme) +
            '&accent=' + encodeURIComponent(accent);

        container.innerHTML =
            '<h2>Speed Test</h2>' +
            '<div class="st-iframe-wrap">' +
                '<div id="st-loading" class="page-loading">' +
                    '<span class="spinner"></span> Loading\u2026' +
                '</div>' +
                '<iframe id="st-frame" class="st-iframe" src="' + url + '" ' +
                    'allow="autoplay" allowfullscreen scrolling="no"></iframe>' +
            '</div>';

        var frame = document.getElementById('st-frame');
        frame.onload = function() {
            var el = document.getElementById('st-loading');
            if (el) el.style.display = 'none';
        };

        App.setCleanup(function() {
            var f = document.getElementById('st-frame');
            if (f) f.src = 'about:blank';
        });
    }

    App.registerPage('speedtest', renderSpeedtest);
})();
