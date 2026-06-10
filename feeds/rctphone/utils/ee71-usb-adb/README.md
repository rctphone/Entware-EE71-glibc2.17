# EE71 USB ADB — ECM + ADB on All Hosts

Patches the EE71 kernel's USB composition table to include ADB (FunctionFS) on Mac, Windows, and Linux connections.

## Problem

The kernel has a built-in table (`jrd_usb_configs_tab`) controlling USB functions per host OS. Stock firmware exposes only networking + mass storage — **no ADB**:

| Host OS | PID  | Stock Functions          |
|---------|------|--------------------------|
| Mac     | 0908 | ecm, mass_storage        |
| Windows | 0195 | rndis_qc, mass_storage   |
| Linux   | 0195 | rndis_qc, mass_storage   |

The switching happens **in the kernel** (`jrd_usb_switch`), not userspace — composition scripts in `/sbin/usb/compositions/` are never called for auto-switch.

## Solution

1. **`patch_usb_kernel`** (S01 in rcS.d) — patches kernel table via `/dev/kmem` before auto-switch fires. Adds diag, ffs, serial, mass_storage to Mac and Win/Linux entries. Also includes `fix_current_boot` fallback if auto-switch fires before the patch.

2. **`usb` init** (S38 in rcS.d) — mounts FunctionFS at `/dev/usb-ffs/adb` so adbd can connect to the USB gadget.

After patching:

| Host OS | PID  | Patched Functions                          |
|---------|------|--------------------------------------------|
| Mac     | 0908 | ecm, diag, ffs, serial, mass_storage       |
| Windows | 0195 | rndis_qc, diag, ffs, serial, mass_storage  |
| Linux   | 0195 | rndis_qc, diag, ffs, serial, mass_storage  |

## Kernel Table Structure

```
Address: 0xc0a4a890 (symbol: jrd_usb_configs_tab)
Entries: 15, each 36 bytes = PID(4) + 8 x func_id(4)
Firmware: EE71_E1_02.00_38
```

Function ID mapping (from `drivers/usb/gadget/android.c` `supported_functions[]`):

```
 0 = ffs (ADB)      7 = diag       9 = serial
15 = rndis_qc      16 = ecm       18 = mass_storage
```

Patch payload (replaces func slots 1-4, keeps transport in slot 0):

```
Before: [transport, mass_storage, -1, -1, -1, -1, -1, -1]
After:  [transport, diag, ffs, serial, mass_storage, -1, -1, -1]
Bytes:  07 00 00 00  00 00 00 00  09 00 00 00  12 00 00 00
```

| Entry | PID  | Entry Address | Patch Address | PID bytes  |
|-------|------|---------------|---------------|------------|
| 14    | 0908 | 0xc0a4aa88    | 0xc0a4aa90    | `08090000` |
| 5     | 0195 | 0xc0a4a944    | 0xc0a4a94C    | `95010000` |

## Boot Timing

```
[~4s]  Kernel USB gadget init, mass_storage (PID 025E)
[~5s]  S01patch_usb_kernel patches table via /dev/kmem
[~5s]  S38usb mounts FunctionFS
[~8s]  jrd_usb_switch detects host OS, reads PATCHED table -> ADB included
```

## Files

| File | Device Location | Purpose |
|------|-----------------|---------|
| `patch_usb_kernel` | `/etc/init.d/` + `rcS.d/S01` | Kernel RAM patch |
| `deploy.sh` | Host only | Deploys via SSH |
| `test_kernel_patch.sh` | Device `/tmp/` | Test: reset + verify auto-switch |
| `test_patched_switch.sh` | Device `/tmp/` | Test: verify patched composition |

## Deploy

```sh
./deploy.sh              # default: 192.168.88.1
./deploy.sh 192.168.1.1  # custom IP
```

Then reboot: `ssh root@192.168.88.1 'sync; sys_reboot'`

## Verify

```sh
# Check kernel patch applied
ssh root@192.168.88.1 'dmesg | grep jrd_usb_config'
# Expected: func_id 16(ecm), 7(diag), 0(ffs), 9(serial), 18(mass_storage)

# Check current composition
ssh root@192.168.88.1 'cat /sys/class/android_usb/android0/functions'
# Expected: ecm,diag,ffs,serial,mass_storage

# Check logs
ssh root@192.168.88.1 'cat /tmp/usb_kernel_patch.log; cat /tmp/usb_ecm_adb.log'
```

## Manual ECM+ADB Switch

```sh
ssh root@192.168.88.1 '
S=/sys/class/android_usb/android0
mount | grep -q functionfs || {
  echo adb > $S/f_ffs/aliases 2>/dev/null
  mkdir -p /dev/usb-ffs/adb
  mount -o uid=2000,gid=2000 -t functionfs adb /dev/usb-ffs/adb
}
pkill adbd 2>/dev/null; echo 0 > $S/enable
echo ecm,diag,ffs,serial,mass_storage > $S/functions
echo diag > $S/f_diag/clients; echo smd > $S/f_serial/transports
echo 0908 > $S/idProduct; echo 1BBB > $S/idVendor
echo 1 > $S/remote_wakeup; sleep 1; echo 1 > $S/enable
sleep 2; /etc/init.d/adbd start'
```

## Porting

Addresses are firmware-specific (`EE71_E1_02.00_38`). For other firmware:

```sh
# Find table address
cat /proc/kallsyms | grep jrd_usb_configs_tab

# Dump table (15 entries x 36 bytes)
TABLE=0x...
dd if=/dev/kmem bs=1 skip=$((TABLE)) count=$((15*36)) 2>/dev/null | od -A x -t x1

# Calculate: entry_addr = TABLE + index * 36, patch_addr = entry_addr + 8
```
