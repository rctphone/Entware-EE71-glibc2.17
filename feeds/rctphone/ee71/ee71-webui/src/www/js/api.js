/**
 * api.js — EE71 Web API client
 *
 * Handles:
 * - Stock webapi JSON-RPC calls (POST /jrd/webapi)
 * - Custom CGI calls (GET/POST /cgi-bin/*.cgi)
 * - Full login flow (XOR + PBKDF2 + AES via Web Crypto API)
 * - Session heartbeat
 * - Auth redirect detection
 *
 * No external dependencies — Web Crypto API only.
 */

const API = (() => {
    'use strict';

    // --- Constants (from stock build.js) ---
    const XOR_KEY = 'e5dl12XYVggihggafXWf0f2YSf2Xngd1';
    const VERIFICATION_KEY = 'KSDHSDFOGQ5WERYTUIQWERTYUISDFG1HJZXCVCXBN2GDSMNDHKVKFsVBNf';
    const COOKIE_PREFIX = '1D4B9765B16C3A64AD97489B1610498B';
    const PBKDF2_ITERATIONS = 1024;
    const PBKDF2_DKLEN = 64; // bytes → 128 hex chars
    const HEARTBEAT_MS = 6000; // 6 seconds (matches stock UI)

    // --- Session state (in-memory only, never in localStorage) ---
    let _verificationToken = '';
    let _heartbeatTimer = null;

    // --- Client-side inactivity timeout ---
    const INACTIVITY_MS = 3600000; // 60 minutes (stock was 5 min — too aggressive)
    let _inactivityTimer = null;
    let _heartbeatInFlight = false;

    // --- API error class ---

    const CORE_API_ERRORS = {
        '021001': 'Erase SIM lock failed.',
        '040101': 'Get network information data error.',
        '040201': 'Search network failed.',
        '040301': 'Get result failed.',
        '040401': 'Register network fail.',
        '040501': 'Get register network state failed.',
        '040601': 'Get network setting failed.',
        '040701': 'Set network setting failed.',
        '040702': 'Just can set when disconnected.',
        '040801': 'Get NetworkModeListType failed.',
        '040901': 'Get DomRoamGuardForced failed.',
        '050101': 'Get WLAN state failed.',
        '050201': 'Set WLAN off failed.',
        '050202': 'WLAN is off.',
        '050301': 'Set WLAN on failed.',
        '050302': 'WLAN is on.',
        '050401': 'Get WLAN settings failed.',
        '050501': 'Set WLAN settings failed.',
        '050601': 'Set WPS pin mode failed.',
        '050602': 'Set WPS pin code failed, the security mode not support.',
        '050603': 'Set WPS pin fail, WPS is active.',
        '050701': 'Set WPS PBC failed.',
        '050702': 'Set WPS PBC failed, the security mode not support.',
        '050703': 'Set WPS PBC failed, WPS is active.',
        '051901': 'Import SMS to device failed.',
        '060101': 'Get SMS init status failed.',
        '060201': 'Get SMS contact list failed.',
        '060301': 'Get SMS content list failed.',
        '060401': 'Get SMS storage state failed.',
        '060501': 'Delete SMS failed.',
        '060601': 'Send SMS failed.',
        '060602': 'Fail still sending last message.',
        '060603': 'Fail with store space full.',
        '060701': 'Get send SMS status failed.',
        '060801': 'Save SMS failed.',
        '061001': 'Set SMS settings failed.',
        '061101': 'Get single SMS failed.',
        '061301': 'Get SMS list by contact number failed.',
        '070101': 'Get usage record failed.',
        '070201': 'Clear all usage records failed.',
        '070301': 'Get usage settings failed.',
        '070401': 'Set usage settings failed.',
        '090501': 'Set check device new version failed.',
        '101901': 'Get URL filter settings failed.',
        '102001': 'Set URL filter settings failed.',
        '110201': 'Set LAN settings failed.',
        '132401': 'Send ping failed.',
        '132402': 'Ping operation fails.',
        '140101': 'Get DLNA settings failed.',
        '140201': 'Set DLNA settings failed.',
        '140301': 'Get samba status failed.',
        '140401': 'Set samba status failed.',
        '140501': 'Get FTP status failed.',
        '140601': 'Set FTP status failed.',
        '140701': 'Get sdshare space failed.',
        '140801': 'Get sdshare filelist failed.',
        '140901': 'Get sdcard status failed.',
        '141001': 'Get usbcard status failed.',
        '141101': 'Set usbcard status failed.',
        '150101': 'Get profile list failed.',
        '150201': 'Add new profile failed.',
        '150301': 'Edit profile failed.',
        '150302': 'Profile is not exist.',
        '150401': 'Delete profile failed.',
        '150402': 'Profile is not exist.',
        '150501': 'Set default profile failed.',
        '160101': 'Get battery state failed.',
        '160201': 'Get power saving mode failed.',
        '160301': 'Set power saving mode failed.'
    };

    function normalizeApiMessage(code, message, method) {
        let raw = String(message || '').trim();
        if (method && raw.indexOf(method + ':') === 0) {
            raw = raw.slice(method.length + 1).trim();
        }
        const mapped = CORE_API_ERRORS[String(code || '')];
        if (!mapped) return raw || 'Unknown API error';
        if (!raw || raw === 'Unknown API error' || raw === String(code) || raw === mapped) {
            return mapped + ' (' + code + ')';
        }
        if (raw.indexOf(mapped) !== -1) {
            return raw.indexOf('(' + code + ')') === -1 ? raw + ' (' + code + ')' : raw;
        }
        return mapped + ' (' + code + '): ' + raw;
    }

    class ApiError extends Error {
        constructor(code, message, method) {
            super(method ? method + ': ' + message : message);
            this.name = 'ApiError';
            this.code = code;
            this.apiMessage = message;
            this.method = method || '';
        }
    }

    // --- XOR obfuscation (exact match of stock encrypt()) ---

    function xorEncrypt(text) {
        const result = [];
        for (let i = 0; i < text.length; i++) {
            const k = XOR_KEY.charCodeAt(i % XOR_KEY.length);
            const c = text.charCodeAt(i);
            result.push((0xF0 & k) | ((0x0F & c) ^ (0x0F & k)));
            result.push((0xF0 & k) | ((c >> 4) ^ (0x0F & k)));
        }
        return String.fromCharCode(...result);
    }

    // --- Crypto helpers ---
    // Pure JS fallback for HTTP (crypto.subtle requires HTTPS)

    function hexEncode(buf) {
        return Array.from(new Uint8Array(buf))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    const _hasSubtle = typeof crypto !== 'undefined' && crypto.subtle;

    // --- SHA-512 (pure JS) ---
    const _sha512K = [
        0x428a2f98,0xd728ae22, 0x71374491,0x23ef65cd, 0xb5c0fbcf,0xec4d3b2f, 0xe9b5dba5,0x8189dbbc,
        0x3956c25b,0xf348b538, 0x59f111f1,0xb605d019, 0x923f82a4,0xaf194f9b, 0xab1c5ed5,0xda6d8118,
        0xd807aa98,0xa3030242, 0x12835b01,0x45706fbe, 0x243185be,0x4ee4b28c, 0x550c7dc3,0xd5ffb4e2,
        0x72be5d74,0xf27b896f, 0x80deb1fe,0x3b1696b1, 0x9bdc06a7,0x25c71235, 0xc19bf174,0xcf692694,
        0xe49b69c1,0x9ef14ad2, 0xefbe4786,0x384f25e3, 0x0fc19dc6,0x8b8cd5b5, 0x240ca1cc,0x77ac9c65,
        0x2de92c6f,0x592b0275, 0x4a7484aa,0x6ea6e483, 0x5cb0a9dc,0xbd41fbd4, 0x76f988da,0x831153b5,
        0x983e5152,0xee66dfab, 0xa831c66d,0x2db43210, 0xb00327c8,0x98fb213f, 0xbf597fc7,0xbeef0ee4,
        0xc6e00bf3,0x3da88fc2, 0xd5a79147,0x930aa725, 0x06ca6351,0xe003826f, 0x14292967,0x0a0e6e70,
        0x27b70a85,0x46d22ffc, 0x2e1b2138,0x5c26c926, 0x4d2c6dfc,0x5ac42aed, 0x53380d13,0x9d95b3df,
        0x650a7354,0x8baf63de, 0x766a0abb,0x3c77b2a8, 0x81c2c92e,0x47edaee6, 0x92722c85,0x1482353b,
        0xa2bfe8a1,0x4cf10364, 0xa81a664b,0xbc423001, 0xc24b8b70,0xd0f89791, 0xc76c51a3,0x0654be30,
        0xd192e819,0xd6ef5218, 0xd6990624,0x5565a910, 0xf40e3585,0x5771202a, 0x106aa070,0x32bbd1b8,
        0x19a4c116,0xb8d2d0c8, 0x1e376c08,0x5141ab53, 0x2748774c,0xdf8eeb99, 0x34b0bcb5,0xe19b48a8,
        0x391c0cb3,0xc5c95a63, 0x4ed8aa4a,0xe3418acb, 0x5b9cca4f,0x7763e373, 0x682e6ff3,0xd6b2b8a3,
        0x748f82ee,0x5defb2fc, 0x78a5636f,0x43172f60, 0x84c87814,0xa1f0ab72, 0x8cc70208,0x1a6439ec,
        0x90befffa,0x23631e28, 0xa4506ceb,0xde82bde9, 0xbef9a3f7,0xb2c67915, 0xc67178f2,0xe372532b,
        0xca273ece,0xea26619c, 0xd186b8c7,0x21c0c207, 0xeada7dd6,0xcde0eb1e, 0xf57d4f7f,0xee6ed178,
        0x06f067aa,0x72176fba, 0x0a637dc5,0xa2c898a6, 0x113f9804,0xbef90dae, 0x1b710b35,0x131c471b,
        0x28db77f5,0x23047d84, 0x32caab7b,0x40c72493, 0x3c9ebe0a,0x15c9bebc, 0x431d67c4,0x9c100d4c,
        0x4cc5d4be,0xcb3e42b6, 0x597f299c,0xfc657e2a, 0x5fcb6fab,0x3ad6faec, 0x6c44198c,0x4a475817
    ];

    function _sha512(msgBytes) {
        // Pre-processing
        var len = msgBytes.length;
        var bitLen = len * 8;
        // Append bit '1', pad to 896 mod 1024, append 128-bit length
        var padLen = (128 - ((len + 17) % 128)) % 128;
        var buf = new Uint8Array(len + 1 + padLen + 16);
        buf.set(msgBytes);
        buf[len] = 0x80;
        // Length in bits as 128-bit big-endian (we only use lower 53 bits)
        var dv = new DataView(buf.buffer);
        dv.setUint32(buf.length - 4, bitLen >>> 0);
        dv.setUint32(buf.length - 8, (bitLen / 0x100000000) >>> 0);

        // Initial hash values
        var H = [0x6a09e667,0xf3bcc908, 0xbb67ae85,0x84caa73b, 0x3c6ef372,0xfe94f82b, 0xa54ff53a,0x5f1d36f1,
                  0x510e527f,0xade682d1, 0x9b05688c,0x2b3e6c1f, 0x1f83d9ab,0xfb41bd6b, 0x5be0cd19,0x137e2179];

        var W = new Array(160); // 80 * 2
        for (var off = 0; off < buf.length; off += 128) {
            // Prepare message schedule
            for (var t = 0; t < 32; t++) W[t] = dv.getUint32(off + t * 4);
            for (var t = 32; t < 160; t += 2) {
                // sigma1(W[t-2]) — >>> 0 converts signed bitwise results to unsigned
                var xh = W[t-4], xl = W[t-3];
                var s1h = (((xh>>>19)|(xl<<13)) ^ ((xl>>>29)|(xh<<3)) ^ (xh>>>6)) >>> 0;
                var s1l = (((xl>>>19)|(xh<<13)) ^ ((xh>>>29)|(xl<<3)) ^ ((xl>>>6)|(xh<<26))) >>> 0;
                // sigma0(W[t-15])
                xh = W[t-30]; xl = W[t-29];
                var s0h = (((xh>>>1)|(xl<<31)) ^ ((xh>>>8)|(xl<<24)) ^ (xh>>>7)) >>> 0;
                var s0l = (((xl>>>1)|(xh<<31)) ^ ((xl>>>8)|(xh<<24)) ^ ((xl>>>7)|(xh<<25))) >>> 0;
                // W[t] = sigma1(W[t-2]) + W[t-7] + sigma0(W[t-15]) + W[t-16]
                var lo = (s1l + W[t-13]) >>> 0; var hi = (s1h + W[t-14] + (lo < s1l ? 1 : 0)) >>> 0;
                lo = (lo + s0l) >>> 0; hi = (hi + s0h + (lo < s0l ? 1 : 0)) >>> 0;
                lo = (lo + W[t-31]) >>> 0; hi = (hi + W[t-32] + (lo < W[t-31] ? 1 : 0)) >>> 0;
                W[t] = hi; W[t+1] = lo;
            }

            var ah=H[0],al=H[1],bh=H[2],bl=H[3],ch=H[4],cl=H[5],dh=H[6],dl=H[7],
                eh=H[8],el=H[9],fh=H[10],fl=H[11],gh=H[12],gl=H[13],hh=H[14],hl=H[15];

            for (var t = 0; t < 80; t++) {
                // Sigma1(e) — >>> 0 for unsigned carry checks
                var S1h = (((eh>>>14)|(el<<18)) ^ ((eh>>>18)|(el<<14)) ^ ((el>>>9)|(eh<<23))) >>> 0;
                var S1l = (((el>>>14)|(eh<<18)) ^ ((el>>>18)|(eh<<14)) ^ ((eh>>>9)|(el<<23))) >>> 0;
                // Ch(e,f,g)
                var Chh = ((eh & fh) ^ (~eh & gh)) >>> 0, Chl = ((el & fl) ^ (~el & gl)) >>> 0;
                // temp1 = h + Sigma1(e) + Ch(e,f,g) + K[t] + W[t]
                var tlo = (hl + S1l) >>> 0; var thi = (hh + S1h + (tlo < hl ? 1 : 0)) >>> 0;
                tlo = (tlo + Chl) >>> 0; thi = (thi + Chh + (tlo < Chl ? 1 : 0)) >>> 0;
                tlo = (tlo + _sha512K[t*2+1]) >>> 0; thi = (thi + _sha512K[t*2] + (tlo < _sha512K[t*2+1] ? 1 : 0)) >>> 0;
                tlo = (tlo + W[t*2+1]) >>> 0; thi = (thi + W[t*2] + (tlo < W[t*2+1] ? 1 : 0)) >>> 0;
                // Sigma0(a)
                var S0h = (((ah>>>28)|(al<<4)) ^ ((al>>>2)|(ah<<30)) ^ ((al>>>7)|(ah<<25))) >>> 0;
                var S0l = (((al>>>28)|(ah<<4)) ^ ((ah>>>2)|(al<<30)) ^ ((ah>>>7)|(al<<25))) >>> 0;
                // Maj(a,b,c)
                var Mjh = ((ah & bh) ^ (ah & ch) ^ (bh & ch)) >>> 0, Mjl = ((al & bl) ^ (al & cl) ^ (bl & cl)) >>> 0;
                // temp2 = Sigma0(a) + Maj(a,b,c)
                var t2l = (S0l + Mjl) >>> 0; var t2h = (S0h + Mjh + (t2l < S0l ? 1 : 0)) >>> 0;

                hh=gh; hl=gl; gh=fh; gl=fl; fh=eh; fl=el;
                el = (dl + tlo) >>> 0; eh = (dh + thi + (el < dl ? 1 : 0)) >>> 0;
                dh=ch; dl=cl; ch=bh; cl=bl; bh=ah; bl=al;
                al = (tlo + t2l) >>> 0; ah = (thi + t2h + (al < tlo ? 1 : 0)) >>> 0;
            }

            var addl;
            addl=(H[1]+al)>>>0;  H[0]=(H[0]+ah+(addl<H[1]?1:0))>>>0; H[1]=addl;
            addl=(H[3]+bl)>>>0;  H[2]=(H[2]+bh+(addl<H[3]?1:0))>>>0; H[3]=addl;
            addl=(H[5]+cl)>>>0;  H[4]=(H[4]+ch+(addl<H[5]?1:0))>>>0; H[5]=addl;
            addl=(H[7]+dl)>>>0;  H[6]=(H[6]+dh+(addl<H[7]?1:0))>>>0; H[7]=addl;
            addl=(H[9]+el)>>>0;  H[8]=(H[8]+eh+(addl<H[9]?1:0))>>>0; H[9]=addl;
            addl=(H[11]+fl)>>>0; H[10]=(H[10]+fh+(addl<H[11]?1:0))>>>0; H[11]=addl;
            addl=(H[13]+gl)>>>0; H[12]=(H[12]+gh+(addl<H[13]?1:0))>>>0; H[13]=addl;
            addl=(H[15]+hl)>>>0; H[14]=(H[14]+hh+(addl<H[15]?1:0))>>>0; H[15]=addl;
        }

        var out = new Uint8Array(64);
        var odv = new DataView(out.buffer);
        for (var i = 0; i < 16; i++) odv.setUint32(i * 4, H[i]);
        return out;
    }

    function _hmacSha512(keyBytes, msgBytes) {
        var bk = keyBytes.length > 128 ? _sha512(keyBytes) : keyBytes;
        var ipad = new Uint8Array(128 + msgBytes.length);
        var opad = new Uint8Array(128 + 64);
        for (var i = 0; i < 128; i++) {
            var k = i < bk.length ? bk[i] : 0;
            ipad[i] = k ^ 0x36;
            opad[i] = k ^ 0x5c;
        }
        ipad.set(msgBytes, 128);
        var inner = _sha512(ipad);
        opad.set(inner, 128);
        return _sha512(opad);
    }

    function _pbkdf2Sha512Sw(password, salt, iterations, dkLen) {
        var enc = new TextEncoder();
        var pwBytes = enc.encode(password);
        var saltBytes = enc.encode(salt);
        var numBlocks = Math.ceil(dkLen / 64);
        var dk = new Uint8Array(numBlocks * 64);
        for (var block = 1; block <= numBlocks; block++) {
            var sbi = new Uint8Array(saltBytes.length + 4);
            sbi.set(saltBytes);
            sbi[saltBytes.length] = (block >>> 24) & 0xff;
            sbi[saltBytes.length + 1] = (block >>> 16) & 0xff;
            sbi[saltBytes.length + 2] = (block >>> 8) & 0xff;
            sbi[saltBytes.length + 3] = block & 0xff;
            var U = _hmacSha512(pwBytes, sbi);
            var T = new Uint8Array(U);
            for (var i = 1; i < iterations; i++) {
                U = _hmacSha512(pwBytes, U);
                for (var j = 0; j < 64; j++) T[j] ^= U[j];
            }
            dk.set(T, (block - 1) * 64);
        }
        return dk.slice(0, dkLen);
    }

    // --- AES-128-CBC (pure JS) ---
    var _aes_sbox = [
        0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
        0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
        0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
        0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
        0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
        0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
        0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
        0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
        0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
        0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
        0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
        0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
        0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
        0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
        0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
        0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16
    ];
    var _aes_rcon = [0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36];

    function _aesExpandKey(key) {
        var w = new Uint8Array(176); // 11 round keys * 16 bytes
        w.set(key);
        for (var i = 16; i < 176; i += 4) {
            var t0=w[i-4],t1=w[i-3],t2=w[i-2],t3=w[i-1];
            if (i % 16 === 0) {
                var tmp=t0; t0=_aes_sbox[t1]; t1=_aes_sbox[t2]; t2=_aes_sbox[t3]; t3=_aes_sbox[tmp];
                t0 ^= _aes_rcon[(i/16)-1];
            }
            w[i]=w[i-16]^t0; w[i+1]=w[i-15]^t1; w[i+2]=w[i-14]^t2; w[i+3]=w[i-13]^t3;
        }
        return w;
    }

    function _xtime(a) { return ((a<<1)^(a&0x80?0x1b:0))&0xff; }

    function _aesEncryptBlock(state, rk) {
        var s = new Uint8Array(state);
        for (var i=0;i<16;i++) s[i]^=rk[i];
        for (var r=1;r<=10;r++) {
            // SubBytes
            for (var i=0;i<16;i++) s[i]=_aes_sbox[s[i]];
            // ShiftRows
            var t;
            t=s[1];s[1]=s[5];s[5]=s[9];s[9]=s[13];s[13]=t;
            t=s[2];s[2]=s[10];s[10]=t;t=s[6];s[6]=s[14];s[14]=t;
            t=s[15];s[15]=s[11];s[11]=s[7];s[7]=s[3];s[3]=t;
            // MixColumns (skip on last round)
            if (r<10) {
                for (var c=0;c<16;c+=4) {
                    var a=s[c],b=s[c+1],d=s[c+2],e=s[c+3];
                    s[c]=_xtime(a)^_xtime(b)^b^d^e;
                    s[c+1]=a^_xtime(b)^_xtime(d)^d^e;
                    s[c+2]=a^b^_xtime(d)^_xtime(e)^e;
                    s[c+3]=_xtime(a)^a^b^d^_xtime(e);
                }
            }
            // AddRoundKey
            for (var i=0;i<16;i++) s[i]^=rk[r*16+i];
        }
        return s;
    }

    function _aesCbcEncryptSw(data, keyBytes, ivBytes) {
        var rk = _aesExpandKey(keyBytes);
        var prev = new Uint8Array(ivBytes);
        var out = new Uint8Array(data.length);
        for (var off = 0; off < data.length; off += 16) {
            var block = new Uint8Array(16);
            for (var i = 0; i < 16; i++) block[i] = data[off + i] ^ prev[i];
            prev = _aesEncryptBlock(block, rk);
            out.set(prev, off);
        }
        return out;
    }

    // --- Unified crypto API (native or fallback) ---

    async function pbkdf2Sha512(password, salt) {
        if (_hasSubtle) {
            var enc = new TextEncoder();
            var keyMaterial = await crypto.subtle.importKey(
                'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
            );
            var bits = await crypto.subtle.deriveBits(
                { name: 'PBKDF2', salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-512' },
                keyMaterial, PBKDF2_DKLEN * 8
            );
            return hexEncode(bits);
        }
        return hexEncode(_pbkdf2Sha512Sw(password, salt, PBKDF2_ITERATIONS, PBKDF2_DKLEN));
    }

    async function aes128CbcEncrypt(plaintext, key16, iv16) {
        var enc = new TextEncoder();
        var data = enc.encode(plaintext);

        if (_hasSubtle) {
            // crypto.subtle.encrypt handles PKCS7 padding internally
            var cryptoKey = await crypto.subtle.importKey(
                'raw', enc.encode(key16), { name: 'AES-CBC' }, false, ['encrypt']
            );
            var encrypted = await crypto.subtle.encrypt(
                { name: 'AES-CBC', iv: enc.encode(iv16) }, cryptoKey, data
            );
            return btoa(String.fromCharCode.apply(null, new Uint8Array(encrypted)));
        }
        // Software path: manual PKCS7 padding
        var padLen = 16 - (data.length % 16);
        var padded = new Uint8Array(data.length + padLen);
        padded.set(data);
        padded.fill(padLen, data.length);
        var encrypted = _aesCbcEncryptSw(padded, enc.encode(key16), enc.encode(iv16));
        return btoa(String.fromCharCode.apply(null, encrypted));
    }

    // encrypt_c: XOR-obfuscate token, then AES-128-CBC, then base64
    async function encryptToken(token, key16, iv16) {
        const obfuscated = xorEncrypt(token);
        return aes128CbcEncrypt(obfuscated, key16, iv16);
    }

    // --- Cookie helpers ---

    function setCookie(value) {
        document.cookie = 't=' + value + '; path=/';
    }

    function clearCookie() {
        document.cookie = 't=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }

    function getCookie() {
        const m = document.cookie.match(/(?:^|;\s*)t=([^;]*)/);
        return m ? m[1] : '';
    }

    // Read current token from cookie (server rotates it via Set-Cookie after each request)
    function _currentToken() {
        const cookie = getCookie();
        if (cookie && cookie.length > COOKIE_PREFIX.length) {
            return cookie.slice(COOKIE_PREFIX.length);
        }
        return _verificationToken; // Fallback to in-memory token (e.g. right after login)
    }

    // --- API error codes ---
    const ERR_SESSION_EXPIRED = ['010101', '-32699', '-32698', '010104'];
    const ERR_LOGIN_LOCKED = '010103';

    // --- Request queues ---
    // Webapi calls are serialized (max 1) because the server rotates the
    // verification token via Set-Cookie after each response. Concurrent
    // webapi requests would all send the same token — the server invalidates
    // it after the first response, causing session errors on the rest.
    // CGI calls don't use tokens, so they can run concurrently (max 3).
    let _webapiInflight = 0;
    const _webapiPending = [];

    let _cgiInflight = 0;
    const _CGI_MAX = 3;
    const _cgiPending = [];

    function _webapiThrottled(fn) {
        return new Promise((resolve, reject) => {
            function run() {
                _webapiInflight++;
                fn().then(
                    (v) => { _webapiInflight--; drain(); resolve(v); },
                    (e) => { _webapiInflight--; drain(); reject(e); }
                );
            }
            function drain() {
                if (_webapiPending.length > 0 && _webapiInflight < 1) {
                    _webapiPending.shift()();
                }
            }
            if (_webapiInflight < 1) {
                run();
            } else {
                _webapiPending.push(run);
            }
        });
    }

    function _cgiThrottled(fn) {
        return new Promise((resolve, reject) => {
            function run() {
                _cgiInflight++;
                fn().then(
                    (v) => { _cgiInflight--; drain(); resolve(v); },
                    (e) => { _cgiInflight--; drain(); reject(e); }
                );
            }
            function drain() {
                while (_cgiPending.length > 0 && _cgiInflight < _CGI_MAX) {
                    _cgiPending.shift()();
                }
            }
            if (_cgiInflight < _CGI_MAX) {
                run();
            } else {
                _cgiPending.push(run);
            }
        });
    }

    // --- Webapi JSON-RPC ---

    function webapi(method, params) {
        return _webapiThrottled(async () => {
            const body = JSON.stringify({
                id: '1',
                jsonrpc: '2.0',
                method: method,
                params: params || {}
            });

            const headers = {
                'Content-Type': 'application/json',
                'Referer': location.origin + '/index.html',
                '_TclRequestVerificationKey': VERIFICATION_KEY
            };
            // Read token from cookie before each request (server rotates via Set-Cookie)
            const token = _currentToken();
            if (token) {
                headers['_TclRequestVerificationToken'] = token;
            }

            const resp = await fetch('/jrd/webapi', {
                method: 'POST',
                headers: headers,
                body: body
            });
            const data = await resp.json();

            if (data.error) {
                const code = String(data.error.code || '');
                const message = normalizeApiMessage(code, data.error.message, method);

                // Session expiration is handled centrally by the heartbeat —
                // never auto-expire here (avoids race conditions with concurrent requests)
                if (code === ERR_LOGIN_LOCKED) {
                    throw new ApiError(code, 'Login locked — too many attempts, wait 5 minutes', method);
                }
                throw new ApiError(code, message, method);
            }

            return data.result !== undefined ? data.result : data;
        });
    }

    // --- CGI fetch wrapper ---

    function cgiGet(path, params) {
        return _cgiThrottled(async () => {
            let url = '/cgi-bin/' + path;
            if (params) {
                const qs = new URLSearchParams(params).toString();
                url += '?' + qs;
            }

            const resp = await fetch(url, { redirect: 'manual' });

            // Detect GoAhead auth redirect (302 -> /index.html). Do not reload here:
            // status bar and page background polling catch CGI failures and should not
            // tear down a still-valid stock /jrd/webapi session.
            const ct = resp.headers.get('Content-Type') || '';
            if (resp.status === 0 || resp.type === 'opaqueredirect' ||
                (resp.status >= 300 && resp.status < 400) || ct.includes('text/html')) {
                throw new ApiError('CGI_AUTH_REDIRECT', 'CGI authentication required', path);
            }

            return resp.json();
        });
    }

    function cgiPost(path, data) {
        return _cgiThrottled(async () => {
            const resp = await fetch('/cgi-bin/' + path, {
                method: 'POST',
                redirect: 'manual',
                headers: {
                    'Content-Type': 'application/json',
                    'X-EE71-Request': '1'
                },
                body: JSON.stringify(data)
            });

            const ct = resp.headers.get('Content-Type') || '';
            if (resp.status === 0 || resp.type === 'opaqueredirect' ||
                (resp.status >= 300 && resp.status < 400) || ct.includes('text/html')) {
                throw new ApiError('CGI_AUTH_REDIRECT', 'CGI authentication required', path);
            }

            const result = await resp.json();
            if (result && result.error) {
                throw new ApiError('', result.error, path);
            }
            return result;
        });
    }

    // --- Login flow ---

    async function login(username, password) {
        // Step 1: Get salt
        const deviceSt = await webapi('GetDeviceSt');
        const salt = deviceSt.Salt;

        // Step 2: Hash password
        const pwHash = await pbkdf2Sha512(password, salt);

        // Step 3: Encrypt username
        const encUser = xorEncrypt(username);

        // Step 4: Login (throws ApiError on failure/lockout)
        const result = await webapi('Login', {
            UserName: encUser,
            Password: pwHash
        });

        if (!result || result.token === undefined) {
            throw new ApiError('', 'Login failed — unexpected response', 'Login');
        }

        const token = String(result.token);
        const param0 = String(result.param0); // AES key (16 chars)
        const param1 = String(result.param1); // AES IV (16 chars)

        // Step 5: Construct verification token
        _verificationToken = await encryptToken(token, param0, param1);

        // Step 6: Set cookie
        setCookie(COOKIE_PREFIX + _verificationToken);

        // Start heartbeat
        _startHeartbeat();

        return true;
    }

    async function logout() {
        _stopHeartbeat();
        try {
            await webapi('Logout');
        } catch (e) {
            // Ignore errors during logout
        }
        _verificationToken = '';
        clearCookie();
    }

    // --- Session management ---

    function _startHeartbeat() {
        _stopHeartbeat();
        _heartbeatTimer = setInterval(async () => {
            if (_heartbeatInFlight) return;
            _heartbeatInFlight = true;
            try {
                // HeartBeat is the stock keepalive — resets server session timer
                await webapi('HeartBeat');
            } catch (e) {
                // Only expire on confirmed session-expired errors, not network glitches
                if (e instanceof ApiError && ERR_SESSION_EXPIRED.indexOf(e.code) !== -1) {
                    _handleSessionExpired();
                }
            } finally {
                _heartbeatInFlight = false;
            }
        }, HEARTBEAT_MS);
        _startInactivityTimer();
    }

    function _stopHeartbeat() {
        if (_heartbeatTimer) {
            clearInterval(_heartbeatTimer);
            _heartbeatTimer = null;
        }
        _heartbeatInFlight = false;
        _stopInactivityTimer();
    }

    // --- Client-side inactivity timeout ---

    const _ACTIVITY_EVENTS = ['click', 'keydown', 'scroll', 'touchstart'];
    let _mouseMoveThrottle = 0;

    function _resetInactivity() {
        if (_inactivityTimer) {
            clearTimeout(_inactivityTimer);
            _inactivityTimer = setTimeout(_handleInactivityLogout, INACTIVITY_MS);
        }
    }

    function _onMouseMove() {
        var now = Date.now();
        if (now - _mouseMoveThrottle < 10000) return; // throttle to once per 10s
        _mouseMoveThrottle = now;
        _resetInactivity();
    }

    function _startInactivityTimer() {
        _stopInactivityTimer();
        _inactivityTimer = setTimeout(_handleInactivityLogout, INACTIVITY_MS);
        _ACTIVITY_EVENTS.forEach(function(ev) {
            document.addEventListener(ev, _resetInactivity, { passive: true });
        });
        document.addEventListener('mousemove', _onMouseMove, { passive: true });
    }

    function _stopInactivityTimer() {
        if (_inactivityTimer) {
            clearTimeout(_inactivityTimer);
            _inactivityTimer = null;
        }
        _ACTIVITY_EVENTS.forEach(function(ev) {
            document.removeEventListener(ev, _resetInactivity);
        });
        document.removeEventListener('mousemove', _onMouseMove);
    }

    // --- Why the session ended ---------------------------------------------
    //
    // Two server-side facts we cannot change: webs drops a session after about
    // five minutes idle, and it allows only ONE session per user, so logging in
    // from a second device silently kills the first. Both look identical from
    // here — an expired-session error code — so the UI says what it knows and
    // names both possibilities rather than bouncing to the login screen with no
    // explanation. The notice has to survive the reload, hence sessionStorage.
    const SESSION_NOTICE_KEY = 'ee71-session-end';

    function _rememberSessionEnd(reason) {
        try {
            sessionStorage.setItem(SESSION_NOTICE_KEY, JSON.stringify({
                reason: reason,
                route: (location.hash || '').replace(/^#\/?/, ''),
                at: Date.now()
            }));
        } catch (e) {
            // Private mode / storage disabled: we lose the explanation, not the logout.
        }
    }

    // Read once and clear — the notice belongs to exactly one login screen.
    function takeSessionEndNotice() {
        try {
            const raw = sessionStorage.getItem(SESSION_NOTICE_KEY);
            if (!raw) return null;
            sessionStorage.removeItem(SESSION_NOTICE_KEY);
            const notice = JSON.parse(raw);
            // A notice from much earlier is noise, not information.
            if (!notice || (Date.now() - (notice.at || 0)) > 120000) return null;
            return notice;
        } catch (e) {
            return null;
        }
    }

    function _handleInactivityLogout() {
        _stopHeartbeat();
        _rememberSessionEnd('idle');
        _verificationToken = '';
        clearCookie();
        webapi('Logout').catch(function() {}).then(function() {
            location.href = '/'; // Stock uses location.href = "/"
        });
    }

    function _handleSessionExpired() {
        _stopHeartbeat();
        _stopInactivityTimer();
        _rememberSessionEnd('expired');
        _verificationToken = '';
        clearCookie();
        // Stock behavior: call Logout → full page reload (clears all in-memory state)
        webapi('Logout').catch(function() {}).then(function() {
            location.reload();
        });
    }

    function isLoggedIn() {
        return !!_currentToken();
    }

    // Try to restore session from existing cookie (validates with server)
    async function restoreSession() {
        const cookie = getCookie();
        if (!cookie || !cookie.startsWith(COOKIE_PREFIX)) return false;
        _verificationToken = cookie.slice(COOKIE_PREFIX.length);
        try {
            const state = await webapi('GetLoginState');
            if (state.State === 1 || state.State === '1') {
                _startHeartbeat();
                return true;
            }
        } catch (e) {
            if (e instanceof ApiError && ERR_SESSION_EXPIRED.indexOf(e.code) !== -1) {
                _verificationToken = '';
                clearCookie();
                return false;
            }
            // A transient webapi/token/network failure during page load should not
            // destroy the browser cookie. The heartbeat will re-check once running.
            _startHeartbeat();
            return true;
        }
        // Server says not logged in — clear stale cookie
        _verificationToken = '';
        clearCookie();
        return false;
    }

    // --- Batch helper for status bar ---

    async function batchWebapi(methods) {
        const results = {};
        const promises = methods.map(async (m) => {
            try {
                results[m] = await webapi(m);
            } catch (e) {
                results[m] = null;
            }
        });
        await Promise.all(promises);
        return results;
    }

    // --- Public API ---

    return {
        login,
        logout,
        isLoggedIn,
        restoreSession,
        takeSessionEndNotice,
        LOGIN_LOCKOUT_SECONDS: 300,
        ERR_LOGIN_LOCKED,
        webapi,
        cgiGet,
        cgiPost,
        batchWebapi,
        ApiError,
        // Expose for tests
        _xorEncrypt: xorEncrypt,
        _pbkdf2Sha512: pbkdf2Sha512
    };
})();
window.API = API;
