/*
 * sms_forward — SMS to Telegram forwarding daemon for EE71
 *
 * Polls core_app via IPC (libsock_client.so.0) for new SMS,
 * forwards received messages to Telegram via libcurl.
 *
 * Replaces: sms_watchd + sms_notify + sms_forward.sh
 *
 * Build: arm-oe-linux-gnueabi-g++ -std=c++11 -Os ... -o sms_forward \
 *        sms_forward.cpp cJSON.o -ldl -lpthread -lcurl
 */

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <csignal>
#include <cerrno>
#include <unistd.h>
#include <fcntl.h>
#include <dlfcn.h>
#include <syslog.h>
#include <sys/stat.h>
#include <curl/curl.h>

extern "C" {
#include "cJSON.h"
}

/* --- Constants --- */

#define PID_PATH        "/var/run/sms_forward.pid"
#define CONF_PATH       "/etc/sms_forward.conf"
#define LASTID_PATH     "/etc/sms_forward_lastid"
#define SOCKET_PATH     "/dev/socket/qmux_webs/server_webs"
#define LOG_TAG         "sms_fwd"

#define IPC_HDR_SIZE    24
#define IPC_TIMEOUT_MS  5000
#define IPC_RESP_SIZE   16384
#define CONF_LINE_MAX   1024

/* --- Types --- */

typedef int (*init_fn_t)(const char *);
typedef int (*send_fn_t)(void *, int, void *, int *, int);

struct config {
    bool telegram_enabled;
    char bot_token[256];
    char chat_id[64];
    char filter_numbers[512];
    int poll_interval;
};

/* --- Globals --- */

static volatile sig_atomic_t g_running = 1;
static volatile sig_atomic_t g_reload = 0;
static int g_foreground = 0;

/* --- Signal handlers --- */

static void handle_term(int) { g_running = 0; }
static void handle_hup(int) { g_reload = 1; }
static void handle_alarm(int) {
    /* jrd_init_app_client retries forever; alarm breaks out */
    syslog(LOG_ERR, "IPC init timeout");
    _exit(1);
}

/* --- Logging --- */

#define logmsg(pri, fmt, ...) do { \
    syslog(pri, fmt, ##__VA_ARGS__); \
    if (g_foreground) fprintf(stderr, "[" LOG_TAG "] " fmt "\n", ##__VA_ARGS__); \
} while (0)

/* --- Config --- */

static void config_defaults(config &cfg)
{
    cfg.telegram_enabled = false;
    cfg.bot_token[0] = '\0';
    cfg.chat_id[0] = '\0';
    cfg.filter_numbers[0] = '\0';
    cfg.poll_interval = 10;
}

static void load_config(config &cfg)
{
    config_defaults(cfg);

    FILE *f = fopen(CONF_PATH, "r");
    if (!f) {
        logmsg(LOG_WARNING, "config not found: %s", CONF_PATH);
        return;
    }

    char line[CONF_LINE_MAX];
    while (fgets(line, sizeof(line), f)) {
        /* strip trailing whitespace */
        char *end = line + strlen(line) - 1;
        while (end >= line && (*end == '\n' || *end == '\r' || *end == ' '))
            *end-- = '\0';
        /* skip comments and empty */
        if (line[0] == '#' || line[0] == '\0')
            continue;
        char *eq = strchr(line, '=');
        if (!eq)
            continue;
        *eq = '\0';
        const char *key = line;
        const char *val = eq + 1;

        if (strcmp(key, "TELEGRAM_ENABLED") == 0)
            cfg.telegram_enabled = (atoi(val) == 1);
        else if (strcmp(key, "TELEGRAM_BOT_TOKEN") == 0)
            snprintf(cfg.bot_token, sizeof(cfg.bot_token), "%s", val);
        else if (strcmp(key, "TELEGRAM_CHAT_ID") == 0)
            snprintf(cfg.chat_id, sizeof(cfg.chat_id), "%s", val);
        else if (strcmp(key, "FILTER_NUMBERS") == 0)
            snprintf(cfg.filter_numbers, sizeof(cfg.filter_numbers), "%s", val);
        else if (strcmp(key, "POLL_INTERVAL") == 0) {
            int v = atoi(val);
            if (v >= 1 && v <= 3600)
                cfg.poll_interval = v;
        }
    }
    fclose(f);
}

/* --- PID file --- */

static int write_pidfile()
{
    FILE *f = fopen(PID_PATH, "r");
    if (f) {
        int pid = 0;
        if (fscanf(f, "%d", &pid) == 1 && pid > 0) {
            if (kill(pid, 0) == 0) {
                fclose(f);
                fprintf(stderr, "sms_forward: already running (pid %d)\n", pid);
                return -1;
            }
        }
        fclose(f);
    }
    f = fopen(PID_PATH, "w");
    if (!f) {
        fprintf(stderr, "sms_forward: cannot create %s: %s\n",
                PID_PATH, strerror(errno));
        return -1;
    }
    fprintf(f, "%d\n", getpid());
    fclose(f);
    return 0;
}

/* --- Daemonize --- */

static void daemonize()
{
    pid_t pid = fork();
    if (pid < 0) { perror("fork"); exit(1); }
    if (pid > 0) _exit(0);
    setsid();
    int fd = open("/dev/null", O_RDWR);
    if (fd >= 0) {
        dup2(fd, STDIN_FILENO);
        dup2(fd, STDOUT_FILENO);
        dup2(fd, STDERR_FILENO);
        if (fd > 2) close(fd);
    }
}

/* --- IPC --- */

static bool ipc_call(send_fn_t send_fn,
                     const char *method, const char *params,
                     char *resp_json, int resp_size)
{
    char jsonrpc[4096];
    int json_len = snprintf(jsonrpc, sizeof(jsonrpc),
        "{\"jsonrpc\":\"2.0\",\"method\":\"%s\",\"params\":%s,\"id\":\"1\"}",
        method, params);

    int total = IPC_HDR_SIZE + json_len;
    char *buf = (char *)malloc(total + 1);
    if (!buf) return false;
    memset(buf, 0, IPC_HDR_SIZE);
    memcpy(buf + IPC_HDR_SIZE, jsonrpc, json_len + 1);

    char *resp = (char *)calloc(1, IPC_RESP_SIZE);
    if (!resp) { free(buf); return false; }
    int resp_status = 0;

    int ret = send_fn(buf, total, resp, &resp_status, IPC_TIMEOUT_MS);
    free(buf);

    if (ret != 0) {
        logmsg(LOG_ERR, "IPC %s failed (ret=%d)", method, ret);
        free(resp);
        return false;
    }

    /* Response: skip 24-byte header */
    const char *rj = resp + IPC_HDR_SIZE;
    if (rj[0] && resp_json) {
        int rlen = strlen(rj);
        if (rlen >= resp_size) rlen = resp_size - 1;
        memcpy(resp_json, rj, rlen);
        resp_json[rlen] = '\0';
    }

    free(resp);
    return true;
}

/* --- Last ID persistence --- */

static int read_last_id()
{
    FILE *f = fopen(LASTID_PATH, "r");
    if (!f) return -1;  /* first run */
    int id = 0;
    if (fscanf(f, "%d", &id) != 1) id = -1;
    fclose(f);
    return id;
}

static void write_last_id(int id)
{
    FILE *f = fopen(LASTID_PATH, "w");
    if (f) {
        fprintf(f, "%d\n", id);
        fclose(f);
    }
}

/* --- SMS flag --- */

static bool check_new_sms_flag(send_fn_t send_fn)
{
    char resp[1024] = {};
    if (!ipc_call(send_fn, "GetNewSMSFlag", "{}", resp, sizeof(resp))) {
        logmsg(LOG_ERR, "GetNewSMSFlag IPC call failed");
        return false;
    }

    logmsg(LOG_DEBUG, "GetNewSMSFlag: %s", resp);

    cJSON *root = cJSON_Parse(resp);
    if (!root) {
        logmsg(LOG_ERR, "parse GetNewSMSFlag failed: %.100s", resp);
        return false;
    }

    cJSON *result = cJSON_GetObjectItem(root, "result");
    if (!result) {
        logmsg(LOG_ERR, "GetNewSMSFlag: no 'result' field");
        cJSON_Delete(root);
        return false;
    }

    cJSON *flag = cJSON_GetObjectItem(result, "newSMSFlag");
    int val = flag ? (int)cJSON_GetNumberValue(flag) : 0;
    cJSON_Delete(root);

    if (val == 1)
        logmsg(LOG_INFO, "new SMS flag set");

    return val == 1;
}

static void clear_new_sms_flag(send_fn_t send_fn)
{
    char resp[1024] = {};
    ipc_call(send_fn, "SetNewSMSFlag", "{\"newSMSFlag\":0}", resp, sizeof(resp));
}

/* --- Number filter --- */

static bool number_matches_filter(const char *phone, const char *filter)
{
    if (!filter || filter[0] == '\0')
        return true;  /* no filter = accept all */

    /* Comma-separated list */
    char tmp[512];
    snprintf(tmp, sizeof(tmp), "%s", filter);
    char *saveptr = NULL;
    char *tok = strtok_r(tmp, ",", &saveptr);
    while (tok) {
        /* strip spaces */
        while (*tok == ' ') tok++;
        char *end = tok + strlen(tok) - 1;
        while (end > tok && *end == ' ') *end-- = '\0';
        if (*tok && strstr(phone, tok))
            return true;
        tok = strtok_r(NULL, ",", &saveptr);
    }
    return false;
}

/* --- Telegram --- */

struct curl_buf {
    char *data;
    size_t len;
};

static size_t curl_write_cb(void *ptr, size_t size, size_t nmemb, void *ud)
{
    curl_buf *b = (curl_buf *)ud;
    size_t total = size * nmemb;
    char *tmp = (char *)realloc(b->data, b->len + total + 1);
    if (!tmp) return 0;
    b->data = tmp;
    memcpy(b->data + b->len, ptr, total);
    b->len += total;
    b->data[b->len] = '\0';
    return total;
}

static size_t curl_discard(void *ptr, size_t size, size_t nmemb, void *)
{
    (void)ptr;
    return size * nmemb;
}

static void telegram_curl_error(char *out, size_t out_size, CURLcode res,
                                const char *errbuf)
{
    const char *detail = (errbuf && errbuf[0]) ? errbuf : curl_easy_strerror(res);

    if (res == CURLE_OPERATION_TIMEDOUT) {
        snprintf(out, out_size,
                 "api.telegram.org:443 connection timed out after 3s. "
                 "The current network/VPN path cannot complete a TCP connection to Telegram API");
        return;
    }
    if (res == CURLE_COULDNT_CONNECT) {
        snprintf(out, out_size,
                 "api.telegram.org:443 connection failed: %s",
                 detail ? detail : "connect failed");
        return;
    }
    if (res == CURLE_COULDNT_RESOLVE_HOST) {
        snprintf(out, out_size, "api.telegram.org DNS lookup failed");
        return;
    }

    snprintf(out, out_size, "%s%s%s",
             curl_easy_strerror(res),
             (detail && detail[0] && strcmp(detail, curl_easy_strerror(res)) != 0) ? ": " : "",
             (detail && detail[0] && strcmp(detail, curl_easy_strerror(res)) != 0) ? detail : "");
}

static bool send_telegram(const config &cfg,
                          const char *from, const char *text,
                          const char *time_str)
{
    char url[512];
    snprintf(url, sizeof(url),
             "https://api.telegram.org/bot%s/sendMessage", cfg.bot_token);

    /* Build message text */
    char msg[4096];
    snprintf(msg, sizeof(msg),
             "<b>From:</b> %s\n<b>Time:</b> %s\n\n%s",
             from, time_str, text);

    CURL *curl = curl_easy_init();
    if (!curl) return false;

    char errbuf[CURL_ERROR_SIZE];
    errbuf[0] = '\0';

    char *escaped_msg = curl_easy_escape(curl, msg, 0);
    char *escaped_chat = curl_easy_escape(curl, cfg.chat_id, 0);
    if (!escaped_msg || !escaped_chat) {
        logmsg(LOG_ERR, "Telegram curl escape failed");
        curl_free(escaped_msg);
        curl_free(escaped_chat);
        curl_easy_cleanup(curl);
        return false;
    }

    char postdata[8192];
    snprintf(postdata, sizeof(postdata),
             "chat_id=%s&text=%s&parse_mode=HTML",
             escaped_chat, escaped_msg);

    curl_free(escaped_msg);
    curl_free(escaped_chat);

    curl_easy_setopt(curl, CURLOPT_URL, url);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, postdata);
    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 3L);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 5L);
    curl_easy_setopt(curl, CURLOPT_LOW_SPEED_LIMIT, 1L);
    curl_easy_setopt(curl, CURLOPT_LOW_SPEED_TIME, 3L);
    curl_easy_setopt(curl, CURLOPT_ERRORBUFFER, errbuf);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, curl_discard);
    curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1L);

    CURLcode res = curl_easy_perform(curl);
    long http_code = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_code);
    curl_easy_cleanup(curl);

    if (res != CURLE_OK) {
        char msg[512];
        telegram_curl_error(msg, sizeof(msg), res, errbuf);
        logmsg(LOG_ERR, "Telegram API: %s", msg);
        return false;
    }
    if (http_code != 200) {
        logmsg(LOG_ERR, "Telegram HTTP %ld", http_code);
        return false;
    }

    return true;
}

/* Get chat name from Telegram chat object */
static void chat_display_name(cJSON *chat, char *out, int out_size)
{
    cJSON *title = cJSON_GetObjectItem(chat, "title");
    if (title && cJSON_GetStringValue(title)) {
        snprintf(out, out_size, "%s", cJSON_GetStringValue(title));
        return;
    }
    cJSON *first = cJSON_GetObjectItem(chat, "first_name");
    cJSON *last = cJSON_GetObjectItem(chat, "last_name");
    const char *fn = first ? cJSON_GetStringValue(first) : NULL;
    const char *ln = last ? cJSON_GetStringValue(last) : NULL;
    if (fn && ln)
        snprintf(out, out_size, "%s %s", fn, ln);
    else if (fn)
        snprintf(out, out_size, "%s", fn);
    else
        snprintf(out, out_size, "(unknown)");
}

/* List Telegram chats via getUpdates */
static int list_telegram_chats(const config &cfg)
{
    if (!cfg.bot_token[0]) {
        fprintf(stderr, "[ERR] TELEGRAM_BOT_TOKEN not set\n");
        return 1;
    }

    char url[512];
    snprintf(url, sizeof(url),
             "https://api.telegram.org/bot%s/getUpdates", cfg.bot_token);

    CURL *curl = curl_easy_init();
    if (!curl) return 1;

    curl_buf buf = {NULL, 0};
    curl_easy_setopt(curl, CURLOPT_URL, url);
    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 3L);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 5L);
    curl_easy_setopt(curl, CURLOPT_LOW_SPEED_LIMIT, 1L);
    curl_easy_setopt(curl, CURLOPT_LOW_SPEED_TIME, 3L);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, curl_write_cb);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &buf);
    curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1L);
    CURLcode res = curl_easy_perform(curl);
    long http_code = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_code);
    curl_easy_cleanup(curl);

    if (res != CURLE_OK) {
        char msg[512];
        telegram_curl_error(msg, sizeof(msg), res, NULL);
        fprintf(stderr, "[ERR] Telegram API: %s\n", msg);
        free(buf.data);
        return 1;
    }
    if (http_code != 200) {
        fprintf(stderr, "[ERR] Telegram HTTP %ld\n", http_code);
        free(buf.data);
        return 1;
    }

    cJSON *root = cJSON_Parse(buf.data);
    free(buf.data);
    if (!root) {
        fprintf(stderr, "[ERR] JSON parse failed\n");
        return 1;
    }

    cJSON *result = cJSON_GetObjectItem(root, "result");
    if (!result || !cJSON_IsArray(result)) {
        printf("No updates (send a message to the bot first)\n");
        cJSON_Delete(root);
        return 0;
    }

    /* Collect unique chats */
    struct chat_info { long long id; char name[256]; char type[32]; };
    chat_info chats[64];
    int num_chats = 0;

    int count = cJSON_GetArraySize(result);
    for (int i = 0; i < count; i++) {
        cJSON *upd = cJSON_GetArrayItem(result, i);
        /* Try message.chat, then my_chat_member.chat */
        cJSON *chat = NULL;
        cJSON *msg = cJSON_GetObjectItem(upd, "message");
        if (msg) chat = cJSON_GetObjectItem(msg, "chat");
        if (!chat) {
            msg = cJSON_GetObjectItem(upd, "my_chat_member");
            if (msg) chat = cJSON_GetObjectItem(msg, "chat");
        }
        if (!chat) continue;

        cJSON *cid = cJSON_GetObjectItem(chat, "id");
        if (!cid) continue;
        long long id = (long long)cJSON_GetNumberValue(cid);

        /* Dedup */
        bool dup = false;
        for (int j = 0; j < num_chats; j++) {
            if (chats[j].id == id) { dup = true; break; }
        }
        if (dup || num_chats >= 64) continue;

        chats[num_chats].id = id;
        chat_display_name(chat, chats[num_chats].name,
                          sizeof(chats[num_chats].name));
        cJSON *ctype = cJSON_GetObjectItem(chat, "type");
        snprintf(chats[num_chats].type, sizeof(chats[num_chats].type),
                 "%s", ctype ? cJSON_GetStringValue(ctype) : "?");
        num_chats++;
    }

    cJSON_Delete(root);

    if (num_chats == 0) {
        printf("No chats found (send a message to the bot first)\n");
        return 0;
    }

    printf("Chats (%d):\n", num_chats);
    for (int i = 0; i < num_chats; i++) {
        printf("  %lld  %-12s  %s\n",
               chats[i].id, chats[i].type, chats[i].name);
    }

    return 0;
}

/* --- SMS reading and forwarding --- */

static void read_and_forward(send_fn_t send_fn, const config &cfg)
{
    int last_id = read_last_id();
    bool first_run = (last_id < 0);

    /* Get contact list */
    char *resp = (char *)calloc(1, IPC_RESP_SIZE);
    if (!resp) return;

    if (!ipc_call(send_fn, "GetSMSContactList",
                  "{\"Page\":0,\"ContactNum\":50}", resp, IPC_RESP_SIZE)) {
        free(resp);
        return;
    }

    cJSON *root = cJSON_Parse(resp);
    free(resp);
    if (!root) {
        logmsg(LOG_ERR, "parse GetSMSContactList failed");
        return;
    }

    cJSON *result = cJSON_GetObjectItem(root, "result");
    if (!result) {
        cJSON_Delete(root);
        return;
    }

    cJSON *contacts = cJSON_GetObjectItem(result, "SMSContactList");
    if (!contacts || !cJSON_IsArray(contacts)) {
        cJSON_Delete(root);
        return;
    }

    int count = cJSON_GetArraySize(contacts);
    int current_max_id = 0;
    for (int i = 0; i < count; i++) {
        cJSON *c = cJSON_GetArrayItem(contacts, i);
        cJSON *sid = cJSON_GetObjectItem(c, "SMSId");
        if (sid) {
            int id = (int)cJSON_GetNumberValue(sid);
            if (id > current_max_id) current_max_id = id;
        }
    }

    /* First run: seed from current max — don't forward old messages */
    if (first_run) {
        write_last_id(current_max_id);
        logmsg(LOG_INFO, "first run: seeded last_id=%d", current_max_id);
        cJSON_Delete(root);
        return;
    }

    if (current_max_id == 0 && last_id > 0) {
        logmsg(LOG_INFO, "SMS storage empty: reset last_id from %d to 0", last_id);
        write_last_id(0);
        cJSON_Delete(root);
        return;
    }

    int effective_last_id = last_id;
    if (current_max_id > 0 && current_max_id < last_id) {
        logmsg(LOG_WARNING, "SMS id rollover detected: current max %d < last_id %d",
               current_max_id, last_id);
        effective_last_id = 0;
    }

    int max_id = effective_last_id;

    for (int i = 0; i < count; i++) {
        cJSON *c = cJSON_GetArrayItem(contacts, i);
        cJSON *sid_item = cJSON_GetObjectItem(c, "SMSId");
        if (!sid_item) continue;

        int top_sid = (int)cJSON_GetNumberValue(sid_item);
        if (top_sid <= effective_last_id) continue;

        /* This contact has new messages */
        cJSON *phone_item = cJSON_GetObjectItem(c, "PhoneNumber");
        cJSON *cid_item = cJSON_GetObjectItem(c, "ContactId");
        if (!phone_item || !cid_item) continue;

        const char *phone = NULL;
        if (cJSON_IsString(phone_item)) {
            phone = cJSON_GetStringValue(phone_item);
        } else if (cJSON_IsArray(phone_item) && cJSON_GetArraySize(phone_item) > 0) {
            phone = cJSON_GetStringValue(cJSON_GetArrayItem(phone_item, 0));
        }
        if (!phone) continue;

        int contact_id = (int)cJSON_GetNumberValue(cid_item);

        /* Get messages for this contact */
        char params[256];
        snprintf(params, sizeof(params),
                 "{\"ContactId\":%d,\"Page\":0,\"PhoneNumber\":\"%s\"}",
                 contact_id, phone);

        char *msg_resp = (char *)calloc(1, IPC_RESP_SIZE);
        if (!msg_resp) continue;

        if (!ipc_call(send_fn, "GetSMSContentList", params,
                      msg_resp, IPC_RESP_SIZE)) {
            free(msg_resp);
            continue;
        }

        cJSON *msg_root = cJSON_Parse(msg_resp);
        free(msg_resp);
        if (!msg_root) continue;

        cJSON *msg_result = cJSON_GetObjectItem(msg_root, "result");
        if (!msg_result) { cJSON_Delete(msg_root); continue; }

        cJSON *msg_list = cJSON_GetObjectItem(msg_result, "SMSContentList");
        if (!msg_list || !cJSON_IsArray(msg_list)) {
            cJSON_Delete(msg_root);
            continue;
        }

        int msg_count = cJSON_GetArraySize(msg_list);
        for (int j = 0; j < msg_count; j++) {
            cJSON *m = cJSON_GetArrayItem(msg_list, j);

            /* SMSType: 0=received, 2=sent */
            cJSON *stype = cJSON_GetObjectItem(m, "SMSType");
            if (!stype || (int)cJSON_GetNumberValue(stype) != 0)
                continue;

            cJSON *msid = cJSON_GetObjectItem(m, "SMSId");
            if (!msid) continue;
            int mid = (int)cJSON_GetNumberValue(msid);
            if (mid <= effective_last_id) continue;
            if (mid > max_id) max_id = mid;

            /* Filter by number */
            if (!number_matches_filter(phone, cfg.filter_numbers))
                continue;

            cJSON *content = cJSON_GetObjectItem(m, "SMSContent");
            cJSON *stime = cJSON_GetObjectItem(m, "SMSTime");

            const char *body = content ? cJSON_GetStringValue(content) : "";
            const char *time_str = stime ? cJSON_GetStringValue(stime) : "";

            if (send_telegram(cfg, phone, body ? body : "", time_str ? time_str : ""))
                logmsg(LOG_INFO, "forwarded SMS #%d from %s", mid, phone);
            else
                logmsg(LOG_ERR, "Telegram failed for SMS #%d from %s", mid, phone);

        }
        cJSON_Delete(msg_root);
    }

    cJSON_Delete(root);

    if (max_id != last_id)
        write_last_id(max_id);
}

/* --- Check mode --- */

static int run_checks(const config &cfg, init_fn_t init_fn, send_fn_t send_fn)
{
    int errors = 0;

    printf("Config: %s\n", CONF_PATH);
    printf("  telegram_enabled = %s\n", cfg.telegram_enabled ? "yes" : "no");
    printf("  bot_token        = %s\n", cfg.bot_token[0] ? "(set)" : "(empty)");
    printf("  chat_id          = %s\n", cfg.chat_id[0] ? cfg.chat_id : "(empty)");
    printf("  filter_numbers   = %s\n",
           cfg.filter_numbers[0] ? cfg.filter_numbers : "(none)");
    printf("  poll_interval    = %d\n", cfg.poll_interval);

    /* Test IPC connection */
    printf("\nIPC connection... ");
    fflush(stdout);

    alarm(10);
    int ret = init_fn(SOCKET_PATH);
    alarm(0);

    if (ret != 0) {
        printf("FAIL (ret=%d)\n", ret);
        errors++;
    } else {
        printf("OK\n");

        /* Test GetNewSMSFlag */
        printf("GetNewSMSFlag... ");
        fflush(stdout);
        char resp[2048] = {};
        if (ipc_call(send_fn, "GetNewSMSFlag", "{}", resp, sizeof(resp))) {
            printf("OK: %s\n", resp);
        } else {
            printf("FAIL\n");
            errors++;
        }
    }

    /* Test Telegram */
    if (cfg.telegram_enabled && cfg.bot_token[0] && cfg.chat_id[0]) {
        printf("Telegram test... ");
        fflush(stdout);
        if (send_telegram(cfg, "sms_forward", "check mode test", "now"))
            printf("OK\n");
        else {
            printf("FAIL\n");
            errors++;
        }
    } else {
        printf("Telegram: skipped (not configured)\n");
    }

    printf("\nResult: %d error(s)\n", errors);
    return errors ? 1 : 0;
}

/* --- Usage --- */

static void usage(const char *prog)
{
    fprintf(stderr,
        "Usage: %s [-f] [-c] [-t] [-l] [-h]\n"
        "  -f  foreground (don't daemonize, log to stderr)\n"
        "  -c  check config and test connectivity\n"
        "  -t  send test message to Telegram\n"
        "  -l  list Telegram chats (from recent bot updates)\n"
        "  -h  show this help\n", prog);
}

/* --- Main --- */

int main(int argc, char *argv[])
{
    int opt;
    int check_mode = 0;
    int test_mode = 0;
    int list_mode = 0;

    while ((opt = getopt(argc, argv, "fctlh")) != -1) {
        switch (opt) {
        case 'f': g_foreground = 1; break;
        case 'c': check_mode = 1; g_foreground = 1; break;
        case 't': test_mode = 1; g_foreground = 1; break;
        case 'l': list_mode = 1; g_foreground = 1; break;
        case 'h':
        default:
            usage(argv[0]);
            return (opt == 'h') ? 0 : 1;
        }
    }

    openlog(LOG_TAG, LOG_PID, LOG_DAEMON);

    /* Load config */
    config cfg;
    load_config(cfg);

    curl_global_init(CURL_GLOBAL_DEFAULT);

    /* List Telegram chats — no IPC needed */
    if (list_mode) {
        int ret = list_telegram_chats(cfg);
        curl_global_cleanup();
        return ret;
    }

    /* Test message — no IPC needed */
    if (test_mode) {
        if (!cfg.telegram_enabled || !cfg.bot_token[0] || !cfg.chat_id[0]) {
            fprintf(stderr, "[ERR] Telegram not configured\n");
            curl_global_cleanup();
            return 1;
        }
        printf("Sending test message to chat %s... ", cfg.chat_id);
        fflush(stdout);
        if (send_telegram(cfg, "sms_forward", "Test message", "now")) {
            printf("OK\n");
            curl_global_cleanup();
            return 0;
        } else {
            printf("FAIL\n");
            curl_global_cleanup();
            return 1;
        }
    }

    /* Load libsock_client.so.0 */
    void *lib = dlopen("libsock_client.so.0", RTLD_NOW);
    if (!lib) {
        fprintf(stderr, "[ERR] Cannot load libsock_client.so.0: %s\n", dlerror());
        return 1;
    }

    init_fn_t init_fn = (init_fn_t)dlsym(lib, "jrd_init_app_client");
    send_fn_t send_fn = (send_fn_t)dlsym(lib, "client_send_sync_msg");
    if (!init_fn || !send_fn) {
        fprintf(stderr, "[ERR] Cannot resolve libsock_client symbols\n");
        dlclose(lib);
        return 1;
    }

    /* Check mode */
    if (check_mode) {
        int ret = run_checks(cfg, init_fn, send_fn);
        curl_global_cleanup();
        dlclose(lib);
        return ret;
    }

    /* Daemonize */
    if (!g_foreground)
        daemonize();

    if (write_pidfile() < 0) {
        dlclose(lib);
        return 1;
    }

    /* Signals */
    signal(SIGTERM, handle_term);
    signal(SIGINT, handle_term);
    signal(SIGHUP, handle_hup);
    signal(SIGPIPE, SIG_IGN);
    signal(SIGALRM, handle_alarm);

    /* Connect to core_app */
    logmsg(LOG_INFO, "starting (poll=%ds)", cfg.poll_interval);

    alarm(10);
    int ret = init_fn(SOCKET_PATH);
    alarm(0);

    if (ret != 0) {
        logmsg(LOG_ERR, "IPC init failed (ret=%d)", ret);
        unlink(PID_PATH);
        dlclose(lib);
        return 1;
    }
    logmsg(LOG_INFO, "connected to core_app");

    /* Seed lastid on startup if not yet initialized */
    if (read_last_id() < 0) {
        logmsg(LOG_INFO, "first run: seeding last SMS id");
        read_and_forward(send_fn, cfg);
    }

    /* Main loop — poll contact list directly (newSMSFlag unreliable via IPC) */
    while (g_running) {
        if (g_reload) {
            logmsg(LOG_INFO, "reloading config");
            load_config(cfg);
            g_reload = 0;
        }

        if (cfg.telegram_enabled && cfg.bot_token[0] && cfg.chat_id[0]) {
            read_and_forward(send_fn, cfg);
        }

        /* Interruptible sleep */
        for (int i = 0; i < cfg.poll_interval && g_running; i++)
            sleep(1);
    }

    /* Cleanup */
    logmsg(LOG_INFO, "shutting down");
    curl_global_cleanup();
    dlclose(lib);
    unlink(PID_PATH);
    closelog();

    return 0;
}
