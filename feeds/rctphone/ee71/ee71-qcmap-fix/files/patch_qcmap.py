#!/usr/bin/env python3
"""
Patch QCMAP_ConnectionManager to fix zero-length netlink attribute infinite loop.

Bug: The netlink route attribute parser at 0x244c4 iterates through TLV attributes
looking for RTA_GATEWAY (type=3). If an attribute has length=0, the pointer and
remaining-byte counter never advance, causing an infinite busy loop at 100% CPU.

The netlink listener thread (TID) spins forever processing one message, never calling
recvfrom() again. The netlink receive buffer fills up (164KB), all new events are
dropped, and the CPU is pegged at 100%.

Fix: Add a zero-step guard in the advance block. If the computed step (r4*8) is zero,
exit the parsing loop instead of spinning forever.

Original code at 0x244c4 (advance block):
    0x244c4: E0422184  sub   r2, r2, r4, lsl #3   ; r2 -= step
    0x244c8: E0877008  add   r7, r7, r8            ; r7 += step
    0x244cc: E3520002  cmp   r2, #2                ; remaining > 2?
    0x244d0: DA00002C  ble   #0x24588              ; exit if done

Patched code:
    0x244c4: E3580000  cmp    r8, #0               ; zero-length attribute?
    0x244c8: 10522184  subsne r2, r2, r4, lsl #3   ; if not: r2 -= step (set flags)
    0x244cc: 10877008  addne  r7, r7, r8            ; if not: r7 += step
    0x244d0: DA00002C  ble    #0x24588              ; exit if zero-step OR r2 <= 0

When r8=0: cmp sets Z=1, subsne/addne skipped, ble taken (Z=1) → exit.
When r8>0: cmp sets Z=0, subs executes and updates flags, add executes,
           ble checks if r2 went to 0 or negative → exit or continue loop.

Target: QCMAP_ConnectionManager from EE71 firmware EE71_E1_02.00_38
Binary: 478100 bytes, ARM ELF, linked Apr 24 2022
"""

import struct
import hashlib
import shutil
import sys
import os

# Virtual address to file offset mapping
# .text vaddr 0x10274, file offset 0x8274 → delta = 0x8000
VADDR_TO_FILE_OFFSET = 0x8000

PATCH_VADDR = 0x244C4
PATCH_FILE_OFFSET = PATCH_VADDR - VADDR_TO_FILE_OFFSET  # 0x1C4C4

# Original bytes (little-endian ARM32)
ORIGINAL_BYTES = bytes([
    0x84, 0x21, 0x42, 0xE0,  # sub   r2, r2, r4, lsl #3
    0x08, 0x70, 0x87, 0xE0,  # add   r7, r7, r8
    0x02, 0x00, 0x52, 0xE3,  # cmp   r2, #2
])

# Patched bytes (little-endian ARM32)
PATCHED_BYTES = bytes([
    0x00, 0x00, 0x58, 0xE3,  # cmp    r8, #0
    0x84, 0x21, 0x52, 0x10,  # subsne r2, r2, r4, lsl #3
    0x08, 0x70, 0x87, 0x10,  # addne  r7, r7, r8
])

# The 4th instruction (ble #0x24588 = DA00002C) is unchanged

EXPECTED_SIZE = 478100
ORIGINAL_SHA256 = None  # Will be computed on first run


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def patch(input_path, output_path):
    with open(input_path, 'rb') as f:
        data = bytearray(f.read())

    print(f"Input:  {input_path}")
    print(f"Size:   {len(data)} bytes")
    print(f"SHA256: {sha256(data)}")

    # Verify size
    if len(data) != EXPECTED_SIZE:
        print(f"WARNING: Expected {EXPECTED_SIZE} bytes, got {len(data)}")

    # Check if already patched
    current = data[PATCH_FILE_OFFSET:PATCH_FILE_OFFSET + len(PATCHED_BYTES)]
    if current == PATCHED_BYTES:
        print("\nBinary is ALREADY PATCHED. Nothing to do.")
        return False

    # Verify original bytes
    current = data[PATCH_FILE_OFFSET:PATCH_FILE_OFFSET + len(ORIGINAL_BYTES)]
    if current != ORIGINAL_BYTES:
        print(f"\nERROR: Original bytes at offset 0x{PATCH_FILE_OFFSET:X} don't match!")
        print(f"Expected: {ORIGINAL_BYTES.hex()}")
        print(f"Found:    {current.hex()}")
        print("This binary may be a different version or already modified.")
        return False

    print(f"\nOriginal bytes verified at offset 0x{PATCH_FILE_OFFSET:X}")

    # Show what we're changing
    print("\nPatch details (vaddr 0x{:05X}, file offset 0x{:05X}):".format(
        PATCH_VADDR, PATCH_FILE_OFFSET))
    for i in range(3):
        orig_word = struct.unpack_from('<I', ORIGINAL_BYTES, i * 4)[0]
        patch_word = struct.unpack_from('<I', PATCHED_BYTES, i * 4)[0]
        addr = PATCH_VADDR + i * 4
        marker = " *" if orig_word != patch_word else ""
        print(f"  0x{addr:05X}: {orig_word:08X} → {patch_word:08X}{marker}")

    # Apply patch
    data[PATCH_FILE_OFFSET:PATCH_FILE_OFFSET + len(PATCHED_BYTES)] = PATCHED_BYTES

    # Verify the 4th instruction is untouched (ble #0x24588)
    ble_offset = PATCH_FILE_OFFSET + 12
    ble_word = struct.unpack_from('<I', data, ble_offset)[0]
    assert ble_word == 0xDA00002C, f"ble instruction corrupted: {ble_word:08X}"

    # Write output
    with open(output_path, 'wb') as f:
        f.write(data)

    os.chmod(output_path, 0o755)

    print(f"\nOutput: {output_path}")
    print(f"SHA256: {sha256(data)}")
    print("\nPatch applied successfully!")
    return True


def verify(path):
    """Verify a binary is correctly patched."""
    with open(path, 'rb') as f:
        data = f.read()

    current = data[PATCH_FILE_OFFSET:PATCH_FILE_OFFSET + len(PATCHED_BYTES)]
    ble_word = struct.unpack_from('<I', data, PATCH_FILE_OFFSET + 12)[0]

    if current == PATCHED_BYTES and ble_word == 0xDA00002C:
        print(f"PASS: {path} is correctly patched")
        return True
    elif current == ORIGINAL_BYTES:
        print(f"INFO: {path} has original (unpatched) code")
        return False
    else:
        print(f"UNKNOWN: {path} has unexpected bytes at patch location")
        return False


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage:")
        print(f"  {sys.argv[0]} <input_binary> [output_binary]")
        print(f"  {sys.argv[0]} --verify <binary>")
        print()
        print("If output is omitted, writes to <input>.patched")
        sys.exit(1)

    if sys.argv[1] == '--verify':
        if len(sys.argv) < 3:
            print("Usage: {} --verify <binary>".format(sys.argv[0]))
            sys.exit(1)
        ok = verify(sys.argv[2])
        sys.exit(0 if ok else 1)

    input_path = sys.argv[1]
    if len(sys.argv) >= 3:
        output_path = sys.argv[2]
    else:
        output_path = input_path + '.patched'

    ok = patch(input_path, output_path)
    sys.exit(0 if ok else 1)
