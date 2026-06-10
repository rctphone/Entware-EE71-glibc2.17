#!/usr/bin/env python3
"""Patch qce50.c for EE71: add pipe pair override module param + debug prints."""
import sys

def patch(path):
    with open(path, 'r') as f:
        src = f.read()

    # ================================================================
    # Patch 1: Add module parameter after includes
    # ================================================================
    marker = '#include "qce_ota.h"'
    insert_after_includes = '''#include "qce_ota.h"

/* EE71 patch: module parameter to override BAM pipe pair from device tree.
 * qcedev uses pair 2 (pipes 4-5), qcrypto DT says pair 3 (pipes 6-7).
 * Pipe pair 3 causes system hang on EE71 (MDM9640) due to non-existent
 * BAM pipes — writing to their MMIO registers hangs the CPU bus.
 * Use: insmod qce50.ko qce_pipe_pair_override=1
 */
static int qce_pipe_pair_override = -1;
module_param(qce_pipe_pair_override, int, 0644);
MODULE_PARM_DESC(qce_pipe_pair_override,
	"Override BAM pipe pair index from DT (-1=use DT, 0-3=force)");'''

    if marker not in src:
        print(f"ERROR: cannot find '{marker}' in {path}", file=sys.stderr)
        sys.exit(1)
    src = src.replace(marker, insert_after_includes, 1)
    print("  patch 1: added module_param qce_pipe_pair_override")

    # ================================================================
    # Patch 2: Override pipe pair after DT read + add debug logging
    # ================================================================
    # Find the block that reads bam-pipe-pair and calculates pipe indices:
    #   pce_dev->ce_sps.dest_pipe_index = 2 * pce_dev->ce_sps.pipe_pair_index;
    #   pce_dev->ce_sps.src_pipe_index  = pce_dev->ce_sps.dest_pipe_index + 1;
    old_calc = \
'''	pce_dev->ce_sps.dest_pipe_index	= 2 * pce_dev->ce_sps.pipe_pair_index;
	pce_dev->ce_sps.src_pipe_index	= pce_dev->ce_sps.dest_pipe_index + 1;'''

    new_calc = \
'''	/* EE71 patch: override pipe pair if module param is set */
	if (qce_pipe_pair_override >= 0 && qce_pipe_pair_override <= 3) {
		pr_info("QCE50: overriding DT pipe_pair %d -> %d (module param)\\n",
			pce_dev->ce_sps.pipe_pair_index,
			qce_pipe_pair_override);
		pce_dev->ce_sps.pipe_pair_index = (uint32_t)qce_pipe_pair_override;
	} else if (qce_pipe_pair_override > 3) {
		pr_warn("QCE50: invalid pipe_pair_override=%d, using DT value %d\\n",
			qce_pipe_pair_override,
			pce_dev->ce_sps.pipe_pair_index);
	}

	pce_dev->ce_sps.dest_pipe_index	= 2 * pce_dev->ce_sps.pipe_pair_index;
	pce_dev->ce_sps.src_pipe_index	= pce_dev->ce_sps.dest_pipe_index + 1;
	pr_info("QCE50: using pipe_pair=%d (dest_pipe=%d, src_pipe=%d)\\n",
		pce_dev->ce_sps.pipe_pair_index,
		pce_dev->ce_sps.dest_pipe_index,
		pce_dev->ce_sps.src_pipe_index);'''

    if old_calc not in src:
        print(f"ERROR: cannot find pipe index calculation in {path}", file=sys.stderr)
        sys.exit(1)
    src = src.replace(old_calc, new_calc, 1)
    print("  patch 2: added pipe pair override logic")

    # ================================================================
    # Patch 3: Add debug print before sps_connect in qce_sps_init_ep_conn
    # ================================================================
    old_sps_connect = \
'''	memset(sps_connect_info->desc.base, 0x00, sps_connect_info->desc.size);

	/* Establish connection between peripheral and memory endpoint */
	rc = sps_connect(sps_pipe_info, sps_connect_info);'''

    new_sps_connect = \
'''	memset(sps_connect_info->desc.base, 0x00, sps_connect_info->desc.size);

	/* EE71 patch: debug print before sps_connect (may hang on bad pipes) */
	pr_info("QCE50: sps_connect %s: src_pipe=%d dest_pipe=%d "
		"lock_group=%d bam_handle=0x%lx\\n",
		is_producer ? "PRODUCER" : "CONSUMER",
		sps_connect_info->src_pipe_index,
		sps_connect_info->dest_pipe_index,
		sps_connect_info->lock_group,
		(unsigned long)pce_dev->ce_sps.bam_handle);

	/* Establish connection between peripheral and memory endpoint */
	rc = sps_connect(sps_pipe_info, sps_connect_info);'''

    if old_sps_connect not in src:
        print(f"ERROR: cannot find sps_connect block in {path}", file=sys.stderr)
        sys.exit(1)
    src = src.replace(old_sps_connect, new_sps_connect, 1)
    print("  patch 3: added debug print before sps_connect")

    # ================================================================
    # Patch 4: Add BAM pipe count logging after sps_register_bam_device
    # ================================================================
    old_bam_reg = \
'''	pce_dev->pbam = pbam;
	list_add_tail(&pbam->qlist, &qce50_bam_list);
	pce_dev->ce_sps.bam_handle =  pbam->handle;'''

    new_bam_reg = \
'''	pce_dev->pbam = pbam;
	list_add_tail(&pbam->qlist, &qce50_bam_list);
	pce_dev->ce_sps.bam_handle =  pbam->handle;
	pr_info("QCE50: BAM registered at 0x%x, handle=0x%lx, "
		"cmd_dscr=%d, shared=%d\\n",
		pbam->bam_mem,
		(unsigned long)pbam->handle,
		pce_dev->support_cmd_dscr,
		pce_dev->is_shared);'''

    if old_bam_reg not in src:
        print(f"ERROR: cannot find BAM registration block in {path}", file=sys.stderr)
        sys.exit(1)
    src = src.replace(old_bam_reg, new_bam_reg, 1)
    print("  patch 4: added BAM registration debug logging")

    # ================================================================
    # Patch 5: Add debug print in qce_sps_init showing BAM info
    # ================================================================
    old_sps_init = \
'''	pr_debug("BAM device registered. bam_handle=0x%lx\\n",
		pce_dev->ce_sps.bam_handle);'''

    new_sps_init = \
'''	pr_info("QCE50: BAM device ready. bam_handle=0x%lx, "
		"pipe_pair=%d (pipes %d-%d)\\n",
		pce_dev->ce_sps.bam_handle,
		pce_dev->ce_sps.pipe_pair_index,
		pce_dev->ce_sps.dest_pipe_index,
		pce_dev->ce_sps.src_pipe_index);'''

    if old_sps_init not in src:
        print(f"ERROR: cannot find qce_sps_init debug in {path}", file=sys.stderr)
        sys.exit(1)
    src = src.replace(old_sps_init, new_sps_init, 1)
    print("  patch 5: added qce_sps_init debug logging")

    with open(path, 'w') as f:
        f.write(src)
    print(f"  All patches applied to {path}")

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <path-to-qce50.c>", file=sys.stderr)
        sys.exit(1)
    patch(sys.argv[1])
