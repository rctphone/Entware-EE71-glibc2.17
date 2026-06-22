/*
 * qcmap_wifi_ctl — WiFi settings + hostapd management for EE71
 *
 * Commands:
 *   apply '{"AP2G":{...},"AP5G":{...},"AP2G_guest":{...},"AP5G_guest":{...}}'
 *     → Generate /etc/hostapd-wlan1.conf from AP2G_guest/AP5G_guest (5GHz)
 *     → Send SetWlanSettings IPC to core_app (via libsock_client.so.0)
 *     → Fails with error if IPC unavailable (no fallback)
 *
 * GetWlanSettings returns 4 sections:
 *   AP2G         (WlanAPID 0) — 2.4GHz primary (wlan0)
 *   AP5G         (WlanAPID 1) — 5GHz band-switch settings
 *   AP2G_guest   (WlanAPID 2) — guest AP on 2.4GHz band
 *   AP5G_guest   (WlanAPID 3) — guest AP on 5GHz band (= wlan1 in AP-AP mode)
 * Both AP2G_guest and AP5G_guest map to the same Guest5G* DB fields.
 *
 *   restart-both     — restart wlan0 + wlan1 hostapd
 *   restart-primary  — restart wlan0 hostapd only
 *   restart-guest    — restart wlan1 hostapd only
 *   status           — check hostapd process status
 *
 * Build: cross-compile for ARM (ARMv7-A, soft-float, glibc 2.17)
 * Runtime deps: hostapd, libsock_client.so.0 (all on device)
 */
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cerrno>
#include <unistd.h>
#include <dirent.h>
#include <dlfcn.h>
#include <fcntl.h>
#include <signal.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <sys/ioctl.h>
#include <net/if.h>
#include <poll.h>
#include <time.h>
#include <linux/sockios.h>

/* ─── Config paths ───────────────────────────────────────────────── */
static const char *HOSTAPD_CONF_2G    = "/etc/hostapd.conf";
static const char *HOSTAPD_CONF_5G    = "/etc/hostapd-wlan1.conf";
static const char *HOSTAPD_PID_2G     = "/etc/hostapd_ssid1.pid";
static const char *HOSTAPD_PID_5G     = "/etc/hostapd_ssid2.pid";
static const char *ENTROPY_FILE       = "/etc/entropy_file1";
static const char *HOSTAPD_CTRL_DIR   = "/var/run/hostapd";
static const char *BRIDGE             = "bridge0";
static const char *MOBILEAP_CFG      = "/etc/mobileap_cfg.xml";
static const char *MOBILEAP_FACTORY  = "/etc/factory_mobileap_cfg.xml";
static const char *QCMAP_STA_IFACE    = "/usr/bin/QCMAP_StaInterface";

/* ─── Simple JSON value extractor ────────────────────────────────── */
/* Extract a string value for a given key from JSON.
 * Handles: "key":"value" or "key":number
 * Does NOT handle nested objects — for nested keys, pass the
 * sub-object string directly. Returns empty string if not found. */
static bool json_get_string(const char *json, const char *key,
                            char *out, int out_sz)
{
    char needle[256];
    snprintf(needle, sizeof(needle), "\"%s\"", key);
    const char *p = strstr(json, needle);
    if (!p) { out[0] = '\0'; return false; }
    p += strlen(needle);
    /* skip whitespace + colon */
    while (*p && (*p == ' ' || *p == '\t' || *p == ':')) p++;
    if (*p == '"') {
        p++;
        int i = 0;
        while (*p && *p != '"' && i < out_sz - 1) {
            if (*p == '\\' && *(p+1)) { p++; }
            out[i++] = *p++;
        }
        out[i] = '\0';
        return true;
    }
    /* number or boolean */
    int i = 0;
    while (*p && *p != ',' && *p != '}' && *p != ' ' && i < out_sz - 1)
        out[i++] = *p++;
    out[i] = '\0';
    return i > 0;
}

static int json_get_int(const char *json, const char *key, int def)
{
    char buf[64];
    if (!json_get_string(json, key, buf, sizeof(buf))) return def;
    return atoi(buf);
}

/* Extract a JSON sub-object: "key":{...} → returns pointer to '{',
 * writes length to *len. Returns NULL if not found. */
static const char *json_get_object(const char *json, const char *key,
                                   int *len)
{
    char needle[256];
    snprintf(needle, sizeof(needle), "\"%s\"", key);
    const char *p = strstr(json, needle);
    if (!p) return NULL;
    p += strlen(needle);
    while (*p && *p != '{') p++;
    if (*p != '{') return NULL;
    int depth = 0;
    const char *start = p;
    while (*p) {
        if (*p == '{') depth++;
        else if (*p == '}') { depth--; if (depth == 0) { *len = (int)(p - start + 1); return start; } }
        p++;
    }
    return NULL;
}

/* ─── System helpers ─────────────────────────────────────────────── */
static bool file_exists(const char *path)
{
    struct stat st;
    return stat(path, &st) == 0;
}

static bool iface_exists(const char *ifname)
{
    char path[128];
    snprintf(path, sizeof(path), "/sys/class/net/%s", ifname);
    return file_exists(path);
}

static long long monotonic_ms()
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (long long)ts.tv_sec * 1000LL + ts.tv_nsec / 1000000LL;
}

static void sleep_ms(int ms)
{
    if (ms <= 0) return;
    struct timespec req;
    req.tv_sec = ms / 1000;
    req.tv_nsec = (ms % 1000) * 1000000L;
    while (nanosleep(&req, &req) != 0 && errno == EINTR) {
    }
}

static bool read_file(const char *path, char *buf, size_t buf_sz, ssize_t *out_len)
{
    int fd = open(path, O_RDONLY);
    if (fd < 0) return false;

    ssize_t rd = read(fd, buf, buf_sz - 1);
    close(fd);
    if (rd < 0) return false;

    buf[rd] = '\0';
    if (out_len) *out_len = rd;
    return true;
}

static bool read_cmdline(pid_t pid, char *buf, size_t buf_sz)
{
    char path[64];
    snprintf(path, sizeof(path), "/proc/%d/cmdline", pid);

    ssize_t rd = 0;
    if (!read_file(path, buf, buf_sz, &rd) || rd <= 0)
        return false;

    for (ssize_t i = 0; i < rd; i++) {
        if (buf[i] == '\0')
            buf[i] = ' ';
    }

    return true;
}

static bool cmdline_contains_all(const char *cmdline,
                                 const char *const needles[], size_t count)
{
    for (size_t i = 0; i < count; i++) {
        if (!needles[i] || !needles[i][0]) continue;
        if (strstr(cmdline, needles[i]) == NULL)
            return false;
    }
    return true;
}

static size_t find_matching_processes(const char *const needles[],
                                      size_t count, pid_t *pids,
                                      size_t max_pids)
{
    size_t found = 0;
    DIR *dir = opendir("/proc");
    if (!dir) return 0;

    struct dirent *de;
    while ((de = readdir(dir)) != NULL) {
        if (de->d_name[0] < '0' || de->d_name[0] > '9')
            continue;

        pid_t pid = (pid_t)atoi(de->d_name);
        if (pid <= 1 || pid == getpid())
            continue;

        char cmdline[4096];
        if (!read_cmdline(pid, cmdline, sizeof(cmdline)))
            continue;

        if (cmdline_contains_all(cmdline, needles, count))
            pids[found++] = pid;
        if (found == max_pids)
            break;
    }

    closedir(dir);
    return found;
}

static bool process_running_needles(const char *const needles[], size_t count)
{
    pid_t pids[1];
    return find_matching_processes(needles, count, pids, 1) > 0;
}

static int terminate_matching_processes(const char *const needles[],
                                        size_t count, int timeout_ms,
                                        const char *label)
{
    pid_t pids[64];
    size_t pid_count = find_matching_processes(needles, count, pids, 64);
    if (pid_count == 0)
        return 0;

    for (size_t i = 0; i < pid_count; i++) {
        if (kill(pids[i], SIGTERM) != 0 && errno != ESRCH) {
            fprintf(stderr, "[ERR] Failed to SIGTERM %s pid %d: %s\n",
                    label, pids[i], strerror(errno));
        }
    }

    long long deadline = monotonic_ms() + timeout_ms;
    while (monotonic_ms() < deadline) {
        if (!process_running_needles(needles, count))
            return 0;
        sleep_ms(100);
    }

    pid_count = find_matching_processes(needles, count, pids, 64);
    for (size_t i = 0; i < pid_count; i++) {
        if (kill(pids[i], SIGKILL) != 0 && errno != ESRCH) {
            fprintf(stderr, "[ERR] Failed to SIGKILL %s pid %d: %s\n",
                    label, pids[i], strerror(errno));
        }
    }

    deadline = monotonic_ms() + 2000;
    while (monotonic_ms() < deadline) {
        if (!process_running_needles(needles, count))
            return 0;
        sleep_ms(100);
    }

    fprintf(stderr, "[ERR] Timed out stopping %s\n", label);
    return 1;
}

static int spawn_and_wait(char *const argv[], bool quiet = false)
{
    pid_t pid = fork();
    if (pid < 0) {
        fprintf(stderr, "[ERR] fork failed for %s: %s\n",
                argv[0], strerror(errno));
        return 1;
    }

    if (pid == 0) {
        if (quiet) {
            int nullfd = open("/dev/null", O_RDWR);
            if (nullfd >= 0) {
                dup2(nullfd, STDOUT_FILENO);
                dup2(nullfd, STDERR_FILENO);
                if (nullfd > STDERR_FILENO)
                    close(nullfd);
            }
        }
        execvp(argv[0], argv);
        fprintf(stderr, "[ERR] execvp %s failed: %s\n",
                argv[0], strerror(errno));
        _exit(127);
    }

    int status = 0;
    while (waitpid(pid, &status, 0) < 0) {
        if (errno != EINTR) {
            fprintf(stderr, "[ERR] waitpid failed for %s: %s\n",
                    argv[0], strerror(errno));
            return 1;
        }
    }

    if (!WIFEXITED(status) || WEXITSTATUS(status) != 0) {
        fprintf(stderr, "[ERR] %s exited with status %d\n",
                argv[0], WIFEXITED(status) ? WEXITSTATUS(status) : -1);
        return 1;
    }

    return 0;
}

static int hostapd_ctrl_request(const char *ifname, const char *cmd,
                                char *reply, size_t reply_sz, int timeout_ms)
{
    char ctrl_path[128];
    snprintf(ctrl_path, sizeof(ctrl_path), "%s/%s", HOSTAPD_CTRL_DIR, ifname);
    if (!file_exists(ctrl_path))
        return -1;

    int fd = socket(AF_UNIX, SOCK_DGRAM, 0);
    if (fd < 0)
        return -1;

    struct sockaddr_un local;
    memset(&local, 0, sizeof(local));
    local.sun_family = AF_UNIX;

    static int seq = 0;
    snprintf(local.sun_path, sizeof(local.sun_path),
             "/tmp/qcmap-%d-%d", (int)getpid(), ++seq);
    unlink(local.sun_path);

    if (bind(fd, (struct sockaddr *)&local, sizeof(local)) != 0) {
        close(fd);
        unlink(local.sun_path);
        return -1;
    }

    struct sockaddr_un remote;
    memset(&remote, 0, sizeof(remote));
    remote.sun_family = AF_UNIX;
    strncpy(remote.sun_path, ctrl_path, sizeof(remote.sun_path) - 1);

    if (connect(fd, (struct sockaddr *)&remote, sizeof(remote)) != 0) {
        close(fd);
        unlink(local.sun_path);
        return -1;
    }

    if (send(fd, cmd, strlen(cmd), 0) < 0) {
        close(fd);
        unlink(local.sun_path);
        return -1;
    }

    struct pollfd pfd;
    memset(&pfd, 0, sizeof(pfd));
    pfd.fd = fd;
    pfd.events = POLLIN;
    int pr = poll(&pfd, 1, timeout_ms);
    if (pr <= 0) {
        close(fd);
        unlink(local.sun_path);
        return -1;
    }

    ssize_t rd = recv(fd, reply, reply_sz - 1, 0);
    close(fd);
    unlink(local.sun_path);
    if (rd < 0)
        return -1;

    reply[rd] = '\0';
    return 0;
}

static int wait_hostapd_ready(const char *ifname, int timeout_ms)
{
    long long deadline = monotonic_ms() + timeout_ms;
    char reply[128];

    while (monotonic_ms() < deadline) {
        if (hostapd_ctrl_request(ifname, "PING", reply, sizeof(reply), 250) == 0 &&
            strncmp(reply, "PONG", 4) == 0)
            return 0;
        sleep_ms(100);
    }

    fprintf(stderr, "[ERR] Timed out waiting for hostapd ctrl on %s\n", ifname);
    return 1;
}

static bool bridge_hasif(const char *bridge, const char *ifname)
{
    char path[160];
    snprintf(path, sizeof(path), "/sys/class/net/%s/brif/%s", bridge, ifname);
    return file_exists(path);
}

static int bridge_if_ioctl(unsigned long request, const char *bridge,
                           const char *ifname, int allowed_errno)
{
    unsigned int ifindex = if_nametoindex(ifname);
    if (ifindex == 0) {
        fprintf(stderr, "[ERR] Interface %s is missing\n", ifname);
        return 1;
    }

    int fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) {
        fprintf(stderr, "[ERR] socket() failed for bridge ioctl: %s\n",
                strerror(errno));
        return 1;
    }

    struct ifreq ifr;
    memset(&ifr, 0, sizeof(ifr));
    strncpy(ifr.ifr_name, bridge, IFNAMSIZ - 1);
    ifr.ifr_ifindex = (int)ifindex;

    int ret = ioctl(fd, request, &ifr);
    close(fd);
    if (ret != 0 && errno != allowed_errno) {
        fprintf(stderr, "[ERR] bridge ioctl failed for %s/%s: %s\n",
                bridge, ifname, strerror(errno));
        return 1;
    }

    return 0;
}

static int bridge_addif(const char *bridge, const char *ifname)
{
    if (bridge_hasif(bridge, ifname))
        return 0;
    return bridge_if_ioctl(SIOCBRADDIF, bridge, ifname, EEXIST);
}

static int bridge_delif(const char *bridge, const char *ifname)
{
    if (!bridge_hasif(bridge, ifname))
        return 0;
    return bridge_if_ioctl(SIOCBRDELIF, bridge, ifname, ENOENT);
}

static bool hostapd_running(const char *conf_path)
{
    const char *needles[] = {"hostapd", "-B", conf_path};
    return process_running_needles(needles, 3);
}

static bool hostapd_cli_running(const char *ifname)
{
    const char *needles[] = {"hostapd_cli", ifname};
    return process_running_needles(needles, 2);
}

static int stop_hostapd(const char *conf_path, const char *label)
{
    const char *needles[] = {"hostapd", "-B", conf_path};
    return terminate_matching_processes(needles, 3, 5000, label);
}

static int stop_hostapd_cli(const char *ifname)
{
    const char *needles[] = {"hostapd_cli", ifname};
    return terminate_matching_processes(needles, 2, 3000, ifname);
}

/* ─── WlanMode management (mobileap_cfg.xml) ────────────────────── */
/* Read current WlanMode from /etc/mobileap_cfg.xml.
 * Returns true if found, writes value to out (e.g. "AP" or "AP-AP"). */
static bool get_wlan_mode(char *out, int out_sz)
{
    out[0] = '\0';
    FILE *f = fopen(MOBILEAP_CFG, "r");
    if (!f) return false;
    char line[512];
    while (fgets(line, sizeof(line), f)) {
        const char *p = strstr(line, "<WlanMode>");
        if (!p) continue;
        p += 10; /* strlen("<WlanMode>") */
        const char *e = strstr(p, "</WlanMode>");
        if (!e) continue;
        int len = (int)(e - p);
        if (len >= out_sz) len = out_sz - 1;
        memcpy(out, p, len);
        out[len] = '\0';
        fclose(f);
        return true;
    }
    fclose(f);
    return false;
}

/* Replace <WlanMode>X</WlanMode> in mobileap_cfg.xml.
 * Atomic: write to .tmp, rename. Returns 0 on success. */
static int set_wlan_mode(const char *mode)
{
    FILE *f = fopen(MOBILEAP_CFG, "r");
    if (!f) {
        fprintf(stderr, "[ERR] Cannot read %s\n", MOBILEAP_CFG);
        return 1;
    }
    fseek(f, 0, SEEK_END);
    long sz = ftell(f);
    fseek(f, 0, SEEK_SET);
    if (sz <= 0 || sz > 65536) { fclose(f); return 1; }

    char *buf = (char *)malloc(sz + 256);
    if (!buf) { fclose(f); return 1; }
    size_t rd = fread(buf, 1, sz, f);
    fclose(f);
    buf[rd] = '\0';

    /* Find <WlanMode>...</WlanMode> */
    char *start = strstr(buf, "<WlanMode>");
    if (!start) { free(buf); fprintf(stderr, "[ERR] <WlanMode> not found in XML\n"); return 1; }
    char *val_start = start + 10;
    char *val_end = strstr(val_start, "</WlanMode>");
    if (!val_end) { free(buf); return 1; }

    /* Build new file content */
    char tmp_path[256];
    snprintf(tmp_path, sizeof(tmp_path), "%s.tmp", MOBILEAP_CFG);
    FILE *out = fopen(tmp_path, "w");
    if (!out) { free(buf); return 1; }

    fwrite(buf, 1, val_start - buf, out);
    fputs(mode, out);
    fputs(val_end, out); /* includes </WlanMode> and rest of file */
    fclose(out);
    free(buf);

    if (rename(tmp_path, MOBILEAP_CFG) != 0) {
        unlink(tmp_path);
        fprintf(stderr, "[ERR] rename %s failed\n", tmp_path);
        return 1;
    }
    printf("[OK] WlanMode set to %s in %s\n", mode, MOBILEAP_CFG);

    /* Also patch factory template so it persists across reboots.
     * QCMAP regenerates runtime XML from factory at boot. */
    if (file_exists(MOBILEAP_FACTORY)) {
        FILE *ff = fopen(MOBILEAP_FACTORY, "r");
        if (ff) {
            fseek(ff, 0, SEEK_END);
            long fsz = ftell(ff);
            fseek(ff, 0, SEEK_SET);
            if (fsz > 0 && fsz <= 65536) {
                char *fbuf = (char *)malloc(fsz + 256);
                if (fbuf) {
                    size_t frd = fread(fbuf, 1, fsz, ff);
                    fbuf[frd] = '\0';
                    char *fs = strstr(fbuf, "<WlanMode>");
                    if (fs) {
                        char *fvs = fs + 10;
                        char *fve = strstr(fvs, "</WlanMode>");
                        if (fve) {
                            char ftmp[256];
                            snprintf(ftmp, sizeof(ftmp), "%s.tmp", MOBILEAP_FACTORY);
                            FILE *fo = fopen(ftmp, "w");
                            if (fo) {
                                fwrite(fbuf, 1, fvs - fbuf, fo);
                                fputs(mode, fo);
                                fputs(fve, fo);
                                fclose(fo);
                                rename(ftmp, MOBILEAP_FACTORY);
                                printf("[OK] WlanMode set to %s in %s\n", mode, MOBILEAP_FACTORY);
                            }
                        }
                    }
                    free(fbuf);
                }
            }
            fclose(ff);
        }
    }
    return 0;
}

/* Stop wlan1 userspace without tearing down the netdev.
 * The interface delete path is fragile on EE71 and can wedge the driver. */
static void cleanup_wlan1()
{
    stop_hostapd_cli("wlan1");
    stop_hostapd(HOSTAPD_CONF_5G, "wlan1 hostapd");
    bridge_delif(BRIDGE, "wlan1");
    unlink(HOSTAPD_PID_5G);
    unlink("/var/run/hostapd/wlan1");
    printf("[OK] wlan1 cleaned up\n");
}

/* ─── hostapd-wlan1.conf generation ──────────────────────────────── */
/* Generates /etc/hostapd-wlan1.conf from 5GHz (AP2G_guest) params.
 *
 * DB field mapping (AP2G_guest → Guest5G* DB fields → wlan1):
 *   Ssid         → Guest5GSSID
 *   WpaKey       → Guest5GWPAKey
 *   SecurityMode → Guest5GSecurityMode (0=OPEN, 3=WPA2-PSK)
 *   Channel      → Guest5GChannel (0=auto → default 36)
 *   SsidHidden   → Guest5GHiddenSSID
 *   Bandwidth    → Guest5GBandwidth (0=auto, 1=20, 2=40, 3=80)
 */
static int generate_hostapd_wlan1(const char *guest_json)
{
    char ssid[64] = "EE71_5G";
    char key[128] = "";
    int sec_mode = 3; /* WPA2-PSK */
    int channel = 36;
    int hidden = 0;
    int bandwidth = 0;
    int max_numsta = 15;

    json_get_string(guest_json, "Ssid", ssid, sizeof(ssid));
    json_get_string(guest_json, "WpaKey", key, sizeof(key));
    sec_mode = json_get_int(guest_json, "SecurityMode", sec_mode);
    channel  = json_get_int(guest_json, "Channel", channel);
    hidden   = json_get_int(guest_json, "SsidHidden", hidden);
    bandwidth = json_get_int(guest_json, "Bandwidth", bandwidth);
    max_numsta = json_get_int(guest_json, "max_numsta", max_numsta);

    if (channel == 0) channel = 36;

    /* Determine HT/VHT capabilities based on bandwidth.
     * Default (0=auto): 40 MHz — safer, 80MHz may fail if secondary
     * channels are occupied (hostapd HT_SCAN failure). */
    const char *ht_capab;
    int vht_oper_chwidth;
    switch (bandwidth) {
        case 1:  ht_capab = "";                        vht_oper_chwidth = 0; break;
        case 2:  ht_capab = "[HT40+][SHORT-GI-40]";   vht_oper_chwidth = 0; break;
        case 3:  ht_capab = "[HT40+][SHORT-GI-40]";   vht_oper_chwidth = 1; break;
        default: ht_capab = "[HT40+][SHORT-GI-40]";   vht_oper_chwidth = 0; break;
    }

    FILE *f = fopen(HOSTAPD_CONF_5G, "w");
    if (!f) {
        fprintf(stderr, "[ERR] Cannot write %s\n", HOSTAPD_CONF_5G);
        return 1;
    }

    fprintf(f,
        "interface=wlan1\n"
        "driver=nl80211\n"
        "ieee80211d=1\n"
        "ctrl_interface=/var/run/hostapd\n"
        "ctrl_interface_group=0\n"
        "ssid=%s\n"
        "ignore_broadcast_ssid=%d\n"
        "max_num_sta=%d\n"
        "ap_isolate=0\n"
        "beacon_int=100\n"
        "hw_mode=a\n"
        "ieee80211n=1\n"
        "ieee80211ac=1\n"
        "channel=%d\n"
        "country_code=GB\n",
        ssid, hidden, max_numsta, channel);

    if (ht_capab[0])
        fprintf(f, "ht_capab=%s\n", ht_capab);

    fprintf(f,
        "vht_oper_chwidth=%d\n"
        "wmm_enabled=1\n",
        vht_oper_chwidth);

    if (sec_mode == 3 || sec_mode == 2 || sec_mode == 4) {
        /* WPA2-PSK (or WPA/WPA2) — always use WPA2 with CCMP */
        fprintf(f,
            "wpa=2\n"
            "wpa_key_mgmt=WPA-PSK\n"
            "wpa_pairwise=CCMP\n"
            "rsn_pairwise=CCMP\n"
            "wpa_passphrase=%s\n",
            key);
    }
    /* SecurityMode 0 = OPEN — no wpa block needed */

    fclose(f);
    chmod(HOSTAPD_CONF_5G, 0644);
    printf("[OK] Generated %s (ssid=%s, ch=%d, sec=%d)\n",
           HOSTAPD_CONF_5G, ssid, channel, sec_mode);
    return 0;
}

/* ─── Hostapd restart ────────────────────────────────────────────── */
/* Restart procedure:
 *   1. Kill existing hostapd for the interface
 *   2. Start hostapd with config
 *   3. Wait for control socket readiness
 *   4. Ensure bridge membership
 *   5. Start hostapd_cli (for QCMAP event handling)
 */
static int restart_hostapd_wlan0()
{
    printf("[*] Restarting wlan0 hostapd...\n");

    if (!file_exists(HOSTAPD_CONF_2G)) {
        fprintf(stderr, "[ERR] %s not found\n", HOSTAPD_CONF_2G);
        return 1;
    }

    if (stop_hostapd_cli("wlan0") != 0)
        return 1;
    if (stop_hostapd(HOSTAPD_CONF_2G, "wlan0 hostapd") != 0)
        return 1;

    /* Remove stale ctrl interface */
    unlink(HOSTAPD_PID_2G);
    unlink("/var/run/hostapd/wlan0");

    char *hostapd_argv[] = {
        (char *)"hostapd",
        (char *)"-B",
        (char *)HOSTAPD_CONF_2G,
        (char *)"-P",
        (char *)HOSTAPD_PID_2G,
        (char *)"-e",
        (char *)ENTROPY_FILE,
        NULL
    };
    if (spawn_and_wait(hostapd_argv) != 0) {
        fprintf(stderr, "[ERR] Failed to start wlan0 hostapd\n");
        return 1;
    }

    if (wait_hostapd_ready("wlan0", 15000) != 0)
        return 1;

    char *hostapd_cli_argv[] = {
        (char *)"hostapd_cli",
        (char *)"-i",
        (char *)"wlan0",
        (char *)"-p",
        (char *)HOSTAPD_CTRL_DIR,
        (char *)"-B",
        (char *)"-a",
        (char *)QCMAP_STA_IFACE,
        NULL
    };
    if (spawn_and_wait(hostapd_cli_argv, true) != 0) {
        fprintf(stderr, "[ERR] Failed to start wlan0 hostapd_cli\n");
        return 1;
    }

    printf("[OK] wlan0 hostapd restarted\n");
    return 0;
}

static int restart_hostapd_wlan1()
{
    printf("[*] Restarting wlan1 hostapd...\n");

    if (!file_exists(HOSTAPD_CONF_5G)) {
        fprintf(stderr, "[ERR] %s not found\n", HOSTAPD_CONF_5G);
        return 1;
    }

    if (stop_hostapd_cli("wlan1") != 0)
        return 1;
    if (stop_hostapd(HOSTAPD_CONF_5G, "wlan1 hostapd") != 0)
        return 1;

    /* Remove stale PID + ctrl interface */
    unlink(HOSTAPD_PID_5G);
    unlink("/var/run/hostapd/wlan1");

    /* On EE71, deleting/recreating wlan1 through iw can wedge the driver
     * and leave both iw and hostapd stuck in D-state. Keep the existing
     * wlan1 if the interface is already present and only fail if it is
     * genuinely missing. */
    if (!iface_exists("wlan1")) {
        fprintf(stderr, "[ERR] wlan1 interface is missing\n");
        return 1;
    }

    char *hostapd_argv[] = {
        (char *)"hostapd",
        (char *)"-B",
        (char *)HOSTAPD_CONF_5G,
        (char *)"-P",
        (char *)HOSTAPD_PID_5G,
        (char *)"-e",
        (char *)ENTROPY_FILE,
        NULL
    };
    if (spawn_and_wait(hostapd_argv) != 0) {
        fprintf(stderr, "[ERR] Failed to start wlan1 hostapd\n");
        return 1;
    }

    if (wait_hostapd_ready("wlan1", 20000) != 0)
        return 1;

    if (bridge_addif(BRIDGE, "wlan1") != 0)
        return 1;

    char *hostapd_cli_argv[] = {
        (char *)"hostapd_cli",
        (char *)"-i",
        (char *)"wlan1",
        (char *)"-p",
        (char *)HOSTAPD_CTRL_DIR,
        (char *)"-B",
        (char *)"-a",
        (char *)QCMAP_STA_IFACE,
        NULL
    };
    if (spawn_and_wait(hostapd_cli_argv, true) != 0) {
        fprintf(stderr, "[ERR] Failed to start wlan1 hostapd_cli\n");
        return 1;
    }

    printf("[OK] wlan1 hostapd restarted\n");
    return 0;
}

/* ─── IPC to core_app via libsock_client.so.0 ────────────────────── */
/*
 * Reverse-engineered from libsock_client.so.0 (16 KB, stripped)
 * and config_manager (47 KB, stripped) disassembly.
 *
 * Wire protocol:
 *   Message = 24-byte header (all zeros) + JSON-RPC 2.0 string
 *   Response = 24-byte header + JSON-RPC 2.0 response string
 *   Transport: "pack" + uint32 total_len + message (added by library)
 *
 * int jrd_init_app_client(const char *sock_path);
 *   Connect to core_app via abstract Unix socket @<sock_path>.
 *   sock_path = "/dev/socket/qmux_webs/server_webs" (from config_manager RE).
 *   Also calls Diag_LSM_Init(0) for QCOM diag logging.
 *   Retries forever (1s sleep) until server socket available.
 *   Returns 0 on success.
 *
 * int client_send_sync_msg(void *msg, int msg_len,
 *                          void *resp, int *resp_status,
 *                          int timeout_ms);
 *   Send synchronous message to core_app.
 *   msg = 24-byte zeroed header + JSON-RPC 2.0 string.
 *   msg_len = 24 + strlen(json_rpc).
 *   resp = output buffer (3072+ bytes recommended).
 *   resp_status = output int pointer (initialized to 0).
 *   timeout_ms = timeout in milliseconds (config_manager uses 5000).
 *   Returns 0 on success.
 *   Response JSON starts at resp + 24.
 */

static const int IPC_HDR_SIZE = 24;
static const int IPC_TIMEOUT_MS = 5000;

typedef int (*init_fn_t)(const char *);
typedef int (*send_fn_t)(void *, int, void *, int *, int);

/* Build JSON-RPC 2.0 message for SetWlanSettings.
 * Returns malloc'd buffer (24-byte header + JSON), caller must free.
 * Sets *out_len to total length. */
static char *build_ipc_message(const char *ap2g, const char *ap5g,
                               const char *guest, const char *guest5g,
                               int *out_len)
{
    /* Construct: {"jsonrpc":"2.0","method":"SetWlanSettings","params":{...},"id":"1"} */
    char params[8192];
    int pos = 0;
    pos += snprintf(params + pos, sizeof(params) - pos, "{");
    bool need_comma = false;
    if (ap2g && ap2g[0]) {
        pos += snprintf(params + pos, sizeof(params) - pos,
                        "\"AP2G\":%s", ap2g);
        need_comma = true;
    }
    if (ap5g && ap5g[0]) {
        pos += snprintf(params + pos, sizeof(params) - pos,
                        "%s\"AP5G\":%s", need_comma ? "," : "", ap5g);
        need_comma = true;
    }
    if (guest && guest[0]) {
        pos += snprintf(params + pos, sizeof(params) - pos,
                        "%s\"AP2G_guest\":%s", need_comma ? "," : "", guest);
        need_comma = true;
    }
    if (guest5g && guest5g[0]) {
        pos += snprintf(params + pos, sizeof(params) - pos,
                        "%s\"AP5G_guest\":%s", need_comma ? "," : "", guest5g);
    }
    pos += snprintf(params + pos, sizeof(params) - pos, "}");

    char jsonrpc[8192 + 256];
    int json_len = snprintf(jsonrpc, sizeof(jsonrpc),
        "{\"jsonrpc\":\"2.0\",\"method\":\"SetWlanSettings\","
        "\"params\":%s,\"id\":\"1\"}", params);

    int total = IPC_HDR_SIZE + json_len;
    char *buf = (char *)malloc(total + 1);
    if (!buf) return NULL;
    memset(buf, 0, IPC_HDR_SIZE);
    memcpy(buf + IPC_HDR_SIZE, jsonrpc, json_len + 1);
    *out_len = total;
    return buf;
}

static bool ipc_set_wlan_settings(const char *ap2g, const char *ap5g,
                                  const char *guest, const char *guest5g)
{
    void *lib = dlopen("libsock_client.so.0", RTLD_NOW);
    if (!lib) {
        fprintf(stderr, "[ERR] Cannot load libsock_client.so.0: %s\n",
                dlerror());
        return false;
    }

    auto init_fn = (init_fn_t)dlsym(lib, "jrd_init_app_client");
    auto send_fn = (send_fn_t)dlsym(lib, "client_send_sync_msg");

    if (!init_fn || !send_fn) {
        fprintf(stderr, "[ERR] Cannot resolve libsock_client symbols\n");
        dlclose(lib);
        return false;
    }

    /* Connect to core_app via abstract Unix socket.
     * Socket path from config_manager disassembly (0x95fc). */
    int ret = init_fn("/dev/socket/qmux_webs/server_webs");
    if (ret != 0) {
        fprintf(stderr, "[ERR] jrd_init_app_client failed: %d\n", ret);
        dlclose(lib);
        return false;
    }
    printf("[OK] Connected to core_app\n");

    /* Build JSON-RPC 2.0 message */
    int msg_len = 0;
    char *msg = build_ipc_message(ap2g, ap5g, guest, guest5g, &msg_len);
    if (!msg) {
        fprintf(stderr, "[ERR] Failed to build IPC message\n");
        dlclose(lib);
        return false;
    }
    printf("[*] IPC message: %s\n", msg + IPC_HDR_SIZE);

    /* Send SetWlanSettings to core_app */
    char response[4096] = {};
    int resp_status = 0;
    ret = send_fn(msg, msg_len, response, &resp_status, IPC_TIMEOUT_MS);
    free(msg);

    if (ret != 0) {
        fprintf(stderr, "[ERR] client_send_sync_msg failed: %d\n", ret);
        dlclose(lib);
        return false;
    }

    printf("[OK] IPC SetWlanSettings succeeded\n");
    /* Response JSON starts after 24-byte header */
    const char *resp_json = response + IPC_HDR_SIZE;
    if (resp_json[0])
        printf("  Response: %.200s\n", resp_json);

    dlclose(lib);
    return true;
}

/* ─── Status ─────────────────────────────────────────────────────── */
static int cmd_status()
{
    bool wlan0_up = hostapd_running(HOSTAPD_CONF_2G);
    bool wlan1_up = hostapd_running(HOSTAPD_CONF_5G);
    bool wlan0_cli = hostapd_cli_running("wlan0");
    bool wlan1_cli = hostapd_cli_running("wlan1");
    char wlan_mode[32] = "unknown";
    get_wlan_mode(wlan_mode, sizeof(wlan_mode));

    printf("{\"wlan0\":%s,\"wlan1\":%s,"
           "\"wlan0_cli\":%s,\"wlan1_cli\":%s,"
           "\"conf_2g\":%s,\"conf_5g\":%s,"
           "\"wlan_mode\":\"%s\"}\n",
           wlan0_up ? "true" : "false",
           wlan1_up ? "true" : "false",
           wlan0_cli ? "true" : "false",
           wlan1_cli ? "true" : "false",
           file_exists(HOSTAPD_CONF_2G) ? "true" : "false",
           file_exists(HOSTAPD_CONF_5G) ? "true" : "false",
           wlan_mode);
    return 0;
}

static bool wait_for_hostapd_state(const char *conf_path, bool want_running,
                                   int timeout_ms)
{
    long long deadline = monotonic_ms() + timeout_ms;
    while (monotonic_ms() < deadline) {
        if (hostapd_running(conf_path) == want_running)
            return true;
        sleep_ms(200);
    }
    return hostapd_running(conf_path) == want_running;
}

/* ─── Apply ──────────────────────────────────────────────────────── */
static int cmd_apply(const char *json)
{
    int len;

    /* Extract optional "mode" field: "2g", "5g", or "dual" */
    char mode[16] = {};
    json_get_string(json, "mode", mode, sizeof(mode));
    bool has_mode = mode[0] != '\0';
    bool want_dual = has_mode && strcmp(mode, "dual") == 0;
    bool want_5g   = has_mode && strcmp(mode, "5g") == 0;
    bool want_2g   = has_mode && strcmp(mode, "2g") == 0;

    /* Handle WlanMode transition if mode is specified */
    if (has_mode) {
        char cur_mode[32] = {};
        get_wlan_mode(cur_mode, sizeof(cur_mode));
        bool is_apap = strcmp(cur_mode, "AP-AP") == 0;

        if (want_dual && !is_apap) {
            printf("[*] Switching WlanMode AP → AP-AP\n");
            if (set_wlan_mode("AP-AP") != 0) return 1;
        } else if (!want_dual && is_apap) {
            printf("[*] Switching WlanMode AP-AP → AP\n");
            cleanup_wlan1();
            if (set_wlan_mode("AP") != 0) return 1;
        }
    }

    /* Extract AP2G_guest (WlanAPID 2, maps to Guest5G* DB fields) */
    const char *guest = json_get_object(json, "AP2G_guest", &len);
    char guest_buf[2048] = {};
    if (guest && len < (int)sizeof(guest_buf)) {
        memcpy(guest_buf, guest, len);
    }

    /* Extract AP5G_guest (WlanAPID 3, same Guest5G* DB fields).
     * Both AP2G_guest and AP5G_guest map to the same DB rows.
     * Prefer AP5G_guest (semantically correct for 5GHz wlan1),
     * fall back to AP2G_guest if absent. */
    const char *guest5g = json_get_object(json, "AP5G_guest", &len);
    char guest5g_buf[2048] = {};
    if (guest5g && len < (int)sizeof(guest5g_buf)) {
        memcpy(guest5g_buf, guest5g, len);
    }
    const char *eff_guest = guest5g_buf[0] ? guest5g_buf : guest_buf;

    /* Extract AP2G */
    const char *ap2g = json_get_object(json, "AP2G", &len);
    char ap2g_buf[2048] = {};
    if (ap2g && len < (int)sizeof(ap2g_buf)) {
        memcpy(ap2g_buf, ap2g, len);
    }

    /* Extract AP5G */
    const char *ap5g = json_get_object(json, "AP5G", &len);
    char ap5g_buf[2048] = {};
    if (ap5g && len < (int)sizeof(ap5g_buf)) {
        memcpy(ap5g_buf, ap5g, len);
    }

    /* Step 1: Generate /etc/hostapd-wlan1.conf for dual-band mode.
     * Skip for single-band (no wlan1 needed). */
    bool need_wlan1 = want_dual || (!has_mode && eff_guest[0]);
    if (need_wlan1 && eff_guest[0]) {
        int ret = generate_hostapd_wlan1(eff_guest);
        if (ret != 0) return ret;
    }

    /* Step 2: Spawn wlan1 watchdog for dual-band mode only.
     * IPC triggers EnableWLAN → rmmod wlan → our process gets killed.
     * The watchdog is a detached child (setsid) that waits for WiFi
     * to come back, then starts wlan1 hostapd if needed. */
    if (need_wlan1) {
        pid_t pid = fork();
        if (pid == 0) {
            setsid();
            for (int fd = 3; fd < 64; fd++) close(fd);
            freopen("/dev/null", "r", stdin);
            freopen("/tmp/qcmap_watchdog.log", "a", stdout);
            freopen("/tmp/qcmap_watchdog.log", "a", stderr);

            printf("[watchdog] Waiting for WiFi teardown...\n");
            fflush(stdout);

            /* Phase 1: Wait for teardown (max 15s) */
            if (wait_for_hostapd_state(HOSTAPD_CONF_2G, false, 15000)) {
                printf("[watchdog] WiFi teardown detected\n");
                fflush(stdout);
            } else {
                printf("[watchdog] Teardown not observed before timeout\n");
                fflush(stdout);
            }

            /* Phase 2: Wait for wlan0 recovery (max 30s) */
            printf("[watchdog] Waiting for wlan0 recovery...\n");
            fflush(stdout);
            if (wait_for_hostapd_state(HOSTAPD_CONF_2G, true, 30000)) {
                printf("[watchdog] wlan0 hostapd is back\n");
                fflush(stdout);
            } else {
                printf("[watchdog] wlan0 recovery timed out\n");
                fflush(stdout);
            }

            /* Phase 3: Start wlan1 hostapd if not running */
            if (!hostapd_running(HOSTAPD_CONF_5G)) {
                printf("[watchdog] Starting wlan1 hostapd...\n");
                fflush(stdout);
                restart_hostapd_wlan1();
            } else {
                printf("[watchdog] wlan1 hostapd already running\n");
            }
            fflush(stdout);
            _exit(0);
        }
        if (pid > 0)
            printf("[OK] Watchdog spawned (PID %d)\n", pid);
    }

    /* Step 3: IPC to core_app (SetWlanSettings via JSON-RPC 2.0).
     * This makes core_app write DB + generate hostapd.conf (wlan0)
     * + trigger EnableWLAN QMI → QCMAP restarts WiFi.
     * WARNING: our process may be killed during WiFi teardown.
     * The watchdog (step 2) will handle wlan1 restart. */
    if (!ipc_set_wlan_settings(ap2g_buf, ap5g_buf, guest_buf, guest5g_buf)) {
        fprintf(stderr, "[ERR] IPC to core_app failed\n");
        return 1;
    }

    printf("[OK] IPC completed, WiFi restarting...\n");
    return 0;
}

/* ─── Main ───────────────────────────────────────────────────────── */
static void usage(const char *prog)
{
    fprintf(stderr,
        "Usage: %s <command> [args]\n"
        "\n"
        "Commands:\n"
        "  apply '{\"AP2G\":{...},\"AP5G\":{...},\"AP5G_guest\":{...}}'\n"
        "      Apply WiFi settings: generate hostapd-wlan1.conf,\n"
        "      IPC to core_app, restart hostapd.\n"
        "\n"
        "  restart-both      Restart wlan0 + wlan1 hostapd\n"
        "  restart-primary   Restart wlan0 hostapd only\n"
        "  restart-guest     Restart wlan1 hostapd only\n"
        "  status            Check hostapd process status (JSON)\n"
        "\n", prog);
}

int main(int argc, char *argv[])
{
    if (argc < 2) {
        usage(argv[0]);
        return 1;
    }

    const char *cmd = argv[1];

    if (strcmp(cmd, "status") == 0) {
        return cmd_status();
    }
    if (strcmp(cmd, "restart-both") == 0) {
        int r1 = restart_hostapd_wlan0();
        int r2 = restart_hostapd_wlan1();
        return (r1 || r2) ? 1 : 0;
    }
    if (strcmp(cmd, "restart-primary") == 0) {
        return restart_hostapd_wlan0();
    }
    if (strcmp(cmd, "restart-guest") == 0) {
        return restart_hostapd_wlan1();
    }
    if (strcmp(cmd, "apply") == 0) {
        if (argc < 3) {
            fprintf(stderr, "[ERR] apply requires JSON argument\n");
            return 1;
        }
        return cmd_apply(argv[2]);
    }

    fprintf(stderr, "[ERR] Unknown command: %s\n", cmd);
    usage(argv[0]);
    return 1;
}
