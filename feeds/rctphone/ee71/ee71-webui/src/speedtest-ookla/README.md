# Self-Hosted Ookla Speedtest Widget

Local deployment of the Ookla Speedtest Custom React widget with custom branding, stripped identity, and direct server connections.

## Quick Start

```sh
# 1. Add hosts entry (one-time)
sudo sh -c 'echo "127.0.0.1 ee71.speedtestcustom.com" >> /etc/hosts'

# 2. Serve
cd /tmp/speedtest_custom_assets
python3 -m http.server 8877

# 3. Open
open http://ee71.speedtestcustom.com:8877
```

## Why `ee71.speedtestcustom.com`?

Ookla test servers only return `Access-Control-Allow-Origin` for whitelisted domains:
- `*.speedtestcustom.com` — allowed
- `*.speedtest.net` — allowed
- `localhost`, `megafon.ru.com`, everything else — blocked

By mapping `ee71.speedtestcustom.com` to `127.0.0.1` in `/etc/hosts`, the browser sends `Origin: http://ee71.speedtestcustom.com:8877` which Ookla servers accept. No proxy, no `--disable-web-security` needed.

## Files

| File | Purpose |
|------|---------|
| `index.html` | SPA entry with `window.ST_PARAMS` config |
| `js/testBundle.js` | Ookla React engine (~2MB webpack bundle) |
| `css/gauge.min.css` | UI styles (fonts removed, system-ui fallback) |
| `static/js/*.chunk.js` | Lazy-loaded i18n locale chunks (EN + RU) |
| `api/js/servers` | Static server list JSON (10 servers) |
| `refresh.sh` | Re-fetch fresh ST_PARAMS from Ookla, apply all patches |
| `serve_speedtest.py` | Python server with optional CORS proxy (not needed with hosts trick) |

## Changes from Original (`domv.speedtestcustom.com`)

### Branding & Theme
| Field | Original | Modified |
|-------|----------|----------|
| `subdomain` | `domv` | `ee71` |
| `backgroundColor` | `#ffffff` | `#1a1a2e` (dark) |
| `primaryColor` | `#00b956` (green) | `#3d8b7a` (EE71 teal) |

### Identity Stripped
All client-identifying fields zeroed/emptied:
- `subscriptionId`, `testConfigurationId`, `resellerContactId`, `dataProtectionContactId` → `0`/`null`
- `auth0` block → `{}`
- `apiKey` → `null`
- `jwtToken`, `buildId` → `""` (disables telemetry POST to `/logging-api/log`)
- `ipAddress`, `ispName`, `ispId` → `""` (discovered live from test servers)
- Subscription prices → `0`

### Network
| Field | Original | Modified |
|-------|----------|----------|
| `embedUrls` | `["megafon.ru.com"]` | `["ee71.speedtestcustom.com:8877"]` |
| `httpsOnly` | `true` | `false` |
| Config URLs | `https://` | `http://` |

### Fonts
All 4 `@font-face` blocks removed from `gauge.min.css`:
- Montserrat Variable (woff2)
- Montserrat Regular (woff)
- Montserrat Bold (woff)
- gauge-mono (woff2/woff)

Replaced with `system-ui, -apple-system, ...` — no external font downloads.

## Ookla XHR Protocol Reference

The engine communicates with test servers via HTTP (XHR) and WebSocket.

### Server Discovery (page load, all 10 servers in parallel)

| Phase | Endpoint | Method | Purpose |
|-------|----------|--------|---------|
| 1 | `/hello` | GET | Version handshake. Response: `hello 2.11 (2.11.0)` |
| 2 | `/getip` | GET | Client external IP. Response: plain text IP |
| 3 | `/capabilities` | GET | Server features. Response: `capabilities SERVER_HOST_AUTH UPLOAD_STATS` |
| 4 | `/ping` x3 rounds | GET | Latency measurement (empty 200, measures RTT) |

Engine picks the lowest-latency server.

### Test Session (selected server only, `&guid=...` on all requests)

| Phase | Endpoint | Method | Purpose |
|-------|----------|--------|---------|
| Setup | `/hello`, `/getip`, `/capabilities` | GET | Re-handshake for test session |
| Ping | `/ping` x10 | GET | Precise latency + jitter measurement |
| IPv6 | `ipv6-api.speedtest.net/getip` | GET | Check IPv6 connectivity |
| Download | `/hello` x4, then `/download?size=25000000` xN | GET | 4 parallel connections, 25MB chunks, streams binary |
| Upload | `/hello` x4, then `/upload` xN | POST | 4 parallel connections, binary body, response: `size={bytes}` |
| Telemetry | `/logging-api/log` | POST | Test results (disabled — empty JWT) |

### Transport Selection
- **Latency**: WebSocket (`ws://host:port/ws`)
- **Download**: XHR with WS fallback
- **Upload**: XHR only (no WS fallback) — requires CORS-allowed origin

## Refresh Config

To get fresh server list and session params:

```sh
./refresh.sh          # default subdomain: domv
./refresh.sh ee71     # custom subdomain
```

The script fetches from `https://{subdomain}.speedtestcustom.com/`, extracts `ST_PARAMS`, and applies patches:
- `httpsOnly` → `false`
- `embedUrls` → `["ee71.speedtestcustom.com:8877"]`
- All `https://` URLs → `http://`

## Test Results (Direct, No Proxy)

| Metric | Value |
|--------|-------|
| Ping | 59-61 ms |
| Jitter | 1-3 ms |
| Download | 39-54 Mbps |
| Upload | 68 Mbps |
| Server | SFR / ORANGE FRANCE, Lyon |
