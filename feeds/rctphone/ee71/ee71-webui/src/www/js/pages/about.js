;(function() {
    'use strict';
    var icon = App.icon, escHtml = App.escHtml, formatUptime = App.formatUptime;

    // Format KB value to human-readable MB
    function fmtMB(kb) {
        var v = parseInt(kb, 10);
        if (isNaN(v) || v === 0) return '0';
        return (v / 1024).toFixed(1) + ' MB';
    }

    function renderAbout(container) {
        container.innerHTML =
            '<h2>About</h2>' +
            '<div class="card">' +
                '<div class="stat-row"><span class="label">Firmware</span><span class="value" id="a-fw">\u2014</span></div>' +
                '<div class="stat-row"><span class="label">Hardware</span><span class="value" id="a-hw">\u2014</span></div>' +
                '<div class="stat-row"><span class="label">IMEI</span><span class="value" id="a-imei">\u2014</span></div>' +
                '<div class="stat-row"><span class="label">MAC Address</span><span class="value" id="a-mac">\u2014</span></div>' +
                '<div class="stat-row"><span class="label">Uptime</span><span class="value" id="a-uptime">\u2014</span></div>' +
                '<div class="stat-row"><span class="label">Kernel</span><span class="value" id="a-kernel">\u2014</span></div>' +
                '<div class="stat-row"><span class="label">Web UI</span><span class="value">Rctphone UI v1.0</span></div>' +
            '</div>' +
            '<div class="card mt-2">' +
                '<h3>Storage</h3>' +
                '<div id="a-storage" class="text-small">Loading...</div>' +
            '</div>' +
            '<div class="card mt-2">' +
                '<h3>Memory</h3>' +
                '<div id="a-memory" class="text-small">Loading...</div>' +
            '</div>';

        Promise.all([
            API.webapi('GetSystemInfo').catch(function() { return null; }),
            API.cgiGet('system.cgi', { action: 'storage' }).catch(function() { return null; }),
            API.cgiGet('system.cgi', { action: 'memory' }).catch(function() { return null; }),
        ]).then(function(results) {
            var info = results[0], storage = results[1], memory = results[2];
            var el = function(id) { return document.getElementById(id); };

            if (info) {
                if (el('a-fw')) el('a-fw').textContent = (info.SwVersion || info.SWversion || info.FWversion || '\u2014').replace(/\n/g, '');
                if (el('a-hw')) el('a-hw').textContent = info.HwVersion || info.HWversion || '\u2014';
                if (el('a-imei')) el('a-imei').textContent = info.IMEI || info.Imei || '\u2014';
                if (el('a-mac')) el('a-mac').textContent = info.MacAddress || '\u2014';
            }
            API.cgiGet('system.cgi', { action: 'uptime' }).then(function(u) {
                if (u && u.seconds != null && el('a-uptime')) el('a-uptime').textContent = formatUptime(u.seconds);
            }).catch(function() {});

            var fsList = Array.isArray(storage) ? storage : (storage && storage.filesystems ? storage.filesystems : []);
            fsList = fsList.filter(function(fs) {
                var name = fs.fs || fs.filesystem || '';
                return name !== 'tmpfs' && name !== 'devtmpfs' && name !== 'rootfs' && name !== 'none';
            });
            if (fsList.length > 0) {
                var elSt = el('a-storage');
                if (elSt) {
                    elSt.innerHTML = '<table class="data-table"><thead><tr>' +
                        '<th>Mount</th><th>Size</th><th>Used</th><th>Avail</th><th>Use</th>' +
                        '</tr></thead><tbody>' +
                        fsList.map(function(fs) {
                            var pct = parseInt(fs.pct || fs.use_pct || 0, 10);
                            return '<tr><td>' + escHtml(fs.mount || fs.mounted_on || '') + '</td>' +
                                '<td class="text-right">' + fmtMB(fs.size) + '</td>' +
                                '<td class="text-right">' + fmtMB(fs.used) + '</td>' +
                                '<td class="text-right">' + fmtMB(fs.avail || fs.available) + '</td>' +
                                '<td class="text-right">' + (pct ? pct + '%' : '\u2014') + '</td></tr>';
                        }).join('') +
                        '</tbody></table>';
                }
            }

            if (memory) {
                var elMem = el('a-memory');
                if (elMem) {
                    var memLabels = { MemTotal: 'Total', MemFree: 'Free', MemAvailable: 'Available', Buffers: 'Buffers', Cached: 'Cached', SwapTotal: 'Swap', SwapFree: 'Swap Free' };
                    var items = ['MemTotal', 'MemFree', 'MemAvailable', 'Buffers', 'Cached', 'SwapTotal', 'SwapFree'];
                    elMem.innerHTML = items
                        .filter(function(k) { return memory[k] !== undefined; })
                        .map(function(k) {
                            return '<div class="stat-row"><span class="label">' + (memLabels[k] || k) + '</span><span class="value">' + fmtMB(memory[k]) + '</span></div>';
                        })
                        .join('');
                }
            }

            // Kernel version
            API.cgiGet('system.cgi', { action: 'kernel' }).then(function(kData) {
                if (kData && kData.version) {
                    var elK = el('a-kernel');
                    if (elK) elK.textContent = kData.version;
                }
            }).catch(function() {});
        }).catch(function() {});
    }

    App.registerPage('about', renderAbout);
})();
