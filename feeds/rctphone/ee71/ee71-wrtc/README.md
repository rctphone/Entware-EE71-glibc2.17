# ee71-wrtc

Covert WireGuard-туннель поверх whitelisted WebRTC-карьеров (Jazz/Telemost) для EE71.
Pure-Go covert joiner + штатный kernel-WireGuard устройства.

> **ЭКСПЕРИМЕНТАЛЬНО (Phase 6, gated).** Канон проекта: `~/Work/wrtc-tunnel`
> (исходник — `wrtc-tunnel/go-core`, дизайн — `wrtc-tunnel/ee71/STRUCTURE.md`).
> В wrtc-tunnel этот пакет доступен по симлинку `ee71/package`.

## Сборка
```bash
# из корня ee71 (Entware build); бинарь — host-Go static armv7, C-toolchain не нужен
make opkg-build PKG=ee71-wrtc WRTC_SRC=$HOME/Work/wrtc-tunnel
```
Зависимости: `ee71-kmod-wireguard`, `wireguard-tools`.

## Состав
- `/usr/sbin/ee71-wrtc` — бинарь (covert joiner)
- `/etc/init.d/wrtc` — sysvinit (rc5.d S95)
- `/etc/wrtc/config` — `wrtc://` URL (conffile)
- `/etc/wrtc/psk` — covert PSK, **0600** (создать вручную, НЕ в URL)

## Feasibility gates (до прод-использования)
Размер бинаря (flash ~48MB) / RSS / CPU с реальным pion; kernel-WG на 3.10 (module/wg0/loopback/MTU/reconnect). См. `wrtc-tunnel/ee71/STRUCTURE.md`.
