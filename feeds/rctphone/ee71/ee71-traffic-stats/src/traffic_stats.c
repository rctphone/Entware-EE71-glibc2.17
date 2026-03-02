/*
 * traffic_stats - Per-host traffic monitoring daemon for EE71
 *
 * Reads /proc/net/nf_conntrack every POLL_INTERVAL seconds,
 * aggregates per-LAN-host byte counters, computes speeds,
 * stores in 4-level ring buffers, writes JSON to /tmp/traffic_stats.json.
 *
 * No external libraries needed — pure libc.
 *
 * Build: arm-oe-linux-gnueabi-gcc -Os ... -o traffic_stats traffic_stats.c
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <signal.h>
#include <unistd.h>
#include <time.h>
#include <errno.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <sys/time.h>
#include <arpa/inet.h>
#include <net/if.h>
#include <sys/ioctl.h>

/* Configuration */
#define MAX_HOSTS       32
#define RING_SIZE       64
#define NUM_LEVELS      4
#define POLL_INTERVAL   3       /* seconds */
#define BRIDGE_IFACE    "bridge0"
#define JSON_PATH       "/tmp/traffic_stats.json"
#define JSON_TMP        "/tmp/traffic_stats.json.tmp"
#define PID_PATH        "/var/run/traffic_stats.pid"
#define CONNTRACK_PATH  "/proc/net/nf_conntrack"
#define ARP_PATH        "/proc/net/arp"
#define SIGNAL_PATH     "/tmp/signal_history.json"
#define SIGNAL_TMP      "/tmp/signal_history.json.tmp"
#define SIGNAL_RING_SZ  64

/* Ring buffer level step sizes (in number of POLL_INTERVAL ticks) */
static const int level_step[NUM_LEVELS] = {
    1,      /* level 0: every 3s */
    20,     /* level 1: every 60s  (20 * 3) */
    60,     /* level 2: every 180s (60 * 3) */
    480     /* level 3: every 1440s (480 * 3) */
};

/* Ring buffer entry */
struct ring_entry {
    uint32_t timestamp;     /* uptime seconds */
    uint32_t rx_speed;      /* bytes/sec (download to host) */
    uint32_t tx_speed;      /* bytes/sec (upload from host) */
};

/* Per-host state */
struct host {
    uint32_t ip;            /* network byte order */
    uint8_t  mac[6];
    uint8_t  active;        /* seen in current poll */
    uint8_t  _pad;
    uint64_t rx_bytes;      /* current poll: total bytes TO this host */
    uint64_t tx_bytes;      /* current poll: total bytes FROM this host */
    uint64_t prev_rx;       /* previous poll bytes */
    uint64_t prev_tx;
    uint64_t total_rx;      /* cumulative since daemon start */
    uint64_t total_tx;
    uint32_t rx_speed;      /* bytes/sec */
    uint32_t tx_speed;
    uint32_t connections;   /* active conntrack entries */
    struct ring_entry rings[NUM_LEVELS][RING_SIZE];
    int ring_pos[NUM_LEVELS];
};

/* Signal history entry */
struct signal_entry {
    uint32_t timestamp;
    int rsrp;
    int sinr;
};

/* Global state */
static struct {
    struct host hosts[MAX_HOSTS];
    int host_count;
    /* WAN totals */
    uint64_t wan_rx_total;
    uint64_t wan_tx_total;
    uint64_t wan_prev_rx;
    uint64_t wan_prev_tx;
    uint32_t wan_rx_speed;
    uint32_t wan_tx_speed;
    struct ring_entry wan_rings[NUM_LEVELS][RING_SIZE];
    int wan_ring_pos[NUM_LEVELS];
    /* Timing */
    uint32_t uptime;
    uint32_t tick;          /* poll counter */
    /* Signal history */
    struct signal_entry signal_ring[SIGNAL_RING_SZ];
    int signal_pos;
    int signal_count;
} G;

static volatile sig_atomic_t running = 1;
static int foreground = 0;

/* LAN detection — populated at startup from bridge0 */
static uint32_t lan_prefix;   /* first 24 bits of LAN IP (host order >> 8) */
static uint32_t lan_router;   /* router IP in network byte order */

/* Detect LAN subnet from bridge interface */
static void detect_lan(void)
{
    struct ifreq ifr;
    int fd = socket(AF_INET, SOCK_DGRAM, 0);
    if (fd < 0) goto fallback;

    memset(&ifr, 0, sizeof(ifr));
    strncpy(ifr.ifr_name, BRIDGE_IFACE, IFNAMSIZ - 1);
    if (ioctl(fd, SIOCGIFADDR, &ifr) < 0) {
        close(fd);
        goto fallback;
    }
    close(fd);

    uint32_t ip = ntohl(((struct sockaddr_in *)&ifr.ifr_addr)->sin_addr.s_addr);
    lan_prefix = ip >> 8;
    lan_router = htonl(ip);
    return;

fallback:
    /* Factory default: 192.168.1.1 */
    lan_prefix = 0xC0A801;  /* 192.168.1.x >> 8 */
    lan_router = htonl(0xC0A80101);
}

static void handle_signal(int sig)
{
    (void)sig;
    running = 0;
}

/* Get system uptime in seconds */
static uint32_t get_uptime(void)
{
    FILE *f = fopen("/proc/uptime", "r");
    double up = 0;
    if (f) {
        if (fscanf(f, "%lf", &up) != 1)
            up = 0;
        fclose(f);
    }
    return (uint32_t)up;
}

/* Find or create host entry by IP */
static struct host *find_host(uint32_t ip)
{
    int i;
    for (i = 0; i < G.host_count; i++) {
        if (G.hosts[i].ip == ip)
            return &G.hosts[i];
    }
    if (G.host_count >= MAX_HOSTS)
        return NULL;
    memset(&G.hosts[G.host_count], 0, sizeof(struct host));
    G.hosts[G.host_count].ip = ip;
    return &G.hosts[G.host_count++];
}

/* Check if IP is on LAN (same /24 as bridge0) */
static int is_lan_ip(uint32_t ip_net_order)
{
    uint32_t ip = ntohl(ip_net_order);
    return (ip >> 8) == lan_prefix;
}

/*
 * Parse /proc/net/nf_conntrack
 *
 * Format per line (with nf_conntrack_acct=1):
 *   ipv4  2 tcp  6 431999 ESTABLISHED src=192.168.1.199 dst=8.8.8.8
 *   sport=12345 dport=443 packets=100 bytes=50000 src=8.8.8.8
 *   dst=192.168.1.199 sport=443 dport=12345 packets=80 bytes=40000
 *   [ASSURED] mark=0 use=2
 *
 * We extract: src, dst, bytes from both directions.
 * "Original" direction: src=LAN → dst=WAN (upload from host)
 * "Reply" direction:    src=WAN → dst=LAN (download to host)
 */
static void parse_conntrack(void)
{
    FILE *f;
    char line[1024];
    int i;

    /* Clear current poll counters */
    for (i = 0; i < G.host_count; i++) {
        G.hosts[i].rx_bytes = 0;
        G.hosts[i].tx_bytes = 0;
        G.hosts[i].connections = 0;
        G.hosts[i].active = 0;
    }

    f = fopen(CONNTRACK_PATH, "r");
    if (!f)
        return;

    while (fgets(line, sizeof(line), f)) {
        /*
         * Parse: find the two src=, dst=, bytes= pairs.
         * First pair = original direction, second = reply.
         */
        char *p = line;
        uint32_t orig_src = 0, orig_dst = 0;
        uint64_t orig_bytes = 0;
        uint64_t reply_bytes = 0;
        int src_count = 0, dst_count = 0, bytes_count = 0;
        struct in_addr addr;

        while ((p = strstr(p, "src=")) != NULL) {
            if (inet_aton(p + 4, &addr)) {
                if (src_count == 0)
                    orig_src = addr.s_addr;
            }
            src_count++;
            p += 4;
        }

        p = line;
        while ((p = strstr(p, "dst=")) != NULL) {
            if (inet_aton(p + 4, &addr)) {
                if (dst_count == 0)
                    orig_dst = addr.s_addr;
            }
            dst_count++;
            p += 4;
        }

        p = line;
        while ((p = strstr(p, "bytes=")) != NULL) {
            uint64_t b = strtoull(p + 6, NULL, 10);
            if (bytes_count == 0)
                orig_bytes = b;
            else if (bytes_count == 1)
                reply_bytes = b;
            bytes_count++;
            p += 6;
        }

        if (src_count < 2 || bytes_count < 2)
            continue;

        /*
         * Identify LAN host.
         * Case 1: orig_src is LAN → host uploads (tx), reply bytes = download (rx)
         * Case 2: orig_dst is LAN → host downloads (rx), but this is
         *         unusual for NAT (typically LAN initiates)
         */
        uint32_t lan_ip = 0;
        uint64_t host_tx = 0, host_rx = 0;

        if (is_lan_ip(orig_src)) {
            lan_ip = orig_src;
            host_tx = orig_bytes;   /* host → WAN */
            host_rx = reply_bytes;  /* WAN → host */
        } else if (is_lan_ip(orig_dst)) {
            lan_ip = orig_dst;
            host_rx = orig_bytes;   /* WAN → host */
            host_tx = reply_bytes;  /* host → WAN */
        }

        if (!lan_ip)
            continue;

        /* Skip router-local traffic */
        if (lan_ip == lan_router)
            continue;

        struct host *h = find_host(lan_ip);
        if (!h)
            continue;

        h->rx_bytes += host_rx;
        h->tx_bytes += host_tx;
        h->connections++;
        h->active = 1;
    }

    fclose(f);
}

/* Read /proc/net/arp to resolve IP → MAC */
static void resolve_arp(void)
{
    FILE *f;
    char line[256];

    f = fopen(ARP_PATH, "r");
    if (!f)
        return;

    /* Skip header */
    if (!fgets(line, sizeof(line), f)) {
        fclose(f);
        return;
    }

    while (fgets(line, sizeof(line), f)) {
        char ip_str[32];
        int hw_type, flags;
        char mac_str[32], mask[8], dev[32];

        if (sscanf(line, "%31s 0x%x 0x%x %31s %7s %31s",
                   ip_str, &hw_type, &flags, mac_str, mask, dev) < 4)
            continue;

        struct in_addr addr;
        if (!inet_aton(ip_str, &addr))
            continue;
        if (!is_lan_ip(addr.s_addr))
            continue;

        struct host *h = find_host(addr.s_addr);
        if (!h)
            continue;

        /* Parse MAC */
        unsigned int m[6];
        if (sscanf(mac_str, "%x:%x:%x:%x:%x:%x",
                   &m[0], &m[1], &m[2], &m[3], &m[4], &m[5]) == 6) {
            int j;
            for (j = 0; j < 6; j++)
                h->mac[j] = (uint8_t)m[j];
        }
    }

    fclose(f);
}

/* Compute speeds and update ring buffers */
static void update_stats(void)
{
    int i, lvl;
    uint64_t total_rx = 0, total_tx = 0;

    G.uptime = get_uptime();

    for (i = 0; i < G.host_count; i++) {
        struct host *h = &G.hosts[i];

        if (h->prev_rx > 0 || h->prev_tx > 0) {
            /* Speed = delta bytes / interval */
            int64_t drx = (int64_t)(h->rx_bytes - h->prev_rx);
            int64_t dtx = (int64_t)(h->tx_bytes - h->prev_tx);
            /* Handle counter reset (new conntrack entries replace old) */
            if (drx < 0) drx = (int64_t)h->rx_bytes;
            if (dtx < 0) dtx = (int64_t)h->tx_bytes;
            h->rx_speed = (uint32_t)(drx / POLL_INTERVAL);
            h->tx_speed = (uint32_t)(dtx / POLL_INTERVAL);
            h->total_rx += (uint64_t)drx;
            h->total_tx += (uint64_t)dtx;
        } else {
            h->rx_speed = 0;
            h->tx_speed = 0;
        }

        h->prev_rx = h->rx_bytes;
        h->prev_tx = h->tx_bytes;

        total_rx += h->rx_speed;
        total_tx += h->tx_speed;
    }

    /* WAN totals (sum of all hosts) */
    G.wan_rx_speed = (uint32_t)total_rx;
    G.wan_tx_speed = (uint32_t)total_tx;
    G.wan_rx_total += total_rx * POLL_INTERVAL;
    G.wan_tx_total += total_tx * POLL_INTERVAL;

    /* Push to ring buffers */
    for (i = 0; i < G.host_count; i++) {
        struct host *h = &G.hosts[i];
        for (lvl = 0; lvl < NUM_LEVELS; lvl++) {
            if ((G.tick % level_step[lvl]) == 0) {
                int pos = h->ring_pos[lvl];
                h->rings[lvl][pos].timestamp = G.uptime;
                if (lvl == 0) {
                    h->rings[lvl][pos].rx_speed = h->rx_speed;
                    h->rings[lvl][pos].tx_speed = h->tx_speed;
                } else {
                    /* Average of previous level's last N entries */
                    int prev_step = level_step[lvl] / level_step[lvl - 1];
                    uint64_t avg_rx = 0, avg_tx = 0;
                    int pp = h->ring_pos[lvl - 1];
                    int k;
                    for (k = 0; k < prev_step && k < RING_SIZE; k++) {
                        int idx = (pp - k + RING_SIZE) % RING_SIZE;
                        avg_rx += h->rings[lvl - 1][idx].rx_speed;
                        avg_tx += h->rings[lvl - 1][idx].tx_speed;
                    }
                    h->rings[lvl][pos].rx_speed = (uint32_t)(avg_rx / prev_step);
                    h->rings[lvl][pos].tx_speed = (uint32_t)(avg_tx / prev_step);
                }
                h->ring_pos[lvl] = (pos + 1) % RING_SIZE;
            }
        }
    }

    /* WAN ring buffers */
    for (lvl = 0; lvl < NUM_LEVELS; lvl++) {
        if ((G.tick % level_step[lvl]) == 0) {
            int pos = G.wan_ring_pos[lvl];
            G.wan_rings[lvl][pos].timestamp = G.uptime;
            if (lvl == 0) {
                G.wan_rings[lvl][pos].rx_speed = G.wan_rx_speed;
                G.wan_rings[lvl][pos].tx_speed = G.wan_tx_speed;
            } else {
                int prev_step = level_step[lvl] / level_step[lvl - 1];
                uint64_t avg_rx = 0, avg_tx = 0;
                int pp = G.wan_ring_pos[lvl - 1];
                int k;
                for (k = 0; k < prev_step && k < RING_SIZE; k++) {
                    int idx = (pp - k + RING_SIZE) % RING_SIZE;
                    avg_rx += G.wan_rings[lvl - 1][idx].rx_speed;
                    avg_tx += G.wan_rings[lvl - 1][idx].tx_speed;
                }
                G.wan_rings[lvl][pos].rx_speed = (uint32_t)(avg_rx / prev_step);
                G.wan_rings[lvl][pos].tx_speed = (uint32_t)(avg_tx / prev_step);
            }
            G.wan_ring_pos[lvl] = (pos + 1) % RING_SIZE;
        }
    }

    G.tick++;
}

/* Write ring buffer entries as JSON array */
static void write_ring_json(FILE *f, struct ring_entry ring[], int pos, int count)
{
    int i, first = 1;
    fprintf(f, "[");
    for (i = 0; i < count; i++) {
        /* Walk from oldest to newest */
        int idx = (pos + i) % RING_SIZE;
        if (ring[idx].timestamp == 0)
            continue;
        if (!first) fprintf(f, ",");
        fprintf(f, "{\"t\":%u,\"rx\":%u,\"tx\":%u}",
                ring[idx].timestamp, ring[idx].rx_speed, ring[idx].tx_speed);
        first = 0;
    }
    fprintf(f, "]");
}

/* Write traffic JSON to tmp file, then rename atomically */
static void write_json(void)
{
    FILE *f;
    int i, lvl;
    char ip_str[INET_ADDRSTRLEN];

    f = fopen(JSON_TMP, "w");
    if (!f)
        return;

    fprintf(f, "{\"uptime\":%u,\"wan\":{\"rx_speed\":%u,\"tx_speed\":%u,"
            "\"rx_total\":%llu,\"tx_total\":%llu},\"hosts\":[",
            G.uptime, G.wan_rx_speed, G.wan_tx_speed,
            (unsigned long long)G.wan_rx_total,
            (unsigned long long)G.wan_tx_total);

    for (i = 0; i < G.host_count; i++) {
        struct host *h = &G.hosts[i];
        if (!h->active && h->total_rx == 0 && h->total_tx == 0)
            continue;

        inet_ntop(AF_INET, &h->ip, ip_str, sizeof(ip_str));

        if (i > 0) fprintf(f, ",");
        fprintf(f, "{\"ip\":\"%s\",\"mac\":\"%02x:%02x:%02x:%02x:%02x:%02x\","
                "\"rx_speed\":%u,\"tx_speed\":%u,"
                "\"rx_total\":%llu,\"tx_total\":%llu,"
                "\"connections\":%u,\"active\":%d}",
                ip_str,
                h->mac[0], h->mac[1], h->mac[2],
                h->mac[3], h->mac[4], h->mac[5],
                h->rx_speed, h->tx_speed,
                (unsigned long long)h->total_rx,
                (unsigned long long)h->total_tx,
                h->connections, h->active);
    }

    fprintf(f, "],\"wan_chart\":{");
    for (lvl = 0; lvl < NUM_LEVELS; lvl++) {
        if (lvl > 0) fprintf(f, ",");
        fprintf(f, "\"%d\":", lvl);
        write_ring_json(f, G.wan_rings[lvl], G.wan_ring_pos[lvl], RING_SIZE);
    }
    fprintf(f, "},\"host_chart\":{");

    int first_host = 1;
    for (i = 0; i < G.host_count; i++) {
        struct host *h = &G.hosts[i];
        if (h->total_rx == 0 && h->total_tx == 0)
            continue;
        inet_ntop(AF_INET, &h->ip, ip_str, sizeof(ip_str));

        if (!first_host) fprintf(f, ",");
        first_host = 0;
        fprintf(f, "\"%s\":{", ip_str);
        for (lvl = 0; lvl < NUM_LEVELS; lvl++) {
            if (lvl > 0) fprintf(f, ",");
            fprintf(f, "\"%d\":", lvl);
            write_ring_json(f, h->rings[lvl], h->ring_pos[lvl], RING_SIZE);
        }
        fprintf(f, "}");
    }

    fprintf(f, "}}");
    fclose(f);

    rename(JSON_TMP, JSON_PATH);
}

/* Read signal info via stock webapi helper script */
static void poll_signal(void)
{
    /* Signal polling runs every 5 ticks (15s) to reduce load.
     * CGI reads from a simple shell helper that calls webapi. */
    if ((G.tick % 5) != 0)
        return;

    /* Read signal from a helper file written by signal_poll.sh
     * (a tiny shell loop that calls webapi GetNetworkInfo) */
    FILE *f = fopen("/tmp/signal_current.txt", "r");
    if (!f)
        return;

    int rsrp = 0, sinr = 0;
    char line[128];
    while (fgets(line, sizeof(line), f)) {
        if (strncmp(line, "RSRP=", 5) == 0)
            rsrp = atoi(line + 5);
        else if (strncmp(line, "SINR=", 5) == 0)
            sinr = atoi(line + 5);
    }
    fclose(f);

    if (rsrp == 0 && sinr == 0)
        return;

    G.signal_ring[G.signal_pos].timestamp = G.uptime;
    G.signal_ring[G.signal_pos].rsrp = rsrp;
    G.signal_ring[G.signal_pos].sinr = sinr;
    G.signal_pos = (G.signal_pos + 1) % SIGNAL_RING_SZ;
    if (G.signal_count < SIGNAL_RING_SZ)
        G.signal_count++;

    /* Write signal history JSON */
    f = fopen(SIGNAL_TMP, "w");
    if (!f)
        return;

    fprintf(f, "[");
    int i, first = 1;
    for (i = 0; i < G.signal_count; i++) {
        int idx = (G.signal_pos - G.signal_count + i + SIGNAL_RING_SZ) % SIGNAL_RING_SZ;
        if (!first) fprintf(f, ",");
        fprintf(f, "{\"t\":%u,\"rsrp\":%d,\"sinr\":%d}",
                G.signal_ring[idx].timestamp,
                G.signal_ring[idx].rsrp,
                G.signal_ring[idx].sinr);
        first = 0;
    }
    fprintf(f, "]");
    fclose(f);

    rename(SIGNAL_TMP, SIGNAL_PATH);
}

/* Write PID file */
static int write_pidfile(void)
{
    FILE *f;

    /* Check if already running */
    f = fopen(PID_PATH, "r");
    if (f) {
        int pid = 0;
        if (fscanf(f, "%d", &pid) == 1 && pid > 0) {
            /* Check if process exists */
            if (kill(pid, 0) == 0) {
                fclose(f);
                fprintf(stderr, "traffic_stats: already running (pid %d)\n", pid);
                return -1;
            }
        }
        fclose(f);
    }

    f = fopen(PID_PATH, "w");
    if (!f) {
        fprintf(stderr, "traffic_stats: cannot create %s: %s\n",
                PID_PATH, strerror(errno));
        return -1;
    }
    fprintf(f, "%d\n", getpid());
    fclose(f);
    return 0;
}

static void remove_pidfile(void)
{
    unlink(PID_PATH);
}

static void enable_conntrack_acct(void)
{
    FILE *f = fopen("/proc/sys/net/netfilter/nf_conntrack_acct", "w");
    if (f) {
        fputs("1\n", f);
        fclose(f);
    }
}

static void usage(const char *prog)
{
    fprintf(stderr, "Usage: %s [-f] [-h]\n"
            "  -f  foreground mode (don't daemonize)\n"
            "  -h  show this help\n", prog);
}

int main(int argc, char *argv[])
{
    int opt;

    while ((opt = getopt(argc, argv, "fh")) != -1) {
        switch (opt) {
        case 'f':
            foreground = 1;
            break;
        case 'h':
        default:
            usage(argv[0]);
            return (opt == 'h') ? 0 : 1;
        }
    }

    /* Daemonize unless foreground */
    if (!foreground) {
        pid_t pid = fork();
        if (pid < 0) {
            perror("fork");
            return 1;
        }
        if (pid > 0)
            return 0;  /* parent exits */
        setsid();
        /* Redirect stdio to /dev/null */
        int fd = open("/dev/null", O_RDWR);
        if (fd >= 0) {
            dup2(fd, STDIN_FILENO);
            dup2(fd, STDOUT_FILENO);
            dup2(fd, STDERR_FILENO);
            if (fd > 2) close(fd);
        }
    }

    if (write_pidfile() < 0)
        return 1;

    signal(SIGTERM, handle_signal);
    signal(SIGINT, handle_signal);
    signal(SIGPIPE, SIG_IGN);

    memset(&G, 0, sizeof(G));
    detect_lan();

    enable_conntrack_acct();

    if (foreground)
        fprintf(stderr, "traffic_stats: started (pid %d, poll every %ds)\n",
                getpid(), POLL_INTERVAL);

    while (running) {
        parse_conntrack();
        resolve_arp();
        update_stats();
        write_json();
        poll_signal();

        if (foreground && (G.tick % 10) == 0) {
            fprintf(stderr, "tick=%u hosts=%d wan_rx=%u wan_tx=%u B/s\n",
                    G.tick, G.host_count, G.wan_rx_speed, G.wan_tx_speed);
        }

        sleep(POLL_INTERVAL);
    }

    if (foreground)
        fprintf(stderr, "traffic_stats: shutting down\n");

    /* Cleanup */
    unlink(JSON_PATH);
    unlink(JSON_TMP);
    remove_pidfile();

    return 0;
}
