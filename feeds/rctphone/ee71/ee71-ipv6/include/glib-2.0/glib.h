/* Minimal glib stub for radish build — only g_strlcpy is needed */
#ifndef __G_LIB_H__
#define __G_LIB_H__

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/* g_strlcpy: glib's BSD strlcpy implementation */
size_t g_strlcpy(char *dest, const char *src, size_t dest_size);

#ifdef __cplusplus
}
#endif

#endif /* __G_LIB_H__ */
