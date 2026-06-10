# sms_watchd — Event-driven SMS notification daemon

Replaces the old `sms_forward.sh` polling daemon (30s interval) with near-instant inotify-based detection. New SMS notifications arrive within ~2 seconds.

## Architecture

```
core_app writes SMS → user_info.db3 modified (new_sms_flag=1)
                            ↓ inotify IN_MODIFY
                      sms_watchd (C, ~10 KB)
                            ↓ fork/exec (debounced 2s)
                      sms_notify (shell, ~4 KB)
                            ↓ sqlite3: check new_sms_flag
                            ↓ curl → WebAPI (GetSMSContactList + GetSMSContentList)
                            ↓ curl → Telegram Bot API
                            ↓ sqlite3: clear new_sms_flag
```

## Components

### sms_watchd (C)

inotify daemon that watches `/jrd-resource/resource/sqlite3/` for `user_info.db3` changes.

- Self-daemonizes (fork+setsid), PID file `/var/run/sms_watchd.pid`
- 2-second debounce (SQLite writes multiple events per transaction)
- No child pileup (waits for sms_notify to finish before spawning again)
- Links only `libc.so.6` — no external dependencies
- Foreground mode: `sms_watchd -f`

### sms_notify (shell)

Notification script called by sms_watchd. Reads unread SMS via WebAPI and forwards to Telegram.

Flow:
1. Lockfile (`mkdir /tmp/sms_notify.lock`) — prevents concurrent runs
2. Source `/etc/sms_forward.conf` — exit if Telegram not enabled
3. Check `new_sms_flag` via sqlite3 — exit if not set
4. Call `GetSMSContactList` via WebAPI — find contacts with `UnreadCount > 0`
5. Call `GetSMSContentList` for each — collect received messages (`SMSType=1`)
6. Forward new messages (id > last_id) to Telegram
7. Clear `new_sms_flag` in sqlite3

WebAPI access: uses `curl --interface bridge0` because `webs` binds to bridge0 IP with `SO_BINDTODEVICE` (unreachable from localhost).

## Why two-step WebAPI

The device WebAPI has no "get all unread SMS" method. `GetSMSContentList` requires a `ContactId`. The only way to discover which conversations have new messages is `GetSMSContactList` (returns `UnreadCount` per contact), then fetch content per-contact.

## Build

```bash
./build_host.sh
```

Requires `ee71-crossoe` Docker image. Output: `work/out/sms_watchd` (~10 KB ARM ELF).

## Deploy

Handled by the `ee71-webui` and `ee71-sms-watchd` Entware packages:

- `/usr/sbin/sms_watchd` — daemon binary
- `/usr/sbin/sms_notify` — notification script
- `free_api/json.txt` — patched with `GetSMSContactList`, `GetSMSContentList` (no login cookie needed)

## Configuration

Same `/etc/sms_forward.conf` as before:

```sh
TELEGRAM_ENABLED=1
TELEGRAM_BOT_TOKEN="123456:ABC..."
TELEGRAM_CHAT_ID="-100..."
FILTER_NUMBERS=""          # comma-separated, empty = all
```

Managed via web UI (SMS → Forward tab) or `sms_fwd.cgi`.

## Init

Started by `/etc/init.d/ee71_webui`:

```bash
/etc/init.d/ee71_webui start    # starts traffic_stats + sms_watchd + speedtest_httpd
/etc/init.d/ee71_webui status   # shows daemon PIDs
```

sms_watchd only starts if `TELEGRAM_ENABLED=1` in config.

## Testing

```bash
# Foreground mode (see events live)
sms_watchd -f

# Trigger manually (simulate new SMS)
sqlite3 /jrd-resource/resource/sqlite3/user_info.db3 \
  "UPDATE sms_config SET value='1' WHERE items='new_sms_flag';"

# Check syslog
logread | grep sms_notify
```
