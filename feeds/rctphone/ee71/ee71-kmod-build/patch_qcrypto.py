#!/usr/bin/env python3
"""Patch qcrypto.c for EE71: fix sg_chain() BUG and sg_mark_end() corruption.

Problem 1: _sha_update() calls sg_chain() to link trailing buffer with request
scatterlist. On this ARM kernel build, sg_chain() triggers BUG() at
include/linux/scatterlist.h:140, crashing the kernel during hash operations.

Problem 2: _sha_update() calls sg_mark_end() on the caller's scatterlist
entries, permanently corrupting the SG chain. This causes count_sg() to see
NULL when a subsequent digest() call tries to traverse the full chain.
Symptom: "count_sg, sg = NULL" followed by "engine appears to be stuck".

Fix: Replace sg_chain() with a copy-and-merge approach for the trailing_buf
path. Remove sg_mark_end() calls on the original SG in both code paths —
count_sg() and _qce_sps_add_sg_data() both use nbytes to limit traversal,
so end markers on the caller's SG are unnecessary.
"""
import sys


def patch(path):
    with open(path, 'r') as f:
        src = f.read()

    # ================================================================
    # Patch 1: Initialize rctx->data = NULL in _sha_init()
    # ================================================================
    old_init = '''\trctx->trailing_buf_len = 0;
\trctx->count = 0;

\treturn 0;
};'''

    new_init = '''\trctx->trailing_buf_len = 0;
\trctx->count = 0;
\trctx->data = NULL;

\treturn 0;
};'''

    if old_init not in src:
        print(f"ERROR: cannot find _sha_init trailing_buf_len block in {path}",
              file=sys.stderr)
        sys.exit(1)
    src = src.replace(old_init, new_init, 1)
    print("  patch 1: _sha_init — initialize rctx->data = NULL")

    # ================================================================
    # Patch 2: Replace sg_chain() in _sha_update() with copy approach
    #          Also remove sg_mark_end(sg_last) — not needed since we
    #          copy data and don't DMA from the original SG.
    # ================================================================
    old_chain = '''\t\t} else {
\t\t\tif (sg_last)
\t\t\t\tsg_mark_end(sg_last);
\t\t\telse
\t\t\t\tpr_err("qcrypto: _sha_update, sg_last= NULL");
\t\t\tmemset(rctx->sg, 0, sizeof(rctx->sg));
\t\t\tsg_set_buf(&rctx->sg[0], staging,
\t\t\t\t\t\trctx->trailing_buf_len);
\t\t\tsg_mark_end(&rctx->sg[1]);
\t\t\tsg_chain(rctx->sg, 2, req->src);
\t\t\treq->src = rctx->sg;
\t\t}'''

    new_chain = '''\t\t} else {
\t\t\t/*
\t\t\t * EE71 patch: avoid sg_chain() which BUGs on this
\t\t\t * kernel build. Copy trailing + src into one buffer.
\t\t\t * Do NOT sg_mark_end() on original SG — it corrupts
\t\t\t * the caller's scatterlist permanently.
\t\t\t */
\t\t\tuint32_t src_len = nbytes - rctx->trailing_buf_len;
\t\t\trctx->data = kmalloc(nbytes + L1_CACHE_BYTES,
\t\t\t\t\t\t\tGFP_ATOMIC);
\t\t\tif (rctx->data == NULL) {
\t\t\t\tpr_err("qcrypto: _sha_update alloc fail\\n");
\t\t\t\treturn -ENOMEM;
\t\t\t}
\t\t\tmemcpy(rctx->data, staging, rctx->trailing_buf_len);
\t\t\t{
\t\t\t\tuint32_t cnt = qcrypto_count_sg(req->src,
\t\t\t\t\t\t\t\tsrc_len);
\t\t\t\tqcrypto_sg_copy_to_buffer(req->src, cnt,
\t\t\t\t\trctx->data + rctx->trailing_buf_len,
\t\t\t\t\tsrc_len);
\t\t\t}
\t\t\tmemset(rctx->sg, 0, sizeof(rctx->sg));
\t\t\tsg_set_buf(&rctx->sg[0], rctx->data, nbytes);
\t\t\tsg_mark_end(&rctx->sg[0]);
\t\t\treq->src = rctx->sg;
\t\t}'''

    if old_chain not in src:
        print(f"ERROR: cannot find sg_chain block in _sha_update in {path}",
              file=sys.stderr)
        sys.exit(1)
    src = src.replace(old_chain, new_chain, 1)
    print("  patch 2: _sha_update — replaced sg_chain() with copy-merge (no sg_mark_end on original)")

    # ================================================================
    # Patch 3: Fix _qce_ahash_complete() to free rctx->data
    # ================================================================
    old_complete = '''\tif (cp->ce_support.aligned_only)  {
\t\tareq->src = rctx->orig_src;
\t\tkfree(rctx->data);
\t}'''

    new_complete = '''\tif (cp->ce_support.aligned_only)
\t\tareq->src = rctx->orig_src;
\tif (rctx->data) {
\t\tkfree(rctx->data);
\t\trctx->data = NULL;
\t}'''

    if old_complete not in src:
        print(f"ERROR: cannot find _qce_ahash_complete cleanup in {path}",
              file=sys.stderr)
        sys.exit(1)
    src = src.replace(old_complete, new_complete, 1)
    print("  patch 3: _qce_ahash_complete — free rctx->data unconditionally")

    # ================================================================
    # Patch 4: Remove sg_mark_end(sg_last) when trailing_buf_len == 0.
    #
    # _sha_update() calls sg_mark_end() on the caller's scatterlist
    # to truncate it at the split point. But this permanently corrupts
    # the SG chain — the completion handler restores req->src/nbytes
    # but NOT the SG entry's page_link end bit.
    #
    # This causes a bug when a subsequent digest() call reuses the same
    # SG array: count_sg() hits NULL because the chain was broken.
    #
    # The fix is safe because all consumers (count_sg, qce_dma_map_sg,
    # _qce_sps_add_sg_data) use nbytes to limit their traversal, so
    # they don't rely on the SG end marker for correctness.
    # ================================================================
    old_else = '''\t} else
\t\tif (sg_last)
\t\t\tsg_mark_end(sg_last);
\t\telse
\t\t\tpr_err("qcrypto.c: _sha_update, sg_last = NULL");'''

    new_else = '''\t} else {
\t\t/*
\t\t * EE71 patch: do NOT sg_mark_end() on the caller's SG.
\t\t * It permanently corrupts the chain (completion handler
\t\t * restores req->src but not the SG end bit). count_sg()
\t\t * and _qce_sps_add_sg_data() both use nbytes to limit
\t\t * traversal, so the end marker is unnecessary.
\t\t */
\t}'''

    if old_else not in src:
        print(f"ERROR: cannot find trailing_buf_len==0 sg_mark_end block in {path}",
              file=sys.stderr)
        sys.exit(1)
    src = src.replace(old_else, new_else, 1)
    print("  patch 4: _sha_update — remove sg_mark_end when trailing_buf_len==0")

    with open(path, 'w') as f:
        f.write(src)
    print(f"  All patches applied to {path}")


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <path-to-qcrypto.c>", file=sys.stderr)
        sys.exit(1)
    patch(sys.argv[1])
