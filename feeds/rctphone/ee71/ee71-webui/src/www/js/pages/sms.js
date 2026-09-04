;(function() {
    'use strict';
    var icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr, timeAgo = App.formatTimeAgo;

    function renderSms(container) {
        container.innerHTML =
            '<div class="sms-sticky-header">' +
                '<h2>SMS</h2>' +
                '<div class="tab-bar">' +
                    '<button class="tab-btn active" ' + actionAttr('smsTab', ['inbox']) + '>Inbox</button>' +
                    '<button class="tab-btn" ' + actionAttr('smsTab', ['forward']) + '>Forward</button>' +
                '</div>' +
            '</div>' +
            '<div id="sms-inbox" class="tab-content active"></div>' +
            '<div id="sms-compose" class="tab-content"></div>' +
            '<div id="sms-forward" class="tab-content"></div>';

        _smsTab('inbox');
    }

    function _smsTab(tab) {
        ['inbox', 'compose', 'forward'].forEach(function(t) {
            var el = document.getElementById('sms-' + t);
            if (el) el.classList.toggle('active', t === tab);
        });
        var barTabs = ['inbox', 'forward'];
        var btns = document.querySelectorAll('.tab-bar .tab-btn');
        btns.forEach(function(b, i) {
            b.classList.toggle('active', barTabs[i] === tab);
        });
        var composeBtn = document.querySelector('.sms-compose-btn');
        if (composeBtn) composeBtn.classList.toggle('active', tab === 'compose');

        var pc = document.getElementById('page-content');
        if (pc) pc.classList.remove('chat-active');

        if (tab === 'inbox') _loadSmsInbox();
        else if (tab === 'compose') _loadSmsCompose();
        else if (tab === 'forward') _loadSmsForward();
    }

    function _timeAgoShort(dateStr) {
        var m = (dateStr || '').match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
        if (!m) return dateStr || '\u2014';
        var d = new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]);
        var now = new Date();
        var diffMs = now - d;
        if (diffMs < 0) return dateStr;
        var diffMin = Math.floor(diffMs / 60000);
        var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        var dayDiff = Math.round((today - msgDay) / 86400000);
        // Relative wording only for the last two hours; after that a person
        // wants the clock time, not arithmetic. Same day -> "HH:MM",
        // previous day -> "Yesterday", anything older -> the date alone.
        if (diffMin < 1) return 'just now';
        if (diffMin < 60) return diffMin + ' min ago';
        if (diffMin < 120 && dayDiff === 0) {
            var rm = diffMin % 60;
            return rm > 0 ? '1h ' + rm + 'm ago' : '1h ago';
        }
        if (dayDiff === 0) return m[4] + ':' + m[5];
        if (dayDiff === 1) return 'Yesterday';
        var dd = (d.getDate() < 10 ? '0' : '') + d.getDate();
        var mm = (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1);
        return dd + '.' + mm + '.' + d.getFullYear();
    }

    function _avatarLetters(name) {
        var s = (name || '').trim();
        if (!s) return '?';
        if (/^\+?\d[\d\s\-()]*$/.test(s)) return '#';
        var words = s.split(/\s+/);
        if (words.length >= 2) return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
        var caps = s.match(/[A-ZА-ЯЁ]/g);
        if (caps && caps.length >= 2) return (caps[0] + caps[1]).toUpperCase();
        return s.substring(0, 2).toUpperCase();
    }

    function _formatTime(dateStr) {
        var parts = (dateStr || '').split(' ');
        return parts[1] ? parts[1].substring(0, 5) : '';
    }

    function _formatDate(dateStr) {
        var parts = (dateStr || '').match(/^(\d{2})-(\d{2})-(\d{4})/);
        if (!parts) return dateStr || '';
        var now = new Date();
        var y = +parts[3], m = +parts[2] - 1, d = +parts[1];
        if (y === now.getFullYear() && m === now.getMonth() && d === now.getDate()) return 'Today';
        var yest = new Date(now); yest.setDate(yest.getDate() - 1);
        if (y === yest.getFullYear() && m === yest.getMonth() && d === yest.getDate()) return 'Yesterday';
        return parts[1] + '.' + parts[2] + '.' + parts[3];
    }

    function _smsPhone(raw) {
        if (Array.isArray(raw)) return raw[0] || '';
        return raw || '';
    }

    function _smsPhoneKey(phone) {
        return (phone || '').replace(/[\s\-()]/g, '').toLowerCase();
    }

    function _flatSmsToContacts(list) {
        var groups = {};
        (list || []).forEach(function(m) {
            if (String(m.SMSType) === '4') return;
            var phone = _smsPhone(m.PhoneNumber);
            var key = _smsPhoneKey(phone);
            if (!key) return;
            if (!groups[key]) {
                groups[key] = {
                    ContactId: 0,
                    PhoneNumber: phone,
                    LatestContent: m.SMSContent || '',
                    LatestTime: m.SMSTime || '',
                    SMSIds: [],
                    TotalNum: 0
                };
            }
            groups[key].TotalNum++;
            if (m.SMSId != null) groups[key].SMSIds.push(m.SMSId);
            if (!groups[key].LatestTime || (m.SMSTime || '') > groups[key].LatestTime) {
                groups[key].LatestContent = m.SMSContent || '';
                groups[key].LatestTime = m.SMSTime || '';
            }
        });
        return Object.keys(groups).map(function(k) { return groups[k]; });
    }

    function _loadFlatSmsList() {
        return API.webapi('GetSMSListByContactNum', { Page: 1, key: 'inbox' }).then(function(r) {
            return (r && r.SMSList) || [];
        });
    }

    function _smsDelay(ms) {
        return new Promise(function(resolve) { setTimeout(resolve, ms); });
    }

    function _isSmsContentListError(e) {
        var msg = (e && (e.apiMessage || e.message)) || '';
        return e && e.method === 'GetSMSContentList' ||
            /GetSMSContentList|Get SMS content list failed/i.test(msg);
    }

    function _renderSmsInbox(el, storage, contactList) {
        var used = parseInt(storage.TUseCount || storage.UsedNum || 0, 10);
        var left = parseInt(storage.LeftCount || 0, 10);
        var total = parseInt(storage.MaxCount || storage.TotalNum || 0, 10) || (used + left);
        var pct = total ? Math.round(used / total * 100) : 0;
        var html = '<div class="sms-storage-row">' +
            '<span class="sms-storage-label">Storage ' + used + '/' + total + '</span>' +
            '<div class="sms-storage-track"><div class="sms-storage-fill" style="width:' + pct + '%"></div></div>' +
            '<button class="sms-compose-btn" ' + actionAttr('smsTab', ['compose']) + ' title="New message">' +
                icon('ic-edit') +
            '</button>' +
            '</div>';

        if (!contactList || contactList.length === 0) {
            html += '<p class="text-muted" style="text-align:center;padding:2rem 0">No messages</p>';
        } else {
            html += '<div class="chat-list">';
            contactList.forEach(function(c) {
                var phoneStr = _smsPhone(c.PhoneNumber);
                var preview = ((c.LatestContent || c.SMSContent || '') + '').substring(0, 50);
                var unreadCount = parseInt(c.UnreadCount || 0, 10);
                var totalCount = parseInt(c.TotalNum || c.TSMSCount || 0, 10);
                var smsIds = Array.isArray(c.SMSIds) ? c.SMSIds.join(',') : '';
                var letter = _avatarLetters(phoneStr);

                html += '<div class="chat-item">' +
                    '<div class="chat-item-fg" ' + actionAttr('openSmsThread', [phoneStr, c.ContactId || 0]) + '>' +
                        '<div class="chat-avatar">' + escHtml(letter) + '</div>' +
                        '<div class="chat-item-body">' +
                            '<div class="chat-item-top">' +
                                '<span class="chat-item-name">' + escHtml(phoneStr) + '</span>' +
                                '<span class="chat-item-time">' + escHtml(_timeAgoShort(c.LatestTime || c.SMSTime || '')) + '</span>' +
                            '</div>' +
                            '<div class="chat-item-bottom">' +
                                '<span class="chat-item-preview">' + escHtml(preview) + '</span>' +
                                (unreadCount > 0
                                    ? '<span class="badge-unread">' + unreadCount + '</span>'
                                    : (totalCount > 0 ? '<span class="badge-unread muted">' + totalCount + '</span>' : '')) +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<button class="chat-item-action-bg" data-stop ' + actionAttr('deleteSmsThread', [c.ContactId || 0, phoneStr, smsIds]) + '>' +
                        icon('ic-delete') + 'Delete' +
                    '</button>' +
                '</div>';
            });
            html += '</div>';
        }

        el.innerHTML = html;
    }

    function _loadSmsInbox(retries) {
        var el = document.getElementById('sms-inbox');
        if (!el) return;
        el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading messages...</div>';
        retries = retries == null ? 2 : retries;

        Promise.all([
            API.webapi('GetSMSStorageState'),
            API.webapi('GetSMSContactList', { Page: 0, ContactNum: 50 }).catch(function() { return null; })
        ]).then(function(results) {
            var storage = results[0], contacts = results[1];
            var used = parseInt(storage.TUseCount || storage.UsedNum || 0, 10);
            var contactList = contacts && contacts.SMSContactList || [];
            if (contactList.length === 0 && used > 0) {
                return _loadFlatSmsList().then(function(list) {
                    var fallbackContacts = _flatSmsToContacts(list);
                    if (fallbackContacts.length === 0 && retries > 0) {
                        return _smsDelay(900).then(function() {
                            return _loadSmsInbox(retries - 1);
                        });
                    }
                    _renderSmsInbox(el, storage, fallbackContacts);
                }).catch(function(e) {
                    if (retries > 0) {
                        return _smsDelay(900).then(function() {
                            return _loadSmsInbox(retries - 1);
                        });
                    }
                    _renderSmsInbox(el, storage, contactList);
                });
            }
            _renderSmsInbox(el, storage, contactList);
        }).catch(function(e) {
            el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(e.message) + '</p></div>';
        });
    }


    function _openSmsThread(phone, contactId) {
        var el = document.getElementById('sms-inbox');
        if (!el) return;
        el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading thread...</div>';
        contactId = parseInt(contactId, 10) || 0;

        if (!contactId) return _openFlatSmsThread(phone);

        return API.webapi('GetSMSContentList', {
            ContactId: contactId, Page: 0, PhoneNumber: phone
        }).then(function(msgs) {
            var list = (msgs.SMSContentList || []).slice().reverse();
            _renderSmsThread(el, phone, contactId, list);
        }).catch(function(e) {
            var msg = (e && (e.apiMessage || e.message)) || '';
            if (_isSmsContentListError(e)) {
                return _openFlatSmsThread(phone);
            }
            el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(msg || e) + '</p></div>';
        });
    }

    function _openFlatSmsThread(phone) {
        var el = document.getElementById('sms-inbox');
        if (!el) return;
        return _loadFlatSmsList().then(function(list) {
            var key = _smsPhoneKey(phone);
            var filtered = list.filter(function(m) {
                return String(m.SMSType) !== '4' && _smsPhoneKey(_smsPhone(m.PhoneNumber)) === key;
            }).reverse();
            _renderSmsThread(el, phone, 0, filtered);
        }).catch(function(e) {
            _renderEmptySmsThread(el, phone);
        });
    }

    function _renderSmsThread(el, phone, contactId, list) {
            var letter = _avatarLetters(phone);

            var html = '<div class="chat-wrap">' +
            '<div class="chat-header">' +
                '<button ' + actionAttr('smsTab', ['inbox']) + ' class="chat-back">\u2190</button>' +
                '<div class="chat-avatar sm">' + escHtml(letter) + '</div>' +
                '<span class="chat-header-name">' + escHtml(phone) + '</span>' +
            '</div>';

            if (list.length === 0) {
                html += '<p class="text-muted" style="text-align:center;padding:2rem 0">No messages in thread</p>';
            } else {
                html += '<div class="chat-messages">';
                var prevDate = '', prevType = null;
                list.forEach(function(m) {
                    var isSent = (m.SMSType === 2 || m.SMSType === '2');
                    var dir = isSent ? 'out' : 'in';
                    var smsId = m.SMSId || m.SmsId || '';
                    var hasReport = (m.sms_report && m.sms_report !== 0 && m.sms_report !== '0') ||
                        (m.ReportStatus && m.ReportStatus !== 0 && m.ReportStatus !== '0');
                    var curDate = _formatDate(m.SMSTime || '');
                    var grouped = (prevType === dir && curDate === prevDate);

                    if (curDate && curDate !== prevDate) {
                        html += '<div class="chat-date-sep"><span>' + escHtml(curDate) + '</span></div>';
                    }

                    html += '<div class="chat-msg ' + dir + (grouped ? ' grouped' : '') + '">';
                    html += '<div class="chat-msg-text">' + escHtml(m.SMSContent || '') + '</div>';
                    html += '<div class="chat-msg-meta">';
                    if (smsId) {
                        html += '<button type="button" ' + actionAttr('deleteSingleSms', [smsId, phone, contactId || 0]) +
                            ' class="chat-msg-del" title="Delete message" aria-label="Delete message">' +
                            icon('ic-delete') +
                        '</button>';
                    }
                    html += '<span class="chat-msg-time">' + escHtml(_formatTime(m.SMSTime || '')) + '</span>';
                    if (isSent) {
                        html += '<svg class="icon-xs' + (hasReport ? ' read' : '') + '"><use href="#' + (hasReport ? 'ic-check-all' : 'ic-check') + '"/></svg>';
                    }
                    html += '</div></div>';

                    prevDate = curDate;
                    prevType = dir;
                });
                html += '</div>';
            }

            html += '<div class="chat-input-bar">' +
                '<textarea id="sms-reply-text" rows="1" placeholder="Message"></textarea>' +
                '<button ' + actionAttr('sendSms', [phone]) + ' class="chat-send-btn">' +
                    '<svg class="icon"><use href="#ic-send"/></svg>' +
                '</button>' +
            '</div>' +
            '</div>'; /* close .chat-wrap */

            el.innerHTML = html;
            var pc = document.getElementById('page-content');
            if (pc) pc.classList.add('chat-active');

            var chatMsgs = el.querySelector('.chat-messages');
            if (chatMsgs) chatMsgs.scrollTop = chatMsgs.scrollHeight;

            var replyText = document.getElementById('sms-reply-text');
            var sendBtn = document.querySelector('.chat-send-btn');
            if (replyText && sendBtn) {
                replyText.addEventListener('input', function() {
                    sendBtn.classList.toggle('active', replyText.value.trim().length > 0);
                });
            }

            API.webapi('SetNewSMSFlag').catch(function() {});
    }

    function _renderEmptySmsThread(el, phone) {
        var letter = _avatarLetters(phone);
        el.innerHTML = '<div class="chat-wrap">' +
            '<div class="chat-header">' +
                '<button ' + actionAttr('smsTab', ['inbox']) + ' class="chat-back">\u2190</button>' +
                '<div class="chat-avatar sm">' + escHtml(letter) + '</div>' +
                '<span class="chat-header-name">' + escHtml(phone || '') + '</span>' +
            '</div>' +
            '<p class="text-muted" style="text-align:center;padding:2rem 0">No messages in thread</p>' +
            '<div class="chat-input-bar">' +
                '<textarea id="sms-reply-text" rows="1" placeholder="Message"></textarea>' +
                '<button ' + actionAttr('sendSms', [phone]) + ' class="chat-send-btn">' +
                    '<svg class="icon"><use href="#ic-send"/></svg>' +
                '</button>' +
            '</div>' +
        '</div>';
        var pc = document.getElementById('page-content');
        if (pc) pc.classList.add('chat-active');
    }

    function _loadSmsCompose() {
        var el = document.getElementById('sms-compose');
        if (!el) return;

        el.innerHTML =
            '<div class="compose-to-row">' +
                '<label>To:</label>' +
                '<input type="tel" id="sms-to" placeholder="Enter number...">' +
            '</div>' +
            '<div id="compose-contacts"><div class="page-loading"><div class="spinner"></div></div></div>' +
            '<div id="compose-editor" class="hidden">' +
                '<div class="compose-recipient" id="compose-recipient-display"></div>' +
                '<textarea id="sms-text" rows="3" placeholder="Type your message..."></textarea>' +
                '<div class="stat-row">' +
                    '<span class="label" id="sms-char-count">0 / 160</span>' +
                    '<span class="value" id="sms-parts">1 part</span>' +
                '</div>' +
                '<div id="sms-send-status"></div>' +
                '<div class="chat-input-bar">' +
                    '<button ' + actionAttr('sendSmsCompose') + ' class="chat-send-btn">' +
                        '<svg class="icon"><use href="#ic-send"/></svg>' +
                    '</button>' +
                '</div>' +
            '</div>';

        _loadComposeContacts();

        var toInput = document.getElementById('sms-to');
        if (toInput) {
            toInput.addEventListener('input', function() {
                var q = toInput.value.trim().toLowerCase();
                var items = el.querySelectorAll('.chat-item');
                items.forEach(function(item) {
                    var name = (item.getAttribute('data-search') || '').toLowerCase();
                    item.style.display = (!q || name.indexOf(q) !== -1) ? '' : 'none';
                });
                // Show editor when a valid number is typed
                var editor = document.getElementById('compose-editor');
                var contacts = document.getElementById('compose-contacts');
                if (/^\+?\d{3,}$/.test(toInput.value.trim())) {
                    if (editor) editor.classList.remove('hidden');
                    if (contacts) contacts.classList.add('hidden');
                    var disp = document.getElementById('compose-recipient-display');
                    if (disp) disp.textContent = toInput.value.trim();
                    var textArea = document.getElementById('sms-text');
                    if (textArea && !textArea._bound) {
                        textArea._bound = true;
                        textArea.addEventListener('input', _smsCharCount);
                    }
                } else {
                    if (editor) editor.classList.add('hidden');
                    if (contacts) contacts.classList.remove('hidden');
                }
            });
            toInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    var v = toInput.value.trim();
                    if (/^\+?\d{3,}$/.test(v)) _selectComposeRecipient(v, v);
                }
            });
        }
    }

    function _loadComposeContacts() {
        var el = document.getElementById('compose-contacts');
        if (!el) return;

        Promise.all([
            API.webapi('getPhoneBookInitState').then(function(r) {
                if (parseInt(r.state, 10) !== 0) return [];
                return API.webapi('getPhoneBooklistInfo', { Page: 1 }).then(function(pb) {
                    return (pb.PhoneBookList || []).map(function(c) {
                        return { name: c.Name || '', phone: c.PhoneNumber || '', source: 'sim' };
                    });
                });
            }).catch(function() { return []; }),
            API.webapi('GetSMSContactList', { Page: 0, ContactNum: 50 }).then(function(r) {
                return (r.SMSContactList || []).filter(function(c) {
                    var ph = Array.isArray(c.PhoneNumber) ? (c.PhoneNumber[0] || '') : (c.PhoneNumber || '');
                    return /^\+?\d[\d\s\-()]*$/.test(ph);
                }).map(function(c) {
                    var ph = Array.isArray(c.PhoneNumber) ? (c.PhoneNumber[0] || '') : (c.PhoneNumber || '');
                    return { name: '', phone: ph, preview: c.LatestContent || '', source: 'sms' };
                });
            }).catch(function() { return []; })
        ]).then(function(results) {
            var simContacts = results[0];
            var smsContacts = results[1];

            // Merge: SIM contacts first, then SMS contacts (skip dupes)
            var seen = {};
            var all = [];
            simContacts.forEach(function(c) {
                if (!c.phone) return;
                var key = c.phone.replace(/[\s\-()]/g, '').toLowerCase();
                if (!seen[key]) { seen[key] = true; all.push(c); }
            });
            smsContacts.forEach(function(c) {
                if (!c.phone) return;
                var key = c.phone.replace(/[\s\-()]/g, '').toLowerCase();
                if (!seen[key]) { seen[key] = true; all.push(c); }
            });

            if (all.length === 0) {
                el.innerHTML = '<p class="text-muted" style="text-align:center;padding:1rem 0">No contacts. Type a number above.</p>';
                return;
            }

            var html = '<div class="chat-list">';
            all.forEach(function(c) {
                var displayName = c.name || c.phone;
                var subtitle = c.name ? c.phone : (c.preview || '').substring(0, 50);
                var letter = _avatarLetters(displayName);
                var searchStr = escHtml((c.name + ' ' + c.phone).trim());
                html += '<div class="chat-item" ' +
                    actionAttr('selectComposeRecipient', [c.phone, displayName]) +
                    ' data-search="' + searchStr + '">' +
                    '<div class="chat-avatar">' + escHtml(letter) + '</div>' +
                    '<div class="chat-item-body">' +
                        '<div class="chat-item-top">' +
                            '<span class="chat-item-name">' + escHtml(displayName) + '</span>' +
                            (c.source === 'sim' ? '<span class="chat-item-time">SIM</span>' : '') +
                        '</div>' +
                        (subtitle ? '<div class="chat-item-bottom"><span class="chat-item-preview">' + escHtml(subtitle) + '</span></div>' : '') +
                    '</div>' +
                '</div>';
            });
            html += '</div>';
            el.innerHTML = html;
        });
    }

    function _selectComposeRecipient(phone, name) {
        var toInput = document.getElementById('sms-to');
        var editor = document.getElementById('compose-editor');
        var contacts = document.getElementById('compose-contacts');
        var disp = document.getElementById('compose-recipient-display');

        if (toInput) toInput.value = phone;
        if (disp) disp.textContent = (name && name !== phone) ? name + ' (' + phone + ')' : phone;
        if (editor) editor.classList.remove('hidden');
        if (contacts) contacts.classList.add('hidden');

        var textArea = document.getElementById('sms-text');
        if (textArea) {
            if (!textArea._bound) {
                textArea._bound = true;
                textArea.addEventListener('input', _smsCharCount);
            }
            textArea.focus();
        }
    }

    function _smsCharCount() {
        var text = document.getElementById('sms-text');
        if (!text) return;
        var len = text.value.length;
        var parts = len <= 160 ? 1 : Math.ceil(len / 153);
        var el = document.getElementById('sms-char-count');
        if (el) el.textContent = len + ' / ' + (parts === 1 ? 160 : 153 * parts);
        var elP = document.getElementById('sms-parts');
        if (elP) elP.textContent = parts + ' part' + (parts > 1 ? 's' : '');
    }

    function _smsTimestamp() {
        var d = new Date();
        var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
               ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }

    function _retryOpenThread(phone, contactId, attempts, delay) {
        contactId = parseInt(contactId, 10) || 0;
        if (!contactId) return _openFlatSmsThread(phone);
        var el = document.getElementById('sms-inbox');
        if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading thread...</div>';
        // Test API readiness without rendering, then render on success
        return API.webapi('GetSMSContentList', {
            ContactId: contactId, Page: 0, PhoneNumber: phone
        }).then(function() {
            return _openSmsThread(phone, contactId);
        }).catch(function(e) {
            if (_isSmsContentListError(e)) return _openFlatSmsThread(phone);
            if (attempts <= 1) {
                if (el) el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(e.message) + '</p></div>';
                return;
            }
            return _smsDelay(delay).then(function() {
                return _retryOpenThread(phone, contactId, attempts - 1, delay);
            });
        });
    }

    function _pollSendResult(maxAttempts) {
        var attempts = 0;
        var limit = maxAttempts || 10;
        return new Promise(function(resolve, reject) {
            var timer = setInterval(function() {
                attempts++;
                API.webapi('GetSendSMSResult').then(function(r) {
                    var st = parseInt(r.SendStatus, 10);
                    if (st === 2) { clearInterval(timer); resolve(); return; }
                    // The attempt limit applies to EVERY branch, including
                    // "still sending" — otherwise a modem stuck at status 1
                    // leaves this interval running forever.
                    if (attempts >= limit) {
                        clearInterval(timer);
                        reject(new Error('Send timed out (status ' + st + ')'));
                        return;
                    }
                    if (st === 1 || st === 3) return; // still sending, keep polling
                    clearInterval(timer);
                    reject(new Error('Send failed (status ' + st + ')'));
                }).catch(function(e) { clearInterval(timer); reject(e); });
            }, 3000);
            // Navigating away must not leave the poll running.
            App.setCleanup(function() { clearInterval(timer); });
        });
    }

    function _clearSendStatus(bar) {
        if (!bar) return;
        var el = bar.previousElementSibling;
        if (el && el.classList.contains('chat-send-status')) el.remove();
    }

    function _showSendStatus(bar, msg, isError) {
        if (!bar) return;
        _clearSendStatus(bar);
        var div = document.createElement('div');
        div.className = 'chat-send-status' + (isError ? ' error' : '');
        div.textContent = msg;
        bar.parentNode.insertBefore(div, bar);
        if (isError) setTimeout(function() { div.remove(); }, 8000);
    }

    function _sendSms(phone) {
        var textEl = document.getElementById('sms-reply-text');
        if (!textEl || !textEl.value.trim()) return;

        var bar = document.querySelector('.chat-input-bar');
        var btn = document.querySelector('.chat-send-btn');
        if (btn) { btn.disabled = true; btn.classList.add('sending'); }
        if (textEl) textEl.disabled = true;
        _clearSendStatus(bar);

        API.webapi('SendSMS', {
            SMSId: -1,
            PhoneNumber: phone,
            SMSContent: textEl.value.trim(),
            SMSTime: _smsTimestamp()
        }).then(function() {
            return _pollSendResult(10);
        }).then(function() {
            textEl.value = '';
            textEl.dispatchEvent(new Event('input'));
            if (btn) { btn.disabled = false; btn.classList.remove('sending'); }
            if (textEl) textEl.disabled = false;
            btn = null; textEl = null;
            return new Promise(function(r) { setTimeout(r, 5000); });
        }).then(function() {
            return _retryOpenThread(phone, 0, 3, 3000);
        }).catch(function(e) {
            if (bar) {
                var msg = (e.apiMessage || e.message || 'Send failed');
                if (e.code) msg += ' [' + e.code + ']';
                _showSendStatus(bar, msg, true);
            }
        }).then(function() {
            if (btn) { btn.disabled = false; btn.classList.remove('sending'); }
            if (textEl) textEl.disabled = false;
        });
    }

    function _sendSmsCompose() {
        var to = document.getElementById('sms-to');
        var text = document.getElementById('sms-text');
        var status = document.getElementById('sms-send-status');
        var sendBtn = document.querySelector('.chat-send-btn');
        if (!to || !text || !to.value.trim() || !text.value.trim()) {
            if (status) status.innerHTML = '<p class="text-danger">Recipient and message required</p>';
            return;
        }

        var phone = to.value.trim();
        if (sendBtn) { sendBtn.disabled = true; sendBtn.classList.add('sending'); }
        if (text) text.disabled = true;
        if (status) status.innerHTML = '';

        API.webapi('SendSMS', {
            SMSId: -1,
            PhoneNumber: phone,
            SMSContent: text.value.trim(),
            SMSTime: _smsTimestamp()
        }).then(function() {
            return _pollSendResult(10);
        }).then(function() {
            // Switch to inbox and open the thread
            _smsTab('inbox');
            return new Promise(function(r) { setTimeout(r, 5000); });
        }).then(function() {
            return _retryOpenThread(phone, 0, 3, 3000);
        }).catch(function(e) {
            var msg = (e.apiMessage || e.message || 'Send failed');
            if (e.code) msg += ' [' + e.code + ']';
            if (status) status.innerHTML = '<p class="text-danger">' + escHtml(msg) + '</p>';
        }).then(function() {
            if (sendBtn) { sendBtn.disabled = false; sendBtn.classList.remove('sending'); }
            if (text) text.disabled = false;
        });
    }

    function _reloadSmsInboxSoon() {
        setTimeout(function() { _loadSmsInbox(4); }, 1200);
    }

    function _deleteSingleSms(smsId, phone, contactId) {
        App.confirmDialog('Delete this message?', function() {
            App.wrapFormSubmit(null, function() {
                return API.webapi('DeleteSMS', { DelFlag: 3, SMSArray: [parseInt(smsId, 10)] })
                    .then(function() {
                        return _smsDelay(1200).then(function() {
                            return _openSmsThread(phone, contactId);
                        });
                    });
            }, { key: 'sms-del-one', error: 'Delete failed', success: 'Message deleted' });
        }, null, { title: 'Delete message', confirmText: 'Delete', danger: true });
    }

    function _resolveThreadSmsIds(phone, smsIds) {
        var ids = (smsIds || '').split(',').map(function(v) {
            return parseInt(v, 10);
        }).filter(function(v) {
            return !isNaN(v);
        });
        if (ids.length > 0) return Promise.resolve(ids);

        return _loadFlatSmsList().then(function(list) {
            var key = _smsPhoneKey(phone);
            return list.filter(function(m) {
                return String(m.SMSType) !== '4' &&
                    _smsPhoneKey(_smsPhone(m.PhoneNumber)) === key &&
                    m.SMSId != null;
            }).map(function(m) {
                return parseInt(m.SMSId, 10);
            }).filter(function(v) {
                return !isNaN(v);
            });
        });
    }

    function _deleteSmsThread(contactId, phone, smsIds) {
        App.confirmDialog(
            'Delete every message in this conversation? This cannot be undone.',
            function() {
                App.wrapFormSubmit(null, function() {
                    return _resolveThreadSmsIds(phone, smsIds).then(function(ids) {
                        if (!ids.length) return null;
                        return API.webapi('DeleteSMS', { DelFlag: 3, SMSArray: ids });
                    }).then(function() {
                        _reloadSmsInboxSoon();
                    }, function(e) {
                        // The list still needs refreshing even when the delete failed.
                        _reloadSmsInboxSoon();
                        throw e;
                    });
                }, { key: 'sms-del-thread', error: 'Delete failed', success: 'Conversation deleted' });
            }, null,
            { title: 'Delete conversation', confirmText: 'Delete', danger: true });
    }

    function _loadSmsForward() {
        var el = document.getElementById('sms-forward');
        if (!el) return;
        el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading...</div>';

        Promise.all([
            API.webapi('getSMSAutoRedirectSetting').catch(function() { return {}; }),
            API.cgiGet('sms_fwd.cgi', { action: 'status' }).catch(function() { return {}; })
        ]).then(function(results) {
            var redirect = results[0];
            var conf = results[1];

            var phoneEnabled = parseInt(redirect.redirect_flag, 10) === 1;
            var phoneTarget = redirect.redirect_number || '';

            el.innerHTML =
            '<div class="card">' +
                '<h3>Phone Redirect</h3>' +
                '<p class="text-muted text-small">Built-in modem feature — forwards incoming SMS to another number</p>' +
                '<label>' +
                    '<input type="checkbox" id="fwd-phone-enabled"' + (phoneEnabled ? ' checked' : '') + '>' +
                    ' Enable SMS redirect' +
                '</label>' +
                '<label>Target Number</label>' +
                '<input type="tel" id="fwd-phone-target" value="' + escHtml(phoneTarget) + '" placeholder="+1234567890">' +
                '<button ' + actionAttr('savePhoneRedirect') + ' style="margin-top:0.5rem">Save</button>' +
                '<div id="fwd-phone-status"></div>' +
            '</div>' +

            '<div class="card">' +
                '<h3>Telegram Forwarding</h3>' +
                '<label>' +
                    '<input type="checkbox" id="fwd-tg-enabled"' + (conf.telegram_enabled ? ' checked' : '') + '>' +
                    ' Enable Telegram forwarding' +
                '</label>' +
                '<label>Bot Token ' + (conf.has_token ? '<span class="text-muted text-small">(configured: ' + escHtml(conf.telegram_bot_token) + ')</span>' : '') + '</label>' +
                '<input type="text" id="fwd-tg-token" value="" placeholder="' + (conf.has_token ? 'Enter new token to change' : '123456:ABC-DEF1234...') + '">' +
                '<div class="flex-center" style="gap:0.5rem;margin:0.5rem 0">' +
                    '<button class="btn-small" ' + actionAttr('smsBotInfo') + '>Bot Info</button>' +
                    '<button class="btn-small" ' + actionAttr('smsRecentChats') + '>Recent Chats</button>' +
                '</div>' +
                '<div id="fwd-bot-info"></div>' +
                '<label>Chat ID</label>' +
                '<input type="text" id="fwd-tg-chatid" value="' + escHtml(conf.telegram_chat_id || '') + '" placeholder="-1001234567890">' +
                '<div id="fwd-chat-list"></div>' +
                '<button class="btn-small" ' + actionAttr('smsTestTelegram') + ' style="margin-top:0.5rem">Send Test Message</button>' +
                '<div id="fwd-test-result"></div>' +
            '</div>' +

            '<div class="card">' +
                '<h3>Daemon Options</h3>' +
                '<label>Filter Numbers (comma-separated, empty = all)</label>' +
                '<input type="text" id="fwd-filter" value="' + escHtml(conf.filter_numbers || '') + '" placeholder="+1234567890,+0987654321">' +
                '<div class="stat-row">' +
                    '<span class="label">Detection</span>' +
                    '<span class="value">Event-driven (inotify)</span>' +
                '</div>' +
                '<div class="stat-row">' +
                    '<span class="label">Daemon Status</span>' +
                    '<span class="value ' + (conf.running ? 'text-success' : 'text-danger') + '">' + (conf.running ? 'Running' : 'Stopped') + '</span>' +
                '</div>' +
                '<button ' + actionAttr('saveTelegramForward') + '>Save Telegram Config</button>' +
                '<div id="fwd-save-status"></div>' +
            '</div>';
        }).catch(function(e) {
            el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(e.message) + '</p></div>';
        });
    }

    function _savePhoneRedirect() {
        var status = document.getElementById('fwd-phone-status');
        if (status) status.innerHTML = '<div class="page-loading"><div class="spinner"></div> Saving...</div>';

        var enabled = document.getElementById('fwd-phone-enabled').checked;
        var target = (document.getElementById('fwd-phone-target').value || '').trim();

        if (enabled && !target) {
            if (status) status.innerHTML = '<p class="text-danger">Target number is required</p>';
            return;
        }

        API.webapi('setSMSAutoRedirectSetting', {
            redirect_flag: enabled ? 1 : 0,
            redirect_number: target,
            SMSTime: _smsTimestamp()
        }).then(function() {
            if (status) status.innerHTML = '<p class="text-success">Phone redirect ' + (enabled ? 'enabled' : 'disabled') + '</p>';
        }).catch(function(e) {
            if (status) status.innerHTML = '<p class="text-danger">Error: ' + escHtml(e.message) + '</p>';
        });
    }

    function _saveTelegramForward() {
        var status = document.getElementById('fwd-save-status');
        if (status) status.innerHTML = '<div class="page-loading"><div class="spinner"></div> Saving...</div>';

        var data = {
            action: 'save',
            telegram_enabled: document.getElementById('fwd-tg-enabled').checked ? 1 : 0,
            telegram_bot_token: document.getElementById('fwd-tg-token').value.trim(),
            telegram_chat_id: document.getElementById('fwd-tg-chatid').value.trim(),
            phone_enabled: 0,
            phone_target: '',
            filter_numbers: document.getElementById('fwd-filter').value.trim()
        };

        API.cgiPost('sms_fwd.cgi', data).then(function(result) {
            if (result.ok) {
                if (status) status.innerHTML = '<p class="text-success">Telegram config saved</p>';
            } else {
                if (status) status.innerHTML = '<p class="text-danger">Error: ' + escHtml(result.error || 'Unknown') + '</p>';
            }
        }).catch(function(e) {
            if (status) status.innerHTML = '<p class="text-danger">Error: ' + escHtml(e.message) + '</p>';
        });
    }

    function _smsTestTelegram() {
        var status = document.getElementById('fwd-test-result');
        if (status) status.innerHTML = '<div class="page-loading"><div class="spinner"></div> Sending test...</div>';

        var data = {
            action: 'test_telegram',
            telegram_bot_token: document.getElementById('fwd-tg-token').value.trim(),
            telegram_chat_id: document.getElementById('fwd-tg-chatid').value.trim()
        };

        API.cgiPost('sms_fwd.cgi', data).then(function(result) {
            if (result.ok) {
                if (status) status.innerHTML = '<p class="text-success">' + escHtml(result.message) + '</p>';
            } else {
                if (status) status.innerHTML = '<p class="text-danger">' + escHtml(result.error || 'Failed') + '</p>';
            }
        }).catch(function(e) {
            if (status) status.innerHTML = '<p class="text-danger">Error: ' + escHtml(e.message) + '</p>';
        });
    }

    function _smsBotInfo() {
        var el = document.getElementById('fwd-bot-info');
        if (!el) return;
        el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

        API.cgiGet('sms_fwd.cgi', { action: 'bot_info' }).then(function(result) {
            if (result.ok) {
                el.innerHTML = '<div class="stat-row"><span class="label">Bot</span><span class="value">@' + escHtml(result.username) + ' (' + escHtml(result.first_name) + ')</span></div>' +
                    '<div class="stat-row"><span class="label">Link</span><span class="value"><a href="' + escHtml(result.link) + '" target="_blank">' + escHtml(result.link) + '</a></span></div>';
            } else {
                el.innerHTML = '<p class="text-danger">' + escHtml(result.error || 'Failed') + '</p>';
            }
        }).catch(function(e) {
            el.innerHTML = '<p class="text-danger">Error: ' + escHtml(e.message) + '</p>';
        });
    }

    function _smsRecentChats() {
        var el = document.getElementById('fwd-chat-list');
        if (!el) return;
        el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

        API.cgiGet('sms_fwd.cgi', { action: 'recent_chats' }).then(function(result) {
            if (result.ok && result.chats) {
                if (result.chats.length === 0) {
                    el.innerHTML = '<p class="text-muted">No recent chats. Send a message to the bot first.</p>';
                } else {
                    var html = '<table class="data-table"><thead><tr><th>Chat ID</th><th>Name</th><th>Type</th><th></th></tr></thead><tbody>';
                    result.chats.forEach(function(c) {
                        html += '<tr><td class="text-mono">' + escHtml(c.id) + '</td>' +
                            '<td>' + escHtml(c.title) + '</td>' +
                            '<td>' + escHtml(c.type) + '</td>' +
                            '<td><button class="btn-small" ' + actionAttr('smsSetChatId', [c.id]) + '>Use</button></td></tr>';
                    });
                    html += '</tbody></table>';
                    el.innerHTML = html;
                }
            } else {
                el.innerHTML = '<p class="text-danger">' + escHtml(result.error || 'Failed') + '</p>';
            }
        }).catch(function(e) {
            el.innerHTML = '<p class="text-danger">Error: ' + escHtml(e.message) + '</p>';
        });
    }

    function _smsSetChatId(id) {
        var el = document.getElementById('fwd-tg-chatid');
        if (el) el.value = id;
    }

    App.registerPage('sms', renderSms);
    App._smsTab = _smsTab;
    App._openSmsThread = _openSmsThread;
    App._deleteSmsThread = _deleteSmsThread;
    App._deleteSingleSms = _deleteSingleSms;
    App._sendSms = _sendSms;
    App._sendSmsCompose = _sendSmsCompose;
    App._selectComposeRecipient = _selectComposeRecipient;
    App._smsCharCount = _smsCharCount;
    App._savePhoneRedirect = _savePhoneRedirect;
    App._saveTelegramForward = _saveTelegramForward;
    App._smsTestTelegram = _smsTestTelegram;
    App._smsBotInfo = _smsBotInfo;
    App._smsRecentChats = _smsRecentChats;
    App._smsSetChatId = _smsSetChatId;
})();
