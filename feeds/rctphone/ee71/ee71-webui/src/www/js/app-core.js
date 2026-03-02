/**
 * app-core.js — EE71 Custom Web UI core
 *
 * Helpers, router, theme, status bar, navigation, init.
 * Page renderers register themselves via App.registerPage().
 *
 * No external dependencies — uses api.js.
 */

var App = (function() {
    'use strict';

    // --- Helpers ---

    function $(sel, ctx) { return (ctx || document).querySelector(sel); }
    function $$(sel, ctx) { return (ctx || document).querySelectorAll(sel); }

    function h(tag, attrs) {
        var el = document.createElement(tag);
        if (attrs) {
            for (var k in attrs) {
                if (!attrs.hasOwnProperty(k)) continue;
                var v = attrs[k];
                if (k === 'class') el.className = v;
                else if (k === 'html') el.innerHTML = v;
                else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
                else el.setAttribute(k, v);
            }
        }
        for (var i = 2; i < arguments.length; i++) {
            var c = arguments[i];
            if (typeof c === 'string') el.appendChild(document.createTextNode(c));
            else if (c) el.appendChild(c);
        }
        return el;
    }

    function icon(id, cls) {
        return '<svg class="' + (cls || '') + '"><use href="#' + id + '"/></svg>';
    }

    function formatBytes(bytes) {
        if (bytes == null || isNaN(bytes)) return '\u2014';
        bytes = Number(bytes);
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
        return (bytes / 1073741824).toFixed(2) + ' GB';
    }

    function formatSpeed(bytesPerSec) {
        if (bytesPerSec == null || isNaN(bytesPerSec)) return { value: '\u2014', unit: '' };
        bytesPerSec = Number(bytesPerSec);
        var bps = bytesPerSec * 8;
        if (bps < 1000) return { value: bps.toFixed(0), unit: 'bps' };
        if (bps < 1000000) return { value: (bps / 1000).toFixed(1), unit: 'Kbps' };
        if (bps < 1000000000) return { value: (bps / 1000000).toFixed(1), unit: 'Mbps' };
        return { value: (bps / 1000000000).toFixed(2), unit: 'Gbps' };
    }

    function formatUptime(seconds) {
        if (!seconds) return '\u2014';
        seconds = Number(seconds);
        var d = Math.floor(seconds / 86400);
        var hh = Math.floor((seconds % 86400) / 3600);
        var mm = Math.floor((seconds % 3600) / 60);
        if (d > 0) return d + 'd ' + hh + 'h ' + mm + 'm';
        if (hh > 0) return hh + 'h ' + mm + 'm';
        return mm + 'm';
    }

    // Parse "DD-MM-YYYY HH:MM:SS" → Date object
    function _parseDateTime(str) {
        if (!str) return null;
        // Handle DD-MM-YYYY HH:MM:SS
        var m = str.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
        if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]);
        // Try ISO or native parsing as fallback
        var d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    }

    function formatTimeAgo(dateStr) {
        var d = _parseDateTime(dateStr);
        if (!d) return dateStr || '\u2014';

        var now = new Date();
        var diffMs = now - d;
        if (diffMs < 0) return dateStr; // future date — show as-is

        var diffSec = Math.floor(diffMs / 1000);
        var diffMin = Math.floor(diffSec / 60);
        var diffHr = Math.floor(diffMin / 60);

        // Less than 1 minute
        if (diffMin < 1) return 'just now';
        // Less than 1 hour
        if (diffMin < 60) return diffMin + ' min ago';
        // Less than 24 hours — show hours + minutes
        if (diffHr < 24) {
            var rm = diffMin % 60;
            return rm > 0 ? diffHr + 'h ' + rm + 'm ago' : diffHr + 'h ago';
        }

        // Calendar-based: today, yesterday, N days ago, then date
        var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        var dayDiff = Math.round((today - msgDay) / 86400000);

        var time = (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' +
                   (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();

        if (dayDiff === 0) return 'today ' + time;
        if (dayDiff === 1) return 'yesterday ' + time;
        if (dayDiff < 7) return dayDiff + ' days ago ' + time;

        // Older than a week — show compact date
        var dd = (d.getDate() < 10 ? '0' : '') + d.getDate();
        var mm = (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1);
        return dd + '.' + mm + '.' + d.getFullYear() + ' ' + time;
    }

    function escHtml(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML.replace(/"/g, '&quot;');
    }

    // CSP-safe event delegation helper: builds data-action attribute string
    function actionAttr(name, args) {
        var s = 'data-action="' + name + '"';
        if (args !== undefined && args !== null) {
            s += ' data-args="' + escHtml(JSON.stringify(Array.isArray(args) ? args : [args])) + '"';
        }
        return s;
    }

    // --- Navigation definition ---

    var NAV_ITEMS = [
        { id: 'dashboard',    icon: 'ic-dashboard',  label: 'Dashboard' },

        { id: 'clients',      icon: 'ic-clients',    label: 'Clients' },
        { id: 'connection',   icon: 'ic-mobile',     label: 'Connection' },
        { id: 'apn',          icon: 'ic-globe',      label: 'APN' },
        { id: 'at-terminal',  icon: 'ic-terminal',   label: 'AT Terminal' },
        { id: 'ussd',         icon: 'ic-mobile',     label: 'USSD' },
        { id: 'mobile-settings', icon: 'ic-settings', label: 'Settings' },
        { id: 'sms',          icon: 'ic-sms',        label: 'SMS' },
        { id: 'wifi',         icon: 'ic-wifi',       label: 'WiFi' },

        { id: 'lan',          icon: 'ic-network',    label: 'LAN' },
        { id: 'firewall',     icon: 'ic-firewall',   label: 'Firewall' },
        { id: 'upnp',         icon: 'ic-network',    label: 'UPnP' },
        { id: 'ttl-fix',      icon: 'ic-firewall',   label: 'TTL Fix' },
        { id: 'vpn',          icon: 'ic-vpn',        label: 'VPN' },
        { id: 'diagnostics',  icon: 'ic-diag',       label: 'Diagnostics' },
        { id: 'speedtest',    icon: 'ic-speedtest',  label: 'Speed Test' },
        { id: 'settings',     icon: 'ic-settings',   label: 'Settings' },
        { id: 'ssh',          icon: 'ic-terminal',   label: 'SSH' },
        { id: 'backup',       icon: 'ic-download',   label: 'Backup' },
        { id: 'about',        icon: 'ic-about',      label: 'About' },
    ];

    var NAV_GROUPS = [
        { label: 'STATUS',   icon: 'ic-dashboard', items: ['dashboard', 'clients'] },
        { label: 'MOBILE',   icon: 'ic-mobile',    items: ['connection', 'sms', 'ussd', 'mobile-settings'] },
        { label: 'NETWORK',  icon: 'ic-wifi',      items: ['wifi', 'lan', 'firewall', 'upnp', 'ttl-fix', 'vpn'] },
        { label: 'SYSTEM',   icon: 'ic-settings',  items: ['diagnostics', 'speedtest', 'settings', 'ssh', 'backup', 'about'] },
    ];

    var _navItemMap = {};
    NAV_ITEMS.forEach(function(item) { _navItemMap[item.id] = item; });

    var _sidebarCollapsed = localStorage.getItem('ee71-sidebar') === 'collapsed';

    // --- Theme ---

    function initTheme() {
        var saved = localStorage.getItem('ee71-theme');
        if (saved) {
            document.documentElement.setAttribute('data-theme', saved);
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
        }
        updateThemeIcon();
    }

    function toggleTheme() {
        var current = document.documentElement.getAttribute('data-theme');
        var next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('ee71-theme', next);
        updateThemeIcon();
    }

    function updateThemeIcon() {
        var btn = $('#theme-toggle');
        if (!btn) return;
        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        btn.innerHTML = icon(isDark ? 'ic-sun' : 'ic-moon');
    }

    // --- Status bar ---

    var _statusTimer = null;
    var _deviceInfoLoaded = false;

    function _loadDeviceInfo() {
        if (_deviceInfoLoaded) return;
        API.webapi('GetSystemInfo').then(function(info) {
            _deviceInfoLoaded = true;
            var elExtra = $('#sb-dev-extra');
            if (elExtra) elExtra.textContent = info.DeviceName || '';
        }).catch(function() {});
    }

    function refreshStatusBar() {
        // Free APIs (no auth required): GetNetworkInfo, GetConnectionState, GetSMSStorageState
        API.batchWebapi([
            'GetNetworkInfo',
            'GetConnectionState',
            'GetSMSStorageState'
        ]).then(function(data) {
            // Network type + signal
            var net = data.GetNetworkInfo || {};
            var _techMap = {0:'',1:'GSM',2:'GPRS',3:'EDGE',4:'3G',5:'3G+',6:'3G+',7:'H+',8:'LTE',9:'LTE+'};
            var techLabel = _techMap[net.NetworkType] || '';
            var opName = net.NetworkName || '';
            var netType = (opName && techLabel) ? opName + ' ' + techLabel : opName || techLabel || '\u2014';
            var rsrp = parseInt(net.RSRP, 10);
            var signalLevel = 0;
            // RSRP valid range: -140 to -44 dBm; values >= 0 or -1 mean no signal
            if (!isNaN(rsrp) && rsrp < -1) {
                if (rsrp >= -80) signalLevel = 5;
                else if (rsrp >= -90) signalLevel = 4;
                else if (rsrp >= -100) signalLevel = 3;
                else if (rsrp >= -110) signalLevel = 2;
                else signalLevel = 1;
            } else {
                var rssi = parseInt(net.SignalStrength, 10);
                if (!isNaN(rssi) && rssi > 0) signalLevel = Math.min(5, Math.max(1, Math.ceil(rssi / 20)));
            }

            var elTech = $('#sb-tech');
            if (elTech) elTech.textContent = netType;

            var bars = $$('#sb-signal .bar');
            bars.forEach(function(b, i) {
                b.classList.toggle('active', i < signalLevel);
            });

            // Connection state
            var conn = data.GetConnectionState || {};
            var elInet = $('#sb-inet');
            if (elInet) {
                var connected = conn.ConnectionStatus === 2 || conn.ConnectionStatus === '2';
                elInet.classList.toggle('sb-dim', !connected);
                elInet.classList.toggle('sb-on', connected);
            }

            // SMS count
            var sms = data.GetSMSStorageState || {};
            var unread = parseInt(sms.UnreadSMSCount, 10) || 0;
            var elSms = $('#sb-sms');
            if (elSms) elSms.classList.toggle('hidden', unread === 0);
            var elSmsBadge = $('#sb-sms-count');
            if (elSmsBadge) elSmsBadge.textContent = unread;
        }).catch(function() {});

        // Battery + WiFi (require auth — fail silently if not logged in)
        API.batchWebapi([
            'GetBatteryState',
            'GetWlanState'
        ]).then(function(data) {
            // Battery (update SVG fill width + text) — skip if API returned null (auth required)
            var bat = data.GetBatteryState;
            if (bat) {
                var batLevel = parseInt(bat.BatteryLevel, 10) || 0;
                var batFill = document.getElementById('sb-bat-fill');
                if (batFill) {
                    var fillW = Math.max(0, Math.min(100, batLevel)) / 100 * 21;
                    batFill.setAttribute('width', fillW.toFixed(1));
                }
                var batText = $('#sb-battery .battery-level');
                if (batText) batText.textContent = batLevel + '%';
            }

            // WiFi state — skip if API returned null (auth required)
            var wlan = data.GetWlanState;
            if (wlan) {
                var elWifi = $('#sb-wifi');
                if (elWifi) {
                    var wifiOn = wlan.WlanState === 1 || wlan.WlanState === '1';
                    elWifi.classList.toggle('sb-dim', !wifiOn);
                    elWifi.classList.toggle('sb-on', wifiOn);
                }
            }
        }).catch(function() {});

        // VPN status (CGI, requires auth — skip if not logged in to avoid 302 reload)
        if (!API.isLoggedIn()) return;
        Promise.all([
            API.cgiGet('wireguard.cgi', { action: 'status' }).catch(function() { return {}; }),
            API.cgiGet('amneziawg.cgi', { action: 'status' }).catch(function() { return {}; }),
            API.cgiGet('shadowsocks.cgi', { action: 'status' }).catch(function() { return {}; }),
        ]).then(function(vpn) {
            var elVpn = $('#sb-vpn');
            if (elVpn) {
                var vpnOn = !!(vpn[0].up || vpn[1].up || vpn[2].running);
                elVpn.classList.toggle('hidden', !vpnOn);
            }
        }).catch(function() {});
    }

    function startStatusPolling() {
        stopStatusPolling();
        refreshStatusBar();
        _loadDeviceInfo();
        _statusTimer = setInterval(function() {
            refreshStatusBar();
            _loadDeviceInfo();
        }, 5000);
    }

    function stopStatusPolling() {
        if (_statusTimer) {
            clearInterval(_statusTimer);
            _statusTimer = null;
        }
    }

    // --- Page registry ---

    var PAGE_RENDERERS = {};

    function registerPage(id, renderer) {
        PAGE_RENDERERS[id] = renderer;
    }

    function stubPage(title, iconId, description) {
        return function(container) {
            container.innerHTML =
                '<h2>' + escHtml(title) + '</h2>' +
                '<p class="text-muted">' + escHtml(description) + '</p>' +
                '<div class="page-loading"><div class="spinner"></div> Coming soon</div>';
        };
    }

    // --- Router ---

    var _currentPage = null;
    var _currentPageCleanup = null;

    function setCleanup(fn) {
        _currentPageCleanup = fn;
    }

    function navigate(pageId) {
        if (pageId !== _currentPage) {
            window.location.hash = '#/' + pageId;
        }
    }

    function getRoute() {
        var hash = window.location.hash || '';
        var m = hash.match(/^#\/(.+)/);
        return m ? m[1] : '';
    }

    function onRouteChange() {
        var route = getRoute();

        if (!API.isLoggedIn() && route !== 'login') {
            window.location.hash = '#/login';
            return;
        }

        if (API.isLoggedIn() && (route === 'login' || route === '')) {
            window.location.hash = '#/dashboard';
            return;
        }

        renderPage(route || 'login');
    }

    function renderPage(pageId) {
        // Cleanup previous page
        if (_currentPageCleanup) {
            _currentPageCleanup();
            _currentPageCleanup = null;
        }

        _currentPage = pageId;

        // Update nav active states
        $$('#sidebar a, #bottom-nav a, #mobile-menu a').forEach(function(a) {
            a.classList.toggle('active', a.getAttribute('data-page') === pageId);
        });

        // Auto-open the group containing the active page
        NAV_GROUPS.forEach(function(group, gi) {
            var sub = $('#nav-group-' + gi);
            if (sub && group.items.indexOf(pageId) !== -1) {
                sub.classList.add('open');
            }
        });

        // Show/hide nav chrome for login
        var isLogin = pageId === 'login';
        var sidebar = $('#sidebar');
        var bottomNav = $('#bottom-nav');
        var statusBar = $('#status-bar');
        if (sidebar) sidebar.classList.toggle('hidden', isLogin);
        if (bottomNav) bottomNav.classList.toggle('hidden', isLogin);
        if (statusBar) statusBar.classList.remove('hidden');
        var mobileMenu = $('#mobile-menu');
        if (mobileMenu) mobileMenu.classList.add('hidden');

        var container = $('#page-content');
        if (!container) return;

        container.innerHTML = '';

        // Render page
        var renderer = PAGE_RENDERERS[pageId];
        if (renderer) {
            renderer(container);
        } else {
            container.innerHTML = '<div class="page-loading">Page not found: ' + escHtml(pageId) + '</div>';
        }
    }

    // --- Build navigation ---

    var BOTTOM_NAV_IDS = {
        dashboard: 1, clients: 1,
        connection: 1, sms: 1,
        wifi: 1, vpn: 1,
        settings: 1, speedtest: 1, about: 1
    };

    function _doLogout() {
        API.logout().then(function() {
            window.location.hash = '#/login';
        });
    }

    function _toggleMobileMenu() {
        var menu = $('#mobile-menu');
        if (menu) menu.classList.toggle('hidden');
    }

    function _toggleSidebar() {
        _sidebarCollapsed = !_sidebarCollapsed;
        localStorage.setItem('ee71-sidebar', _sidebarCollapsed ? 'collapsed' : 'expanded');
        document.body.classList.toggle('sidebar-collapsed', _sidebarCollapsed);
    }

    function _toggleNavGroup(groupIdx) {
        var sub = $('#nav-group-' + groupIdx);
        if (!sub) return;
        sub.classList.toggle('open');
    }

    function buildNav() {
        var sidebar = $('#sidebar');
        var bottomScroll = $('#bottom-nav .nav-scroll');
        var menuContent = $('#mobile-menu .mobile-menu-content');

        // Apply saved sidebar state
        if (_sidebarCollapsed) document.body.classList.add('sidebar-collapsed');

        // Sidebar: grouped navigation
        if (sidebar) {
            var navWrap = document.createElement('div');
            navWrap.className = 'nav-groups';

            NAV_GROUPS.forEach(function(group, gi) {
                // Group header (icon + label)
                var header = h('div', { class: 'nav-group-header', html:
                    icon(group.icon) + '<span class="nav-group-label">' + group.label + '</span>'
                });
                header.setAttribute('data-group', gi);
                header.addEventListener('click', function() {
                    if (_sidebarCollapsed) {
                        _toggleSidebar();
                    } else {
                        _toggleNavGroup(gi);
                    }
                });
                navWrap.appendChild(header);

                // Sub-items
                var subDiv = document.createElement('div');
                subDiv.className = 'nav-group-items open';
                subDiv.id = 'nav-group-' + gi;

                group.items.forEach(function(itemId) {
                    var item = _navItemMap[itemId];
                    if (!item) return;
                    var link = h('a', {
                        href: '#/' + item.id,
                        'data-page': item.id,
                        html: icon(item.icon) + '<span class="nav-item-label">' + item.label + '</span>'
                    });
                    subDiv.appendChild(link);
                });
                navWrap.appendChild(subDiv);
            });

            sidebar.appendChild(navWrap);

            // Spacer + toggle + logout at bottom
            var spacer = document.createElement('div');
            spacer.className = 'flex-spacer';
            sidebar.appendChild(spacer);

            var toggleBtn = h('a', {
                href: '#',
                class: 'nav-toggle-btn',
                html: '<span class="nav-toggle-expand">' + icon('ic-menu') + '</span>' +
                      '<span class="nav-toggle-collapse">' + icon('ic-menu') + '<span class="nav-item-label">Hide menu</span></span>'
            });
            toggleBtn.addEventListener('click', function(e) {
                e.preventDefault();
                _toggleSidebar();
            });
            sidebar.appendChild(toggleBtn);

            var sideLogout = h('a', {
                href: '#',
                class: 'nav-logout',
                html: icon('ic-power') + '<span class="nav-item-label">Logout</span>'
            });
            sideLogout.addEventListener('click', function(e) {
                e.preventDefault();
                _doLogout();
            });
            sidebar.appendChild(sideLogout);
        }

        // Bottom nav: items from all 4 groups
        NAV_ITEMS.forEach(function(item) {
            if (BOTTOM_NAV_IDS[item.id]) {
                var bottomLink = h('a', {
                    href: '#/' + item.id,
                    'data-page': item.id,
                    html: icon(item.icon) + '<span>' + item.label + '</span>'
                });
                if (bottomScroll) bottomScroll.appendChild(bottomLink);
            }
        });

        // Hamburger in status bar (mobile) opens fullscreen menu
        var hamburgerBtn = $('#sb-hamburger');
        if (hamburgerBtn) hamburgerBtn.addEventListener('click', _toggleMobileMenu);

        // Mobile menu: close button + grouped navigation
        var closeBtn = $('#mobile-menu-close');
        if (closeBtn) closeBtn.addEventListener('click', _toggleMobileMenu);

        if (menuContent) {
            function _appendNavItem(container, itemId) {
                var item = _navItemMap[itemId];
                if (!item) return;
                var menuLink = h('a', {
                    href: '#/' + item.id,
                    'data-page': item.id,
                    html: icon(item.icon) + '<span>' + item.label + '</span>'
                });
                menuLink.addEventListener('click', _toggleMobileMenu);
                container.appendChild(menuLink);
            }

            NAV_GROUPS.forEach(function(group) {
                var groupLabel = h('div', { class: 'nav-group-label', html:
                    icon(group.icon) + group.label
                });
                menuContent.appendChild(groupLabel);

                group.items.forEach(function(itemId) {
                    _appendNavItem(menuContent, itemId);
                });
            });

            // Bottom actions: theme toggle + logout
            var bottomActions = h('div', { class: 'mobile-menu-bottom' });

            var themeLink = h('a', {
                href: '#',
                html: icon('ic-moon') + '<span>Toggle theme</span>'
            });
            themeLink.className = 'mobile-menu-action';
            themeLink.addEventListener('click', function(e) {
                e.preventDefault();
                toggleTheme();
                // Update icon in this link
                var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                themeLink.innerHTML = icon(isDark ? 'ic-sun' : 'ic-moon') + '<span>Toggle theme</span>';
            });
            bottomActions.appendChild(themeLink);

            var logoutLink = h('a', {
                href: '#',
                html: icon('ic-power') + '<span>Logout</span>'
            });
            logoutLink.className = 'mobile-menu-action nav-logout';
            logoutLink.addEventListener('click', function(e) {
                e.preventDefault();
                _toggleMobileMenu();
                _doLogout();
            });
            bottomActions.appendChild(logoutLink);

            menuContent.appendChild(bottomActions);
        }
    }

    function showModal(message, onOk) {
        // Remove any existing modal
        var old = document.getElementById('ee71-modal');
        if (old) old.remove();

        var overlay = document.createElement('div');
        overlay.id = 'ee71-modal';
        overlay.className = 'modal-overlay';
        overlay.innerHTML =
            '<div class="modal-box">' +
                '<p>' + escHtml(message) + '</p>' +
                '<button class="modal-ok-btn" data-action="modalOk">OK</button>' +
            '</div>';
        document.body.appendChild(overlay);

        _modalOkCallback = onOk || null;
    }

    var _modalOkCallback = null;

    function _modalOk() {
        var overlay = document.getElementById('ee71-modal');
        if (overlay) overlay.remove();
        if (_modalOkCallback) {
            var cb = _modalOkCallback;
            _modalOkCallback = null;
            cb();
        }
    }

    // --- Init ---

    async function init() {
        initTheme();
        buildNav();

        // Theme toggle
        var themeBtn = $('#theme-toggle');
        if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

        // Global event delegation for CSP-safe click handlers
        document.addEventListener('click', function(e) {
            var el = e.target.closest('[data-action]');
            if (!el) return;
            if (el.tagName === 'A' || el.tagName === 'BUTTON') e.preventDefault();
            if (el.hasAttribute('data-stop')) e.stopPropagation();
            var fn = App['_' + el.dataset.action];
            if (typeof fn !== 'function') return;
            var raw = el.dataset.args;
            if (raw) {
                try { fn.apply(null, JSON.parse(raw)); } catch(ex) { fn(); }
            } else {
                fn();
            }
        });

        // Global event delegation for CSP-safe change handlers
        document.addEventListener('change', function(e) {
            var el = e.target.closest('[data-onchange]');
            if (!el) return;
            var fn = App['_' + el.dataset.onchange];
            if (typeof fn !== 'function') return;
            var raw = el.dataset.args;
            if (raw) {
                try { fn.apply(null, JSON.parse(raw)); } catch(ex) { fn(); }
            } else {
                fn();
            }
        });

        // Validate session with server (GetLoginState)
        await API.restoreSession();

        // Always poll status bar (free APIs work without auth)
        startStatusPolling();

        // Router
        window.addEventListener('hashchange', onRouteChange);
        onRouteChange();
    }

    // --- Public API ---

    return {
        init: init,
        navigate: navigate,
        registerPage: registerPage,
        setCleanup: setCleanup,
        stubPage: stubPage,
        startStatusPolling: startStatusPolling,
        stopStatusPolling: stopStatusPolling,
        $: $,
        $$: $$,
        h: h,
        icon: icon,
        formatBytes: formatBytes,
        formatSpeed: formatSpeed,
        formatUptime: formatUptime,
        formatTimeAgo: formatTimeAgo,
        escHtml: escHtml,
        actionAttr: actionAttr,
        _getRoute: getRoute,
        _modalOk: _modalOk,
    };
})();
