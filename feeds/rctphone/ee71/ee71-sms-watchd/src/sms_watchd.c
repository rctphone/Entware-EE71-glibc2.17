/*
 * sms_watchd - inotify-based SMS notification daemon for EE71
 *
 * Watches /jrd-resource/resource/sqlite3/ for changes to user_info.db3
 * (core_app sets new_sms_flag=1 on SMS arrival). On change, debounces
 * and fork/execs /usr/sbin/sms_notify to read SMS via WebAPI and send
 * Telegram notifications.
 *
 * No external libraries — pure libc.
 *
 * Build: arm-oe-linux-gnueabi-gcc -Os ... -o sms_watchd sms_watchd.c
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>
#include <unistd.h>
#include <time.h>
#include <errno.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <sys/select.h>
#include <sys/inotify.h>
#include <sys/wait.h>

#define PID_PATH        "/var/run/sms_watchd.pid"
#define WATCH_DIR       "/jrd-resource/resource/sqlite3"
#define WATCH_PREFIX    "user_info.db3"
#define NOTIFY_BIN      "/usr/sbin/sms_notify"
#define DEBOUNCE_SEC    2
#define SELECT_TIMEOUT  5

/* inotify event buffer: room for ~16 events */
#define EVT_BUF_SIZE    (16 * (sizeof(struct inotify_event) + 256))

static volatile sig_atomic_t running = 1;
static volatile pid_t child_pid = 0;
static int foreground = 0;

static void handle_term(int sig)
{
    (void)sig;
    running = 0;
}

static void handle_child(int sig)
{
    (void)sig;
    int status;
    while (waitpid(-1, &status, WNOHANG) > 0)
        ;
    child_pid = 0;
}

static int write_pidfile(void)
{
    FILE *f;

    /* Check if already running */
    f = fopen(PID_PATH, "r");
    if (f) {
        int pid = 0;
        if (fscanf(f, "%d", &pid) == 1 && pid > 0) {
            if (kill(pid, 0) == 0) {
                fclose(f);
                fprintf(stderr, "sms_watchd: already running (pid %d)\n", pid);
                return -1;
            }
        }
        fclose(f);
    }

    f = fopen(PID_PATH, "w");
    if (!f) {
        fprintf(stderr, "sms_watchd: cannot create %s: %s\n",
                PID_PATH, strerror(errno));
        return -1;
    }
    fprintf(f, "%d\n", getpid());
    fclose(f);
    return 0;
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
    int ifd, wd;
    char buf[EVT_BUF_SIZE];
    time_t last_trigger = 0;

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

    signal(SIGTERM, handle_term);
    signal(SIGINT, handle_term);
    signal(SIGCHLD, handle_child);
    signal(SIGPIPE, SIG_IGN);

    /* Set up inotify */
    ifd = inotify_init1(IN_CLOEXEC);
    if (ifd < 0) {
        perror("inotify_init1");
        unlink(PID_PATH);
        return 1;
    }

    wd = inotify_add_watch(ifd, WATCH_DIR,
                           IN_MODIFY | IN_CLOSE_WRITE | IN_MOVED_TO);
    if (wd < 0) {
        fprintf(stderr, "sms_watchd: inotify_add_watch(%s): %s\n",
                WATCH_DIR, strerror(errno));
        close(ifd);
        unlink(PID_PATH);
        return 1;
    }

    if (foreground)
        fprintf(stderr, "sms_watchd: watching %s (pid %d)\n",
                WATCH_DIR, getpid());

    while (running) {
        fd_set rfds;
        struct timeval tv;

        FD_ZERO(&rfds);
        FD_SET(ifd, &rfds);
        tv.tv_sec = SELECT_TIMEOUT;
        tv.tv_usec = 0;

        int ret = select(ifd + 1, &rfds, NULL, NULL, &tv);
        if (ret < 0) {
            if (errno == EINTR)
                continue;
            break;
        }
        if (ret == 0)
            continue;  /* timeout */

        ssize_t len = read(ifd, buf, sizeof(buf));
        if (len <= 0)
            continue;

        /* Scan events for user_info.db3 changes */
        int triggered = 0;
        char *ptr = buf;
        while (ptr < buf + len) {
            struct inotify_event *evt = (struct inotify_event *)ptr;
            if (evt->len > 0 &&
                strncmp(evt->name, WATCH_PREFIX, strlen(WATCH_PREFIX)) == 0) {
                triggered = 1;
            }
            ptr += sizeof(struct inotify_event) + evt->len;
        }

        if (!triggered)
            continue;

        /* Debounce */
        time_t now = time(NULL);
        if ((now - last_trigger) < DEBOUNCE_SEC)
            continue;

        /* No child pileup */
        if (child_pid != 0)
            continue;

        last_trigger = now;

        if (foreground)
            fprintf(stderr, "sms_watchd: triggered, spawning %s\n", NOTIFY_BIN);

        pid_t pid = fork();
        if (pid == 0) {
            /* Child: exec sms_notify */
            close(ifd);
            execl(NOTIFY_BIN, NOTIFY_BIN, (char *)NULL);
            _exit(127);  /* exec failed */
        } else if (pid > 0) {
            child_pid = pid;
        }
    }

    /* Cleanup */
    if (foreground)
        fprintf(stderr, "sms_watchd: shutting down\n");

    if (child_pid > 0) {
        kill(child_pid, SIGTERM);
        waitpid(child_pid, NULL, 0);
    }

    inotify_rm_watch(ifd, wd);
    close(ifd);
    unlink(PID_PATH);

    return 0;
}
