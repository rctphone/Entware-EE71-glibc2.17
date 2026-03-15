/* Compatibility stubs for missing libc functions */
#include <string.h>
#include <stddef.h>

/* strlcat — not in glibc 2.17, needed by libdsutils.so */
size_t strlcat(char *dst, const char *src, size_t dstsize)
{
    size_t dstlen = strlen(dst);
    size_t srclen = strlen(src);

    if (dstlen >= dstsize)
        return dstsize + srclen;

    if (srclen < dstsize - dstlen)
        memcpy(dst + dstlen, src, srclen + 1);
    else {
        memcpy(dst + dstlen, src, dstsize - dstlen - 1);
        dst[dstsize - 1] = '\0';
    }

    return dstlen + srclen;
}
