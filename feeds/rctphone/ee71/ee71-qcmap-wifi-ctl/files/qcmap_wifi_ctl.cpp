/*
 * qcmap_wifi_ctl — the two WiFi jobs stock leaves undone on EE71
 *
 * The device is always AP-AP: QCMAP reads WlanMode from
 * /etc/mobileap_cfg.xml at start, launches BOTH hostapd instances itself,
 * bridges both, and core_app re-asserts the mode into QCMAP at every
 * start (it derives that mode from a wifi_config row it reads once —
 * never write those rows from here or from any caller). Nothing here
 * manages the mode, and nothing here touches wlan0 — core_app owns
 * /etc/hostapd.conf and the wlan0 hostapd.
 *
 * Exactly three things no stock component does:
 *   1. write /etc/hostapd-wlan1.conf from the Guest5G* settings
 *   2. bring the wlan1 hostapd back after core_app's `killall hostapd`
 *      (core_app restarts only wlan0; QCMAP never notices)
 *   3. set wifi_config.GuestAP=1 when the guest AP is switched on — the
 *      provisioning row that decides dual-band at boot and that no API
 *      path can reach (see provision_guest_ap)
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
 * Never send AP5G.ApStatus=1 together with a guest section: that puts two
 * 5 GHz APs on one radio.
 *
 *   restart-guest    — restart wlan1 hostapd only
 *   stop-guest       — stop wlan1 hostapd ("5 GHz off"), idempotent
 *   status           — check hostapd process status
 *
 * A guest section with "ApStatus":0 updates the config file but does not
 * start wlan1; use stop-guest to actually take it down.
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
/* HOSTAPD_CONF_2G is read-only here: it identifies core_app's wlan0
 * hostapd process so the watchdog can tell when it went down and came
 * back. This tool never writes it and never restarts wlan0. */
static const char *HOSTAPD_CONF_2G    = "/etc/hostapd.conf";
static const char *HOSTAPD_CONF_5G    = "/etc/hostapd-wlan1.conf";
static const char *HOSTAPD_PID_5G     = "/etc/hostapd_ssid2.pid";
static const char *ENTROPY_FILE       = "/etc/entropy_file1";
static const char *HOSTAPD_CTRL_DIR   = "/var/run/hostapd";
static const char *BRIDGE             = "bridge0";
static const char *MOBILEAP_CFG      = "/etc/mobileap_cfg.xml";
static const char *QCMAP_STA_IFACE    = "/usr/bin/QCMAP_StaInterface";
static const char *USER_DB            = "/jrd-resource/resource/sqlite3/user_info.db3";

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

/* ─── WlanMode (mobileap_cfg.xml) — READ ONLY ───────────────────── */
/* Reported by `status` so a caller can see which mode QCMAP came up in.
 * Nothing writes this file here: QCMAP only parses it at process start,
 * so a runtime edit changes nothing and only desyncs disk from memory,
 * and core_app re-asserts the mode into QCMAP at every start anyway.
 * Expect "AP-AP" on this device, always. */
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

/* ─── Provisioning: wifi_config.GuestAP ──────────────────────────── */
/* GuestAP is the one row that decides whether the device comes up dual-band,
 * and no API path can set it: the name does not exist in the JSON-RPC wire
 * protocol at all (0 occurrences in either stock SPA), so SetWlanSettings
 * cannot carry it. core_app loads it in its bulk schema read at startup and
 * asserts the WLAN mode from in-memory state well after. Factory value is 0;
 * this unit is 1 only because a provisioning script we have since deleted set
 * it on 2026-03-02. With that script gone, nothing writes it — so without this
 * function the UI cannot enable dual-band at all.
 * Semantics settled in docs/plans/guestap-apmode-semantics.md.
 *
 * Three deliberate properties:
 *
 *  1. ONE-WAY. It only ever writes 1, never 0. "5 GHz off" is a runtime state
 *     (stop-guest), not a provisioning change. The old code wrote 0 here on the
 *     2g path, which is a plausible mechanism for the long-standing "AP-AP
 *     reverts after reboot" complaint: turning 5 GHz off once left the device
 *     unable to come back dual-band the same way it went off. Never again.
 *
 *  2. NOT THE RACE WE REMOVED. The writes deleted earlier targeted runtime rows
 *     (2GAPStatus, Guest5GAPStatus, APMode) that core_app keeps in memory and
 *     rewrites from its own cache on every SetWlanSettings — so they were lost
 *     or clobbered core_app's belief. GuestAP is read once at startup and has no
 *     wire field, so writing it out of band cannot collide with an in-flight
 *     core_app operation; it simply takes effect at the next core_app start,
 *     which is exactly the "works after a reboot" semantics we want. It is
 *     written BEFORE the IPC so core_app is not mid-apply.
 *
 *  3. NO-OP WHEN ALREADY PROVISIONED. The UPDATE is guarded by value<>'1', so
 *     the steady-state cost is one read-only sqlite call and zero NAND writes.
 *
 * Not fatal on failure: the settings change itself is still valid, and the next
 * apply retries. Explicit -batch -noheader -list because sqlite3 3.53 on this
 * device renders a decorated box table when stdout is a TTY.
 */
/* Returns true only when the row is known to read 1 afterwards — either it
 * already did, or this call set it. Every other outcome (sqlite3 missing, DB
 * locked, row absent, unparseable output) returns false so the caller can say
 * so instead of reporting a success the device will not honour at boot.
 *
 * busy_timeout matters: core_app holds this DB and writes it on every settings
 * apply, so SQLITE_BUSY is a live possibility exactly when we run. Without the
 * timeout sqlite3 gives up instantly and we would silently not provision. */
static bool provision_guest_ap()
{
    char cmd[1024];
    snprintf(cmd, sizeof(cmd),
        "sqlite3 -batch -noheader -list '%s' "
        "\"PRAGMA busy_timeout=5000; "
        "UPDATE wifi_config SET value='1' "
        "WHERE items='GuestAP' AND value<>'1'; "
        "SELECT changes() || ':' || "
        "(SELECT COUNT(*) FROM wifi_config WHERE items='GuestAP');\" 2>&1",
        USER_DB);

    FILE *p = popen(cmd, "r");
    if (!p) {
        fprintf(stderr, "[ERR] Cannot run sqlite3 for GuestAP provisioning: %s\n",
                strerror(errno));
        return false;
    }

    /* PRAGMA busy_timeout returns a row, so read until the last line. */
    char line[256], out[256] = {};
    while (fgets(line, sizeof(line), p))
        snprintf(out, sizeof(out), "%s", line);
    int rc = pclose(p);

    int changed = 0, present = 0;
    if (rc != 0 || sscanf(out, "%d:%d", &changed, &present) != 2) {
        fprintf(stderr, "[ERR] GuestAP provisioning failed "
                        "(sqlite3 rc=%d, last output '%s')\n", rc, out);
        return false;
    }
    if (present == 0) {
        fprintf(stderr, "[ERR] wifi_config.GuestAP row missing from %s — "
                        "dual-band cannot be provisioned\n", USER_DB);
        return false;
    }
    if (changed > 0) {
        /* QCMAP is running single-AP right now (no wlan1 vdev), so the guest
         * AP cannot be started until core_app re-asserts the mode at its next
         * start. The marker lets callers tell the user that plainly. */
        printf("[OK] wifi_config.GuestAP set to 1 (was not 1)\n");
        printf("REBOOT_REQUIRED\n");
    }
    return true;
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

/* ─── wlan1 hostapd stop ─────────────────────────────────────────── */
/* "5 GHz off": stop the guest AP's userspace and nothing else.
 *
 * Deliberately does NOT touch the WLAN mode, the netdev, or bridge
 * membership. wlan1 stays in bridge0 as an idle interface with no
 * beacon and no clients, which is harmless and keeps us out of the
 * fragile interface-delete path. QCMAP will start wlan1 again at the
 * next boot from its own XML, so this is a runtime state by design.
 *
 * Idempotent: terminate_matching_processes() returns 0 when nothing
 * matches, and unlink() failures are ignored, so stopping an already
 * stopped guest AP succeeds quietly. There is deliberately no
 * file_exists(HOSTAPD_CONF_5G) guard — a missing config is not a
 * reason to fail at turning something off.
 */
static int stop_hostapd_wlan1()
{
    printf("[*] Stopping wlan1 hostapd...\n");

    if (stop_hostapd_cli("wlan1") != 0)
        return 1;
    if (stop_hostapd(HOSTAPD_CONF_5G, "wlan1 hostapd") != 0)
        return 1;

    unlink(HOSTAPD_PID_5G);
    unlink("/var/run/hostapd/wlan1");

    printf("[OK] wlan1 hostapd stopped\n");
    return 0;
}

/* ─── wlan1 hostapd restart ──────────────────────────────────────── */
/* Restart procedure:
 *   1. Kill existing hostapd for wlan1
 *   2. Start hostapd with config
 *   3. Wait for control socket readiness
 *   4. Ensure bridge membership
 *   5. Start hostapd_cli (for QCMAP event handling)
 *
 * wlan0 has no counterpart here on purpose: core_app owns it, and a
 * second writer of the same process is how the two ended up fighting.
 */
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
/* A "mode" key in the body is accepted and ignored: the device is always
 * AP-AP and switching it at runtime was never possible (QCMAP reads the
 * XML only at start, core_app overrides it at its next start). Callers
 * should stop sending it. */
static int cmd_apply(const char *json)
{
    int len;

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

    /* "ApStatus":0 in the guest section means 5 GHz off. Starting the AP
     * the caller just asked us to switch off would be the tool
     * contradicting its own input, so only bring wlan1 back when the
     * guest AP is actually wanted. Stopping it is a separate explicit
     * call (stop-guest); this only declines to start it. Absent
     * ApStatus defaults to "on" so existing callers keep working. */
    bool have_guest = eff_guest[0] != '\0';
    bool need_wlan1 = have_guest && json_get_int(eff_guest, "ApStatus", 1) != 0;

    /* Validate before any side effect: a rejected request must leave the
     * device exactly as it was, config file included.
     *
     * Refuse AP5G.ApStatus=1 together with a live guest section.
     *
     * AP5G.ApStatus=1 is the band switch: core_app moves wlan0 itself to
     * 5 GHz. With the guest AP also on, wlan1 is already a 5 GHz AP, so
     * both hostapd want 5 GHz channels on one QCA6174 — which does DBS
     * 2.4+5, not 5+5. One of them fails to come up and QCMAP's recovery
     * path takes the whole WLAN down (`/etc/init.d/wlan stop`), not just
     * the guest.
     *
     * wifi.cgi rejects this too, but it is not a trust boundary: this tool
     * is run by hand and from scripts, and the failure mode is no WiFi at
     * all. Absent AP5G.ApStatus defaults to 0 — omitting the section is not
     * a request for the band switch. */
    if (need_wlan1 && ap5g_buf[0] &&
        json_get_int(ap5g_buf, "ApStatus", 0) != 0) {
        fprintf(stderr,
            "[ERR] Refusing AP5G.ApStatus=1 with the guest AP enabled: that "
            "puts two 5 GHz APs on one radio and can take the whole WLAN "
            "down. Send AP5G.ApStatus=0 for dual-band, or drop the guest "
            "section.\n");
        return 1;
    }

    /* Step 1: Generate /etc/hostapd-wlan1.conf whenever the caller sent a
     * guest section, including one that turns the guest AP off — the file
     * is what QCMAP starts wlan1 from at the next boot, so it should stay
     * current either way. A caller that does not want the file touched
     * simply omits AP2G_guest/AP5G_guest. */
    if (have_guest) {
        int ret = generate_hostapd_wlan1(eff_guest);
        if (ret != 0) return ret;
    }

    /* Step 1b: if the guest AP is being switched on, make sure the device is
     * provisioned to come up dual-band after a reboot too. Gated on the same
     * condition — asking for the 5 GHz AP is what provisions it. A plain 2.4 GHz
     * change never touches provisioning, and neither does switching 5 GHz off.
     *
     * A failure here does not abort the apply: the settings themselves are
     * still valid and 5 GHz still comes up now. Only persistence across a
     * reboot is lost, so it is a warning, not an error — but it must be a
     * *visible* one, or we report success for something the device will not
     * honour at its next boot. */
    if (need_wlan1 && !provision_guest_ap())
        printf("GUESTAP_FAILED\n");

    /* Step 2: Spawn the wlan1 watchdog.
     * The IPC below makes core_app run `killall hostapd` — which takes
     * wlan1 down with wlan0 — and then restart wlan0 only. QCMAP does not
     * notice, so nothing stock brings wlan1 back. The watchdog is a
     * detached child (setsid) that waits for wlan0 to go and return, then
     * starts wlan1 hostapd if it is still missing.
     * This whole step disappears once core_app is patched to kill only
     * its own hostapd pid. It only covers changes made through this tool;
     * a stock SetWlanSettings from any other client still kills 5 GHz. */
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
        "      IPC to core_app, restart wlan1 hostapd.\n"
        "\n"
        "  restart-guest     Restart wlan1 hostapd only\n"
        "  stop-guest        Stop wlan1 hostapd (5 GHz off), idempotent\n"
        "  status            Check hostapd process status (JSON)\n"
        "\n"
        "wlan0 is core_app's; this tool never restarts it.\n"
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
    if (strcmp(cmd, "restart-guest") == 0) {
        return restart_hostapd_wlan1();
    }
    if (strcmp(cmd, "stop-guest") == 0) {
        return stop_hostapd_wlan1();
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
