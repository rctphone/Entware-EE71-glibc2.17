(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key2 of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key2) && key2 !== except)
          __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // js/termino.min.js
  var require_termino_min = __commonJS({
    "js/termino.min.js"(exports, module) {
      window.Termino = function(terminalSelector, keyCodes, settings) {
        try {
          function termInput(e) {
            return new Promise(function(t) {
              function r(e2) {
                if (e2.keyCode == Command_Key) {
                  window.event.preventDefault && window.event.preventDefault();
                  let n = terminalSelector.querySelector(DEF_SETTINGS.terminal_input).value;
                  termClearValue(), terminalSelector.querySelector(DEF_SETTINGS.terminal_input).removeEventListener("keypress", r), InputState = false, 0 != n.length ? (termEcho(n), t(n)) : (termEcho(""), t());
                }
              }
              terminal_console.innerHTML += e, termClearValue(), scrollTerminalToBottom(), InputState = true, terminalSelector.querySelector(DEF_SETTINGS.terminal_input).addEventListener("keypress", r);
            });
          }
          function termEcho(e) {
            terminal_console.innerHTML += `<pre>${DEF_SETTINGS.prompt} ${e}</pre>`, scrollTerminalToBottom();
          }
          function termOutput(e) {
            terminal_console.innerHTML += `<pre>${e}</pre>`, scrollTerminalToBottom();
          }
          function termClear() {
            terminal_console.innerHTML = "";
          }
          function termKill() {
            termClear(), terminalSelector.querySelector(DEF_SETTINGS.terminal_input).setAttribute("disabled", ""), terminalSelector.querySelector(DEF_SETTINGS.terminal_input).setAttribute("placeholder", DEF_SETTINGS.terminal_killed_placeholder);
          }
          function termEnable() {
            terminalSelector.querySelector(DEF_SETTINGS.terminal_input).removeAttribute("disabled", "");
          }
          function termDisable() {
            terminalSelector.querySelector(DEF_SETTINGS.terminal_input).setAttribute("disabled", "");
          }
          function termClearValue() {
            terminalSelector.querySelector(DEF_SETTINGS.terminal_input).value = "";
          }
          function scrollTerminalToBottom() {
            terminal_console.scrollTop = terminal_console.scrollHeight;
          }
          function scrollTerminalToTop() {
            terminal_console.scrollTo({ top: 0, behavior: "smooth" });
          }
          function addElementWithID(e, t, r) {
            let n = null;
            n = document.createElement("div"), r && n.setAttribute("class", r), n.setAttribute("id", e), t && (n.innerHTML = t), terminal_console.appendChild(n);
          }
          function removeElementWithID(e) {
            try {
              terminalSelector.querySelector("#" + e).outerHTML = "";
            } catch (t) {
              throw { message: `Error could not find ${t.message}` };
            }
          }
          if (!terminalSelector) throw { message: "No Query Selector was provided." };
          let DEF_SETTINGS = { allow_scroll: true, prompt: "> ", command_key: 13, terminal_killed_placeholder: "TERMINAL DISABLED", terminal_output: ".termino-console", terminal_input: ".termino-input", disable_terminal_input: false };
          if (settings) {
            let compare2 = function(e, t) {
              let r = Object.keys(e), n = Object.keys(t);
              if (r.length != n.length) return false;
              for (var i = 0; i < r.length; i++) if (r[i] != n[i]) return false;
              return true;
            };
            var compare = compare2;
            if (true != compare2(DEF_SETTINGS, settings)) throw { message: "Settings Error: Your overwritten Termino settings are not valid" };
            DEF_SETTINGS = settings;
          }
          let terminal_console = terminalSelector.querySelector(DEF_SETTINGS.terminal_output), KEYCODES = [{ id: "SCROLL_UP_KEY", key_code: 38 }, { id: "SCROLL_DOWN_KEY", key_code: 40 }], Scroll_Up_Key = KEYCODES[0].key_code, Scroll_Down_Key = KEYCODES[1].key_code;
          keyCodes && (0 != keyCodes.filter((e) => "SCROLL_UP_KEY" === e.id).length && void 0 != keyCodes.filter((e) => "SCROLL_UP_KEY" === e.id)[0].key_code && (Scroll_Up_Key = keyCodes.filter((e) => "SCROLL_UP_KEY" === e.id)[0].key_code), 0 != keyCodes.filter((e) => "SCROLL_DOWN_KEY" === e.id).length && void 0 != keyCodes.filter((e) => "SCROLL_DOWN_KEY" === e.id)[0].key_code && (Scroll_Down_Key = keyCodes.filter((e) => "SCROLL_DOWN_KEY" === e.id)[0].key_code), KEYCODES = keyCodes);
          let Command_Key = DEF_SETTINGS.command_key;
          terminalSelector.addEventListener("keydown", (e) => {
            true != DEF_SETTINGS.disable_terminal_input && checkIfCommand(), true === DEF_SETTINGS.allow_scroll && (e.keyCode == Scroll_Up_Key ? terminal_console.scrollTo({ top: 0, behavior: "smooth" }) : e.keyCode == Scroll_Down_Key && (terminal_console.scrollTop = terminal_console.scrollHeight));
          });
          let InputState = false;
          let termDelay = (e) => new Promise((t) => setTimeout(t, e));
          async function checkIfCommand() {
            let key = window.event.keyCode;
            if (0 != KEYCODES.filter((e) => e.key_code === key).length && (KEYCODES = KEYCODES.filter((e) => e.key_code === key), 0 != KEYCODES.length && void 0 != KEYCODES[0].function)) try {
              await eval(KEYCODES[0].function);
            } catch (error) {
              throw { message: `KeyCode Function Error: ${error.message}` };
            }
            true != InputState && key === Command_Key && (window.event.preventDefault && window.event.preventDefault(), termEcho(terminalSelector.querySelector(DEF_SETTINGS.terminal_input).value), termClearValue());
          }
          return true === DEF_SETTINGS.disable_terminal_input && terminalSelector.querySelector(DEF_SETTINGS.terminal_input).setAttribute("disabled", ""), { echo: termEcho, output: termOutput, clear: termClear, delay: termDelay, disable_input: termDisable, enable_input: termEnable, input: termInput, scroll_to_bottom: scrollTerminalToBottom, scroll_to_top: scrollTerminalToTop, add_element: addElementWithID, remove_element: removeElementWithID, kill: termKill };
        } catch (error) {
          throw console.error(`Termino.js Error: ${error.message}`), { message: `Termino.js Error: ${error.message}` };
        }
      };
      "undefined" == typeof document && console.error("Termino.js is only supported for the browser");
    }
  });

  // js/uPlot.iife.min.js
  var uPlot2 = (function() {
    "use strict";
    const l = "u-off", e = "u-label", t = "width", n = "height", i = "top", o = "bottom", s = "left", r = "right", u = "#000", a = u + "0", f = "mousemove", c = "mousedown", h = "mouseup", d = "mouseenter", p = "mouseleave", m = "dblclick", g = "change", x = "dppxchange", w = "--", _ = "undefined" != typeof window, b = _ ? document : null, v = _ ? window : null, k = _ ? navigator : null;
    let y, M;
    function S(l2, e2) {
      if (null != e2) {
        let t2 = l2.classList;
        !t2.contains(e2) && t2.add(e2);
      }
    }
    function T(l2, e2) {
      let t2 = l2.classList;
      t2.contains(e2) && t2.remove(e2);
    }
    function E(l2, e2, t2) {
      l2.style[e2] = t2 + "px";
    }
    function z(l2, e2, t2, n2) {
      let i2 = b.createElement(l2);
      return null != e2 && S(i2, e2), null != t2 && t2.insertBefore(i2, n2), i2;
    }
    function D(l2, e2) {
      return z("div", l2, e2);
    }
    const P = /* @__PURE__ */ new WeakMap();
    function A(e2, t2, n2, i2, o2) {
      let s2 = "translate(" + t2 + "px," + n2 + "px)";
      s2 != P.get(e2) && (e2.style.transform = s2, P.set(e2, s2), 0 > t2 || 0 > n2 || t2 > i2 || n2 > o2 ? S(e2, l) : T(e2, l));
    }
    const W = /* @__PURE__ */ new WeakMap();
    function Y(l2, e2, t2) {
      let n2 = e2 + t2;
      n2 != W.get(l2) && (W.set(l2, n2), l2.style.background = e2, l2.style.borderColor = t2);
    }
    const C = /* @__PURE__ */ new WeakMap();
    function H(l2, e2, t2, n2) {
      let i2 = e2 + "" + t2;
      i2 != C.get(l2) && (C.set(l2, i2), l2.style.height = t2 + "px", l2.style.width = e2 + "px", l2.style.marginLeft = n2 ? -e2 / 2 + "px" : 0, l2.style.marginTop = n2 ? -t2 / 2 + "px" : 0);
    }
    const F = { passive: true }, R = { ...F, capture: true };
    function G(l2, e2, t2, n2) {
      e2.addEventListener(l2, t2, n2 ? R : F);
    }
    function I(l2, e2, t2) {
      e2.removeEventListener(l2, t2, F);
    }
    function L(l2, e2, t2, n2) {
      let i2;
      t2 = t2 || 0;
      let o2 = 2147483647 >= (n2 = n2 || e2.length - 1);
      for (; n2 - t2 > 1; ) i2 = o2 ? t2 + n2 >> 1 : sl((t2 + n2) / 2), l2 > e2[i2] ? t2 = i2 : n2 = i2;
      return l2 - e2[t2] > e2[n2] - l2 ? n2 : t2;
    }
    function O(l2) {
      return (e2, t2, n2) => {
        let i2 = -1, o2 = -1;
        for (let o3 = t2; n2 >= o3; o3++) if (l2(e2[o3])) {
          i2 = o3;
          break;
        }
        for (let i3 = n2; i3 >= t2; i3--) if (l2(e2[i3])) {
          o2 = i3;
          break;
        }
        return [i2, o2];
      };
    }
    _ && (function l2() {
      let e2 = devicePixelRatio;
      y != e2 && (y = e2, M && I(g, M, l2), M = matchMedia(`(min-resolution: ${y - 1e-3}dppx) and (max-resolution: ${y + 1e-3}dppx)`), G(g, M, l2), v.dispatchEvent(new CustomEvent(x)));
    })();
    const N = (l2) => null != l2, j = (l2) => null != l2 && l2 > 0, U = O(N), V = O(j);
    function B(l2, e2, t2, n2) {
      let i2 = hl(l2), o2 = hl(e2);
      l2 == e2 && (-1 == i2 ? (l2 *= t2, e2 /= t2) : (l2 /= t2, e2 *= t2));
      let s2 = 10 == t2 ? dl : pl, r2 = 1 == o2 ? ul : sl, u2 = (1 == i2 ? sl : ul)(s2(ol(l2))), a2 = r2(s2(ol(e2))), f2 = cl(t2, u2), c2 = cl(t2, a2);
      return 10 == t2 && (0 > u2 && (f2 = Al(f2, -u2)), 0 > a2 && (c2 = Al(c2, -a2))), n2 || 2 == t2 ? (l2 = f2 * i2, e2 = c2 * o2) : (l2 = Pl(l2, f2), e2 = Dl(e2, c2)), [l2, e2];
    }
    function $(l2, e2, t2, n2) {
      let i2 = B(l2, e2, t2, n2);
      return 0 == l2 && (i2[0] = 0), 0 == e2 && (i2[1] = 0), i2;
    }
    const J = 0.1, q = { mode: 3, pad: J }, K = { pad: 0, soft: null, mode: 0 }, X = { min: K, max: K };
    function Z(l2, e2, t2, n2) {
      return Ol(t2) ? ll(l2, e2, t2) : (K.pad = t2, K.soft = n2 ? 0 : null, K.mode = n2 ? 3 : 0, ll(l2, e2, X));
    }
    function Q(l2, e2) {
      return null == l2 ? e2 : l2;
    }
    function ll(l2, e2, t2) {
      let n2 = t2.min, i2 = t2.max, o2 = Q(n2.pad, 0), s2 = Q(i2.pad, 0), r2 = Q(n2.hard, -gl), u2 = Q(i2.hard, gl), a2 = Q(n2.soft, gl), f2 = Q(i2.soft, -gl), c2 = Q(n2.mode, 0), h2 = Q(i2.mode, 0), d2 = e2 - l2, p2 = dl(d2), m2 = fl(ol(l2), ol(e2)), g2 = dl(m2), x2 = ol(g2 - p2);
      (1e-24 > d2 || x2 > 10) && (d2 = 0, 0 != l2 && 0 != e2 || (d2 = 1e-24, 2 == c2 && a2 != gl && (o2 = 0), 2 == h2 && f2 != -gl && (s2 = 0)));
      let w2 = d2 || m2 || 1e3, _2 = dl(w2), b2 = cl(10, sl(_2)), v2 = Al(Pl(l2 - w2 * (0 == d2 ? 0 == l2 ? 0.1 : 1 : o2), b2 / 10), 24), k2 = a2 > l2 || 1 != c2 && (3 != c2 || v2 > a2) && (2 != c2 || a2 > v2) ? gl : a2, y2 = fl(r2, k2 > v2 && l2 >= k2 ? k2 : al(k2, v2)), M2 = Al(Dl(e2 + w2 * (0 == d2 ? 0 == e2 ? 0.1 : 1 : s2), b2 / 10), 24), S2 = e2 > f2 || 1 != h2 && (3 != h2 || f2 > M2) && (2 != h2 || M2 > f2) ? -gl : f2, T2 = al(u2, M2 > S2 && S2 >= e2 ? S2 : fl(S2, M2));
      return y2 == T2 && 0 == y2 && (T2 = 100), [y2, T2];
    }
    const el = new Intl.NumberFormat(_ ? k.language : "en-US"), tl = (l2) => el.format(l2), nl = Math, il = nl.PI, ol = nl.abs, sl = nl.floor, rl = nl.round, ul = nl.ceil, al = nl.min, fl = nl.max, cl = nl.pow, hl = nl.sign, dl = nl.log10, pl = nl.log2, ml = (l2, e2 = 1) => nl.asinh(l2 / e2), gl = 1 / 0;
    function xl(l2) {
      return 1 + (0 | dl((l2 ^ l2 >> 31) - (l2 >> 31)));
    }
    function wl(l2, e2, t2) {
      return al(fl(l2, e2), t2);
    }
    function _l(l2) {
      return "function" == typeof l2;
    }
    function bl(l2) {
      return _l(l2) ? l2 : () => l2;
    }
    const vl = (l2) => l2, kl = (l2, e2) => e2, yl = () => null, Ml = () => true, Sl = (l2, e2) => l2 == e2, Tl = /\.\d*?(?=9{6,}|0{6,})/gm, El = (l2) => {
      if (Il(l2) || Wl.has(l2)) return l2;
      const e2 = "" + l2, t2 = e2.match(Tl);
      if (null == t2) return l2;
      let n2 = t2[0].length - 1;
      if (-1 != e2.indexOf("e-")) {
        let [l3, t3] = e2.split("e");
        return +`${El(l3)}e${t3}`;
      }
      return Al(l2, n2);
    };
    function zl(l2, e2) {
      return El(Al(El(l2 / e2)) * e2);
    }
    function Dl(l2, e2) {
      return El(ul(El(l2 / e2)) * e2);
    }
    function Pl(l2, e2) {
      return El(sl(El(l2 / e2)) * e2);
    }
    function Al(l2, e2 = 0) {
      if (Il(l2)) return l2;
      let t2 = 10 ** e2;
      return rl(l2 * t2 * (1 + Number.EPSILON)) / t2;
    }
    const Wl = /* @__PURE__ */ new Map();
    function Yl(l2) {
      return (("" + l2).split(".")[1] || "").length;
    }
    function Cl(l2, e2, t2, n2) {
      let i2 = [], o2 = n2.map(Yl);
      for (let s2 = e2; t2 > s2; s2++) {
        let e3 = ol(s2), t3 = Al(cl(l2, s2), e3);
        for (let r2 = 0; n2.length > r2; r2++) {
          let u2 = 10 == l2 ? +`${n2[r2]}e${s2}` : n2[r2] * t3, a2 = (0 > s2 ? e3 : 0) + (o2[r2] > s2 ? o2[r2] : 0), f2 = 10 == l2 ? u2 : Al(u2, a2);
          i2.push(f2), Wl.set(f2, a2);
        }
      }
      return i2;
    }
    const Hl = {}, Fl = [], Rl = [null, null], Gl = Array.isArray, Il = Number.isInteger;
    function Ll(l2) {
      return "string" == typeof l2;
    }
    function Ol(l2) {
      let e2 = false;
      if (null != l2) {
        let t2 = l2.constructor;
        e2 = null == t2 || t2 == Object;
      }
      return e2;
    }
    function Nl(l2) {
      return null != l2 && "object" == typeof l2;
    }
    const jl = Object.getPrototypeOf(Uint8Array), Ul = "__proto__";
    function Vl(l2, e2 = Ol) {
      let t2;
      if (Gl(l2)) {
        let n2 = l2.find(((l3) => null != l3));
        if (Gl(n2) || e2(n2)) {
          t2 = Array(l2.length);
          for (let n3 = 0; l2.length > n3; n3++) t2[n3] = Vl(l2[n3], e2);
        } else t2 = l2.slice();
      } else if (l2 instanceof jl) t2 = l2.slice();
      else if (e2(l2)) {
        t2 = {};
        for (let n2 in l2) n2 != Ul && (t2[n2] = Vl(l2[n2], e2));
      } else t2 = l2;
      return t2;
    }
    function Bl(l2) {
      let e2 = arguments;
      for (let t2 = 1; e2.length > t2; t2++) {
        let n2 = e2[t2];
        for (let e3 in n2) e3 != Ul && (Ol(l2[e3]) ? Bl(l2[e3], Vl(n2[e3])) : l2[e3] = Vl(n2[e3]));
      }
      return l2;
    }
    function $l(l2, e2, t2) {
      for (let n2, i2 = 0, o2 = -1; e2.length > i2; i2++) {
        let s2 = e2[i2];
        if (s2 > o2) {
          for (n2 = s2 - 1; n2 >= 0 && null == l2[n2]; ) l2[n2--] = null;
          for (n2 = s2 + 1; t2 > n2 && null == l2[n2]; ) l2[o2 = n2++] = null;
        }
      }
    }
    const Jl = "undefined" == typeof queueMicrotask ? (l2) => Promise.resolve().then(l2) : queueMicrotask, ql = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], Kl = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    function Xl(l2) {
      return l2.slice(0, 3);
    }
    const Zl = Kl.map(Xl), Ql = ql.map(Xl), le = { MMMM: ql, MMM: Ql, WWWW: Kl, WWW: Zl };
    function ee(l2) {
      return (10 > l2 ? "0" : "") + l2;
    }
    const te = { YYYY: (l2) => l2.getFullYear(), YY: (l2) => (l2.getFullYear() + "").slice(2), MMMM: (l2, e2) => e2.MMMM[l2.getMonth()], MMM: (l2, e2) => e2.MMM[l2.getMonth()], MM: (l2) => ee(l2.getMonth() + 1), M: (l2) => l2.getMonth() + 1, DD: (l2) => ee(l2.getDate()), D: (l2) => l2.getDate(), WWWW: (l2, e2) => e2.WWWW[l2.getDay()], WWW: (l2, e2) => e2.WWW[l2.getDay()], HH: (l2) => ee(l2.getHours()), H: (l2) => l2.getHours(), h: (l2) => {
      let e2 = l2.getHours();
      return 0 == e2 ? 12 : e2 > 12 ? e2 - 12 : e2;
    }, AA: (l2) => 12 > l2.getHours() ? "AM" : "PM", aa: (l2) => 12 > l2.getHours() ? "am" : "pm", a: (l2) => 12 > l2.getHours() ? "a" : "p", mm: (l2) => ee(l2.getMinutes()), m: (l2) => l2.getMinutes(), ss: (l2) => ee(l2.getSeconds()), s: (l2) => l2.getSeconds(), fff: (l2) => (function(l3) {
      return (10 > l3 ? "00" : 100 > l3 ? "0" : "") + l3;
    })(l2.getMilliseconds()) };
    function ne(l2, e2) {
      e2 = e2 || le;
      let t2, n2 = [], i2 = /\{([a-z]+)\}|[^{]+/gi;
      for (; t2 = i2.exec(l2); ) n2.push("{" == t2[0][0] ? te[t2[1]] : t2[0]);
      return (l3) => {
        let t3 = "";
        for (let i3 = 0; n2.length > i3; i3++) t3 += "string" == typeof n2[i3] ? n2[i3] : n2[i3](l3, e2);
        return t3;
      };
    }
    const ie = new Intl.DateTimeFormat().resolvedOptions().timeZone, oe = (l2) => l2 % 1 == 0, se = [1, 2, 2.5, 5], re = Cl(10, -32, 0, se), ue = Cl(10, 0, 32, se), ae = ue.filter(oe), fe = re.concat(ue), ce = "{YYYY}", he = "\n" + ce, de = "{M}/{D}", pe = "\n" + de, me = pe + "/{YY}", ge = "{aa}", xe = "{h}:{mm}" + ge, we = "\n" + xe, _e = ":{ss}", be = null;
    function ve(l2) {
      let e2 = 1e3 * l2, t2 = 60 * e2, n2 = 60 * t2, i2 = 24 * n2, o2 = 30 * i2, s2 = 365 * i2;
      return [(1 == l2 ? Cl(10, 0, 3, se).filter(oe) : Cl(10, -3, 0, se)).concat([e2, 5 * e2, 10 * e2, 15 * e2, 30 * e2, t2, 5 * t2, 10 * t2, 15 * t2, 30 * t2, n2, 2 * n2, 3 * n2, 4 * n2, 6 * n2, 8 * n2, 12 * n2, i2, 2 * i2, 3 * i2, 4 * i2, 5 * i2, 6 * i2, 7 * i2, 8 * i2, 9 * i2, 10 * i2, 15 * i2, o2, 2 * o2, 3 * o2, 4 * o2, 6 * o2, s2, 2 * s2, 5 * s2, 10 * s2, 25 * s2, 50 * s2, 100 * s2]), [[s2, ce, be, be, be, be, be, be, 1], [28 * i2, "{MMM}", he, be, be, be, be, be, 1], [i2, de, he, be, be, be, be, be, 1], [n2, "{h}" + ge, me, be, pe, be, be, be, 1], [t2, xe, me, be, pe, be, be, be, 1], [e2, _e, me + " " + xe, be, pe + " " + xe, be, we, be, 1], [l2, _e + ".{fff}", me + " " + xe, be, pe + " " + xe, be, we, be, 1]], function(e3) {
        return (r2, u2, a2, f2, c2, h2) => {
          let d2 = [], p2 = c2 >= s2, m2 = c2 >= o2 && s2 > c2, g2 = e3(a2), x2 = Al(g2 * l2, 3), w2 = Pe(g2.getFullYear(), p2 ? 0 : g2.getMonth(), m2 || p2 ? 1 : g2.getDate()), _2 = Al(w2 * l2, 3);
          if (m2 || p2) {
            let t3 = m2 ? c2 / o2 : 0, n3 = p2 ? c2 / s2 : 0, i3 = x2 == _2 ? x2 : Al(Pe(w2.getFullYear() + n3, w2.getMonth() + t3, 1) * l2, 3), r3 = new Date(rl(i3 / l2)), u3 = r3.getFullYear(), a3 = r3.getMonth();
            for (let o3 = 0; f2 >= i3; o3++) {
              let s3 = Pe(u3 + n3 * o3, a3 + t3 * o3, 1), r4 = s3 - e3(Al(s3 * l2, 3));
              i3 = Al((+s3 + r4) * l2, 3), i3 > f2 || d2.push(i3);
            }
          } else {
            let o3 = i2 > c2 ? c2 : i2, s3 = _2 + (sl(a2) - sl(x2)) + Dl(x2 - _2, o3);
            d2.push(s3);
            let p3 = e3(s3), m3 = p3.getHours() + p3.getMinutes() / t2 + p3.getSeconds() / n2, g3 = c2 / n2, w3 = h2 / r2.axes[u2]._space;
            for (; s3 = Al(s3 + c2, 1 == l2 ? 0 : 3), f2 >= s3; ) if (g3 > 1) {
              let l3 = sl(Al(m3 + g3, 6)) % 24, t3 = e3(s3).getHours() - l3;
              t3 > 1 && (t3 = -1), s3 -= t3 * n2, m3 = (m3 + g3) % 24, 0.7 > Al((s3 - d2[d2.length - 1]) / c2, 3) * w3 || d2.push(s3);
            } else d2.push(s3);
          }
          return d2;
        };
      }];
    }
    const [ke, ye, Me] = ve(1), [Se, Te, Ee] = ve(1e-3);
    function ze(l2, e2) {
      return l2.map(((l3) => l3.map(((t2, n2) => 0 == n2 || 8 == n2 || null == t2 ? t2 : e2(1 == n2 || 0 == l3[8] ? t2 : l3[1] + t2)))));
    }
    function De(l2, e2) {
      return (t2, n2, i2, o2, s2) => {
        let r2, u2, a2, f2, c2, h2, d2 = e2.find(((l3) => s2 >= l3[0])) || e2[e2.length - 1];
        return n2.map(((e3) => {
          let t3 = l2(e3), n3 = t3.getFullYear(), i3 = t3.getMonth(), o3 = t3.getDate(), s3 = t3.getHours(), p2 = t3.getMinutes(), m2 = t3.getSeconds(), g2 = n3 != r2 && d2[2] || i3 != u2 && d2[3] || o3 != a2 && d2[4] || s3 != f2 && d2[5] || p2 != c2 && d2[6] || m2 != h2 && d2[7] || d2[1];
          return r2 = n3, u2 = i3, a2 = o3, f2 = s3, c2 = p2, h2 = m2, g2(t3);
        }));
      };
    }
    function Pe(l2, e2, t2) {
      return new Date(l2, e2, t2);
    }
    function Ae(l2, e2) {
      return e2(l2);
    }
    function We(l2, e2) {
      return (t2, n2, i2, o2) => null == o2 ? w : e2(l2(n2));
    }
    Cl(2, -53, 53, [1]);
    const Ye = { show: true, live: true, isolate: false, mount: () => {
    }, markers: { show: true, width: 2, stroke: function(l2, e2) {
      let t2 = l2.series[e2];
      return t2.width ? t2.stroke(l2, e2) : t2.points.width ? t2.points.stroke(l2, e2) : null;
    }, fill: function(l2, e2) {
      return l2.series[e2].fill(l2, e2);
    }, dash: "solid" }, idx: null, idxs: null, values: [] }, Ce = [0, 0];
    function He(l2, e2, t2, n2 = true) {
      return (l3) => {
        0 == l3.button && (!n2 || l3.target == e2) && t2(l3);
      };
    }
    function Fe(l2, e2, t2, n2 = true) {
      return (l3) => {
        (!n2 || l3.target == e2) && t2(l3);
      };
    }
    const Re = { show: true, x: true, y: true, lock: false, move: function(l2, e2, t2) {
      return Ce[0] = e2, Ce[1] = t2, Ce;
    }, points: { one: false, show: function(l2, e2) {
      let i2 = l2.cursor.points, o2 = D(), s2 = i2.size(l2, e2);
      E(o2, t, s2), E(o2, n, s2);
      let r2 = s2 / -2;
      E(o2, "marginLeft", r2), E(o2, "marginTop", r2);
      let u2 = i2.width(l2, e2, s2);
      return u2 && E(o2, "borderWidth", u2), o2;
    }, size: function(l2, e2) {
      return l2.series[e2].points.size;
    }, width: 0, stroke: function(l2, e2) {
      let t2 = l2.series[e2].points;
      return t2._stroke || t2._fill;
    }, fill: function(l2, e2) {
      let t2 = l2.series[e2].points;
      return t2._fill || t2._stroke;
    } }, bind: { mousedown: He, mouseup: He, click: He, dblclick: He, mousemove: Fe, mouseleave: Fe, mouseenter: Fe }, drag: { setScale: true, x: true, y: false, dist: 0, uni: null, click: (l2, e2) => {
      e2.stopPropagation(), e2.stopImmediatePropagation();
    }, _x: false, _y: false }, focus: { dist: (l2, e2, t2, n2, i2) => n2 - i2, prox: -1, bias: 0 }, hover: { skip: [void 0], prox: null, bias: 0 }, left: -10, top: -10, idx: null, dataIdx: null, idxs: null, event: null }, Ge = { show: true, stroke: "rgba(0,0,0,0.07)", width: 2 }, Ie = Bl({}, Ge, { filter: kl }), Le = Bl({}, Ie, { size: 10 }), Oe = Bl({}, Ge, { show: false }), Ne = '12px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"', je = "bold " + Ne, Ue = { show: true, scale: "x", stroke: u, space: 50, gap: 5, alignTo: 1, size: 50, labelGap: 0, labelSize: 30, labelFont: je, side: 2, grid: Ie, ticks: Le, border: Oe, font: Ne, lineGap: 1.5, rotate: 0 }, Ve = { show: true, scale: "x", auto: false, sorted: 1, min: gl, max: -gl, idxs: [] };
    function Be(l2, e2) {
      return e2.map(((l3) => null == l3 ? "" : tl(l3)));
    }
    function $e(l2, e2, t2, n2, i2, o2, s2) {
      let r2 = [], u2 = Wl.get(i2) || 0;
      for (let l3 = t2 = s2 ? t2 : Al(Dl(t2, i2), u2); n2 >= l3; l3 = Al(l3 + i2, u2)) r2.push(Object.is(l3, -0) ? 0 : l3);
      return r2;
    }
    function Je(l2, e2, t2, n2, i2) {
      const o2 = [], s2 = l2.scales[l2.axes[e2].scale].log, r2 = sl((10 == s2 ? dl : pl)(t2));
      i2 = cl(s2, r2), 10 == s2 && (i2 = fe[L(i2, fe)]);
      let u2 = t2, a2 = i2 * s2;
      10 == s2 && (a2 = fe[L(a2, fe)]);
      do {
        o2.push(u2), u2 += i2, 10 != s2 || Wl.has(u2) || (u2 = Al(u2, Wl.get(i2))), a2 > u2 || (a2 = (i2 = u2) * s2, 10 == s2 && (a2 = fe[L(a2, fe)]));
      } while (n2 >= u2);
      return o2;
    }
    function qe(l2, e2, t2, n2, i2) {
      let o2 = l2.scales[l2.axes[e2].scale].asinh, s2 = n2 > o2 ? Je(l2, e2, fl(o2, t2), n2, i2) : [o2], r2 = 0 > n2 || t2 > 0 ? [] : [0];
      return (-o2 > t2 ? Je(l2, e2, fl(o2, -n2), -t2, i2) : [o2]).reverse().map(((l3) => -l3)).concat(r2, s2);
    }
    const Ke = /./, Xe = /[12357]/, Ze = /[125]/, Qe = /1/, lt = (l2, e2, t2, n2) => l2.map(((l3, i2) => 4 == e2 && 0 == l3 || i2 % n2 == 0 && t2.test(l3.toExponential()[0 > l3 ? 1 : 0]) ? l3 : null));
    function et(l2, e2, t2) {
      let n2 = l2.axes[t2], i2 = n2.scale, o2 = l2.scales[i2], s2 = l2.valToPos, r2 = n2._space, u2 = s2(10, i2), a2 = s2(9, i2) - u2 < r2 ? s2(7, i2) - u2 < r2 ? s2(5, i2) - u2 < r2 ? Qe : Ze : Xe : Ke;
      if (a2 == Qe) {
        let l3 = ol(s2(1, i2) - u2);
        if (r2 > l3) return lt(e2.slice().reverse(), o2.distr, a2, ul(r2 / l3)).reverse();
      }
      return lt(e2, o2.distr, a2, 1);
    }
    function tt(l2, e2, t2) {
      let n2 = l2.axes[t2], i2 = n2.scale, o2 = n2._space, s2 = l2.valToPos, r2 = ol(s2(1, i2) - s2(2, i2));
      return o2 > r2 ? lt(e2.slice().reverse(), 3, Ke, ul(o2 / r2)).reverse() : e2;
    }
    function nt(l2, e2, t2, n2) {
      return null == n2 ? w : null == e2 ? "" : tl(e2);
    }
    const it = { show: true, scale: "y", stroke: u, space: 30, gap: 5, alignTo: 1, size: 50, labelGap: 0, labelSize: 30, labelFont: je, side: 3, grid: Ie, ticks: Le, border: Oe, font: Ne, lineGap: 1.5, rotate: 0 }, ot = { scale: null, auto: true, sorted: 0, min: gl, max: -gl }, st = (l2, e2, t2, n2, i2) => i2, rt = { show: true, auto: true, sorted: 0, gaps: st, alpha: 1, facets: [Bl({}, ot, { scale: "x" }), Bl({}, ot, { scale: "y" })] }, ut = { scale: "y", auto: true, sorted: 0, show: true, spanGaps: false, gaps: st, alpha: 1, points: { show: function(l2, e2) {
      let { scale: t2, idxs: n2 } = l2.series[0], i2 = l2._data[0], o2 = l2.valToPos(i2[n2[0]], t2, true), s2 = l2.valToPos(i2[n2[1]], t2, true);
      return ol(s2 - o2) / (l2.series[e2].points.space * y) >= n2[1] - n2[0];
    }, filter: null }, values: null, min: gl, max: -gl, idxs: [], path: null, clip: null };
    function at(l2, e2, t2) {
      return t2 / 10;
    }
    const ft = { time: true, auto: true, distr: 1, log: 10, asinh: 1, min: null, max: null, dir: 1, ori: 0 }, ct = Bl({}, ft, { time: false, ori: 1 }), ht = {};
    function dt(l2) {
      let e2 = ht[l2];
      return e2 || (e2 = { key: l2, plots: [], sub(l3) {
        e2.plots.push(l3);
      }, unsub(l3) {
        e2.plots = e2.plots.filter(((e3) => e3 != l3));
      }, pub(l3, t2, n2, i2, o2, s2, r2) {
        for (let u2 = 0; e2.plots.length > u2; u2++) e2.plots[u2] != t2 && e2.plots[u2].pub(l3, t2, n2, i2, o2, s2, r2);
      } }, null != l2 && (ht[l2] = e2)), e2;
    }
    function pt(l2, e2, t2) {
      const n2 = l2.mode, i2 = l2.series[e2], o2 = 2 == n2 ? l2._data[e2] : l2._data, s2 = l2.scales, r2 = l2.bbox;
      let u2 = o2[0], a2 = 2 == n2 ? o2[1] : o2[e2], f2 = 2 == n2 ? s2[i2.facets[0].scale] : s2[l2.series[0].scale], c2 = 2 == n2 ? s2[i2.facets[1].scale] : s2[i2.scale], h2 = r2.left, d2 = r2.top, p2 = r2.width, m2 = r2.height, g2 = l2.valToPosH, x2 = l2.valToPosV;
      return 0 == f2.ori ? t2(i2, u2, a2, f2, c2, g2, x2, h2, d2, p2, m2, kt, Mt, Tt, zt, Pt) : t2(i2, u2, a2, f2, c2, x2, g2, d2, h2, m2, p2, yt, St, Et, Dt, At);
    }
    function mt(l2, e2) {
      let t2 = 0, n2 = 0, i2 = Q(l2.bands, Fl);
      for (let l3 = 0; i2.length > l3; l3++) {
        let o2 = i2[l3];
        o2.series[0] == e2 ? t2 = o2.dir : o2.series[1] == e2 && (n2 |= 1 == o2.dir ? 1 : 2);
      }
      return [t2, 1 == n2 ? -1 : 2 == n2 ? 1 : 3 == n2 ? 2 : 0];
    }
    function gt(l2, e2, t2, n2, i2) {
      let o2 = l2.series[e2], s2 = l2.scales[2 == l2.mode ? o2.facets[1].scale : o2.scale];
      return -1 == i2 ? s2.min : 1 == i2 ? s2.max : 3 == s2.distr ? 1 == s2.dir ? s2.min : s2.max : 0;
    }
    function xt(l2, e2, t2, n2, i2, o2) {
      return pt(l2, e2, ((l3, e3, s2, r2, u2, a2, f2, c2, h2, d2, p2) => {
        let m2 = l3.pxRound;
        const g2 = 0 == r2.ori ? Mt : St;
        let x2, w2;
        1 == r2.dir * (0 == r2.ori ? 1 : -1) ? (x2 = t2, w2 = n2) : (x2 = n2, w2 = t2);
        let _2 = m2(a2(e3[x2], r2, d2, c2)), b2 = m2(f2(s2[x2], u2, p2, h2)), v2 = m2(a2(e3[w2], r2, d2, c2)), k2 = m2(f2(1 == o2 ? u2.max : u2.min, u2, p2, h2)), y2 = new Path2D(i2);
        return g2(y2, v2, k2), g2(y2, _2, k2), g2(y2, _2, b2), y2;
      }));
    }
    function wt(l2, e2, t2, n2, i2, o2) {
      let s2 = null;
      if (l2.length > 0) {
        s2 = new Path2D();
        const r2 = 0 == e2 ? Tt : Et;
        let u2 = t2;
        for (let e3 = 0; l2.length > e3; e3++) {
          let t3 = l2[e3];
          if (t3[1] > t3[0]) {
            let l3 = t3[0] - u2;
            l3 > 0 && r2(s2, u2, n2, l3, n2 + o2), u2 = t3[1];
          }
        }
        let a2 = t2 + i2 - u2, f2 = 10;
        a2 > 0 && r2(s2, u2, n2 - f2 / 2, a2, n2 + o2 + f2);
      }
      return s2;
    }
    function _t(l2, e2, t2, n2, i2, o2, s2) {
      let r2 = [], u2 = l2.length;
      for (let a2 = 1 == i2 ? t2 : n2; a2 >= t2 && n2 >= a2; a2 += i2) if (null === e2[a2]) {
        let f2 = a2, c2 = a2;
        if (1 == i2) for (; ++a2 <= n2 && null === e2[a2]; ) c2 = a2;
        else for (; --a2 >= t2 && null === e2[a2]; ) c2 = a2;
        let h2 = o2(l2[f2]), d2 = c2 == f2 ? h2 : o2(l2[c2]), p2 = f2 - i2;
        h2 = s2 > 0 || 0 > p2 || p2 >= u2 ? h2 : o2(l2[p2]);
        let m2 = c2 + i2;
        d2 = 0 > s2 || 0 > m2 || m2 >= u2 ? d2 : o2(l2[m2]), h2 > d2 || r2.push([h2, d2]);
      }
      return r2;
    }
    function bt(l2) {
      return 0 == l2 ? vl : 1 == l2 ? rl : (e2) => zl(e2, l2);
    }
    function vt(l2) {
      let e2 = 0 == l2 ? kt : yt, t2 = 0 == l2 ? (l3, e3, t3, n3, i2, o2) => {
        l3.arcTo(e3, t3, n3, i2, o2);
      } : (l3, e3, t3, n3, i2, o2) => {
        l3.arcTo(t3, e3, i2, n3, o2);
      }, n2 = 0 == l2 ? (l3, e3, t3, n3, i2) => {
        l3.rect(e3, t3, n3, i2);
      } : (l3, e3, t3, n3, i2) => {
        l3.rect(t3, e3, i2, n3);
      };
      return (l3, i2, o2, s2, r2, u2 = 0, a2 = 0) => {
        0 == u2 && 0 == a2 ? n2(l3, i2, o2, s2, r2) : (u2 = al(u2, s2 / 2, r2 / 2), a2 = al(a2, s2 / 2, r2 / 2), e2(l3, i2 + u2, o2), t2(l3, i2 + s2, o2, i2 + s2, o2 + r2, u2), t2(l3, i2 + s2, o2 + r2, i2, o2 + r2, a2), t2(l3, i2, o2 + r2, i2, o2, a2), t2(l3, i2, o2, i2 + s2, o2, u2), l3.closePath());
      };
    }
    const kt = (l2, e2, t2) => {
      l2.moveTo(e2, t2);
    }, yt = (l2, e2, t2) => {
      l2.moveTo(t2, e2);
    }, Mt = (l2, e2, t2) => {
      l2.lineTo(e2, t2);
    }, St = (l2, e2, t2) => {
      l2.lineTo(t2, e2);
    }, Tt = vt(0), Et = vt(1), zt = (l2, e2, t2, n2, i2, o2) => {
      l2.arc(e2, t2, n2, i2, o2);
    }, Dt = (l2, e2, t2, n2, i2, o2) => {
      l2.arc(t2, e2, n2, i2, o2);
    }, Pt = (l2, e2, t2, n2, i2, o2, s2) => {
      l2.bezierCurveTo(e2, t2, n2, i2, o2, s2);
    }, At = (l2, e2, t2, n2, i2, o2, s2) => {
      l2.bezierCurveTo(t2, e2, i2, n2, s2, o2);
    };
    function Wt() {
      return (l2, e2, t2, n2, i2) => pt(l2, e2, ((e3, o2, s2, r2, u2, a2, f2, c2, h2, d2, p2) => {
        let m2, g2, { pxRound: x2, points: w2 } = e3;
        0 == r2.ori ? (m2 = kt, g2 = zt) : (m2 = yt, g2 = Dt);
        const _2 = Al(w2.width * y, 3);
        let b2 = (w2.size - w2.width) / 2 * y, v2 = Al(2 * b2, 3), k2 = new Path2D(), M2 = new Path2D(), { left: S2, top: T2, width: E2, height: z2 } = l2.bbox;
        Tt(M2, S2 - v2, T2 - v2, E2 + 2 * v2, z2 + 2 * v2);
        const D2 = (l3) => {
          if (null != s2[l3]) {
            let e4 = x2(a2(o2[l3], r2, d2, c2)), t3 = x2(f2(s2[l3], u2, p2, h2));
            m2(k2, e4 + b2, t3), g2(k2, e4, t3, b2, 0, 2 * il);
          }
        };
        if (i2) i2.forEach(D2);
        else for (let l3 = t2; n2 >= l3; l3++) D2(l3);
        return { stroke: _2 > 0 ? k2 : null, fill: k2, clip: M2, flags: 3 };
      }));
    }
    function Yt(l2) {
      return (e2, t2, n2, i2, o2, s2) => {
        n2 != i2 && (o2 != n2 && s2 != n2 && l2(e2, t2, n2), o2 != i2 && s2 != i2 && l2(e2, t2, i2), l2(e2, t2, s2));
      };
    }
    const Ct = Yt(Mt), Ht = Yt(St);
    function Ft(l2) {
      const e2 = Q(l2?.alignGaps, 0);
      return (l3, t2, n2, i2) => pt(l3, t2, ((o2, s2, r2, u2, a2, f2, c2, h2, d2, p2, m2) => {
        [n2, i2] = U(r2, n2, i2);
        let g2, x2, w2 = o2.pxRound, _2 = (l4) => w2(f2(l4, u2, p2, h2)), b2 = (l4) => w2(c2(l4, a2, m2, d2));
        0 == u2.ori ? (g2 = Mt, x2 = Ct) : (g2 = St, x2 = Ht);
        const v2 = u2.dir * (0 == u2.ori ? 1 : -1), k2 = { stroke: new Path2D(), fill: null, clip: null, band: null, gaps: null, flags: 1 }, y2 = k2.stroke;
        let M2 = false;
        if (i2 - n2 < 4 * p2) for (let l4 = 1 == v2 ? n2 : i2; l4 >= n2 && i2 >= l4; l4 += v2) {
          let e3 = r2[l4];
          null === e3 ? M2 = true : null != e3 && g2(y2, _2(s2[l4]), b2(e3));
        }
        else {
          let e3, t3, o3, a3 = (e4) => l3.posToVal(e4, u2.key, true), f3 = null, c3 = null, h3 = _2(s2[1 == v2 ? n2 : i2]), d3 = _2(s2[n2]), p3 = _2(s2[i2]), m3 = a3(1 == v2 ? d3 + 1 : p3 - 1);
          for (let l4 = 1 == v2 ? n2 : i2; l4 >= n2 && i2 >= l4; l4 += v2) {
            let n3 = s2[l4], i3 = (1 == v2 ? m3 > n3 : n3 > m3) ? h3 : _2(n3), o4 = r2[l4];
            i3 == h3 ? null != o4 ? (t3 = o4, null == f3 ? (g2(y2, i3, b2(t3)), e3 = f3 = c3 = t3) : f3 > t3 ? f3 = t3 : t3 > c3 && (c3 = t3)) : null === o4 && (M2 = true) : (null != f3 && x2(y2, h3, b2(f3), b2(c3), b2(e3), b2(t3)), null != o4 ? (t3 = o4, g2(y2, i3, b2(t3)), f3 = c3 = e3 = t3) : (f3 = c3 = null, null === o4 && (M2 = true)), h3 = i3, m3 = a3(h3 + v2));
          }
          null != f3 && f3 != c3 && o3 != h3 && x2(y2, h3, b2(f3), b2(c3), b2(e3), b2(t3));
        }
        let [S2, T2] = mt(l3, t2);
        if (null != o2.fill || 0 != S2) {
          let e3 = k2.fill = new Path2D(y2), r3 = b2(o2.fillTo(l3, t2, o2.min, o2.max, S2)), u3 = _2(s2[n2]), a3 = _2(s2[i2]);
          -1 == v2 && ([a3, u3] = [u3, a3]), g2(e3, a3, r3), g2(e3, u3, r3);
        }
        if (!o2.spanGaps) {
          let a3 = [];
          M2 && a3.push(..._t(s2, r2, n2, i2, v2, _2, e2)), k2.gaps = a3 = o2.gaps(l3, t2, n2, i2, a3), k2.clip = wt(a3, u2.ori, h2, d2, p2, m2);
        }
        return 0 != T2 && (k2.band = 2 == T2 ? [xt(l3, t2, n2, i2, y2, -1), xt(l3, t2, n2, i2, y2, 1)] : xt(l3, t2, n2, i2, y2, T2)), k2;
      }));
    }
    function Rt(l2, e2, t2, n2, i2, o2, s2 = gl) {
      if (l2.length > 1) {
        let r2 = null;
        for (let u2 = 0, a2 = 1 / 0; l2.length > u2; u2++) if (void 0 !== e2[u2]) {
          if (null != r2) {
            let e3 = ol(l2[u2] - l2[r2]);
            a2 > e3 && (a2 = e3, s2 = ol(t2(l2[u2], n2, i2, o2) - t2(l2[r2], n2, i2, o2)));
          }
          r2 = u2;
        }
      }
      return s2;
    }
    function Gt(l2, e2, t2, n2, i2) {
      const o2 = l2.length;
      if (2 > o2) return null;
      const s2 = new Path2D();
      if (t2(s2, l2[0], e2[0]), 2 == o2) n2(s2, l2[1], e2[1]);
      else {
        let t3 = Array(o2), n3 = Array(o2 - 1), r2 = Array(o2 - 1), u2 = Array(o2 - 1);
        for (let t4 = 0; o2 - 1 > t4; t4++) r2[t4] = e2[t4 + 1] - e2[t4], u2[t4] = l2[t4 + 1] - l2[t4], n3[t4] = r2[t4] / u2[t4];
        t3[0] = n3[0];
        for (let l3 = 1; o2 - 1 > l3; l3++) 0 === n3[l3] || 0 === n3[l3 - 1] || n3[l3 - 1] > 0 != n3[l3] > 0 ? t3[l3] = 0 : (t3[l3] = 3 * (u2[l3 - 1] + u2[l3]) / ((2 * u2[l3] + u2[l3 - 1]) / n3[l3 - 1] + (u2[l3] + 2 * u2[l3 - 1]) / n3[l3]), isFinite(t3[l3]) || (t3[l3] = 0));
        t3[o2 - 1] = n3[o2 - 2];
        for (let n4 = 0; o2 - 1 > n4; n4++) i2(s2, l2[n4] + u2[n4] / 3, e2[n4] + t3[n4] * u2[n4] / 3, l2[n4 + 1] - u2[n4] / 3, e2[n4 + 1] - t3[n4 + 1] * u2[n4] / 3, l2[n4 + 1], e2[n4 + 1]);
      }
      return s2;
    }
    const It = /* @__PURE__ */ new Set();
    function Lt() {
      for (let l2 of It) l2.syncRect(true);
    }
    _ && (G("resize", v, Lt), G("scroll", v, Lt, true), G(x, v, (() => {
      en.pxRatio = y;
    })));
    const Ot = Ft(), Nt = Wt();
    function jt(l2, e2, t2, n2) {
      return (n2 ? [l2[0], l2[1]].concat(l2.slice(2)) : [l2[0]].concat(l2.slice(1))).map(((l3, n3) => Ut(l3, n3, e2, t2)));
    }
    function Ut(l2, e2, t2, n2) {
      return Bl({}, 0 == e2 ? t2 : n2, l2);
    }
    function Vt(l2, e2, t2) {
      return null == e2 ? Rl : [e2, t2];
    }
    const Bt = Vt;
    function $t(l2, e2, t2) {
      return null == e2 ? Rl : Z(e2, t2, J, true);
    }
    function Jt(l2, e2, t2, n2) {
      return null == e2 ? Rl : B(e2, t2, l2.scales[n2].log, false);
    }
    const qt = Jt;
    function Kt(l2, e2, t2, n2) {
      return null == e2 ? Rl : $(e2, t2, l2.scales[n2].log, false);
    }
    const Xt = Kt;
    function Zt(l2, e2, t2, n2, i2) {
      let o2 = fl(xl(l2), xl(e2)), s2 = e2 - l2, r2 = L(i2 / n2 * s2, t2);
      do {
        let l3 = t2[r2], e3 = n2 * l3 / s2;
        if (e3 >= i2 && 17 >= o2 + (5 > l3 ? Wl.get(l3) : 0)) return [l3, e3];
      } while (++r2 < t2.length);
      return [0, 0];
    }
    function Qt(l2) {
      let e2, t2;
      return [l2 = l2.replace(/(\d+)px/, ((l3, n2) => (e2 = rl((t2 = +n2) * y)) + "px")), e2, t2];
    }
    function ln(l2) {
      l2.show && [l2.font, l2.labelFont].forEach(((l3) => {
        let e2 = Al(l3[2] * y, 1);
        l3[0] = l3[0].replace(/[0-9.]+px/, e2 + "px"), l3[1] = e2;
      }));
    }
    function en(u2, g2, _2) {
      const k2 = { mode: Q(u2.mode, 1) }, M2 = k2.mode;
      function P2(l2, e2, t2, n2) {
        let i2 = e2.valToPct(l2);
        return n2 + t2 * (-1 == e2.dir ? 1 - i2 : i2);
      }
      function W2(l2, e2, t2, n2) {
        let i2 = e2.valToPct(l2);
        return n2 + t2 * (-1 == e2.dir ? i2 : 1 - i2);
      }
      function C2(l2, e2, t2, n2) {
        return 0 == e2.ori ? P2(l2, e2, t2, n2) : W2(l2, e2, t2, n2);
      }
      k2.valToPosH = P2, k2.valToPosV = W2;
      let F2 = false;
      k2.status = 0;
      const R2 = k2.root = D("uplot");
      null != u2.id && (R2.id = u2.id), S(R2, u2.class), u2.title && (D("u-title", R2).textContent = u2.title);
      const O2 = z("canvas"), K2 = k2.ctx = O2.getContext("2d"), X2 = D("u-wrap", R2);
      G("click", X2, ((l2) => {
        l2.target === el2 && (Nn != Gn || jn != In) && Zn.click(k2, l2);
      }), true);
      const ll2 = k2.under = D("u-under", X2);
      X2.appendChild(O2);
      const el2 = k2.over = D("u-over", X2), tl2 = +Q((u2 = Vl(u2)).pxAlign, 1), sl2 = bt(tl2);
      (u2.plugins || []).forEach(((l2) => {
        l2.opts && (u2 = l2.opts(k2, u2) || u2);
      }));
      const hl2 = u2.ms || 1e-3, pl2 = k2.series = 1 == M2 ? jt(u2.series || [], Ve, ut, false) : (function(l2, e2) {
        return l2.map(((l3, t2) => 0 == t2 ? {} : Bl({}, e2, l3)));
      })(u2.series || [null], rt), xl2 = k2.axes = jt(u2.axes || [], Ue, it, true), vl2 = k2.scales = {}, Tl2 = k2.bands = u2.bands || [];
      Tl2.forEach(((l2) => {
        l2.fill = bl(l2.fill || null), l2.dir = Q(l2.dir, -1);
      }));
      const El2 = 2 == M2 ? pl2[1].facets[0].scale : pl2[0].scale, Dl2 = { axes: function() {
        for (let l2 = 0; xl2.length > l2; l2++) {
          let e2 = xl2[l2];
          if (!e2.show || !e2._show) continue;
          let t2, n2, u3 = e2.side, a2 = u3 % 2, f2 = e2.stroke(k2, l2), c2 = 0 == u3 || 3 == u3 ? -1 : 1, [h2, d2] = e2._found;
          if (null != e2.label) {
            let s2 = rl((e2._lpos + e2.labelGap * c2) * y);
            _n(e2.labelFont[0], f2, "center", 2 == u3 ? i : o), K2.save(), 1 == a2 ? (t2 = n2 = 0, K2.translate(s2, rl(lt2 + st2 / 2)), K2.rotate((3 == u3 ? -il : il) / 2)) : (t2 = rl(Qe2 + ot2 / 2), n2 = s2);
            let r2 = _l(e2.label) ? e2.label(k2, l2, h2, d2) : e2.label;
            K2.fillText(r2, t2, n2), K2.restore();
          }
          if (0 == d2) continue;
          let p2 = vl2[e2.scale], m2 = 0 == a2 ? ot2 : st2, g3 = 0 == a2 ? Qe2 : lt2, x2 = e2._splits, w2 = 2 == p2.distr ? x2.map(((l3) => pn[l3])) : x2, _3 = 2 == p2.distr ? pn[x2[1]] - pn[x2[0]] : h2, b2 = e2.ticks, v2 = e2.border, M3 = b2.show ? b2.size : 0, S2 = rl(M3 * y), T2 = rl((2 == e2.alignTo ? e2._size - M3 - e2.gap : e2.gap) * y), E2 = e2._rotate * -il / 180, z2 = sl2(e2._pos * y), D2 = z2 + (S2 + T2) * c2;
          n2 = 0 == a2 ? D2 : 0, t2 = 1 == a2 ? D2 : 0, _n(e2.font[0], f2, 1 == e2.align ? s : 2 == e2.align ? r : E2 > 0 ? s : 0 > E2 ? r : 0 == a2 ? "center" : 3 == u3 ? r : s, E2 || 1 == a2 ? "middle" : 2 == u3 ? i : o);
          let P3 = e2.font[1] * e2.lineGap, A2 = x2.map(((l3) => sl2(C2(l3, p2, m2, g3)))), W3 = e2._values;
          for (let l3 = 0; W3.length > l3; l3++) {
            let e3 = W3[l3];
            if (null != e3) {
              0 == a2 ? t2 = A2[l3] : n2 = A2[l3], e3 = "" + e3;
              let i2 = -1 == e3.indexOf("\n") ? [e3] : e3.split(/\n/gm);
              for (let l4 = 0; i2.length > l4; l4++) {
                let e4 = i2[l4];
                E2 ? (K2.save(), K2.translate(t2, n2 + l4 * P3), K2.rotate(E2), K2.fillText(e4, 0, 0), K2.restore()) : K2.fillText(e4, t2, n2 + l4 * P3);
              }
            }
          }
          b2.show && zn(A2, b2.filter(k2, w2, l2, d2, _3), a2, u3, z2, S2, Al(b2.width * y, 3), b2.stroke(k2, l2), b2.dash, b2.cap);
          let Y2 = e2.grid;
          Y2.show && zn(A2, Y2.filter(k2, w2, l2, d2, _3), a2, 0 == a2 ? 2 : 1, 0 == a2 ? lt2 : Qe2, 0 == a2 ? st2 : ot2, Al(Y2.width * y, 3), Y2.stroke(k2, l2), Y2.dash, Y2.cap), v2.show && zn([z2], [1], 0 == a2 ? 1 : 0, 0 == a2 ? 1 : 2, 1 == a2 ? lt2 : Qe2, 1 == a2 ? st2 : ot2, Al(v2.width * y, 3), v2.stroke(k2, l2), v2.dash, v2.cap);
        }
        Ci("drawAxes");
      }, series: function() {
        if (Gt2 > 0) {
          let l2 = pl2.some(((l3) => l3._focus)) && dn != Tt2.alpha;
          l2 && (K2.globalAlpha = dn = Tt2.alpha), pl2.forEach(((l3, e2) => {
            if (e2 > 0 && l3.show && (kn(e2, false), kn(e2, true), null == l3._paths)) {
              let t2 = dn;
              dn != l3.alpha && (K2.globalAlpha = dn = l3.alpha);
              let n2 = 2 == M2 ? [0, g2[e2][0].length - 1] : (function(l4) {
                let e3 = wl(Lt2 - 1, 0, Gt2 - 1), t3 = wl(en2 + 1, 0, Gt2 - 1);
                for (; null == l4[e3] && e3 > 0; ) e3--;
                for (; null == l4[t3] && Gt2 - 1 > t3; ) t3++;
                return [e3, t3];
              })(g2[e2]);
              l3._paths = l3.paths(k2, e2, n2[0], n2[1]), dn != t2 && (K2.globalAlpha = dn = t2);
            }
          })), pl2.forEach(((l3, e2) => {
            if (e2 > 0 && l3.show) {
              let t2 = dn;
              dn != l3.alpha && (K2.globalAlpha = dn = l3.alpha), null != l3._paths && yn(e2, false);
              {
                let t3 = null != l3._paths ? l3._paths.gaps : null, n2 = l3.points.show(k2, e2, Lt2, en2, t3), i2 = l3.points.filter(k2, e2, n2, t3);
                (n2 || i2) && (l3.points._paths = l3.points.paths(k2, e2, Lt2, en2, i2), yn(e2, true));
              }
              dn != t2 && (K2.globalAlpha = dn = t2), Ci("drawSeries", e2);
            }
          })), l2 && (K2.globalAlpha = dn = 1);
        }
      } }, Pl2 = (u2.drawOrder || ["axes", "series"]).map(((l2) => Dl2[l2]));
      function Cl2(l2) {
        const e2 = 3 == l2.distr ? (e3) => dl(e3 > 0 ? e3 : l2.clamp(k2, e3, l2.min, l2.max, l2.key)) : 4 == l2.distr ? (e3) => ml(e3, l2.asinh) : 100 == l2.distr ? (e3) => l2.fwd(e3) : (l3) => l3;
        return (t2) => {
          let n2 = e2(t2), { _min: i2, _max: o2 } = l2;
          return (n2 - i2) / (o2 - i2);
        };
      }
      function Il2(l2) {
        let e2 = vl2[l2];
        if (null == e2) {
          let t2 = (u2.scales || Hl)[l2] || Hl;
          if (null != t2.from) {
            Il2(t2.from);
            let e3 = Bl({}, vl2[t2.from], t2, { key: l2 });
            e3.valToPct = Cl2(e3), vl2[l2] = e3;
          } else {
            e2 = vl2[l2] = Bl({}, l2 == El2 ? ft : ct, t2), e2.key = l2;
            let n2 = e2.time, i2 = e2.range, o2 = Gl(i2);
            if ((l2 != El2 || 2 == M2 && !n2) && (!o2 || null != i2[0] && null != i2[1] || (i2 = { min: null == i2[0] ? q : { mode: 1, hard: i2[0], soft: i2[0] }, max: null == i2[1] ? q : { mode: 1, hard: i2[1], soft: i2[1] } }, o2 = false), !o2 && Ol(i2))) {
              let l3 = i2;
              i2 = (e3, t3, n3) => null == t3 ? Rl : Z(t3, n3, l3);
            }
            e2.range = bl(i2 || (n2 ? Bt : l2 == El2 ? 3 == e2.distr ? qt : 4 == e2.distr ? Xt : Vt : 3 == e2.distr ? Jt : 4 == e2.distr ? Kt : $t)), e2.auto = bl(!o2 && e2.auto), e2.clamp = bl(e2.clamp || at), e2._min = e2._max = null, e2.valToPct = Cl2(e2);
          }
        }
      }
      Il2("x"), Il2("y"), 1 == M2 && pl2.forEach(((l2) => {
        Il2(l2.scale);
      })), xl2.forEach(((l2) => {
        Il2(l2.scale);
      }));
      for (let l2 in u2.scales) Il2(l2);
      const jl2 = vl2[El2], Ul2 = jl2.distr;
      let $l2, ql2;
      0 == jl2.ori ? (S(R2, "u-hz"), $l2 = P2, ql2 = W2) : (S(R2, "u-vt"), $l2 = W2, ql2 = P2);
      const Kl2 = {};
      for (let l2 in vl2) {
        let e2 = vl2[l2];
        null == e2.min && null == e2.max || (Kl2[l2] = { min: e2.min, max: e2.max }, e2.min = e2.max = null);
      }
      const Xl2 = u2.tzDate || ((l2) => new Date(rl(l2 / hl2))), Zl2 = u2.fmtDate || ne, Ql2 = 1 == hl2 ? Me(Xl2) : Ee(Xl2), le2 = De(Xl2, ze(1 == hl2 ? ye : Te, Zl2)), ee2 = We(Xl2, Ae("{YYYY}-{MM}-{DD} {h}:{mm}{aa}", Zl2)), te2 = [], ie2 = k2.legend = Bl({}, Ye, u2.legend), oe2 = k2.cursor = Bl({}, Re, { drag: { y: 2 == M2 } }, u2.cursor), se2 = ie2.show, re2 = oe2.show, ue2 = ie2.markers;
      let ce2, he2, de2;
      ie2.idxs = te2, ue2.width = bl(ue2.width), ue2.dash = bl(ue2.dash), ue2.stroke = bl(ue2.stroke), ue2.fill = bl(ue2.fill);
      let pe2, me2 = [], ge2 = [], xe2 = false, we2 = {};
      if (ie2.live) {
        const l2 = pl2[1] ? pl2[1].values : null;
        xe2 = null != l2, pe2 = xe2 ? l2(k2, 1, 0) : { _: 0 };
        for (let l3 in pe2) we2[l3] = w;
      }
      if (se2) if (ce2 = z("table", "u-legend", R2), de2 = z("tbody", null, ce2), ie2.mount(k2, ce2), xe2) {
        he2 = z("thead", null, ce2, de2);
        let l2 = z("tr", null, he2);
        for (var _e2 in z("th", null, l2), pe2) z("th", e, l2).textContent = _e2;
      } else S(ce2, "u-inline"), ie2.live && S(ce2, "u-live");
      const be2 = { show: true }, ve2 = { show: false }, Pe2 = /* @__PURE__ */ new Map();
      function Ce2(l2, e2, t2, n2 = true) {
        const i2 = Pe2.get(e2) || {}, o2 = oe2.bind[l2](k2, e2, t2, n2);
        o2 && (G(l2, e2, i2[l2] = o2), Pe2.set(e2, i2));
      }
      function He2(l2, e2) {
        const t2 = Pe2.get(e2) || {};
        for (let n2 in t2) null != l2 && n2 != l2 || (I(n2, e2, t2[n2]), delete t2[n2]);
        null == l2 && Pe2.delete(e2);
      }
      let Fe2 = 0, Ge2 = 0, Ie2 = 0, Le2 = 0, Oe2 = 0, Ne2 = 0, je2 = Oe2, Ke2 = Ne2, Xe2 = Ie2, Ze2 = Le2, Qe2 = 0, lt2 = 0, ot2 = 0, st2 = 0;
      k2.bbox = {};
      let ht2 = false, pt2 = false, mt2 = false, xt2 = false, wt2 = false, _t2 = false;
      function vt2(l2, e2, t2) {
        (t2 || l2 != k2.width || e2 != k2.height) && kt2(l2, e2), An(false), mt2 = true, pt2 = true, Jn();
      }
      function kt2(l2, e2) {
        k2.width = Fe2 = Ie2 = l2, k2.height = Ge2 = Le2 = e2, Oe2 = Ne2 = 0, (function() {
          let l3 = false, e3 = false, t3 = false, n2 = false;
          xl2.forEach(((i2) => {
            if (i2.show && i2._show) {
              let { side: o2, _size: s2 } = i2, r2 = s2 + (null != i2.label ? i2.labelSize : 0);
              r2 > 0 && (o2 % 2 ? (Ie2 -= r2, 3 == o2 ? (Oe2 += r2, n2 = true) : t3 = true) : (Le2 -= r2, 0 == o2 ? (Ne2 += r2, l3 = true) : e3 = true));
            }
          })), Ct2[0] = l3, Ct2[1] = t3, Ct2[2] = e3, Ct2[3] = n2, Ie2 -= Rt2[1] + Rt2[3], Oe2 += Rt2[3], Le2 -= Rt2[2] + Rt2[0], Ne2 += Rt2[0];
        })(), (function() {
          let l3 = Oe2 + Ie2, e3 = Ne2 + Le2, t3 = Oe2, n2 = Ne2;
          function i2(i3, o2) {
            switch (i3) {
              case 1:
                return l3 += o2, l3 - o2;
              case 2:
                return e3 += o2, e3 - o2;
              case 3:
                return t3 -= o2, t3 + o2;
              case 0:
                return n2 -= o2, n2 + o2;
            }
          }
          xl2.forEach(((l4) => {
            if (l4.show && l4._show) {
              let e4 = l4.side;
              l4._pos = i2(e4, l4._size), null != l4.label && (l4._lpos = i2(e4, l4.labelSize));
            }
          }));
        })();
        let t2 = k2.bbox;
        Qe2 = t2.left = zl(Oe2 * y, 0.5), lt2 = t2.top = zl(Ne2 * y, 0.5), ot2 = t2.width = zl(Ie2 * y, 0.5), st2 = t2.height = zl(Le2 * y, 0.5);
      }
      const yt2 = 3;
      if (k2.setSize = function({ width: l2, height: e2 }) {
        vt2(l2, e2);
      }, null == oe2.dataIdx) {
        let l2 = oe2.hover, e2 = l2.skip = new Set(l2.skip ?? []);
        e2.add(void 0);
        let t2 = l2.prox = bl(l2.prox), n2 = l2.bias ??= 0;
        oe2.dataIdx = (l3, i2, o2, s2) => {
          if (0 == i2) return o2;
          let r2 = o2, u3 = t2(l3, i2, o2, s2) ?? gl, a2 = u3 >= 0 && gl > u3, f2 = 0 == jl2.ori ? Ie2 : Le2, c2 = oe2.left, h2 = g2[0], d2 = g2[i2];
          if (e2.has(d2[o2])) {
            r2 = null;
            let l4, t3 = null, i3 = null;
            if (0 == n2 || -1 == n2) for (l4 = o2; null == t3 && l4-- > 0; ) e2.has(d2[l4]) || (t3 = l4);
            if (0 == n2 || 1 == n2) for (l4 = o2; null == i3 && l4++ < d2.length; ) e2.has(d2[l4]) || (i3 = l4);
            if (null != t3 || null != i3) if (a2) {
              let l5 = c2 - (null == t3 ? -1 / 0 : $l2(h2[t3], jl2, f2, 0)), e3 = (null == i3 ? 1 / 0 : $l2(h2[i3], jl2, f2, 0)) - c2;
              l5 > e3 ? e3 > u3 || (r2 = i3) : l5 > u3 || (r2 = t3);
            } else r2 = null == i3 ? t3 : null == t3 || o2 - t3 > i3 - o2 ? i3 : t3;
          } else a2 && ol(c2 - $l2(h2[o2], jl2, f2, 0)) > u3 && (r2 = null);
          return r2;
        };
      }
      const Mt2 = (l2) => {
        oe2.event = l2;
      };
      oe2.idxs = te2, oe2._lock = false;
      let St2 = oe2.points;
      St2.show = bl(St2.show), St2.size = bl(St2.size), St2.stroke = bl(St2.stroke), St2.width = bl(St2.width), St2.fill = bl(St2.fill);
      const Tt2 = k2.focus = Bl({}, u2.focus || { alpha: 0.3 }, oe2.focus), Et2 = Tt2.prox >= 0, zt2 = Et2 && St2.one;
      let Dt2 = [], Pt2 = [], At2 = [];
      function Wt2(l2, e2) {
        let t2 = St2.show(k2, e2);
        if (t2 instanceof HTMLElement) return S(t2, "u-cursor-pt"), S(t2, l2.class), A(t2, -10, -10, Ie2, Le2), el2.insertBefore(t2, Dt2[e2]), t2;
      }
      function Yt2(t2, n2) {
        if (1 == M2 || n2 > 0) {
          let l2 = 1 == M2 && vl2[t2.scale].time, e2 = t2.value;
          t2.value = l2 ? Ll(e2) ? We(Xl2, Ae(e2, Zl2)) : e2 || ee2 : e2 || nt, t2.label = t2.label || (l2 ? "Time" : "Value");
        }
        if (zt2 || n2 > 0) {
          t2.width = null == t2.width ? 1 : t2.width, t2.paths = t2.paths || Ot || yl, t2.fillTo = bl(t2.fillTo || gt), t2.pxAlign = +Q(t2.pxAlign, tl2), t2.pxRound = bt(t2.pxAlign), t2.stroke = bl(t2.stroke || null), t2.fill = bl(t2.fill || null), t2._stroke = t2._fill = t2._paths = t2._focus = null;
          let l2 = (function(l3) {
            return Al(1 * (3 + 2 * (l3 || 1)), 3);
          })(fl(1, t2.width)), e2 = t2.points = Bl({}, { size: l2, width: fl(1, 0.2 * l2), stroke: t2.stroke, space: 2 * l2, paths: Nt, _stroke: null, _fill: null }, t2.points);
          e2.show = bl(e2.show), e2.filter = bl(e2.filter), e2.fill = bl(e2.fill), e2.stroke = bl(e2.stroke), e2.paths = bl(e2.paths), e2.pxAlign = t2.pxAlign;
        }
        if (se2) {
          let i2 = (function(t3, n3) {
            if (0 == n3 && (xe2 || !ie2.live || 2 == M2)) return Rl;
            let i3 = [], o2 = z("tr", "u-series", de2, de2.childNodes[n3]);
            S(o2, t3.class), t3.show || S(o2, l);
            let s2 = z("th", null, o2);
            if (ue2.show) {
              let l2 = D("u-marker", s2);
              if (n3 > 0) {
                let e2 = ue2.width(k2, n3);
                e2 && (l2.style.border = e2 + "px " + ue2.dash(k2, n3) + " " + ue2.stroke(k2, n3)), l2.style.background = ue2.fill(k2, n3);
              }
            }
            let r2 = D(e, s2);
            for (var u3 in t3.label instanceof HTMLElement ? r2.appendChild(t3.label) : r2.textContent = t3.label, n3 > 0 && (ue2.show || (r2.style.color = t3.width > 0 ? ue2.stroke(k2, n3) : ue2.fill(k2, n3)), Ce2("click", s2, ((l2) => {
              if (oe2._lock) return;
              Mt2(l2);
              let e2 = pl2.indexOf(t3);
              if ((l2.ctrlKey || l2.metaKey) != ie2.isolate) {
                let l3 = pl2.some(((l4, t4) => t4 > 0 && t4 != e2 && l4.show));
                pl2.forEach(((t4, n4) => {
                  n4 > 0 && oi(n4, l3 ? n4 == e2 ? be2 : ve2 : be2, true, Fi.setSeries);
                }));
              } else oi(e2, { show: !t3.show }, true, Fi.setSeries);
            }), false), Et2 && Ce2(d, s2, ((l2) => {
              oe2._lock || (Mt2(l2), oi(pl2.indexOf(t3), ai, true, Fi.setSeries));
            }), false)), pe2) {
              let l2 = z("td", "u-value", o2);
              l2.textContent = "--", i3.push(l2);
            }
            return [o2, i3];
          })(t2, n2);
          me2.splice(n2, 0, i2[0]), ge2.splice(n2, 0, i2[1]), ie2.values.push(null);
        }
        if (re2) {
          te2.splice(n2, 0, null);
          let l2 = null;
          zt2 ? 0 == n2 && (l2 = Wt2(t2, n2)) : n2 > 0 && (l2 = Wt2(t2, n2)), Dt2.splice(n2, 0, l2), Pt2.splice(n2, 0, 0), At2.splice(n2, 0, 0);
        }
        Ci("addSeries", n2);
      }
      k2.addSeries = function(l2, e2) {
        e2 = null == e2 ? pl2.length : e2, l2 = 1 == M2 ? Ut(l2, e2, Ve, ut) : Ut(l2, e2, {}, rt), pl2.splice(e2, 0, l2), Yt2(pl2[e2], e2);
      }, k2.delSeries = function(l2) {
        if (pl2.splice(l2, 1), se2) {
          ie2.values.splice(l2, 1), ge2.splice(l2, 1);
          let e2 = me2.splice(l2, 1)[0];
          He2(null, e2.firstChild), e2.remove();
        }
        re2 && (te2.splice(l2, 1), Dt2.splice(l2, 1)[0].remove(), Pt2.splice(l2, 1), At2.splice(l2, 1)), Ci("delSeries", l2);
      };
      const Ct2 = [false, false, false, false];
      function Ht2(l2, e2, t2) {
        let [n2, i2, o2, s2] = t2, r2 = e2 % 2, u3 = 0;
        return 0 == r2 && (s2 || i2) && (u3 = 0 == e2 && !n2 || 2 == e2 && !o2 ? rl(Ue.size / 3) : 0), 1 == r2 && (n2 || o2) && (u3 = 1 == e2 && !i2 || 3 == e2 && !s2 ? rl(it.size / 2) : 0), u3;
      }
      const Ft2 = k2.padding = (u2.padding || [Ht2, Ht2, Ht2, Ht2]).map(((l2) => bl(Q(l2, Ht2)))), Rt2 = k2._padding = Ft2.map(((l2, e2) => l2(k2, e2, Ct2, 0)));
      let Gt2, Lt2 = null, en2 = null;
      const tn = 1 == M2 ? pl2[0].idxs : null;
      let nn, on, sn, rn, un, an, fn, cn, hn, dn, pn = null, mn = false;
      function gn(l2, e2) {
        if (k2.data = k2._data = g2 = null == l2 ? [] : l2, 2 == M2) {
          Gt2 = 0;
          for (let l3 = 1; pl2.length > l3; l3++) Gt2 += g2[l3][0].length;
        } else {
          0 == g2.length && (k2.data = k2._data = g2 = [[]]), pn = g2[0], Gt2 = pn.length;
          let l3 = g2;
          if (2 == Ul2) {
            l3 = g2.slice();
            let e3 = l3[0] = Array(Gt2);
            for (let l4 = 0; Gt2 > l4; l4++) e3[l4] = l4;
          }
          k2._data = g2 = l3;
        }
        if (An(true), Ci("setData"), 2 == Ul2 && (mt2 = true), false !== e2) {
          let l3 = jl2;
          l3.auto(k2, mn) ? xn() : ii(El2, l3.min, l3.max), xt2 = xt2 || oe2.left >= 0, _t2 = true, Jn();
        }
      }
      function xn() {
        let l2, e2;
        mn = true, 1 == M2 && (Gt2 > 0 ? (Lt2 = tn[0] = 0, en2 = tn[1] = Gt2 - 1, l2 = g2[0][Lt2], e2 = g2[0][en2], 2 == Ul2 ? (l2 = Lt2, e2 = en2) : l2 == e2 && (3 == Ul2 ? [l2, e2] = B(l2, l2, jl2.log, false) : 4 == Ul2 ? [l2, e2] = $(l2, l2, jl2.log, false) : jl2.time ? e2 = l2 + rl(86400 / hl2) : [l2, e2] = Z(l2, e2, J, true))) : (Lt2 = tn[0] = l2 = null, en2 = tn[1] = e2 = null)), ii(El2, l2, e2);
      }
      function wn(l2, e2, t2, n2, i2, o2) {
        l2 ??= a, t2 ??= Fl, n2 ??= "butt", i2 ??= a, o2 ??= "round", l2 != nn && (K2.strokeStyle = nn = l2), i2 != on && (K2.fillStyle = on = i2), e2 != sn && (K2.lineWidth = sn = e2), o2 != un && (K2.lineJoin = un = o2), n2 != an && (K2.lineCap = an = n2), t2 != rn && K2.setLineDash(rn = t2);
      }
      function _n(l2, e2, t2, n2) {
        e2 != on && (K2.fillStyle = on = e2), l2 != fn && (K2.font = fn = l2), t2 != cn && (K2.textAlign = cn = t2), n2 != hn && (K2.textBaseline = hn = n2);
      }
      function bn(l2, e2, t2, n2, i2 = 0) {
        if (n2.length > 0 && l2.auto(k2, mn) && (null == e2 || null == e2.min)) {
          let e3 = Q(Lt2, 0), o2 = Q(en2, n2.length - 1), s2 = null == t2.min ? (function(l3, e4, t3, n3 = 0, i3 = false) {
            let o3 = i3 ? V : U, s3 = i3 ? j : N;
            [e4, t3] = o3(l3, e4, t3);
            let r2 = l3[e4], u3 = l3[e4];
            if (e4 > -1) if (1 == n3) r2 = l3[e4], u3 = l3[t3];
            else if (-1 == n3) r2 = l3[t3], u3 = l3[e4];
            else for (let n4 = e4; t3 >= n4; n4++) {
              let e5 = l3[n4];
              s3(e5) && (r2 > e5 ? r2 = e5 : e5 > u3 && (u3 = e5));
            }
            return [r2 ?? gl, u3 ?? -gl];
          })(n2, e3, o2, i2, 3 == l2.distr) : [t2.min, t2.max];
          l2.min = al(l2.min, t2.min = s2[0]), l2.max = fl(l2.max, t2.max = s2[1]);
        }
      }
      k2.setData = gn;
      const vn = { min: null, max: null };
      function kn(l2, e2) {
        let t2 = e2 ? pl2[l2].points : pl2[l2];
        t2._stroke = t2.stroke(k2, l2), t2._fill = t2.fill(k2, l2);
      }
      function yn(l2, e2) {
        let t2 = e2 ? pl2[l2].points : pl2[l2], { stroke: n2, fill: i2, clip: o2, flags: s2, _stroke: r2 = t2._stroke, _fill: u3 = t2._fill, _width: a2 = t2.width } = t2._paths;
        a2 = Al(a2 * y, 3);
        let f2 = null, c2 = a2 % 2 / 2;
        e2 && null == u3 && (u3 = a2 > 0 ? "#fff" : r2);
        let h2 = 1 == t2.pxAlign && c2 > 0;
        if (h2 && K2.translate(c2, c2), !e2) {
          let l3 = Qe2 - a2 / 2, e3 = lt2 - a2 / 2, t3 = ot2 + a2, n3 = st2 + a2;
          f2 = new Path2D(), f2.rect(l3, e3, t3, n3);
        }
        e2 ? Sn(r2, a2, t2.dash, t2.cap, u3, n2, i2, s2, o2) : (function(l3, e3, t3, n3, i3, o3, s3, r3, u4, a3, f3) {
          let c3 = false;
          0 != u4 && Tl2.forEach(((h3, d2) => {
            if (h3.series[0] == l3) {
              let l4, p2 = pl2[h3.series[1]], m2 = g2[h3.series[1]], x2 = (p2._paths || Hl).band;
              Gl(x2) && (x2 = 1 == h3.dir ? x2[0] : x2[1]);
              let w2 = null;
              p2.show && x2 && (function(l5, e4, t4) {
                for (e4 = Q(e4, 0), t4 = Q(t4, l5.length - 1); t4 >= e4; ) {
                  if (null != l5[e4]) return true;
                  e4++;
                }
                return false;
              })(m2, Lt2, en2) ? (w2 = h3.fill(k2, d2) || o3, l4 = p2._paths.clip) : x2 = null, Sn(e3, t3, n3, i3, w2, s3, r3, u4, a3, f3, l4, x2), c3 = true;
            }
          })), c3 || Sn(e3, t3, n3, i3, o3, s3, r3, u4, a3, f3);
        })(l2, r2, a2, t2.dash, t2.cap, u3, n2, i2, s2, f2, o2), h2 && K2.translate(-c2, -c2);
      }
      const Mn = 3;
      function Sn(l2, e2, t2, n2, i2, o2, s2, r2, u3, a2, f2, c2) {
        wn(l2, e2, t2, n2, i2), (u3 || a2 || c2) && (K2.save(), u3 && K2.clip(u3), a2 && K2.clip(a2)), c2 ? (r2 & Mn) == Mn ? (K2.clip(c2), f2 && K2.clip(f2), En(i2, s2), Tn(l2, o2, e2)) : 2 & r2 ? (En(i2, s2), K2.clip(c2), Tn(l2, o2, e2)) : 1 & r2 && (K2.save(), K2.clip(c2), f2 && K2.clip(f2), En(i2, s2), K2.restore(), Tn(l2, o2, e2)) : (En(i2, s2), Tn(l2, o2, e2)), (u3 || a2 || c2) && K2.restore();
      }
      function Tn(l2, e2, t2) {
        t2 > 0 && (e2 instanceof Map ? e2.forEach(((l3, e3) => {
          K2.strokeStyle = nn = e3, K2.stroke(l3);
        })) : null != e2 && l2 && K2.stroke(e2));
      }
      function En(l2, e2) {
        e2 instanceof Map ? e2.forEach(((l3, e3) => {
          K2.fillStyle = on = e3, K2.fill(l3);
        })) : null != e2 && l2 && K2.fill(e2);
      }
      function zn(l2, e2, t2, n2, i2, o2, s2, r2, u3, a2) {
        let f2 = s2 % 2 / 2;
        1 == tl2 && K2.translate(f2, f2), wn(r2, s2, u3, a2, r2), K2.beginPath();
        let c2, h2, d2, p2, m2 = i2 + (0 == n2 || 3 == n2 ? -o2 : o2);
        0 == t2 ? (h2 = i2, p2 = m2) : (c2 = i2, d2 = m2);
        for (let n3 = 0; l2.length > n3; n3++) null != e2[n3] && (0 == t2 ? c2 = d2 = l2[n3] : h2 = p2 = l2[n3], K2.moveTo(c2, h2), K2.lineTo(d2, p2));
        K2.stroke(), 1 == tl2 && K2.translate(-f2, -f2);
      }
      function Dn(l2) {
        let e2 = true;
        return xl2.forEach(((t2, n2) => {
          if (!t2.show) return;
          let i2 = vl2[t2.scale];
          if (null == i2.min) return void (t2._show && (e2 = false, t2._show = false, An(false)));
          t2._show || (e2 = false, t2._show = true, An(false));
          let o2 = t2.side, s2 = o2 % 2, { min: r2, max: u3 } = i2, [a2, f2] = (function(l3, e3, t3, n3) {
            let i3, o3 = xl2[l3];
            if (n3 > 0) {
              let s3 = o3._space = o3.space(k2, l3, e3, t3, n3);
              i3 = Zt(e3, t3, o3._incrs = o3.incrs(k2, l3, e3, t3, n3, s3), n3, s3);
            } else i3 = [0, 0];
            return o3._found = i3;
          })(n2, r2, u3, 0 == s2 ? Ie2 : Le2);
          if (0 == f2) return;
          let c2 = t2._splits = t2.splits(k2, n2, r2, u3, a2, f2, 2 == i2.distr), h2 = 2 == i2.distr ? c2.map(((l3) => pn[l3])) : c2, d2 = 2 == i2.distr ? pn[c2[1]] - pn[c2[0]] : a2, p2 = t2._values = t2.values(k2, t2.filter(k2, h2, n2, f2, d2), n2, f2, d2);
          t2._rotate = 2 == o2 ? t2.rotate(k2, p2, n2, f2) : 0;
          let m2 = t2._size;
          t2._size = ul(t2.size(k2, p2, n2, l2)), null != m2 && t2._size != m2 && (e2 = false);
        })), e2;
      }
      function Pn(l2) {
        let e2 = true;
        return Ft2.forEach(((t2, n2) => {
          let i2 = t2(k2, n2, Ct2, l2);
          i2 != Rt2[n2] && (e2 = false), Rt2[n2] = i2;
        })), e2;
      }
      function An(l2) {
        pl2.forEach(((e2, t2) => {
          t2 > 0 && (e2._paths = null, l2 && (1 == M2 ? (e2.min = null, e2.max = null) : e2.facets.forEach(((l3) => {
            l3.min = null, l3.max = null;
          }))));
        }));
      }
      let Wn, Yn, Cn, Hn, Fn, Rn, Gn, In, Ln, On, Nn, jn, Un = false, Vn = false, Bn = [];
      function $n() {
        Vn = false;
        for (let l2 = 0; Bn.length > l2; l2++) Ci(...Bn[l2]);
        Bn.length = 0;
      }
      function Jn() {
        Un || (Jl(qn), Un = true);
      }
      function qn() {
        if (ht2 && ((function() {
          for (let l3 in vl2) {
            let e3 = vl2[l3];
            null == Kl2[l3] && (null == e3.min || null != Kl2[El2] && e3.auto(k2, mn)) && (Kl2[l3] = vn);
          }
          for (let l3 in vl2) {
            let e3 = vl2[l3];
            null == Kl2[l3] && null != e3.from && null != Kl2[e3.from] && (Kl2[l3] = vn);
          }
          null != Kl2[El2] && An(true);
          let l2 = {};
          for (let e3 in Kl2) {
            let t3 = Kl2[e3];
            if (null != t3) {
              let n2 = l2[e3] = Vl(vl2[e3], Nl);
              if (null != t3.min) Bl(n2, t3);
              else if (e3 != El2 || 2 == M2) if (0 == Gt2 && null == n2.from) {
                let l3 = n2.range(k2, null, null, e3);
                n2.min = l3[0], n2.max = l3[1];
              } else n2.min = gl, n2.max = -gl;
            }
          }
          if (Gt2 > 0) {
            pl2.forEach(((e3, t3) => {
              if (1 == M2) {
                let n2 = e3.scale, i2 = Kl2[n2];
                if (null == i2) return;
                let o2 = l2[n2];
                if (0 == t3) {
                  let l3 = o2.range(k2, o2.min, o2.max, n2);
                  o2.min = l3[0], o2.max = l3[1], Lt2 = L(o2.min, g2[0]), en2 = L(o2.max, g2[0]), en2 - Lt2 > 1 && (o2.min > g2[0][Lt2] && Lt2++, g2[0][en2] > o2.max && en2--), e3.min = pn[Lt2], e3.max = pn[en2];
                } else e3.show && e3.auto && bn(o2, i2, e3, g2[t3], e3.sorted);
                e3.idxs[0] = Lt2, e3.idxs[1] = en2;
              } else if (t3 > 0 && e3.show && e3.auto) {
                let [n2, i2] = e3.facets, o2 = n2.scale, s2 = i2.scale, [r2, u3] = g2[t3], a2 = l2[o2], f2 = l2[s2];
                null != a2 && bn(a2, Kl2[o2], n2, r2, n2.sorted), null != f2 && bn(f2, Kl2[s2], i2, u3, i2.sorted), e3.min = i2.min, e3.max = i2.max;
              }
            }));
            for (let e3 in l2) {
              let t3 = l2[e3], n2 = Kl2[e3];
              if (null == t3.from && (null == n2 || null == n2.min)) {
                let l3 = t3.range(k2, t3.min == gl ? null : t3.min, t3.max == -gl ? null : t3.max, e3);
                t3.min = l3[0], t3.max = l3[1];
              }
            }
          }
          for (let e3 in l2) {
            let t3 = l2[e3];
            if (null != t3.from) {
              let n2 = l2[t3.from];
              if (null == n2.min) t3.min = t3.max = null;
              else {
                let l3 = t3.range(k2, n2.min, n2.max, e3);
                t3.min = l3[0], t3.max = l3[1];
              }
            }
          }
          let e2 = {}, t2 = false;
          for (let n2 in l2) {
            let i2 = l2[n2], o2 = vl2[n2];
            if (o2.min != i2.min || o2.max != i2.max) {
              o2.min = i2.min, o2.max = i2.max;
              let l3 = o2.distr;
              o2._min = 3 == l3 ? dl(o2.min) : 4 == l3 ? ml(o2.min, o2.asinh) : 100 == l3 ? o2.fwd(o2.min) : o2.min, o2._max = 3 == l3 ? dl(o2.max) : 4 == l3 ? ml(o2.max, o2.asinh) : 100 == l3 ? o2.fwd(o2.max) : o2.max, e2[n2] = t2 = true;
            }
          }
          if (t2) {
            pl2.forEach(((l3, t3) => {
              2 == M2 ? t3 > 0 && e2.y && (l3._paths = null) : e2[l3.scale] && (l3._paths = null);
            }));
            for (let l3 in e2) mt2 = true, Ci("setScale", l3);
            re2 && oe2.left >= 0 && (xt2 = _t2 = true);
          }
          for (let l3 in Kl2) Kl2[l3] = null;
        })(), ht2 = false), mt2 && ((function() {
          let l2 = false, e2 = 0;
          for (; !l2; ) {
            e2++;
            let t2 = Dn(e2), n2 = Pn(e2);
            l2 = e2 == yt2 || t2 && n2, l2 || (kt2(k2.width, k2.height), pt2 = true);
          }
        })(), mt2 = false), pt2) {
          if (E(ll2, s, Oe2), E(ll2, i, Ne2), E(ll2, t, Ie2), E(ll2, n, Le2), E(el2, s, Oe2), E(el2, i, Ne2), E(el2, t, Ie2), E(el2, n, Le2), E(X2, t, Fe2), E(X2, n, Ge2), O2.width = rl(Fe2 * y), O2.height = rl(Ge2 * y), xl2.forEach((({ _el: e2, _show: t2, _size: n2, _pos: i2, side: o2 }) => {
            if (null != e2) if (t2) {
              let t3 = o2 % 2 == 1;
              E(e2, t3 ? "left" : "top", i2 - (3 === o2 || 0 === o2 ? n2 : 0)), E(e2, t3 ? "width" : "height", n2), E(e2, t3 ? "top" : "left", t3 ? Ne2 : Oe2), E(e2, t3 ? "height" : "width", t3 ? Le2 : Ie2), T(e2, l);
            } else S(e2, l);
          })), nn = on = sn = un = an = fn = cn = hn = rn = null, dn = 1, _i(true), Oe2 != je2 || Ne2 != Ke2 || Ie2 != Xe2 || Le2 != Ze2) {
            An(false);
            let l2 = Ie2 / Xe2, e2 = Le2 / Ze2;
            if (re2 && !xt2 && oe2.left >= 0) {
              oe2.left *= l2, oe2.top *= e2, Cn && A(Cn, rl(oe2.left), 0, Ie2, Le2), Hn && A(Hn, 0, rl(oe2.top), Ie2, Le2);
              for (let t2 = 0; Dt2.length > t2; t2++) {
                let n2 = Dt2[t2];
                null != n2 && (Pt2[t2] *= l2, At2[t2] *= e2, A(n2, ul(Pt2[t2]), ul(At2[t2]), Ie2, Le2));
              }
            }
            if (ei.show && !wt2 && ei.left >= 0 && ei.width > 0) {
              ei.left *= l2, ei.width *= l2, ei.top *= e2, ei.height *= e2;
              for (let l3 in ki) E(ti, l3, ei[l3]);
            }
            je2 = Oe2, Ke2 = Ne2, Xe2 = Ie2, Ze2 = Le2;
          }
          Ci("setSize"), pt2 = false;
        }
        Fe2 > 0 && Ge2 > 0 && (K2.clearRect(0, 0, O2.width, O2.height), Ci("drawClear"), Pl2.forEach(((l2) => l2())), Ci("draw")), ei.show && wt2 && (ni(ei), wt2 = false), re2 && xt2 && (xi(null, true, false), xt2 = false), ie2.show && ie2.live && _t2 && (mi(), _t2 = false), F2 || (F2 = true, k2.status = 1, Ci("ready")), mn = false, Un = false;
      }
      function Kn(l2, e2) {
        let t2 = vl2[l2];
        if (null == t2.from) {
          if (0 == Gt2) {
            let n2 = t2.range(k2, e2.min, e2.max, l2);
            e2.min = n2[0], e2.max = n2[1];
          }
          if (e2.min > e2.max) {
            let l3 = e2.min;
            e2.min = e2.max, e2.max = l3;
          }
          if (Gt2 > 1 && null != e2.min && null != e2.max && 1e-16 > e2.max - e2.min) return;
          l2 == El2 && 2 == t2.distr && Gt2 > 0 && (e2.min = L(e2.min, g2[0]), e2.max = L(e2.max, g2[0]), e2.min == e2.max && e2.max++), Kl2[l2] = e2, ht2 = true, Jn();
        }
      }
      k2.batch = function(l2, e2 = false) {
        Un = true, Vn = e2, l2(k2), qn(), e2 && Bn.length > 0 && queueMicrotask($n);
      }, k2.redraw = (l2, e2) => {
        mt2 = e2 || false, false !== l2 ? ii(El2, jl2.min, jl2.max) : Jn();
      }, k2.setScale = Kn;
      let Xn = false;
      const Zn = oe2.drag;
      let Qn = Zn.x, li = Zn.y;
      re2 && (oe2.x && (Wn = D("u-cursor-x", el2)), oe2.y && (Yn = D("u-cursor-y", el2)), 0 == jl2.ori ? (Cn = Wn, Hn = Yn) : (Cn = Yn, Hn = Wn), Nn = oe2.left, jn = oe2.top);
      const ei = k2.select = Bl({ show: true, over: true, left: 0, width: 0, top: 0, height: 0 }, u2.select), ti = ei.show ? D("u-select", ei.over ? el2 : ll2) : null;
      function ni(l2, e2) {
        if (ei.show) {
          for (let e3 in l2) ei[e3] = l2[e3], e3 in ki && E(ti, e3, l2[e3]);
          false !== e2 && Ci("setSelect");
        }
      }
      function ii(l2, e2, t2) {
        Kn(l2, { min: e2, max: t2 });
      }
      function oi(e2, t2, n2, i2) {
        null != t2.focus && (function(l2) {
          if (l2 != ui) {
            let e3 = null == l2, t3 = 1 != Tt2.alpha;
            pl2.forEach(((n3, i3) => {
              if (1 == M2 || i3 > 0) {
                let o2 = e3 || 0 == i3 || i3 == l2;
                n3._focus = e3 ? null : o2, t3 && (function(l3, e4) {
                  pl2[l3].alpha = e4, re2 && null != Dt2[l3] && (Dt2[l3].style.opacity = e4), se2 && me2[l3] && (me2[l3].style.opacity = e4);
                })(i3, o2 ? 1 : Tt2.alpha);
              }
            })), ui = l2, t3 && Jn();
          }
        })(e2), null != t2.show && pl2.forEach(((n3, i3) => {
          0 >= i3 || e2 != i3 && null != e2 || (n3.show = t2.show, (function(e3) {
            if (pl2[e3].show) se2 && T(me2[e3], l);
            else if (se2 && S(me2[e3], l), re2) {
              let l2 = zt2 ? Dt2[0] : Dt2[e3];
              null != l2 && A(l2, -10, -10, Ie2, Le2);
            }
          })(i3), 2 == M2 ? (ii(n3.facets[0].scale, null, null), ii(n3.facets[1].scale, null, null)) : ii(n3.scale, null, null), Jn());
        })), false !== n2 && Ci("setSeries", e2, t2), i2 && Ii("setSeries", k2, e2, t2);
      }
      let si, ri, ui;
      k2.setSelect = ni, k2.setSeries = oi, k2.addBand = function(l2, e2) {
        l2.fill = bl(l2.fill || null), l2.dir = Q(l2.dir, -1), Tl2.splice(e2 = null == e2 ? Tl2.length : e2, 0, l2);
      }, k2.setBand = function(l2, e2) {
        Bl(Tl2[l2], e2);
      }, k2.delBand = function(l2) {
        null == l2 ? Tl2.length = 0 : Tl2.splice(l2, 1);
      };
      const ai = { focus: true };
      function fi(l2, e2, t2) {
        let n2 = vl2[e2];
        t2 && (l2 = l2 / y - (1 == n2.ori ? Ne2 : Oe2));
        let i2 = Ie2;
        1 == n2.ori && (i2 = Le2, l2 = i2 - l2), -1 == n2.dir && (l2 = i2 - l2);
        let o2 = n2._min, s2 = o2 + l2 / i2 * (n2._max - o2), r2 = n2.distr;
        return 3 == r2 ? cl(10, s2) : 4 == r2 ? ((l3, e3 = 1) => nl.sinh(l3) * e3)(s2, n2.asinh) : 100 == r2 ? n2.bwd(s2) : s2;
      }
      function ci(l2, e2) {
        E(ti, s, ei.left = l2), E(ti, t, ei.width = e2);
      }
      function hi(l2, e2) {
        E(ti, i, ei.top = l2), E(ti, n, ei.height = e2);
      }
      se2 && Et2 && Ce2(p, ce2, ((l2) => {
        oe2._lock || (Mt2(l2), null != ui && oi(null, ai, true, Fi.setSeries));
      })), k2.valToIdx = (l2) => L(l2, g2[0]), k2.posToIdx = function(l2, e2) {
        return L(fi(l2, El2, e2), g2[0], Lt2, en2);
      }, k2.posToVal = fi, k2.valToPos = (l2, e2, t2) => 0 == vl2[e2].ori ? P2(l2, vl2[e2], t2 ? ot2 : Ie2, t2 ? Qe2 : 0) : W2(l2, vl2[e2], t2 ? st2 : Le2, t2 ? lt2 : 0), k2.setCursor = (l2, e2, t2) => {
        Nn = l2.left, jn = l2.top, xi(null, e2, t2);
      };
      let di = 0 == jl2.ori ? ci : hi, pi = 1 == jl2.ori ? ci : hi;
      function mi(l2, e2) {
        if (null != l2 && (l2.idxs ? l2.idxs.forEach(((l3, e3) => {
          te2[e3] = l3;
        })) : /* @__PURE__ */ ((l3) => void 0 === l3)(l2.idx) || te2.fill(l2.idx), ie2.idx = te2[0]), se2 && ie2.live) {
          for (let l3 = 0; pl2.length > l3; l3++) (l3 > 0 || 1 == M2 && !xe2) && gi(l3, te2[l3]);
          !(function() {
            if (se2 && ie2.live) for (let l3 = 2 == M2 ? 1 : 0; pl2.length > l3; l3++) {
              if (0 == l3 && xe2) continue;
              let e3 = ie2.values[l3], t2 = 0;
              for (let n2 in e3) ge2[l3][t2++].firstChild.nodeValue = e3[n2];
            }
          })();
        }
        _t2 = false, false !== e2 && Ci("setLegend");
      }
      function gi(l2, e2) {
        let t2, n2 = pl2[l2], i2 = 0 == l2 && 2 == Ul2 ? pn : g2[l2];
        xe2 ? t2 = n2.values(k2, l2, e2) ?? we2 : (t2 = n2.value(k2, null == e2 ? null : i2[e2], l2, e2), t2 = null == t2 ? we2 : { _: t2 }), ie2.values[l2] = t2;
      }
      function xi(l2, e2, t2) {
        let n2;
        Ln = Nn, On = jn, [Nn, jn] = oe2.move(k2, Nn, jn), oe2.left = Nn, oe2.top = jn, re2 && (Cn && A(Cn, rl(Nn), 0, Ie2, Le2), Hn && A(Hn, 0, rl(jn), Ie2, Le2)), si = gl, ri = null;
        let i2 = 0 == jl2.ori ? Ie2 : Le2, o2 = 1 == jl2.ori ? Ie2 : Le2;
        if (0 > Nn || 0 == Gt2 || Lt2 > en2) {
          n2 = oe2.idx = null;
          for (let l3 = 0; pl2.length > l3; l3++) {
            let e3 = Dt2[l3];
            null != e3 && A(e3, -10, -10, Ie2, Le2);
          }
          Et2 && oi(null, ai, true, null == l2 && Fi.setSeries), ie2.live && (te2.fill(n2), _t2 = true);
        } else {
          let l3, e3, t3;
          1 == M2 && (l3 = 0 == jl2.ori ? Nn : jn, e3 = fi(l3, El2), n2 = oe2.idx = L(e3, g2[0], Lt2, en2), t3 = $l2(g2[0][n2], jl2, i2, 0));
          let s2 = -10, r2 = -10, u3 = 0, a2 = 0, f2 = true, c2 = "", h2 = "";
          for (let l4 = 2 == M2 ? 1 : 0; pl2.length > l4; l4++) {
            let d2 = pl2[l4], p2 = te2[l4], m2 = null == p2 ? null : 1 == M2 ? g2[l4][p2] : g2[l4][1][p2], x2 = oe2.dataIdx(k2, l4, n2, e3), w2 = null == x2 ? null : 1 == M2 ? g2[l4][x2] : g2[l4][1][x2];
            if (_t2 = _t2 || w2 != m2 || x2 != p2, te2[l4] = x2, l4 > 0 && d2.show) {
              let e4 = null == x2 ? -10 : x2 == n2 ? t3 : $l2(1 == M2 ? g2[0][x2] : g2[l4][0][x2], jl2, i2, 0), p3 = null == w2 ? -10 : ql2(w2, 1 == M2 ? vl2[d2.scale] : vl2[d2.facets[1].scale], o2, 0);
              if (Et2 && null != w2) {
                let e5 = 1 == jl2.ori ? Nn : jn, t4 = ol(Tt2.dist(k2, l4, x2, p3, e5));
                if (si > t4) {
                  let n3 = Tt2.bias;
                  if (0 != n3) {
                    let i3 = fi(e5, d2.scale), o3 = 0 > i3 ? -1 : 1;
                    o3 != (0 > w2 ? -1 : 1) || (1 == o3 ? 1 == n3 ? i3 > w2 : w2 > i3 : 1 == n3 ? w2 > i3 : i3 > w2) || (si = t4, ri = l4);
                  } else si = t4, ri = l4;
                }
              }
              if (_t2 || zt2) {
                let t4, n3;
                0 == jl2.ori ? (t4 = e4, n3 = p3) : (t4 = p3, n3 = e4);
                let i3, o3, d3, m3, g3, x3, w3 = true, _3 = St2.bbox;
                if (null != _3) {
                  w3 = false;
                  let e5 = _3(k2, l4);
                  d3 = e5.left, m3 = e5.top, i3 = e5.width, o3 = e5.height;
                } else d3 = t4, m3 = n3, i3 = o3 = St2.size(k2, l4);
                if (x3 = St2.fill(k2, l4), g3 = St2.stroke(k2, l4), zt2) l4 != ri || si > Tt2.prox || (s2 = d3, r2 = m3, u3 = i3, a2 = o3, f2 = w3, c2 = x3, h2 = g3);
                else {
                  let e5 = Dt2[l4];
                  null != e5 && (Pt2[l4] = d3, At2[l4] = m3, H(e5, i3, o3, w3), Y(e5, x3, g3), A(e5, ul(d3), ul(m3), Ie2, Le2));
                }
              }
            }
          }
          if (zt2) {
            let l4 = Tt2.prox;
            if (_t2 || (null == ui ? l4 >= si : si > l4 || ri != ui)) {
              let l5 = Dt2[0];
              null != l5 && (Pt2[0] = s2, At2[0] = r2, H(l5, u3, a2, f2), Y(l5, c2, h2), A(l5, ul(s2), ul(r2), Ie2, Le2));
            }
          }
        }
        if (ei.show && Xn) if (null != l2) {
          let [e3, t3] = Fi.scales, [n3, s2] = Fi.match, [r2, u3] = l2.cursor.sync.scales, a2 = l2.cursor.drag;
          if (Qn = a2._x, li = a2._y, Qn || li) {
            let a3, f2, c2, h2, d2, { left: p2, top: m2, width: g3, height: x2 } = l2.select, w2 = l2.scales[r2].ori, _3 = l2.posToVal, b2 = null != e3 && n3(e3, r2), v2 = null != t3 && s2(t3, u3);
            b2 && Qn ? (0 == w2 ? (a3 = p2, f2 = g3) : (a3 = m2, f2 = x2), c2 = vl2[e3], h2 = $l2(_3(a3, r2), c2, i2, 0), d2 = $l2(_3(a3 + f2, r2), c2, i2, 0), di(al(h2, d2), ol(d2 - h2))) : di(0, i2), v2 && li ? (1 == w2 ? (a3 = p2, f2 = g3) : (a3 = m2, f2 = x2), c2 = vl2[t3], h2 = ql2(_3(a3, u3), c2, o2, 0), d2 = ql2(_3(a3 + f2, u3), c2, o2, 0), pi(al(h2, d2), ol(d2 - h2))) : pi(0, o2);
          } else yi();
        } else {
          let l3 = ol(Ln - Fn), e3 = ol(On - Rn);
          if (1 == jl2.ori) {
            let t4 = l3;
            l3 = e3, e3 = t4;
          }
          Qn = Zn.x && l3 >= Zn.dist, li = Zn.y && e3 >= Zn.dist;
          let t3, n3, s2 = Zn.uni;
          null != s2 ? Qn && li && (Qn = l3 >= s2, li = e3 >= s2, Qn || li || (e3 > l3 ? li = true : Qn = true)) : Zn.x && Zn.y && (Qn || li) && (Qn = li = true), Qn && (0 == jl2.ori ? (t3 = Gn, n3 = Nn) : (t3 = In, n3 = jn), di(al(t3, n3), ol(n3 - t3)), li || pi(0, o2)), li && (1 == jl2.ori ? (t3 = Gn, n3 = Nn) : (t3 = In, n3 = jn), pi(al(t3, n3), ol(n3 - t3)), Qn || di(0, i2)), Qn || li || (di(0, 0), pi(0, 0));
        }
        if (Zn._x = Qn, Zn._y = li, null == l2) {
          if (t2) {
            if (null != Ri) {
              let [l3, e3] = Fi.scales;
              Fi.values[0] = null != l3 ? fi(0 == jl2.ori ? Nn : jn, l3) : null, Fi.values[1] = null != e3 ? fi(1 == jl2.ori ? Nn : jn, e3) : null;
            }
            Ii(f, k2, Nn, jn, Ie2, Le2, n2);
          }
          if (Et2) {
            let l3 = t2 && Fi.setSeries, e3 = Tt2.prox;
            null == ui ? si > e3 || oi(ri, ai, true, l3) : si > e3 ? oi(null, ai, true, l3) : ri != ui && oi(ri, ai, true, l3);
          }
        }
        _t2 && (ie2.idx = n2, mi()), false !== e2 && Ci("setCursor");
      }
      k2.setLegend = mi;
      let wi = null;
      function _i(l2 = false) {
        l2 ? wi = null : (wi = el2.getBoundingClientRect(), Ci("syncRect", wi));
      }
      function bi(l2, e2, t2, n2, i2, o2) {
        oe2._lock || Xn && null != l2 && 0 == l2.movementX && 0 == l2.movementY || (vi(l2, e2, t2, n2, i2, o2, 0, false, null != l2), null != l2 ? xi(null, true, true) : xi(e2, true, false));
      }
      function vi(l2, e2, t2, n2, i2, o2, s2, r2, u3) {
        if (null == wi && _i(false), Mt2(l2), null != l2) t2 = l2.clientX - wi.left, n2 = l2.clientY - wi.top;
        else {
          if (0 > t2 || 0 > n2) return Nn = -10, void (jn = -10);
          let [l3, s3] = Fi.scales, r3 = e2.cursor.sync, [u4, a2] = r3.values, [f2, c2] = r3.scales, [h2, d2] = Fi.match, p2 = e2.axes[0].side % 2 == 1, m2 = 0 == jl2.ori ? Ie2 : Le2, g3 = 1 == jl2.ori ? Ie2 : Le2, x2 = p2 ? o2 : i2, w2 = p2 ? i2 : o2, _3 = p2 ? n2 : t2, b2 = p2 ? t2 : n2;
          if (t2 = null != f2 ? h2(l3, f2) ? C2(u4, vl2[l3], m2, 0) : -10 : m2 * (_3 / x2), n2 = null != c2 ? d2(s3, c2) ? C2(a2, vl2[s3], g3, 0) : -10 : g3 * (b2 / w2), 1 == jl2.ori) {
            let l4 = t2;
            t2 = n2, n2 = l4;
          }
        }
        !u3 || null != e2 && e2.cursor.event.type != f || (t2 > 1 && Ie2 - 1 > t2 || (t2 = zl(t2, Ie2)), n2 > 1 && Le2 - 1 > n2 || (n2 = zl(n2, Le2))), r2 ? (Fn = t2, Rn = n2, [Gn, In] = oe2.move(k2, t2, n2)) : (Nn = t2, jn = n2);
      }
      Object.defineProperty(k2, "rect", { get: () => (null == wi && _i(false), wi) });
      const ki = { width: 0, height: 0, left: 0, top: 0 };
      function yi() {
        ni(ki, false);
      }
      let Mi, Si, Ti, Ei;
      function zi(l2, e2, t2, n2, i2, o2) {
        Xn = true, Qn = li = Zn._x = Zn._y = false, vi(l2, e2, t2, n2, i2, o2, 0, true, false), null != l2 && (Ce2(h, b, Di, false), Ii(c, k2, Gn, In, Ie2, Le2, null));
        let { left: s2, top: r2, width: u3, height: a2 } = ei;
        Mi = s2, Si = r2, Ti = u3, Ei = a2;
      }
      function Di(l2, e2, t2, n2, i2, o2) {
        Xn = Zn._x = Zn._y = false, vi(l2, e2, t2, n2, i2, o2, 0, false, true);
        let { left: s2, top: r2, width: u3, height: a2 } = ei, f2 = u3 > 0 || a2 > 0, c2 = Mi != s2 || Si != r2 || Ti != u3 || Ei != a2;
        if (f2 && c2 && ni(ei), Zn.setScale && f2 && c2) {
          let l3 = s2, e3 = u3, t3 = r2, n3 = a2;
          if (1 == jl2.ori && (l3 = r2, e3 = a2, t3 = s2, n3 = u3), Qn && ii(El2, fi(l3, El2), fi(l3 + e3, El2)), li) for (let l4 in vl2) {
            let e4 = vl2[l4];
            l4 != El2 && null == e4.from && e4.min != gl && ii(l4, fi(t3 + n3, l4), fi(t3, l4));
          }
          yi();
        } else oe2.lock && (oe2._lock = !oe2._lock, xi(e2, true, null != l2));
        null != l2 && (He2(h, b), Ii(h, k2, Nn, jn, Ie2, Le2, null));
      }
      function Pi(l2) {
        oe2._lock || (Mt2(l2), xn(), yi(), null != l2 && Ii(m, k2, Nn, jn, Ie2, Le2, null));
      }
      function Ai() {
        xl2.forEach(ln), vt2(k2.width, k2.height, true);
      }
      G(x, v, Ai);
      const Wi = {};
      Wi.mousedown = zi, Wi.mousemove = bi, Wi.mouseup = Di, Wi.dblclick = Pi, Wi.setSeries = (l2, e2, t2, n2) => {
        -1 != (t2 = (0, Fi.match[2])(k2, e2, t2)) && oi(t2, n2, true, false);
      }, re2 && (Ce2(c, el2, zi), Ce2(f, el2, bi), Ce2(d, el2, ((l2) => {
        Mt2(l2), _i(false);
      })), Ce2(p, el2, (function(l2) {
        if (oe2._lock) return;
        Mt2(l2);
        let e2 = Xn;
        if (Xn) {
          let l3, e3, t2 = true, n2 = true, i2 = 10;
          0 == jl2.ori ? (l3 = Qn, e3 = li) : (l3 = li, e3 = Qn), l3 && e3 && (t2 = i2 >= Nn || Nn >= Ie2 - i2, n2 = i2 >= jn || jn >= Le2 - i2), l3 && t2 && (Nn = Gn > Nn ? 0 : Ie2), e3 && n2 && (jn = In > jn ? 0 : Le2), xi(null, true, true), Xn = false;
        }
        Nn = -10, jn = -10, te2.fill(null), xi(null, true, true), e2 && (Xn = e2);
      })), Ce2(m, el2, Pi), It.add(k2), k2.syncRect = _i);
      const Yi = k2.hooks = u2.hooks || {};
      function Ci(l2, e2, t2) {
        Vn ? Bn.push([l2, e2, t2]) : l2 in Yi && Yi[l2].forEach(((l3) => {
          l3.call(null, k2, e2, t2);
        }));
      }
      (u2.plugins || []).forEach(((l2) => {
        for (let e2 in l2.hooks) Yi[e2] = (Yi[e2] || []).concat(l2.hooks[e2]);
      }));
      const Hi = (l2, e2, t2) => t2, Fi = Bl({ key: null, setSeries: false, filters: { pub: Ml, sub: Ml }, scales: [El2, pl2[1] ? pl2[1].scale : null], match: [Sl, Sl, Hi], values: [null, null] }, oe2.sync);
      2 == Fi.match.length && Fi.match.push(Hi), oe2.sync = Fi;
      const Ri = Fi.key, Gi = dt(Ri);
      function Ii(l2, e2, t2, n2, i2, o2, s2) {
        Fi.filters.pub(l2, e2, t2, n2, i2, o2, s2) && Gi.pub(l2, e2, t2, n2, i2, o2, s2);
      }
      function Li() {
        Ci("init", u2, g2), gn(g2 || u2.data, false), Kl2[El2] ? Kn(El2, Kl2[El2]) : xn(), wt2 = ei.show && (ei.width > 0 || ei.height > 0), xt2 = _t2 = true, vt2(u2.width, u2.height);
      }
      return Gi.sub(k2), k2.pub = function(l2, e2, t2, n2, i2, o2, s2) {
        Fi.filters.sub(l2, e2, t2, n2, i2, o2, s2) && Wi[l2](null, e2, t2, n2, i2, o2, s2);
      }, k2.destroy = function() {
        Gi.unsub(k2), It.delete(k2), Pe2.clear(), I(x, v, Ai), R2.remove(), ce2?.remove(), Ci("destroy");
      }, pl2.forEach(Yt2), xl2.forEach((function(l2, e2) {
        if (l2._show = l2.show, l2.show) {
          let t2 = vl2[l2.scale];
          null == t2 && (l2.scale = l2.side % 2 ? pl2[1].scale : El2, t2 = vl2[l2.scale]);
          let n2 = t2.time;
          l2.size = bl(l2.size), l2.space = bl(l2.space), l2.rotate = bl(l2.rotate), Gl(l2.incrs) && l2.incrs.forEach(((l3) => {
            !Wl.has(l3) && Wl.set(l3, Yl(l3));
          })), l2.incrs = bl(l2.incrs || (2 == t2.distr ? ae : n2 ? 1 == hl2 ? ke : Se : fe)), l2.splits = bl(l2.splits || (n2 && 1 == t2.distr ? Ql2 : 3 == t2.distr ? Je : 4 == t2.distr ? qe : $e)), l2.stroke = bl(l2.stroke), l2.grid.stroke = bl(l2.grid.stroke), l2.ticks.stroke = bl(l2.ticks.stroke), l2.border.stroke = bl(l2.border.stroke);
          let i2 = l2.values;
          l2.values = Gl(i2) && !Gl(i2[0]) ? bl(i2) : n2 ? Gl(i2) ? De(Xl2, ze(i2, Zl2)) : Ll(i2) ? (function(l3, e3) {
            let t3 = ne(e3);
            return (e4, n3) => n3.map(((e5) => t3(l3(e5))));
          })(Xl2, i2) : i2 || le2 : i2 || Be, l2.filter = bl(l2.filter || (3 > t2.distr || 10 != t2.log ? 3 == t2.distr && 2 == t2.log ? tt : kl : et)), l2.font = Qt(l2.font), l2.labelFont = Qt(l2.labelFont), l2._size = l2.size(k2, null, e2, 0), l2._space = l2._rotate = l2._incrs = l2._found = l2._splits = l2._values = null, l2._size > 0 && (Ct2[e2] = true, l2._el = D("u-axis", X2));
        }
      })), _2 ? _2 instanceof HTMLElement ? (_2.appendChild(R2), Li()) : _2(k2, Li) : Li(), k2;
    }
    en.assign = Bl, en.fmtNum = tl, en.rangeNum = Z, en.rangeLog = B, en.rangeAsinh = $, en.orient = pt, en.pxRatio = y, en.join = function(l2, e2) {
      if ((function(l3) {
        let e3 = l3[0][0], t3 = e3.length;
        for (let n3 = 1; l3.length > n3; n3++) {
          let i3 = l3[n3][0];
          if (i3.length != t3) return false;
          if (i3 != e3) {
            for (let l4 = 0; t3 > l4; l4++) if (i3[l4] != e3[l4]) return false;
          }
        }
        return true;
      })(l2)) {
        let e3 = l2[0].slice();
        for (let t3 = 1; l2.length > t3; t3++) e3.push(...l2[t3].slice(1));
        return (function(l3, e4 = 100) {
          const t3 = l3.length;
          if (1 >= t3) return true;
          let n3 = 0, i3 = t3 - 1;
          for (; i3 >= n3 && null == l3[n3]; ) n3++;
          for (; i3 >= n3 && null == l3[i3]; ) i3--;
          if (n3 >= i3) return true;
          const o3 = fl(1, sl((i3 - n3 + 1) / e4));
          for (let e5 = l3[n3], t4 = n3 + o3; i3 >= t4; t4 += o3) {
            const n4 = l3[t4];
            if (null != n4) {
              if (e5 >= n4) return false;
              e5 = n4;
            }
          }
          return true;
        })(e3[0]) || (e3 = (function(l3) {
          let e4 = l3[0], t3 = e4.length, n3 = Array(t3);
          for (let l4 = 0; n3.length > l4; l4++) n3[l4] = l4;
          n3.sort(((l4, t4) => e4[l4] - e4[t4]));
          let i3 = [];
          for (let e5 = 0; l3.length > e5; e5++) {
            let o3 = l3[e5], s2 = Array(t3);
            for (let l4 = 0; t3 > l4; l4++) s2[l4] = o3[n3[l4]];
            i3.push(s2);
          }
          return i3;
        })(e3)), e3;
      }
      let t2 = /* @__PURE__ */ new Set();
      for (let e3 = 0; l2.length > e3; e3++) {
        let n3 = l2[e3][0], i3 = n3.length;
        for (let l3 = 0; i3 > l3; l3++) t2.add(n3[l3]);
      }
      let n2 = [Array.from(t2).sort(((l3, e3) => l3 - e3))], i2 = n2[0].length, o2 = /* @__PURE__ */ new Map();
      for (let l3 = 0; i2 > l3; l3++) o2.set(n2[0][l3], l3);
      for (let t3 = 0; l2.length > t3; t3++) {
        let s2 = l2[t3], r2 = s2[0];
        for (let l3 = 1; s2.length > l3; l3++) {
          let u2 = s2[l3], a2 = Array(i2).fill(void 0), f2 = e2 ? e2[t3][l3] : 1, c2 = [];
          for (let l4 = 0; u2.length > l4; l4++) {
            let e3 = u2[l4], t4 = o2.get(r2[l4]);
            null === e3 ? 0 != f2 && (a2[t4] = e3, 2 == f2 && c2.push(t4)) : a2[t4] = e3;
          }
          $l(a2, c2, i2), n2.push(a2);
        }
      }
      return n2;
    }, en.fmtDate = ne, en.tzDate = function(l2, e2) {
      let t2;
      return "UTC" == e2 || "Etc/UTC" == e2 ? t2 = new Date(+l2 + 6e4 * l2.getTimezoneOffset()) : e2 == ie ? t2 = l2 : (t2 = new Date(l2.toLocaleString("en-US", { timeZone: e2 })), t2.setMilliseconds(l2.getMilliseconds())), t2;
    }, en.sync = dt;
    {
      en.addGap = function(l3, e2, t2) {
        let n2 = l3[l3.length - 1];
        n2 && n2[0] == e2 ? n2[1] = t2 : l3.push([e2, t2]);
      }, en.clipGaps = wt;
      let l2 = en.paths = { points: Wt };
      l2.linear = Ft, l2.stepped = function(l3) {
        const e2 = Q(l3.align, 1), t2 = Q(l3.ascDesc, false), n2 = Q(l3.alignGaps, 0), i2 = Q(l3.extend, false);
        return (l4, o2, s2, r2) => pt(l4, o2, ((u2, a2, f2, c2, h2, d2, p2, m2, g2, x2, w2) => {
          [s2, r2] = U(f2, s2, r2);
          let _2 = u2.pxRound, { left: b2, width: v2 } = l4.bbox, k2 = (l5) => _2(d2(l5, c2, x2, m2)), M2 = (l5) => _2(p2(l5, h2, w2, g2)), S2 = 0 == c2.ori ? Mt : St;
          const T2 = { stroke: new Path2D(), fill: null, clip: null, band: null, gaps: null, flags: 1 }, E2 = T2.stroke, z2 = c2.dir * (0 == c2.ori ? 1 : -1);
          let D2 = M2(f2[1 == z2 ? s2 : r2]), P2 = k2(a2[1 == z2 ? s2 : r2]), A2 = P2, W2 = P2;
          i2 && -1 == e2 && (W2 = b2, S2(E2, W2, D2)), S2(E2, P2, D2);
          for (let l5 = 1 == z2 ? s2 : r2; l5 >= s2 && r2 >= l5; l5 += z2) {
            let t3 = f2[l5];
            if (null == t3) continue;
            let n3 = k2(a2[l5]), i3 = M2(t3);
            1 == e2 ? S2(E2, n3, D2) : S2(E2, A2, i3), S2(E2, n3, i3), D2 = i3, A2 = n3;
          }
          let Y2 = A2;
          i2 && 1 == e2 && (Y2 = b2 + v2, S2(E2, Y2, D2));
          let [C2, H2] = mt(l4, o2);
          if (null != u2.fill || 0 != C2) {
            let e3 = T2.fill = new Path2D(E2), t3 = M2(u2.fillTo(l4, o2, u2.min, u2.max, C2));
            S2(e3, Y2, t3), S2(e3, W2, t3);
          }
          if (!u2.spanGaps) {
            let i3 = [];
            i3.push(..._t(a2, f2, s2, r2, z2, k2, n2));
            let h3 = u2.width * y / 2, d3 = t2 || 1 == e2 ? h3 : -h3, p3 = t2 || -1 == e2 ? -h3 : h3;
            i3.forEach(((l5) => {
              l5[0] += d3, l5[1] += p3;
            })), T2.gaps = i3 = u2.gaps(l4, o2, s2, r2, i3), T2.clip = wt(i3, c2.ori, m2, g2, x2, w2);
          }
          return 0 != H2 && (T2.band = 2 == H2 ? [xt(l4, o2, s2, r2, E2, -1), xt(l4, o2, s2, r2, E2, 1)] : xt(l4, o2, s2, r2, E2, H2)), T2;
        }));
      }, l2.bars = function(l3) {
        const e2 = Q((l3 = l3 || Hl).size, [0.6, gl, 1]), t2 = l3.align || 0, n2 = l3.gap || 0;
        let i2 = l3.radius;
        i2 = null == i2 ? [0, 0] : "number" == typeof i2 ? [i2, 0] : i2;
        const o2 = bl(i2), s2 = 1 - e2[0], r2 = Q(e2[1], gl), u2 = Q(e2[2], 1), a2 = Q(l3.disp, Hl), f2 = Q(l3.each, (() => {
        })), { fill: c2, stroke: h2 } = a2;
        return (l4, e3, i3, d2) => pt(l4, e3, ((p2, m2, g2, x2, w2, _2, b2, v2, k2, M2, S2) => {
          let T2, E2, z2 = p2.pxRound, D2 = t2, P2 = n2 * y, A2 = r2 * y, W2 = u2 * y;
          0 == x2.ori ? [T2, E2] = o2(l4, e3) : [E2, T2] = o2(l4, e3);
          const Y2 = x2.dir * (0 == x2.ori ? 1 : -1);
          let C2, H2, F2, R2 = 0 == x2.ori ? Tt : Et, G2 = 0 == x2.ori ? f2 : (l5, e4, t3, n3, i4, o3, s3) => {
            f2(l5, e4, t3, i4, n3, s3, o3);
          }, I2 = Q(l4.bands, Fl).find(((l5) => l5.series[0] == e3)), L2 = p2.fillTo(l4, e3, p2.min, p2.max, null != I2 ? I2.dir : 0), O2 = z2(b2(L2, w2, S2, k2)), N2 = M2, j2 = z2(p2.width * y), U2 = false, V2 = null, B2 = null, $2 = null, J2 = null;
          null == c2 || 0 != j2 && null == h2 || (U2 = true, V2 = c2.values(l4, e3, i3, d2), B2 = /* @__PURE__ */ new Map(), new Set(V2).forEach(((l5) => {
            null != l5 && B2.set(l5, new Path2D());
          })), j2 > 0 && ($2 = h2.values(l4, e3, i3, d2), J2 = /* @__PURE__ */ new Map(), new Set($2).forEach(((l5) => {
            null != l5 && J2.set(l5, new Path2D());
          }))));
          let { x0: q2, size: K2 } = a2;
          if (null != q2 && null != K2) {
            D2 = 1, m2 = q2.values(l4, e3, i3, d2), 2 == q2.unit && (m2 = m2.map(((e4) => l4.posToVal(v2 + e4 * M2, x2.key, true))));
            let t3 = K2.values(l4, e3, i3, d2);
            H2 = 2 == K2.unit ? t3[0] * M2 : _2(t3[0], x2, M2, v2) - _2(0, x2, M2, v2), N2 = Rt(m2, g2, _2, x2, M2, v2, N2), F2 = N2 - H2 + P2;
          } else N2 = Rt(m2, g2, _2, x2, M2, v2, N2), F2 = N2 * s2 + P2, H2 = N2 - F2;
          1 > F2 && (F2 = 0), H2 / 2 > j2 || (j2 = 0), 5 > F2 && (z2 = vl);
          let X2 = F2 > 0;
          H2 = z2(wl(N2 - F2 - (X2 ? j2 : 0), W2, A2)), C2 = (0 == D2 ? H2 / 2 : D2 == Y2 ? 0 : H2) - D2 * Y2 * ((0 == D2 ? P2 / 2 : 0) + (X2 ? j2 / 2 : 0));
          const Z2 = { stroke: null, fill: null, clip: null, band: null, gaps: null, flags: 0 }, ll2 = U2 ? null : new Path2D();
          let el2 = null;
          if (null != I2) el2 = l4.data[I2.series[1]];
          else {
            let { y0: t3, y1: n3 } = a2;
            null != t3 && null != n3 && (g2 = n3.values(l4, e3, i3, d2), el2 = t3.values(l4, e3, i3, d2));
          }
          let tl2 = T2 * H2, nl2 = E2 * H2;
          for (let t3 = 1 == Y2 ? i3 : d2; t3 >= i3 && d2 >= t3; t3 += Y2) {
            let n3 = g2[t3];
            if (null == n3) continue;
            if (null != el2) {
              let l5 = el2[t3] ?? 0;
              if (n3 - l5 == 0) continue;
              O2 = b2(l5, w2, S2, k2);
            }
            let i4 = _2(2 != x2.distr || null != a2 ? m2[t3] : t3, x2, M2, v2), o3 = b2(Q(n3, L2), w2, S2, k2), s3 = z2(i4 - C2), r3 = z2(fl(o3, O2)), u3 = z2(al(o3, O2)), f3 = r3 - u3;
            if (null != n3) {
              let i5 = 0 > n3 ? nl2 : tl2, o4 = 0 > n3 ? tl2 : nl2;
              U2 ? (j2 > 0 && null != $2[t3] && R2(J2.get($2[t3]), s3, u3 + sl(j2 / 2), H2, fl(0, f3 - j2), i5, o4), null != V2[t3] && R2(B2.get(V2[t3]), s3, u3 + sl(j2 / 2), H2, fl(0, f3 - j2), i5, o4)) : R2(ll2, s3, u3 + sl(j2 / 2), H2, fl(0, f3 - j2), i5, o4), G2(l4, e3, t3, s3 - j2 / 2, u3, H2 + j2, f3);
            }
          }
          return j2 > 0 ? Z2.stroke = U2 ? J2 : ll2 : U2 || (Z2._fill = 0 == p2.width ? p2._fill : p2._stroke ?? p2._fill, Z2.width = 0), Z2.fill = U2 ? B2 : ll2, Z2;
        }));
      }, l2.spline = function(l3) {
        return (function(l4, e2) {
          const t2 = Q(e2?.alignGaps, 0);
          return (e3, n2, i2, o2) => pt(e3, n2, ((s2, r2, u2, a2, f2, c2, h2, d2, p2, m2, g2) => {
            [i2, o2] = U(u2, i2, o2);
            let x2, w2, _2, b2 = s2.pxRound, v2 = (l5) => b2(c2(l5, a2, m2, d2)), k2 = (l5) => b2(h2(l5, f2, g2, p2));
            0 == a2.ori ? (x2 = kt, _2 = Mt, w2 = Pt) : (x2 = yt, _2 = St, w2 = At);
            const y2 = a2.dir * (0 == a2.ori ? 1 : -1);
            let M2 = v2(r2[1 == y2 ? i2 : o2]), S2 = M2, T2 = [], E2 = [];
            for (let l5 = 1 == y2 ? i2 : o2; l5 >= i2 && o2 >= l5; l5 += y2) if (null != u2[l5]) {
              let e4 = v2(r2[l5]);
              T2.push(S2 = e4), E2.push(k2(u2[l5]));
            }
            const z2 = { stroke: l4(T2, E2, x2, _2, w2, b2), fill: null, clip: null, band: null, gaps: null, flags: 1 }, D2 = z2.stroke;
            let [P2, A2] = mt(e3, n2);
            if (null != s2.fill || 0 != P2) {
              let l5 = z2.fill = new Path2D(D2), t3 = k2(s2.fillTo(e3, n2, s2.min, s2.max, P2));
              _2(l5, S2, t3), _2(l5, M2, t3);
            }
            if (!s2.spanGaps) {
              let l5 = [];
              l5.push(..._t(r2, u2, i2, o2, y2, v2, t2)), z2.gaps = l5 = s2.gaps(e3, n2, i2, o2, l5), z2.clip = wt(l5, a2.ori, d2, p2, m2, g2);
            }
            return 0 != A2 && (z2.band = 2 == A2 ? [xt(e3, n2, i2, o2, D2, -1), xt(e3, n2, i2, o2, D2, 1)] : xt(e3, n2, i2, o2, D2, A2)), z2;
          }));
        })(Gt, l3);
      };
    }
    return en;
  })();

  // js/entry.js
  var import_termino_min = __toESM(require_termino_min());

  // js/api.js
  var API2 = (() => {
    "use strict";
    const XOR_KEY = "e5dl12XYVggihggafXWf0f2YSf2Xngd1";
    const VERIFICATION_KEY = "KSDHSDFOGQ5WERYTUIQWERTYUISDFG1HJZXCVCXBN2GDSMNDHKVKFsVBNf";
    const COOKIE_PREFIX = "1D4B9765B16C3A64AD97489B1610498B";
    const PBKDF2_ITERATIONS = 1024;
    const PBKDF2_DKLEN = 64;
    const HEARTBEAT_MS = 6e3;
    let _verificationToken = "";
    let _heartbeatTimer = null;
    const INACTIVITY_MS = 3e5;
    let _inactivityTimer = null;
    class ApiError extends Error {
      constructor(code, message, method) {
        super(method ? method + ": " + message : message);
        this.name = "ApiError";
        this.code = code;
        this.apiMessage = message;
        this.method = method || "";
      }
    }
    function xorEncrypt(text) {
      const result = [];
      for (let i = 0; i < text.length; i++) {
        const k = XOR_KEY.charCodeAt(i % XOR_KEY.length);
        const c = text.charCodeAt(i);
        result.push(240 & k | 15 & c ^ 15 & k);
        result.push(240 & k | c >> 4 ^ 15 & k);
      }
      return String.fromCharCode(...result);
    }
    function hexEncode(buf) {
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    const _hasSubtle = typeof crypto !== "undefined" && crypto.subtle;
    const _sha512K = [
      1116352408,
      3609767458,
      1899447441,
      602891725,
      3049323471,
      3964484399,
      3921009573,
      2173295548,
      961987163,
      4081628472,
      1508970993,
      3053834265,
      2453635748,
      2937671579,
      2870763221,
      3664609560,
      3624381080,
      2734883394,
      310598401,
      1164996542,
      607225278,
      1323610764,
      1426881987,
      3590304994,
      1925078388,
      4068182383,
      2162078206,
      991336113,
      2614888103,
      633803317,
      3248222580,
      3479774868,
      3835390401,
      2666613458,
      4022224774,
      944711139,
      264347078,
      2341262773,
      604807628,
      2007800933,
      770255983,
      1495990901,
      1249150122,
      1856431235,
      1555081692,
      3175218132,
      1996064986,
      2198950837,
      2554220882,
      3999719339,
      2821834349,
      766784016,
      2952996808,
      2566594879,
      3210313671,
      3203337956,
      3336571891,
      1034457026,
      3584528711,
      2466948901,
      113926993,
      3758326383,
      338241895,
      168717936,
      666307205,
      1188179964,
      773529912,
      1546045734,
      1294757372,
      1522805485,
      1396182291,
      2643833823,
      1695183700,
      2343527390,
      1986661051,
      1014477480,
      2177026350,
      1206759142,
      2456956037,
      344077627,
      2730485921,
      1290863460,
      2820302411,
      3158454273,
      3259730800,
      3505952657,
      3345764771,
      106217008,
      3516065817,
      3606008344,
      3600352804,
      1432725776,
      4094571909,
      1467031594,
      275423344,
      851169720,
      430227734,
      3100823752,
      506948616,
      1363258195,
      659060556,
      3750685593,
      883997877,
      3785050280,
      958139571,
      3318307427,
      1322822218,
      3812723403,
      1537002063,
      2003034995,
      1747873779,
      3602036899,
      1955562222,
      1575990012,
      2024104815,
      1125592928,
      2227730452,
      2716904306,
      2361852424,
      442776044,
      2428436474,
      593698344,
      2756734187,
      3733110249,
      3204031479,
      2999351573,
      3329325298,
      3815920427,
      3391569614,
      3928383900,
      3515267271,
      566280711,
      3940187606,
      3454069534,
      4118630271,
      4000239992,
      116418474,
      1914138554,
      174292421,
      2731055270,
      289380356,
      3203993006,
      460393269,
      320620315,
      685471733,
      587496836,
      852142971,
      1086792851,
      1017036298,
      365543100,
      1126000580,
      2618297676,
      1288033470,
      3409855158,
      1501505948,
      4234509866,
      1607167915,
      987167468,
      1816402316,
      1246189591
    ];
    function _sha512(msgBytes) {
      var len = msgBytes.length;
      var bitLen = len * 8;
      var padLen = (128 - (len + 17) % 128) % 128;
      var buf = new Uint8Array(len + 1 + padLen + 16);
      buf.set(msgBytes);
      buf[len] = 128;
      var dv = new DataView(buf.buffer);
      dv.setUint32(buf.length - 4, bitLen >>> 0);
      dv.setUint32(buf.length - 8, bitLen / 4294967296 >>> 0);
      var H = [
        1779033703,
        4089235720,
        3144134277,
        2227873595,
        1013904242,
        4271175723,
        2773480762,
        1595750129,
        1359893119,
        2917565137,
        2600822924,
        725511199,
        528734635,
        4215389547,
        1541459225,
        327033209
      ];
      var W = new Array(160);
      for (var off = 0; off < buf.length; off += 128) {
        for (var t = 0; t < 32; t++) W[t] = dv.getUint32(off + t * 4);
        for (var t = 32; t < 160; t += 2) {
          var xh = W[t - 4], xl = W[t - 3];
          var s1h = ((xh >>> 19 | xl << 13) ^ (xl >>> 29 | xh << 3) ^ xh >>> 6) >>> 0;
          var s1l = ((xl >>> 19 | xh << 13) ^ (xh >>> 29 | xl << 3) ^ (xl >>> 6 | xh << 26)) >>> 0;
          xh = W[t - 30];
          xl = W[t - 29];
          var s0h = ((xh >>> 1 | xl << 31) ^ (xh >>> 8 | xl << 24) ^ xh >>> 7) >>> 0;
          var s0l = ((xl >>> 1 | xh << 31) ^ (xl >>> 8 | xh << 24) ^ (xl >>> 7 | xh << 25)) >>> 0;
          var lo = s1l + W[t - 13] >>> 0;
          var hi = s1h + W[t - 14] + (lo < s1l ? 1 : 0) >>> 0;
          lo = lo + s0l >>> 0;
          hi = hi + s0h + (lo < s0l ? 1 : 0) >>> 0;
          lo = lo + W[t - 31] >>> 0;
          hi = hi + W[t - 32] + (lo < W[t - 31] ? 1 : 0) >>> 0;
          W[t] = hi;
          W[t + 1] = lo;
        }
        var ah = H[0], al = H[1], bh = H[2], bl = H[3], ch = H[4], cl = H[5], dh = H[6], dl = H[7], eh = H[8], el = H[9], fh = H[10], fl = H[11], gh = H[12], gl = H[13], hh = H[14], hl = H[15];
        for (var t = 0; t < 80; t++) {
          var S1h = ((eh >>> 14 | el << 18) ^ (eh >>> 18 | el << 14) ^ (el >>> 9 | eh << 23)) >>> 0;
          var S1l = ((el >>> 14 | eh << 18) ^ (el >>> 18 | eh << 14) ^ (eh >>> 9 | el << 23)) >>> 0;
          var Chh = (eh & fh ^ ~eh & gh) >>> 0, Chl = (el & fl ^ ~el & gl) >>> 0;
          var tlo = hl + S1l >>> 0;
          var thi = hh + S1h + (tlo < hl ? 1 : 0) >>> 0;
          tlo = tlo + Chl >>> 0;
          thi = thi + Chh + (tlo < Chl ? 1 : 0) >>> 0;
          tlo = tlo + _sha512K[t * 2 + 1] >>> 0;
          thi = thi + _sha512K[t * 2] + (tlo < _sha512K[t * 2 + 1] ? 1 : 0) >>> 0;
          tlo = tlo + W[t * 2 + 1] >>> 0;
          thi = thi + W[t * 2] + (tlo < W[t * 2 + 1] ? 1 : 0) >>> 0;
          var S0h = ((ah >>> 28 | al << 4) ^ (al >>> 2 | ah << 30) ^ (al >>> 7 | ah << 25)) >>> 0;
          var S0l = ((al >>> 28 | ah << 4) ^ (ah >>> 2 | al << 30) ^ (ah >>> 7 | al << 25)) >>> 0;
          var Mjh = (ah & bh ^ ah & ch ^ bh & ch) >>> 0, Mjl = (al & bl ^ al & cl ^ bl & cl) >>> 0;
          var t2l = S0l + Mjl >>> 0;
          var t2h = S0h + Mjh + (t2l < S0l ? 1 : 0) >>> 0;
          hh = gh;
          hl = gl;
          gh = fh;
          gl = fl;
          fh = eh;
          fl = el;
          el = dl + tlo >>> 0;
          eh = dh + thi + (el < dl ? 1 : 0) >>> 0;
          dh = ch;
          dl = cl;
          ch = bh;
          cl = bl;
          bh = ah;
          bl = al;
          al = tlo + t2l >>> 0;
          ah = thi + t2h + (al < tlo ? 1 : 0) >>> 0;
        }
        var addl;
        addl = H[1] + al >>> 0;
        H[0] = H[0] + ah + (addl < H[1] ? 1 : 0) >>> 0;
        H[1] = addl;
        addl = H[3] + bl >>> 0;
        H[2] = H[2] + bh + (addl < H[3] ? 1 : 0) >>> 0;
        H[3] = addl;
        addl = H[5] + cl >>> 0;
        H[4] = H[4] + ch + (addl < H[5] ? 1 : 0) >>> 0;
        H[5] = addl;
        addl = H[7] + dl >>> 0;
        H[6] = H[6] + dh + (addl < H[7] ? 1 : 0) >>> 0;
        H[7] = addl;
        addl = H[9] + el >>> 0;
        H[8] = H[8] + eh + (addl < H[9] ? 1 : 0) >>> 0;
        H[9] = addl;
        addl = H[11] + fl >>> 0;
        H[10] = H[10] + fh + (addl < H[11] ? 1 : 0) >>> 0;
        H[11] = addl;
        addl = H[13] + gl >>> 0;
        H[12] = H[12] + gh + (addl < H[13] ? 1 : 0) >>> 0;
        H[13] = addl;
        addl = H[15] + hl >>> 0;
        H[14] = H[14] + hh + (addl < H[15] ? 1 : 0) >>> 0;
        H[15] = addl;
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
        ipad[i] = k ^ 54;
        opad[i] = k ^ 92;
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
        sbi[saltBytes.length] = block >>> 24 & 255;
        sbi[saltBytes.length + 1] = block >>> 16 & 255;
        sbi[saltBytes.length + 2] = block >>> 8 & 255;
        sbi[saltBytes.length + 3] = block & 255;
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
    var _aes_sbox = [
      99,
      124,
      119,
      123,
      242,
      107,
      111,
      197,
      48,
      1,
      103,
      43,
      254,
      215,
      171,
      118,
      202,
      130,
      201,
      125,
      250,
      89,
      71,
      240,
      173,
      212,
      162,
      175,
      156,
      164,
      114,
      192,
      183,
      253,
      147,
      38,
      54,
      63,
      247,
      204,
      52,
      165,
      229,
      241,
      113,
      216,
      49,
      21,
      4,
      199,
      35,
      195,
      24,
      150,
      5,
      154,
      7,
      18,
      128,
      226,
      235,
      39,
      178,
      117,
      9,
      131,
      44,
      26,
      27,
      110,
      90,
      160,
      82,
      59,
      214,
      179,
      41,
      227,
      47,
      132,
      83,
      209,
      0,
      237,
      32,
      252,
      177,
      91,
      106,
      203,
      190,
      57,
      74,
      76,
      88,
      207,
      208,
      239,
      170,
      251,
      67,
      77,
      51,
      133,
      69,
      249,
      2,
      127,
      80,
      60,
      159,
      168,
      81,
      163,
      64,
      143,
      146,
      157,
      56,
      245,
      188,
      182,
      218,
      33,
      16,
      255,
      243,
      210,
      205,
      12,
      19,
      236,
      95,
      151,
      68,
      23,
      196,
      167,
      126,
      61,
      100,
      93,
      25,
      115,
      96,
      129,
      79,
      220,
      34,
      42,
      144,
      136,
      70,
      238,
      184,
      20,
      222,
      94,
      11,
      219,
      224,
      50,
      58,
      10,
      73,
      6,
      36,
      92,
      194,
      211,
      172,
      98,
      145,
      149,
      228,
      121,
      231,
      200,
      55,
      109,
      141,
      213,
      78,
      169,
      108,
      86,
      244,
      234,
      101,
      122,
      174,
      8,
      186,
      120,
      37,
      46,
      28,
      166,
      180,
      198,
      232,
      221,
      116,
      31,
      75,
      189,
      139,
      138,
      112,
      62,
      181,
      102,
      72,
      3,
      246,
      14,
      97,
      53,
      87,
      185,
      134,
      193,
      29,
      158,
      225,
      248,
      152,
      17,
      105,
      217,
      142,
      148,
      155,
      30,
      135,
      233,
      206,
      85,
      40,
      223,
      140,
      161,
      137,
      13,
      191,
      230,
      66,
      104,
      65,
      153,
      45,
      15,
      176,
      84,
      187,
      22
    ];
    var _aes_rcon = [1, 2, 4, 8, 16, 32, 64, 128, 27, 54];
    function _aesExpandKey(key2) {
      var w = new Uint8Array(176);
      w.set(key2);
      for (var i = 16; i < 176; i += 4) {
        var t0 = w[i - 4], t1 = w[i - 3], t2 = w[i - 2], t3 = w[i - 1];
        if (i % 16 === 0) {
          var tmp = t0;
          t0 = _aes_sbox[t1];
          t1 = _aes_sbox[t2];
          t2 = _aes_sbox[t3];
          t3 = _aes_sbox[tmp];
          t0 ^= _aes_rcon[i / 16 - 1];
        }
        w[i] = w[i - 16] ^ t0;
        w[i + 1] = w[i - 15] ^ t1;
        w[i + 2] = w[i - 14] ^ t2;
        w[i + 3] = w[i - 13] ^ t3;
      }
      return w;
    }
    function _xtime(a) {
      return (a << 1 ^ (a & 128 ? 27 : 0)) & 255;
    }
    function _aesEncryptBlock(state, rk) {
      var s = new Uint8Array(state);
      for (var i = 0; i < 16; i++) s[i] ^= rk[i];
      for (var r = 1; r <= 10; r++) {
        for (var i = 0; i < 16; i++) s[i] = _aes_sbox[s[i]];
        var t;
        t = s[1];
        s[1] = s[5];
        s[5] = s[9];
        s[9] = s[13];
        s[13] = t;
        t = s[2];
        s[2] = s[10];
        s[10] = t;
        t = s[6];
        s[6] = s[14];
        s[14] = t;
        t = s[15];
        s[15] = s[11];
        s[11] = s[7];
        s[7] = s[3];
        s[3] = t;
        if (r < 10) {
          for (var c = 0; c < 16; c += 4) {
            var a = s[c], b = s[c + 1], d = s[c + 2], e = s[c + 3];
            s[c] = _xtime(a) ^ _xtime(b) ^ b ^ d ^ e;
            s[c + 1] = a ^ _xtime(b) ^ _xtime(d) ^ d ^ e;
            s[c + 2] = a ^ b ^ _xtime(d) ^ _xtime(e) ^ e;
            s[c + 3] = _xtime(a) ^ a ^ b ^ d ^ _xtime(e);
          }
        }
        for (var i = 0; i < 16; i++) s[i] ^= rk[r * 16 + i];
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
    async function pbkdf2Sha512(password, salt) {
      if (_hasSubtle) {
        var enc = new TextEncoder();
        var keyMaterial = await crypto.subtle.importKey(
          "raw",
          enc.encode(password),
          "PBKDF2",
          false,
          ["deriveBits"]
        );
        var bits = await crypto.subtle.deriveBits(
          { name: "PBKDF2", salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-512" },
          keyMaterial,
          PBKDF2_DKLEN * 8
        );
        return hexEncode(bits);
      }
      return hexEncode(_pbkdf2Sha512Sw(password, salt, PBKDF2_ITERATIONS, PBKDF2_DKLEN));
    }
    async function aes128CbcEncrypt(plaintext, key16, iv16) {
      var enc = new TextEncoder();
      var data = enc.encode(plaintext);
      if (_hasSubtle) {
        var cryptoKey = await crypto.subtle.importKey(
          "raw",
          enc.encode(key16),
          { name: "AES-CBC" },
          false,
          ["encrypt"]
        );
        var encrypted = await crypto.subtle.encrypt(
          { name: "AES-CBC", iv: enc.encode(iv16) },
          cryptoKey,
          data
        );
        return btoa(String.fromCharCode.apply(null, new Uint8Array(encrypted)));
      }
      var padLen = 16 - data.length % 16;
      var padded = new Uint8Array(data.length + padLen);
      padded.set(data);
      padded.fill(padLen, data.length);
      var encrypted = _aesCbcEncryptSw(padded, enc.encode(key16), enc.encode(iv16));
      return btoa(String.fromCharCode.apply(null, encrypted));
    }
    async function encryptToken(token, key16, iv16) {
      const obfuscated = xorEncrypt(token);
      return aes128CbcEncrypt(obfuscated, key16, iv16);
    }
    function setCookie(value) {
      document.cookie = "t=" + value + "; path=/";
    }
    function clearCookie() {
      document.cookie = "t=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
    function getCookie() {
      const m = document.cookie.match(/(?:^|;\s*)t=([^;]*)/);
      return m ? m[1] : "";
    }
    function _currentToken() {
      const cookie = getCookie();
      if (cookie && cookie.length > COOKIE_PREFIX.length) {
        return cookie.slice(COOKIE_PREFIX.length);
      }
      return _verificationToken;
    }
    const ERR_SESSION_EXPIRED = ["010101", "-32699", "-32698", "010104"];
    const ERR_LOGIN_LOCKED = "010103";
    let _inflight = 0;
    const _MAX_CONCURRENT = 3;
    const _pending = [];
    function _throttled(fn) {
      return new Promise((resolve, reject) => {
        function run() {
          _inflight++;
          fn().then(
            (v) => {
              _inflight--;
              drain();
              resolve(v);
            },
            (e) => {
              _inflight--;
              drain();
              reject(e);
            }
          );
        }
        function drain() {
          while (_pending.length > 0 && _inflight < _MAX_CONCURRENT) {
            _pending.shift()();
          }
        }
        if (_inflight < _MAX_CONCURRENT) {
          run();
        } else {
          _pending.push(run);
        }
      });
    }
    function webapi(method, params) {
      return _throttled(async () => {
        const body = JSON.stringify({
          id: "1",
          jsonrpc: "2.0",
          method,
          params: params || {}
        });
        const headers = {
          "Content-Type": "application/json",
          "Referer": location.origin + "/index.html",
          "_TclRequestVerificationKey": VERIFICATION_KEY
        };
        const token = _currentToken();
        if (token) {
          headers["_TclRequestVerificationToken"] = token;
        }
        const resp = await fetch("/jrd/webapi", {
          method: "POST",
          headers,
          body
        });
        const data = await resp.json();
        if (data.error) {
          const code = String(data.error.code || "");
          const message = data.error.message || "Unknown API error";
          if (code === ERR_LOGIN_LOCKED) {
            throw new ApiError(code, "Login locked \u2014 too many attempts, wait 5 minutes", method);
          }
          throw new ApiError(code, message, method);
        }
        return data.result !== void 0 ? data.result : data;
      });
    }
    function cgiGet(path, params) {
      return _throttled(async () => {
        let url = "/cgi-bin/" + path;
        if (params) {
          const qs = new URLSearchParams(params).toString();
          url += "?" + qs;
        }
        const resp = await fetch(url, { redirect: "manual" });
        if (resp.status === 0 || resp.type === "opaqueredirect") {
          location.reload();
          return new Promise(function() {
          });
        }
        const ct = resp.headers.get("Content-Type") || "";
        if (ct.includes("text/html")) {
          location.reload();
          return new Promise(function() {
          });
        }
        return resp.json();
      });
    }
    function cgiPost(path, data) {
      return _throttled(async () => {
        const resp = await fetch("/cgi-bin/" + path, {
          method: "POST",
          redirect: "manual",
          headers: {
            "Content-Type": "application/json",
            "X-EE71-Request": "1"
          },
          body: JSON.stringify(data)
        });
        if (resp.status === 0 || resp.type === "opaqueredirect") {
          location.reload();
          return new Promise(function() {
          });
        }
        const ct = resp.headers.get("Content-Type") || "";
        if (ct.includes("text/html")) {
          location.reload();
          return new Promise(function() {
          });
        }
        return resp.json();
      });
    }
    async function login(username, password) {
      const deviceSt = await webapi("GetDeviceSt");
      const salt = deviceSt.Salt;
      const pwHash = await pbkdf2Sha512(password, salt);
      const encUser = xorEncrypt(username);
      const result = await webapi("Login", {
        UserName: encUser,
        Password: pwHash
      });
      if (!result || result.token === void 0) {
        throw new ApiError("", "Login failed \u2014 unexpected response", "Login");
      }
      const token = String(result.token);
      const param0 = String(result.param0);
      const param1 = String(result.param1);
      _verificationToken = await encryptToken(token, param0, param1);
      setCookie(COOKIE_PREFIX + _verificationToken);
      _startHeartbeat();
      return true;
    }
    async function logout() {
      _stopHeartbeat();
      try {
        await webapi("Logout");
      } catch (e) {
      }
      _verificationToken = "";
      clearCookie();
    }
    function _startHeartbeat() {
      _stopHeartbeat();
      _heartbeatTimer = setInterval(async () => {
        try {
          await webapi("HeartBeat");
        } catch (e) {
          if (e instanceof ApiError && ERR_SESSION_EXPIRED.indexOf(e.code) !== -1) {
            _handleSessionExpired();
          }
        }
      }, HEARTBEAT_MS);
      _startInactivityTimer();
    }
    function _stopHeartbeat() {
      if (_heartbeatTimer) {
        clearInterval(_heartbeatTimer);
        _heartbeatTimer = null;
      }
      _stopInactivityTimer();
    }
    function _resetInactivity() {
      if (_inactivityTimer) {
        clearTimeout(_inactivityTimer);
        _inactivityTimer = setTimeout(_handleInactivityLogout, INACTIVITY_MS);
      }
    }
    function _startInactivityTimer() {
      _stopInactivityTimer();
      _inactivityTimer = setTimeout(_handleInactivityLogout, INACTIVITY_MS);
      ["click", "keydown", "keyup"].forEach(function(ev) {
        document.addEventListener(ev, _resetInactivity);
      });
    }
    function _stopInactivityTimer() {
      if (_inactivityTimer) {
        clearTimeout(_inactivityTimer);
        _inactivityTimer = null;
      }
      ["click", "keydown", "keyup"].forEach(function(ev) {
        document.removeEventListener(ev, _resetInactivity);
      });
    }
    function _handleInactivityLogout() {
      _stopHeartbeat();
      _verificationToken = "";
      clearCookie();
      webapi("Logout").catch(function() {
      }).then(function() {
        location.href = "/";
      });
    }
    function _handleSessionExpired() {
      _stopHeartbeat();
      _stopInactivityTimer();
      _verificationToken = "";
      clearCookie();
      webapi("Logout").catch(function() {
      }).then(function() {
        location.reload();
      });
    }
    function isLoggedIn() {
      return !!_currentToken();
    }
    async function restoreSession() {
      const cookie = getCookie();
      if (!cookie || !cookie.startsWith(COOKIE_PREFIX)) return false;
      _verificationToken = cookie.slice(COOKIE_PREFIX.length);
      try {
        const state = await webapi("GetLoginState");
        if (state.State === 1 || state.State === "1") {
          _startHeartbeat();
          return true;
        }
      } catch (e) {
      }
      _verificationToken = "";
      clearCookie();
      return false;
    }
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
    return {
      login,
      logout,
      isLoggedIn,
      restoreSession,
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
  window.API = API2;

  // js/app-core.js
  var App2 = (function() {
    "use strict";
    function $(sel, ctx) {
      return (ctx || document).querySelector(sel);
    }
    function $$(sel, ctx) {
      return (ctx || document).querySelectorAll(sel);
    }
    function h(tag, attrs) {
      var el = document.createElement(tag);
      if (attrs) {
        for (var k in attrs) {
          if (!attrs.hasOwnProperty(k)) continue;
          var v = attrs[k];
          if (k === "class") el.className = v;
          else if (k === "html") el.innerHTML = v;
          else if (k.indexOf("on") === 0) el.addEventListener(k.slice(2), v);
          else el.setAttribute(k, v);
        }
      }
      for (var i = 2; i < arguments.length; i++) {
        var c = arguments[i];
        if (typeof c === "string") el.appendChild(document.createTextNode(c));
        else if (c) el.appendChild(c);
      }
      return el;
    }
    function icon(id, cls) {
      return '<svg class="' + (cls || "") + '"><use href="#' + id + '"/></svg>';
    }
    function formatBytes(bytes) {
      if (bytes == null || isNaN(bytes)) return "\u2014";
      bytes = Number(bytes);
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
      if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
      return (bytes / 1073741824).toFixed(2) + " GB";
    }
    function formatSpeed(bytesPerSec) {
      if (bytesPerSec == null || isNaN(bytesPerSec)) return { value: "\u2014", unit: "" };
      bytesPerSec = Number(bytesPerSec);
      var bps = bytesPerSec * 8;
      if (bps < 1e3) return { value: bps.toFixed(0), unit: "bps" };
      if (bps < 1e6) return { value: (bps / 1e3).toFixed(1), unit: "Kbps" };
      if (bps < 1e9) return { value: (bps / 1e6).toFixed(1), unit: "Mbps" };
      return { value: (bps / 1e9).toFixed(2), unit: "Gbps" };
    }
    function formatUptime(seconds) {
      if (!seconds) return "\u2014";
      seconds = Number(seconds);
      var d = Math.floor(seconds / 86400);
      var hh = Math.floor(seconds % 86400 / 3600);
      var mm = Math.floor(seconds % 3600 / 60);
      if (d > 0) return d + "d " + hh + "h " + mm + "m";
      if (hh > 0) return hh + "h " + mm + "m";
      return mm + "m";
    }
    function _parseDateTime(str) {
      if (!str) return null;
      var m = str.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
      if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]);
      var d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    }
    function formatTimeAgo(dateStr) {
      var d = _parseDateTime(dateStr);
      if (!d) return dateStr || "\u2014";
      var now = /* @__PURE__ */ new Date();
      var diffMs = now - d;
      if (diffMs < 0) return dateStr;
      var diffSec = Math.floor(diffMs / 1e3);
      var diffMin = Math.floor(diffSec / 60);
      var diffHr = Math.floor(diffMin / 60);
      if (diffMin < 1) return "just now";
      if (diffMin < 60) return diffMin + " min ago";
      if (diffHr < 24) {
        var rm = diffMin % 60;
        return rm > 0 ? diffHr + "h " + rm + "m ago" : diffHr + "h ago";
      }
      var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      var msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      var dayDiff = Math.round((today - msgDay) / 864e5);
      var time = (d.getHours() < 10 ? "0" : "") + d.getHours() + ":" + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes();
      if (dayDiff === 0) return "today " + time;
      if (dayDiff === 1) return "yesterday " + time;
      if (dayDiff < 7) return dayDiff + " days ago " + time;
      var dd = (d.getDate() < 10 ? "0" : "") + d.getDate();
      var mm = (d.getMonth() < 9 ? "0" : "") + (d.getMonth() + 1);
      return dd + "." + mm + "." + d.getFullYear() + " " + time;
    }
    function escHtml(s) {
      var d = document.createElement("div");
      d.textContent = s;
      return d.innerHTML.replace(/"/g, "&quot;");
    }
    function actionAttr(name, args) {
      var s = 'data-action="' + name + '"';
      if (args !== void 0 && args !== null) {
        s += ' data-args="' + escHtml(JSON.stringify(Array.isArray(args) ? args : [args])) + '"';
      }
      return s;
    }
    var NAV_ITEMS = [
      { id: "dashboard", icon: "ic-dashboard", label: "Dashboard" },
      { id: "clients", icon: "ic-clients", label: "Clients" },
      { id: "connection", icon: "ic-mobile", label: "Connection" },
      { id: "apn", icon: "ic-globe", label: "APN" },
      { id: "at-terminal", icon: "ic-terminal", label: "AT Terminal" },
      { id: "ussd", icon: "ic-mobile", label: "USSD" },
      { id: "mobile-settings", icon: "ic-settings", label: "Settings" },
      { id: "sms", icon: "ic-sms", label: "SMS" },
      { id: "wifi", icon: "ic-wifi", label: "WiFi" },
      { id: "lan", icon: "ic-network", label: "LAN" },
      { id: "firewall", icon: "ic-firewall", label: "Firewall" },
      { id: "upnp", icon: "ic-network", label: "UPnP" },
      { id: "ttl-fix", icon: "ic-firewall", label: "TTL Fix" },
      { id: "vpn", icon: "ic-vpn", label: "VPN" },
      { id: "diagnostics", icon: "ic-diag", label: "Diagnostics" },
      { id: "speedtest", icon: "ic-speedtest", label: "Speed Test" },
      { id: "settings", icon: "ic-settings", label: "Settings" },
      { id: "ssh", icon: "ic-terminal", label: "SSH" },
      { id: "backup", icon: "ic-download", label: "Backup" },
      { id: "about", icon: "ic-about", label: "About" }
    ];
    var NAV_GROUPS = [
      { label: "STATUS", icon: "ic-dashboard", items: ["dashboard", "clients"] },
      { label: "MOBILE", icon: "ic-mobile", items: ["connection", "sms", "ussd", "mobile-settings"] },
      { label: "NETWORK", icon: "ic-wifi", items: ["wifi", "lan", "firewall", "upnp", "ttl-fix", "vpn"] },
      { label: "SYSTEM", icon: "ic-settings", items: ["diagnostics", "speedtest", "settings", "ssh", "backup", "about"] }
    ];
    var _navItemMap = {};
    NAV_ITEMS.forEach(function(item) {
      _navItemMap[item.id] = item;
    });
    var _sidebarCollapsed = localStorage.getItem("ee71-sidebar") === "collapsed";
    function initTheme() {
      var saved = localStorage.getItem("ee71-theme");
      if (saved) {
        document.documentElement.setAttribute("data-theme", saved);
      } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.setAttribute("data-theme", "light");
      }
      updateThemeIcon();
    }
    function toggleTheme() {
      var current = document.documentElement.getAttribute("data-theme");
      var next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("ee71-theme", next);
      updateThemeIcon();
    }
    function updateThemeIcon() {
      var btn = $("#theme-toggle");
      if (!btn) return;
      var isDark = document.documentElement.getAttribute("data-theme") === "dark";
      btn.innerHTML = icon(isDark ? "ic-sun" : "ic-moon");
    }
    var _statusTimer = null;
    var _deviceInfoLoaded = false;
    function _loadDeviceInfo() {
      if (_deviceInfoLoaded) return;
      API.webapi("GetSystemInfo").then(function(info) {
        _deviceInfoLoaded = true;
        var elExtra = $("#sb-dev-extra");
        if (elExtra) elExtra.textContent = info.DeviceName || "";
      }).catch(function() {
      });
    }
    function refreshStatusBar() {
      API.batchWebapi([
        "GetNetworkInfo",
        "GetConnectionState",
        "GetSMSStorageState"
      ]).then(function(data) {
        var net = data.GetNetworkInfo || {};
        var _techMap = { 0: "", 1: "GSM", 2: "GPRS", 3: "EDGE", 4: "3G", 5: "3G+", 6: "3G+", 7: "H+", 8: "LTE", 9: "LTE+" };
        var techLabel = _techMap[net.NetworkType] || "";
        var opName = net.NetworkName || "";
        var netType = opName && techLabel ? opName + " " + techLabel : opName || techLabel || "\u2014";
        var rsrp = parseInt(net.RSRP, 10);
        var signalLevel = 0;
        if (!isNaN(rsrp) && rsrp < -1) {
          if (rsrp >= -80) signalLevel = 5;
          else if (rsrp >= -90) signalLevel = 4;
          else if (rsrp >= -100) signalLevel = 3;
          else if (rsrp >= -110) signalLevel = 2;
          else signalLevel = 1;
        } else {
          var rssi = parseInt(net.SignalStrength, 10);
          if (!isNaN(rssi) && rssi > 0) signalLevel = Math.min(5, Math.max(1, Math.ceil(rssi / 20)));
        }
        var elTech = $("#sb-tech");
        if (elTech) elTech.textContent = netType;
        var bars = $$("#sb-signal .bar");
        bars.forEach(function(b, i) {
          b.classList.toggle("active", i < signalLevel);
        });
        var conn = data.GetConnectionState || {};
        var elInet = $("#sb-inet");
        if (elInet) {
          var connected = conn.ConnectionStatus === 2 || conn.ConnectionStatus === "2";
          elInet.classList.toggle("sb-dim", !connected);
          elInet.classList.toggle("sb-on", connected);
        }
        var sms = data.GetSMSStorageState || {};
        var unread = parseInt(sms.UnreadSMSCount, 10) || 0;
        var elSms = $("#sb-sms");
        if (elSms) elSms.classList.toggle("hidden", unread === 0);
        var elSmsBadge = $("#sb-sms-count");
        if (elSmsBadge) elSmsBadge.textContent = unread;
      }).catch(function() {
      });
      API.batchWebapi([
        "GetBatteryState",
        "GetWlanState"
      ]).then(function(data) {
        var bat = data.GetBatteryState;
        if (bat) {
          var batLevel = parseInt(bat.BatteryLevel, 10) || 0;
          var batFill = document.getElementById("sb-bat-fill");
          if (batFill) {
            var fillW = Math.max(0, Math.min(100, batLevel)) / 100 * 21;
            batFill.setAttribute("width", fillW.toFixed(1));
          }
          var batText = $("#sb-battery .battery-level");
          if (batText) batText.textContent = batLevel + "%";
        }
        var wlan = data.GetWlanState;
        if (wlan) {
          var elWifi = $("#sb-wifi");
          if (elWifi) {
            var wifiOn = wlan.WlanState === 1 || wlan.WlanState === "1";
            elWifi.classList.toggle("sb-dim", !wifiOn);
            elWifi.classList.toggle("sb-on", wifiOn);
          }
        }
      }).catch(function() {
      });
      if (!API.isLoggedIn()) return;
      Promise.all([
        API.cgiGet("wireguard.cgi", { action: "status" }).catch(function() {
          return {};
        }),
        API.cgiGet("amneziawg.cgi", { action: "status" }).catch(function() {
          return {};
        }),
        API.cgiGet("shadowsocks.cgi", { action: "status" }).catch(function() {
          return {};
        })
      ]).then(function(vpn) {
        var elVpn = $("#sb-vpn");
        if (elVpn) {
          var vpnOn = !!(vpn[0].up || vpn[1].up || vpn[2].running);
          elVpn.classList.toggle("hidden", !vpnOn);
        }
      }).catch(function() {
      });
    }
    function startStatusPolling() {
      stopStatusPolling();
      refreshStatusBar();
      _loadDeviceInfo();
      _statusTimer = setInterval(function() {
        refreshStatusBar();
        _loadDeviceInfo();
      }, 5e3);
    }
    function stopStatusPolling() {
      if (_statusTimer) {
        clearInterval(_statusTimer);
        _statusTimer = null;
      }
    }
    var PAGE_RENDERERS = {};
    function registerPage(id, renderer) {
      PAGE_RENDERERS[id] = renderer;
    }
    function stubPage(title, iconId, description) {
      return function(container) {
        container.innerHTML = "<h2>" + escHtml(title) + '</h2><p class="text-muted">' + escHtml(description) + '</p><div class="page-loading"><div class="spinner"></div> Coming soon</div>';
      };
    }
    var _currentPage = null;
    var _currentPageCleanup = null;
    function setCleanup(fn) {
      _currentPageCleanup = fn;
    }
    function navigate(pageId) {
      if (pageId !== _currentPage) {
        window.location.hash = "#/" + pageId;
      }
    }
    function getRoute() {
      var hash = window.location.hash || "";
      var m = hash.match(/^#\/(.+)/);
      return m ? m[1] : "";
    }
    function onRouteChange() {
      var route = getRoute();
      if (!API.isLoggedIn() && route !== "login") {
        window.location.hash = "#/login";
        return;
      }
      if (API.isLoggedIn() && (route === "login" || route === "")) {
        window.location.hash = "#/dashboard";
        return;
      }
      renderPage(route || "login");
    }
    function renderPage(pageId) {
      if (_currentPageCleanup) {
        _currentPageCleanup();
        _currentPageCleanup = null;
      }
      _currentPage = pageId;
      $$("#sidebar a, #bottom-nav a, #mobile-menu a").forEach(function(a) {
        a.classList.toggle("active", a.getAttribute("data-page") === pageId);
      });
      NAV_GROUPS.forEach(function(group, gi) {
        var sub = $("#nav-group-" + gi);
        if (sub && group.items.indexOf(pageId) !== -1) {
          sub.classList.add("open");
        }
      });
      var isLogin = pageId === "login";
      var sidebar = $("#sidebar");
      var bottomNav = $("#bottom-nav");
      var statusBar = $("#status-bar");
      if (sidebar) sidebar.classList.toggle("hidden", isLogin);
      if (bottomNav) bottomNav.classList.toggle("hidden", isLogin);
      if (statusBar) statusBar.classList.remove("hidden");
      var mobileMenu = $("#mobile-menu");
      if (mobileMenu) mobileMenu.classList.add("hidden");
      var container = $("#page-content");
      if (!container) return;
      container.innerHTML = "";
      var renderer = PAGE_RENDERERS[pageId];
      if (renderer) {
        renderer(container);
      } else {
        container.innerHTML = '<div class="page-loading">Page not found: ' + escHtml(pageId) + "</div>";
      }
    }
    var BOTTOM_NAV_IDS = {
      dashboard: 1,
      clients: 1,
      connection: 1,
      sms: 1,
      wifi: 1,
      vpn: 1,
      settings: 1,
      speedtest: 1,
      about: 1
    };
    function _doLogout() {
      API.logout().then(function() {
        window.location.hash = "#/login";
      });
    }
    function _toggleMobileMenu() {
      var menu = $("#mobile-menu");
      if (menu) menu.classList.toggle("hidden");
    }
    function _toggleSidebar() {
      _sidebarCollapsed = !_sidebarCollapsed;
      localStorage.setItem("ee71-sidebar", _sidebarCollapsed ? "collapsed" : "expanded");
      document.body.classList.toggle("sidebar-collapsed", _sidebarCollapsed);
    }
    function _toggleNavGroup(groupIdx) {
      var sub = $("#nav-group-" + groupIdx);
      if (!sub) return;
      sub.classList.toggle("open");
    }
    function buildNav() {
      var sidebar = $("#sidebar");
      var bottomScroll = $("#bottom-nav .nav-scroll");
      var menuContent = $("#mobile-menu .mobile-menu-content");
      if (_sidebarCollapsed) document.body.classList.add("sidebar-collapsed");
      if (sidebar) {
        var navWrap = document.createElement("div");
        navWrap.className = "nav-groups";
        NAV_GROUPS.forEach(function(group, gi) {
          var header = h("div", {
            class: "nav-group-header",
            html: icon(group.icon) + '<span class="nav-group-label">' + group.label + "</span>"
          });
          header.setAttribute("data-group", gi);
          header.addEventListener("click", function() {
            if (_sidebarCollapsed) {
              _toggleSidebar();
            } else {
              _toggleNavGroup(gi);
            }
          });
          navWrap.appendChild(header);
          var subDiv = document.createElement("div");
          subDiv.className = "nav-group-items open";
          subDiv.id = "nav-group-" + gi;
          group.items.forEach(function(itemId) {
            var item = _navItemMap[itemId];
            if (!item) return;
            var link = h("a", {
              href: "#/" + item.id,
              "data-page": item.id,
              html: icon(item.icon) + '<span class="nav-item-label">' + item.label + "</span>"
            });
            subDiv.appendChild(link);
          });
          navWrap.appendChild(subDiv);
        });
        sidebar.appendChild(navWrap);
        var spacer = document.createElement("div");
        spacer.className = "flex-spacer";
        sidebar.appendChild(spacer);
        var toggleBtn = h("a", {
          href: "#",
          class: "nav-toggle-btn",
          html: '<span class="nav-toggle-expand">' + icon("ic-menu") + '</span><span class="nav-toggle-collapse">' + icon("ic-menu") + '<span class="nav-item-label">Hide menu</span></span>'
        });
        toggleBtn.addEventListener("click", function(e) {
          e.preventDefault();
          _toggleSidebar();
        });
        sidebar.appendChild(toggleBtn);
        var sideLogout = h("a", {
          href: "#",
          class: "nav-logout",
          html: icon("ic-power") + '<span class="nav-item-label">Logout</span>'
        });
        sideLogout.addEventListener("click", function(e) {
          e.preventDefault();
          _doLogout();
        });
        sidebar.appendChild(sideLogout);
      }
      NAV_ITEMS.forEach(function(item) {
        if (BOTTOM_NAV_IDS[item.id]) {
          var bottomLink = h("a", {
            href: "#/" + item.id,
            "data-page": item.id,
            html: icon(item.icon) + "<span>" + item.label + "</span>"
          });
          if (bottomScroll) bottomScroll.appendChild(bottomLink);
        }
      });
      var hamburgerBtn = $("#sb-hamburger");
      if (hamburgerBtn) hamburgerBtn.addEventListener("click", _toggleMobileMenu);
      var closeBtn = $("#mobile-menu-close");
      if (closeBtn) closeBtn.addEventListener("click", _toggleMobileMenu);
      if (menuContent) {
        let _appendNavItem = function(container, itemId) {
          var item = _navItemMap[itemId];
          if (!item) return;
          var menuLink = h("a", {
            href: "#/" + item.id,
            "data-page": item.id,
            html: icon(item.icon) + "<span>" + item.label + "</span>"
          });
          menuLink.addEventListener("click", _toggleMobileMenu);
          container.appendChild(menuLink);
        };
        NAV_GROUPS.forEach(function(group) {
          var groupLabel = h("div", {
            class: "nav-group-label",
            html: icon(group.icon) + group.label
          });
          menuContent.appendChild(groupLabel);
          group.items.forEach(function(itemId) {
            _appendNavItem(menuContent, itemId);
          });
        });
        var bottomActions = h("div", { class: "mobile-menu-bottom" });
        var themeLink = h("a", {
          href: "#",
          html: icon("ic-moon") + "<span>Toggle theme</span>"
        });
        themeLink.className = "mobile-menu-action";
        themeLink.addEventListener("click", function(e) {
          e.preventDefault();
          toggleTheme();
          var isDark = document.documentElement.getAttribute("data-theme") === "dark";
          themeLink.innerHTML = icon(isDark ? "ic-sun" : "ic-moon") + "<span>Toggle theme</span>";
        });
        bottomActions.appendChild(themeLink);
        var logoutLink = h("a", {
          href: "#",
          html: icon("ic-power") + "<span>Logout</span>"
        });
        logoutLink.className = "mobile-menu-action nav-logout";
        logoutLink.addEventListener("click", function(e) {
          e.preventDefault();
          _toggleMobileMenu();
          _doLogout();
        });
        bottomActions.appendChild(logoutLink);
        menuContent.appendChild(bottomActions);
      }
    }
    function showModal(message, onOk) {
      var old = document.getElementById("ee71-modal");
      if (old) old.remove();
      var overlay = document.createElement("div");
      overlay.id = "ee71-modal";
      overlay.className = "modal-overlay";
      overlay.innerHTML = '<div class="modal-box"><p>' + escHtml(message) + '</p><button class="modal-ok-btn" data-action="modalOk">OK</button></div>';
      document.body.appendChild(overlay);
      _modalOkCallback = onOk || null;
    }
    var _modalOkCallback = null;
    function _modalOk() {
      var overlay = document.getElementById("ee71-modal");
      if (overlay) overlay.remove();
      if (_modalOkCallback) {
        var cb = _modalOkCallback;
        _modalOkCallback = null;
        cb();
      }
    }
    async function init() {
      initTheme();
      buildNav();
      var themeBtn = $("#theme-toggle");
      if (themeBtn) themeBtn.addEventListener("click", toggleTheme);
      document.addEventListener("click", function(e) {
        var el = e.target.closest("[data-action]");
        if (!el) return;
        if (el.tagName === "A" || el.tagName === "BUTTON") e.preventDefault();
        if (el.hasAttribute("data-stop")) e.stopPropagation();
        var fn = App2["_" + el.dataset.action];
        if (typeof fn !== "function") return;
        var raw = el.dataset.args;
        if (raw) {
          try {
            fn.apply(null, JSON.parse(raw));
          } catch (ex) {
            fn();
          }
        } else {
          fn();
        }
      });
      document.addEventListener("change", function(e) {
        var el = e.target.closest("[data-onchange]");
        if (!el) return;
        var fn = App2["_" + el.dataset.onchange];
        if (typeof fn !== "function") return;
        var raw = el.dataset.args;
        if (raw) {
          try {
            fn.apply(null, JSON.parse(raw));
          } catch (ex) {
            fn();
          }
        } else {
          fn();
        }
      });
      await API.restoreSession();
      startStatusPolling();
      window.addEventListener("hashchange", onRouteChange);
      onRouteChange();
    }
    return {
      init,
      navigate,
      registerPage,
      setCleanup,
      stubPage,
      startStatusPolling,
      stopStatusPolling,
      $,
      $$,
      h,
      icon,
      formatBytes,
      formatSpeed,
      formatUptime,
      formatTimeAgo,
      escHtml,
      actionAttr,
      _getRoute: getRoute,
      _modalOk
    };
  })();
  window.App = App2;

  // js/pages/login.js
  (function() {
    "use strict";
    var $ = App.$, h = App.h, icon = App.icon, actionAttr = App.actionAttr;
    function renderLogin(container) {
      container.innerHTML = "";
      var page = h("div", { id: "login-page" });
      var box = h("div", { class: "login-box" });
      box.innerHTML = '<div class="login-logo"><svg viewBox="0 0 76 120" width="57" height="90"><circle cx="38" cy="36" r="36" fill="var(--color-primary)"/><circle cx="38" cy="84" r="36" fill="var(--color-primary)"/><circle cx="28" cy="20" r="2.6" fill="#fff"/><circle cx="35" cy="20" r="2.6" fill="#fff"/><circle cx="42" cy="20" r="2.6" fill="#fff"/><circle cx="49" cy="20" r="2.6" fill="#fff"/><circle cx="28" cy="27" r="2.6" fill="#fff"/><circle cx="28" cy="34" r="2.6" fill="#fff"/><circle cx="35" cy="34" r="2.6" fill="#fff"/><circle cx="42" cy="34" r="2.6" fill="#fff"/><circle cx="28" cy="41" r="2.6" fill="#fff"/><circle cx="28" cy="48" r="2.6" fill="#fff"/><circle cx="35" cy="48" r="2.6" fill="#fff"/><circle cx="42" cy="48" r="2.6" fill="#fff"/><circle cx="49" cy="48" r="2.6" fill="#fff"/><circle cx="28" cy="68" r="2.6" fill="#fff"/><circle cx="35" cy="68" r="2.6" fill="#fff"/><circle cx="42" cy="68" r="2.6" fill="#fff"/><circle cx="49" cy="68" r="2.6" fill="#fff"/><circle cx="28" cy="75" r="2.6" fill="#fff"/><circle cx="28" cy="82" r="2.6" fill="#fff"/><circle cx="35" cy="82" r="2.6" fill="#fff"/><circle cx="42" cy="82" r="2.6" fill="#fff"/><circle cx="28" cy="89" r="2.6" fill="#fff"/><circle cx="28" cy="96" r="2.6" fill="#fff"/><circle cx="35" cy="96" r="2.6" fill="#fff"/><circle cx="42" cy="96" r="2.6" fill="#fff"/><circle cx="49" cy="96" r="2.6" fill="#fff"/></svg></div><h2>EE71</h2><div class="login-error" id="login-error"></div><div class="form-group"><div class="pass-field"><input type="password" id="login-pass" placeholder="Admin password" autocomplete="current-password"><button class="pass-eye" ' + actionAttr("togglePassVis", ["login-pass"]) + ' title="Show password">' + icon("ic-eye-off") + '</button></div></div><button id="login-btn" style="width:100%">Log in</button>';
      page.appendChild(box);
      container.appendChild(page);
      var passInput = $("#login-pass");
      var btn = $("#login-btn");
      var err = $("#login-error");
      function doLogin() {
        var pw = passInput.value.trim();
        if (!pw) {
          err.textContent = "Enter password";
          return;
        }
        btn.disabled = true;
        btn.textContent = "Logging in...";
        err.textContent = "";
        API.login("admin", pw).then(function() {
          App.startStatusPolling();
          window.location.hash = "#/dashboard";
        }).catch(function(e) {
          if (e instanceof API.ApiError) {
            if (e.code === "010103") {
              err.textContent = "Too many attempts. Locked for 5 minutes.";
            } else if (e.code === "010102") {
              err.textContent = "Wrong password";
            } else {
              err.textContent = e.apiMessage;
            }
          } else {
            err.textContent = "Connection error";
          }
        }).then(function() {
          btn.disabled = false;
          btn.textContent = "Log in";
        });
      }
      btn.addEventListener("click", doLogin);
      passInput.addEventListener("keydown", function(e) {
        if (e.key === "Enter") doLogin();
      });
      setTimeout(function() {
        passInput.focus();
      }, 100);
    }
    App.registerPage("login", renderLogin);
  })();

  // js/pages/dashboard.js
  (function() {
    "use strict";
    var $ = App.$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;
    var formatBytes = App.formatBytes, formatSpeed = App.formatSpeed, formatUptime = App.formatUptime;
    var _dashTimer = null;
    var _miniChart = null;
    var _speedHistory = { t: [], dl: [], ul: [] };
    function renderDashboard(container) {
      container.innerHTML = '<div class="cards-grid"><div class="card" id="dash-connection"><h3>' + icon("ic-mobile") + ' Connection <span class="status-dot" id="d-conn-dot"></span></h3><div class="stat-row"><span class="label">Operator</span><span class="value" id="d-operator">\u2014</span></div><div class="stat-row"><span class="label">Technology</span><span class="value" id="d-tech">\u2014</span></div><div class="stat-row"><span class="label">Signal (RSRP)</span><span class="value" id="d-rsrp">\u2014</span></div><div class="stat-row"><span class="label">Band</span><span class="value" id="d-band">\u2014</span></div><div class="stat-row" style="border-bottom:none;padding-bottom:2px"><span class="label">Public IP Address</span></div><div class="stat-row"><span class="label">IPv4</span><span class="value text-mono" id="d-ip">\u2014</span></div><div class="stat-row" id="d-ip6-row" style="display:none"><span class="label">IPv6</span><span class="value text-mono" id="d-ip6" style="font-size:0.65rem">\u2014</span></div></div><div class="card" id="dash-speed"><h3>' + icon("ic-traffic") + ' Speed</h3><div class="speed-pair"><div class="speed-display"><div class="speed-label">Download</div><div class="speed-value" id="d-dl-speed">\u2014</div><div class="speed-unit" id="d-dl-unit"></div></div><div class="speed-display"><div class="speed-label">Upload</div><div class="speed-value" id="d-ul-speed">\u2014</div><div class="speed-unit" id="d-ul-unit"></div></div></div><div class="chart-container" id="d-speed-chart" style="min-height:120px"></div></div><div class="card" id="dash-devices"><h3>' + icon("ic-clients") + ' Devices</h3><div class="stat-row"><span class="label">Connected</span><span class="value" id="d-devcount">\u2014</span></div><div id="d-devlist" class="mt-1 text-small"></div></div><div class="card" id="dash-usage"><h3>' + icon("ic-traffic") + ' Data Usage</h3><div class="stat-row"><span class="label">Total</span><span class="value" id="d-usage-total">\u2014</span></div><div class="stat-row"><span class="label">\u2193 Download</span><span class="value" id="d-usage-dl">\u2014</span></div><div class="stat-row"><span class="label">\u2191 Upload</span><span class="value" id="d-usage-ul">\u2014</span></div></div><div class="card" id="dash-system"><h3>' + icon("ic-settings") + ' System</h3><div class="stat-row"><span class="label">Uptime</span><span class="value" id="d-uptime">\u2014</span></div><div class="stat-row"><span class="label">Battery</span><span class="value" id="d-battery">\u2014</span></div><div class="stat-row"><span class="label">Load Avg</span><span class="value" id="d-cpu">\u2014</span><div class="progress-thin green" id="d-cpu-bar"><div class="fill" style="width:0%"></div></div></div><div class="stat-row"><span class="label">Memory</span><span class="value" id="d-memory">\u2014</span><div class="progress-thin orange" id="d-mem-bar"><div class="fill" style="width:0%"></div></div></div></div><div class="card" id="dash-toggles"><h3>' + icon("ic-power") + ' Quick Toggles</h3><div class="quick-toggles"><button class="toggle-btn" id="t-wifi" ' + actionAttr("toggleWifi") + ">" + icon("ic-wifi") + ' WiFi</button><button class="toggle-btn" id="t-data" ' + actionAttr("toggleData") + ">" + icon("ic-globe") + ' Data</button><button class="toggle-btn" id="t-vpn" ' + actionAttr("toggleVpn") + ">" + icon("ic-vpn") + " VPN</button></div></div></div>";
      refreshDashboard();
      _dashTimer = setInterval(refreshDashboard, 5e3);
      App.setCleanup(function() {
        if (_dashTimer) {
          clearInterval(_dashTimer);
          _dashTimer = null;
        }
        if (_miniChart) {
          _miniChart.destroy();
          _miniChart = null;
        }
        _speedHistory = { t: [], dl: [], ul: [] };
      });
    }
    function refreshDashboard() {
      Promise.all([
        API.webapi("GetNetworkInfo").catch(function() {
          return null;
        }),
        API.webapi("GetConnectionState").catch(function() {
          return null;
        }),
        API.webapi("GetBatteryState").catch(function() {
          return null;
        }),
        API.webapi("GetConnectedDeviceList").catch(function() {
          return null;
        }),
        API.webapi("GetUsageRecord").catch(function() {
          return null;
        }),
        API.cgiGet("traffic.cgi", { action: "status" }).catch(function() {
          return null;
        }),
        API.cgiGet("system.cgi", { action: "cpu" }).catch(function() {
          return null;
        })
      ]).then(function(results) {
        var netInfo = results[0], connSt = results[1], batSt = results[2];
        var devList = results[3], usage = results[4], trafficData = results[5], sysInfo = results[6];
        var el = function(id) {
          return document.getElementById(id);
        };
        if (netInfo) {
          var opName = netInfo.NetworkName || netInfo.Domestic || "";
          if (el("d-operator")) el("d-operator").textContent = opName || "\u2014";
          if (el("d-tech")) el("d-tech").textContent = netInfo.NetworkType || "\u2014";
          if (el("d-rsrp")) {
            var rsrp = netInfo.RSRP;
            var v = parseInt(rsrp, 10);
            if (isNaN(v) || v >= -1 || v === 0) {
              el("d-rsrp").textContent = "\u2014";
            } else {
              el("d-rsrp").textContent = rsrp + " dBm";
              el("d-rsrp").className = "value " + (v >= -80 ? "text-success" : v >= -100 ? "text-warn" : "text-danger");
            }
          }
          if (el("d-band")) el("d-band").textContent = netInfo.Band || "\u2014";
          var dot = el("d-conn-dot");
          if (dot) {
            var hasConn = opName && opName !== "N/A" && opName !== "\u2014";
            dot.className = "status-dot " + (hasConn ? "green" : "red");
          }
        }
        if (connSt) {
          var elIp = el("d-ip");
          if (elIp) elIp.textContent = connSt.IPv4Adrress || connSt.IPAddress || "\u2014";
          var ipv6 = connSt.IPv6Adrress || "";
          var elIp6 = el("d-ip6");
          var elIp6Row = el("d-ip6-row");
          if (elIp6) elIp6.textContent = ipv6 || "\u2014";
          if (elIp6Row) elIp6Row.style.display = ipv6 ? "" : "none";
        }
        if (trafficData && trafficData.wan) {
          var dl = formatSpeed(trafficData.wan.rx_speed);
          var ul = formatSpeed(trafficData.wan.tx_speed);
          if (el("d-dl-speed")) el("d-dl-speed").textContent = dl.value;
          if (el("d-dl-unit")) el("d-dl-unit").textContent = dl.unit;
          if (el("d-ul-speed")) el("d-ul-speed").textContent = ul.value;
          if (el("d-ul-unit")) el("d-ul-unit").textContent = ul.unit;
        }
        if (devList) {
          var devices = devList.ConnectedList || [];
          if (el("d-devcount")) el("d-devcount").textContent = devices.length;
          var elList = el("d-devlist");
          if (elList) {
            if (devices.length === 0) {
              elList.textContent = "No devices connected";
            } else {
              elList.innerHTML = devices.slice(0, 8).map(function(d) {
                var name = (d.DeviceName || d.HostName || "").toLowerCase();
                var isPhone = /iphone|ipad|android|galaxy|pixel|xiaomi|redmi|huawei|oneplus|oppo|vivo|samsung|poco|realme/.test(name);
                var devIcon = isPhone ? "ic-mobile" : "ic-computer";
                var cm = Number(d.ConnectMode);
                var connIcon = cm === 0 ? "ic-usb" : "ic-wifi";
                return '<div class="device-row">' + icon(devIcon) + '<span class="device-name">' + escHtml(d.DeviceName || d.HostName || d.IPAddress || d.IpAddress || d.MacAddress || "?") + '</span><span class="device-ip">' + escHtml(d.IpAddress || "") + '</span><span class="device-signal">' + icon(connIcon) + "</span></div>";
              }).join("");
              if (devices.length > 8) {
                elList.innerHTML += '<div class="text-muted text-center mt-1">+' + (devices.length - 8) + " more</div>";
              }
            }
          }
        }
        if (usage) {
          var ul = parseInt(usage.HCurrUseUL, 10) || 0;
          var dlBytes = parseInt(usage.HCurrUseDL, 10) || 0;
          if (el("d-usage-total")) el("d-usage-total").textContent = formatBytes(ul + dlBytes);
          if (el("d-usage-dl")) el("d-usage-dl").textContent = formatBytes(dlBytes);
          if (el("d-usage-ul")) el("d-usage-ul").textContent = formatBytes(ul);
        }
        if (batSt) {
          var elBat = el("d-battery");
          if (elBat) {
            var charging = batSt.chg_state === 1 || batSt.BatteryState === 1 || batSt.BatteryState === "1";
            var batLvl = batSt.BatteryLevel != null ? batSt.BatteryLevel : "?";
            elBat.innerHTML = batLvl + "%" + (charging ? " \u26A1" : "");
          }
        }
        if (sysInfo) {
          if (el("d-cpu") && sysInfo.load1) {
            el("d-cpu").textContent = sysInfo.load1;
            var cpuPct = Math.min(Math.round(parseFloat(sysInfo.load1) * 100), 100);
            var cpuBar = el("d-cpu-bar");
            if (cpuBar) {
              cpuBar.querySelector(".fill").style.width = cpuPct + "%";
            }
          }
        }
        API.cgiGet("system.cgi", { action: "memory" }).then(function(mem) {
          if (mem && mem.MemTotal && el("d-memory")) {
            var used = mem.MemTotal - (mem.MemFree || 0) - (mem.Buffers || 0) - (mem.Cached || 0);
            var memPct = Math.round(used / mem.MemTotal * 100);
            el("d-memory").textContent = memPct + "%";
            var memBar = el("d-mem-bar");
            if (memBar) memBar.querySelector(".fill").style.width = memPct + "%";
          }
        }).catch(function() {
        });
        API.cgiGet("system.cgi", { action: "uptime" }).then(function(u) {
          if (u && u.seconds != null && el("d-uptime")) el("d-uptime").textContent = formatUptime(u.seconds);
        }).catch(function() {
        });
        API.webapi("GetWlanState").then(function(wlanSt) {
          var tWifi = el("t-wifi");
          if (tWifi && wlanSt) tWifi.classList.toggle("on", wlanSt.WlanState === 1 || wlanSt.WlanState === "1");
        }).catch(function() {
        });
        var tData = el("t-data");
        if (tData && connSt) {
          tData.classList.toggle("on", connSt.ConnectionStatus === 2 || connSt.ConnectionStatus === "2");
        }
        Promise.all([
          API.cgiGet("wireguard.cgi", { action: "status" }).catch(function() {
            return {};
          }),
          API.cgiGet("shadowsocks.cgi", { action: "status" }).catch(function() {
            return {};
          })
        ]).then(function(vpnRes) {
          var tVpn = el("t-vpn");
          if (tVpn) tVpn.classList.toggle("on", !!(vpnRes[0].up || vpnRes[1].running));
        }).catch(function() {
        });
        _updateMiniChart(trafficData);
      }).catch(function() {
      });
    }
    function _toggleWifi() {
      API.webapi("GetWlanState").then(function(st) {
        var isOn = st && (st.WlanState === 1 || st.WlanState === "1");
        return API.webapi(isOn ? "SetWlanOff" : "SetWlanOn");
      }).then(function() {
        setTimeout(refreshDashboard, 1e3);
      }).catch(function() {
      });
    }
    function _toggleData() {
      API.webapi("GetConnectionState").then(function(st) {
        var connected = st && (st.ConnectionStatus === 2 || st.ConnectionStatus === "2");
        return API.webapi(connected ? "DisConnect" : "Connect");
      }).then(function() {
        setTimeout(refreshDashboard, 2e3);
      }).catch(function() {
      });
    }
    function _toggleVpn() {
      API.cgiGet("wireguard.cgi", { action: "status" }).then(function(wg) {
        if (wg.up) return API.cgiPost("wireguard.cgi", { action: "disable" });
        return API.cgiGet("shadowsocks.cgi", { action: "status" }).then(function(ss) {
          if (ss.running) return API.cgiPost("shadowsocks.cgi", { action: "disable" });
          if (wg.has_config) return API.cgiPost("wireguard.cgi", { action: "enable" });
          App.navigate("vpn");
        });
      }).then(function() {
        setTimeout(refreshDashboard, 1500);
      }).catch(function() {
      });
    }
    function _updateMiniChart(trafficData) {
      if (!trafficData || !trafficData.wan) return;
      var chartEl = document.getElementById("d-speed-chart");
      if (!chartEl) return;
      var now = Math.floor(Date.now() / 1e3);
      _speedHistory.t.push(now);
      _speedHistory.dl.push((trafficData.wan.rx_speed || 0) * 8 / 1e6);
      _speedHistory.ul.push((trafficData.wan.tx_speed || 0) * 8 / 1e6);
      var MAX = 36;
      if (_speedHistory.t.length > MAX) {
        _speedHistory.t = _speedHistory.t.slice(-MAX);
        _speedHistory.dl = _speedHistory.dl.slice(-MAX);
        _speedHistory.ul = _speedHistory.ul.slice(-MAX);
      }
      if (_speedHistory.t.length < 2) return;
      var data = [_speedHistory.t, _speedHistory.dl, _speedHistory.ul];
      if (_miniChart) {
        _miniChart.setData(data);
      } else {
        _miniChart = new uPlot({
          width: chartEl.clientWidth || 300,
          height: 120,
          cursor: { show: false },
          legend: { show: false },
          scales: { x: { time: false }, y: { auto: true, range: [0, null] } },
          axes: [{ show: false }, { show: false }],
          series: [
            {},
            { stroke: "#0077cc", fill: "rgba(0,119,204,0.15)", width: 1.5 },
            { stroke: "#2e7d32", fill: "rgba(46,125,50,0.15)", width: 1.5 }
          ]
        }, data, chartEl);
      }
    }
    App.registerPage("dashboard", renderDashboard);
    App.refreshDashboard = refreshDashboard;
    App._toggleWifi = _toggleWifi;
    App._toggleData = _toggleData;
    App._toggleVpn = _toggleVpn;
  })();

  // js/pages/connection.js
  (function() {
    "use strict";
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;
    var _connTimer = null;
    var _signalChart = null;
    var _signalHistory = { t: [], rsrp: [], sinr: [] };
    function renderConnection(container) {
      container.innerHTML = '<h2>Connection</h2><div class="tabs" id="conn-tabs"><button class="active" data-tab="signal">Signal</button><button data-tab="network">Network</button></div><div class="tab-content active" id="conn-tab-signal">' + _renderSignalTab() + '</div><div class="tab-content" id="conn-tab-network"><div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div></div>';
      $$("#conn-tabs button").forEach(function(btn) {
        btn.addEventListener("click", function() {
          $$("#conn-tabs button").forEach(function(b) {
            b.classList.remove("active");
          });
          btn.classList.add("active");
          $$("#conn-tabs ~ .tab-content").forEach(function(tc) {
            tc.classList.remove("active");
          });
          var target = document.getElementById("conn-tab-" + btn.dataset.tab);
          if (target) target.classList.add("active");
        });
      });
      _refreshSignal();
      _loadNetwork();
      _connTimer = setInterval(_refreshSignal, 5e3);
      App.setCleanup(function() {
        if (_connTimer) {
          clearInterval(_connTimer);
          _connTimer = null;
        }
        if (_netSearchTimer) {
          clearTimeout(_netSearchTimer);
          _netSearchTimer = null;
        }
        if (_signalChart) {
          _signalChart.destroy();
          _signalChart = null;
        }
        _signalHistory = { t: [], rsrp: [], sinr: [] };
      });
    }
    function _renderSignalTab() {
      return '<div class="cards-grid"><div class="card" id="conn-connection"><h3>' + icon("ic-mobile") + ' Connection</h3><div class="stat-row"><span class="label">Operator</span><span class="value" id="m-operator">\u2014</span></div><div class="stat-row"><span class="label">Technology</span><span class="value" id="m-tech">\u2014</span></div><div class="stat-row"><span class="label">Band</span><span class="value" id="m-band">\u2014</span></div><div class="stat-row"><span class="label">EARFCN</span><span class="value" id="m-earfcn">\u2014</span></div><div class="stat-row"><span class="label">Cell ID</span><span class="value text-mono" id="m-cellid">\u2014</span></div><div class="stat-row"><span class="label">TAC</span><span class="value text-mono" id="m-tac">\u2014</span></div><div class="stat-row" style="border-bottom:none;padding-bottom:2px"><span class="label">Public IP Address</span></div><div class="stat-row"><span class="label">IPv4</span><span class="value text-mono" id="m-ip">\u2014</span></div><div class="stat-row" id="m-ip6-row" style="display:none"><span class="label">IPv6</span><span class="value text-mono" id="m-ip6" style="font-size:0.65rem">\u2014</span></div></div><div class="card" id="conn-signal"><h3>' + icon("ic-mobile") + ' Signal Quality</h3><div class="stat-row"><span class="label">Quality</span><span class="value" id="m-quality">\u2014</span></div><div class="signal-bars">' + _signalMetricBar("RSRP", "m-rsrp", "dBm") + _signalMetricBar("RSRQ", "m-rsrq", "dB") + _signalMetricBar("SINR", "m-sinr", "dB") + _signalMetricBar("RSSI", "m-rssi", "dBm") + '</div></div></div><div class="card mt-2"><div class="flex-between mb-1"><h3>Signal History</h3><div class="zoom-btns"><button class="btn-small active" ' + actionAttr("connSignalZoom", [0]) + '>3m</button><button class="btn-small" ' + actionAttr("connSignalZoom", [1]) + '>1h</button><button class="btn-small" ' + actionAttr("connSignalZoom", [2]) + '>3h</button><button class="btn-small" ' + actionAttr("connSignalZoom", [3]) + '>1d</button></div></div><div class="chart-container" id="m-signal-chart" style="min-height:180px"></div></div>';
    }
    function _signalMetricBar(label, id, unit) {
      return '<div class="signal-metric"><span class="signal-label">' + label + '</span><div class="signal-bar-track"><div class="signal-bar-fill" id="' + id + '-bar"></div></div><span class="signal-value" id="' + id + '">\u2014 ' + unit + "</span></div>";
    }
    function _refreshSignal() {
      Promise.all([
        API.webapi("GetNetworkInfo").catch(function() {
          return null;
        }),
        API.webapi("GetConnectionState").catch(function() {
          return null;
        }),
        API.cgiGet("signal.cgi", { action: "current" }).catch(function() {
          return null;
        })
      ]).then(function(results) {
        var netInfo = results[0], connSt = results[1], sigData = results[2];
        var el = function(id) {
          return document.getElementById(id);
        };
        if (netInfo) {
          if (el("m-operator")) el("m-operator").textContent = netInfo.NetworkName || netInfo.Domestic || "\u2014";
          if (el("m-tech")) el("m-tech").textContent = netInfo.NetworkType || "\u2014";
          if (el("m-band")) el("m-band").textContent = netInfo.Band || sigData && sigData.band || "\u2014";
        }
        if (connSt) {
          if (el("m-ip")) el("m-ip").textContent = connSt.IPv4Adrress || connSt.IPAddress || "\u2014";
          var ipv6 = connSt.IPv6Adrress || "";
          if (el("m-ip6")) el("m-ip6").textContent = ipv6 || "\u2014";
          if (el("m-ip6-row")) el("m-ip6-row").style.display = ipv6 ? "" : "none";
        }
        var rsrp = sigData && sigData.rsrp || netInfo && netInfo.RSRP;
        var rsrq = sigData && sigData.rsrq || netInfo && netInfo.RSRQ;
        var sinr = sigData && sigData.sinr || netInfo && netInfo.SINR;
        var rssi = sigData && sigData.rssi || netInfo && netInfo.SignalStrength;
        var earfcn = sigData && sigData.earfcn || "";
        var cellid = sigData && sigData.cell_id || "";
        var tac = sigData && sigData.tac || "";
        if (el("m-earfcn")) el("m-earfcn").textContent = earfcn || "\u2014";
        if (el("m-cellid")) el("m-cellid").textContent = cellid || "\u2014";
        if (el("m-tac")) el("m-tac").textContent = tac || "\u2014";
        _updateSignalMetric("m-rsrp", rsrp, "dBm", -140, -44, [-80, -100, -110]);
        _updateSignalMetric("m-rsrq", rsrq, "dB", -20, -3, [-10, -15, -17]);
        _updateSignalMetric("m-sinr", sinr, "dB", -5, 30, [13, 0, -5]);
        _updateSignalMetric("m-rssi", rssi, "dBm", -110, -50, [-65, -85, -95]);
        var quality = _signalQuality(rsrp);
        if (el("m-quality")) {
          el("m-quality").textContent = quality.text;
          el("m-quality").className = "value " + quality.cls;
        }
        if (rsrp != null) {
          var now = Math.floor(Date.now() / 1e3);
          _signalHistory.t.push(now);
          _signalHistory.rsrp.push(parseFloat(rsrp) || 0);
          _signalHistory.sinr.push(parseFloat(sinr) || 0);
          var MAX = 120;
          if (_signalHistory.t.length > MAX) {
            _signalHistory.t = _signalHistory.t.slice(-MAX);
            _signalHistory.rsrp = _signalHistory.rsrp.slice(-MAX);
            _signalHistory.sinr = _signalHistory.sinr.slice(-MAX);
          }
          _updateSignalChart();
        }
      }).catch(function() {
      });
    }
    function _updateSignalMetric(id, value, unit, min, max, thresholds) {
      var el = document.getElementById(id);
      var bar = document.getElementById(id + "-bar");
      if (!el) return;
      if (value == null || value === "") {
        el.textContent = "\u2014 " + unit;
        if (bar) {
          bar.style.width = "0%";
          bar.className = "signal-bar-fill";
        }
        return;
      }
      var v = parseFloat(value);
      el.textContent = v + " " + unit;
      var pct = Math.max(0, Math.min(100, (v - min) / (max - min) * 100));
      if (bar) {
        bar.style.width = pct + "%";
        var cls = "signal-bar-fill";
        if (v >= thresholds[0]) cls += " signal-excellent";
        else if (v >= thresholds[1]) cls += " signal-good";
        else if (v >= thresholds[2]) cls += " signal-fair";
        else cls += " signal-poor";
        bar.className = cls;
      }
    }
    function _signalQuality(rsrp) {
      if (rsrp == null) return { text: "\u2014", cls: "" };
      var v = parseFloat(rsrp);
      if (isNaN(v) || v >= -1 || v === 0) return { text: "\u2014", cls: "" };
      if (v >= -80) return { text: "Excellent", cls: "text-success" };
      if (v >= -90) return { text: "Good", cls: "text-success" };
      if (v >= -100) return { text: "Fair", cls: "text-warn" };
      if (v >= -110) return { text: "Poor", cls: "text-warn" };
      return { text: "Very Poor", cls: "text-danger" };
    }
    function _updateSignalChart() {
      var chartEl = document.getElementById("m-signal-chart");
      if (!chartEl || _signalHistory.t.length < 2) return;
      var data = [_signalHistory.t, _signalHistory.rsrp, _signalHistory.sinr];
      if (_signalChart) {
        var w = chartEl.clientWidth || 400;
        _signalChart.setSize({ width: w, height: 180 });
        _signalChart.setData(data);
      } else {
        _signalChart = new uPlot({
          width: chartEl.clientWidth || 400,
          height: 180,
          cursor: { show: true },
          legend: { show: true },
          scales: {
            x: { time: true },
            rsrp: { auto: true, range: [-140, -44] },
            sinr: { auto: true, range: [-5, 30] }
          },
          axes: [
            {},
            { scale: "rsrp", label: "RSRP (dBm)", stroke: "#0077cc", grid: { show: true } },
            { scale: "sinr", label: "SINR (dB)", stroke: "#2e7d32", side: 1, grid: { show: false } }
          ],
          series: [
            {},
            { label: "RSRP", scale: "rsrp", stroke: "#0077cc", width: 2, fill: "rgba(0,119,204,0.1)" },
            { label: "SINR", scale: "sinr", stroke: "#2e7d32", width: 2, fill: "rgba(46,125,50,0.1)" }
          ]
        }, data, chartEl);
      }
    }
    function _connSignalZoom(level) {
      $$(".zoom-btns .btn-small").forEach(function(b, i) {
        b.classList.toggle("active", i === level);
      });
      API.cgiGet("signal.cgi", { action: "history" }).then(function(hist) {
        if (!Array.isArray(hist) || !hist.length) return;
        _signalHistory = { t: [], rsrp: [], sinr: [] };
        hist.forEach(function(pt) {
          if (pt.t) {
            _signalHistory.t.push(pt.t);
            _signalHistory.rsrp.push(pt.rsrp || 0);
            _signalHistory.sinr.push(pt.sinr || 0);
          }
        });
        if (_signalChart) _signalChart.destroy();
        _signalChart = null;
        _updateSignalChart();
      }).catch(function() {
      });
    }
    var _netSearchTimer = null;
    function _loadNetwork() {
      var tab = $("#conn-tab-network");
      if (!tab) return;
      Promise.all([
        API.webapi("GetConnectionSettings").catch(function() {
          return null;
        }),
        API.webapi("GetNetworkInfo").catch(function() {
          return null;
        }),
        API.webapi("GetConnectionState").catch(function() {
          return null;
        }),
        API.webapi("GetUsageSettings").catch(function() {
          return null;
        })
      ]).then(function(results) {
        var connSettings = results[0], netInfo = results[1], connSt = results[2], usage = results[3];
        var cs = connSettings || {};
        var us = usage || {};
        var currentMode = cs.NetselectionMode || cs.NetworkMode || "auto";
        var netSelMode = cs.NetselectionMode || "0";
        var connMode = cs.ConnectMode || "0";
        var roaming = cs.RoamingConnect || "0";
        var idleTime = cs.IdleTime || "0";
        var connected = connSt && (connSt.ConnectionStatus === 2 || connSt.ConnectionStatus === "2");
        tab.innerHTML = '<div class="card"><h3>Network Mode</h3><div class="form-group"><label>Preferred Mode</label><select id="m-netmode"><option value="auto"' + (currentMode === "auto" || currentMode === "0" ? " selected" : "") + '>Auto (4G/3G/2G)</option><option value="4g3g"' + (currentMode === "4g3g" || currentMode === "0302" ? " selected" : "") + '>4G + 3G</option><option value="4g"' + (currentMode === "4g" || currentMode === "03" ? " selected" : "") + '>4G Only (LTE)</option><option value="3g"' + (currentMode === "3g" || currentMode === "02" ? " selected" : "") + '>3G Only (WCDMA)</option><option value="2g"' + (currentMode === "2g" || currentMode === "01" ? " selected" : "") + '>2G Only (GSM)</option></select></div><div class="form-actions"><button ' + actionAttr("connSetMode") + '>Apply Mode</button></div></div><div class="card mt-2"><h3>Operator Selection</h3><div class="form-group"><label><input type="radio" name="netsel" id="m-netsel-auto" value="0"' + (netSelMode === "0" || netSelMode === 0 ? " checked" : "") + '> Automatic</label><label><input type="radio" name="netsel" id="m-netsel-manual" value="1"' + (netSelMode === "1" || netSelMode === 1 ? " checked" : "") + '> Manual</label></div><div class="form-actions"><button ' + actionAttr("connSearchNet") + '>Search Networks</button></div><div id="m-netsearch"></div></div><div class="card mt-2"><h3>Connection</h3><div class="form-group"><label>Connect Mode</label><select id="m-connmode"><option value="0"' + (connMode === "0" || connMode === 0 ? " selected" : "") + '>Auto</option><option value="1"' + (connMode === "1" || connMode === 1 ? " selected" : "") + '>Manual</option></select></div><div class="form-group"><label>Idle Timeout (min)</label><input type="number" id="m-idle" value="' + (parseInt(idleTime, 10) || 0) + '" min="0" max="120"></div><div class="form-group"><label><input type="checkbox" id="m-roaming"' + (roaming === "1" || roaming === 1 ? " checked" : "") + '> Connect while roaming</label></div><div class="form-actions"><button ' + actionAttr("connSaveConn") + ">Save</button>" + (connected ? '<button class="btn-outline" ' + actionAttr("connDisconnect") + ">Disconnect</button>" : '<button class="btn-outline" ' + actionAttr("connConnect") + ">Connect</button>") + '</div></div><div class="card mt-2"><h3>Data Plan</h3><div class="stat-row"><span class="label">Used</span><span class="value">' + App.formatBytes(us.UsedData || 0) + " / " + App.formatBytes((us.MonthlyPlan || 0) * 1048576) + '</span></div><div class="form-group"><label>Monthly Limit (MB)</label><input type="number" id="m-planlimit" value="' + (parseInt(us.MonthlyPlan, 10) || 0) + '" min="0" max="999999"></div><div class="form-group"><label>Billing Day (1-31)</label><input type="number" id="m-billday" value="' + (parseInt(us.BillingDay, 10) || 1) + '" min="1" max="31"></div><div class="form-group"><label><input type="checkbox" id="m-autodisconn"' + (us.AutoDisconnFlag === "1" || us.AutoDisconnFlag === 1 ? " checked" : "") + '> Auto-disconnect at limit</label></div><div class="form-actions"><button ' + actionAttr("connSavePlan") + '>Save Plan</button><button class="btn-outline" ' + actionAttr("connResetCounters") + '>Reset Counters</button></div></div><div class="card mt-2"><h3>IP Addresses</h3><div class="stat-row"><span class="label">IPv4</span><span class="value" id="m-ipv4">' + escHtml(connSt && (connSt.IPv4Adrress || connSt.IPAddress) || "\u2014") + '</span></div><div class="stat-row"><span class="label">IPv6</span><span class="value text-mono text-small" id="m-ipv6">' + escHtml(connSt && connSt.IPv6Adrress || "\u2014") + '</span></div></div><div class="card mt-2"><h3>Data Counters</h3><div class="stat-row"><span class="label">Session RX</span><span class="value" id="m-rx">' + App.formatBytes(connSt && connSt.DlBytes || 0) + '</span></div><div class="stat-row"><span class="label">Session TX</span><span class="value" id="m-tx">' + App.formatBytes(connSt && connSt.UlBytes || 0) + '</span></div><div class="stat-row"><span class="label">Duration</span><span class="value" id="m-dur">' + App.formatUptime(connSt && connSt.ConnectionTime || 0) + "</span></div></div>";
      }).catch(function() {
        tab.innerHTML = '<div class="card"><p class="text-muted">Failed to load network info</p></div>';
      });
    }
    function _connSearchNet() {
      var el = $("#m-netsearch");
      if (!el) return;
      el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Searching (up to 60s)...</div>';
      API.webapi("SetNetworkSettings", { NetselectionMode: 1 }).then(function() {
        return API.webapi("SearchNetwork", { NetworkID: "" });
      }).then(function() {
        _pollNetSearch(0);
      }).catch(function(e) {
        el.innerHTML = '<p class="text-danger">Search failed: ' + escHtml(e.message) + "</p>";
      });
    }
    function _pollNetSearch(attempt) {
      if (attempt > 30) {
        var el = $("#m-netsearch");
        if (el) el.innerHTML = '<p class="text-muted">Search timeout</p>';
        return;
      }
      _netSearchTimer = setTimeout(function() {
        API.webapi("SearchNetworkResult").then(function(r) {
          if (!r || r.SearchState !== 2 && r.SearchState !== "2") {
            _pollNetSearch(attempt + 1);
            return;
          }
          var list = r.ListNetworkItem || [];
          var el2 = $("#m-netsearch");
          if (!el2) return;
          if (!list.length) {
            el2.innerHTML = '<p class="text-muted">No operators found</p>';
            return;
          }
          var RAT_MAP = { "0": "2G", "2": "3G", "7": "4G" };
          var STATE_MAP = { "0": "Unknown", "1": "Available", "2": "Current", "3": "Forbidden" };
          var html = '<table class="data-table mt-1"><thead><tr><th>Operator</th><th>MCC/MNC</th><th>RAT</th><th>State</th><th></th></tr></thead><tbody>';
          list.forEach(function(op, i) {
            var rat = RAT_MAP[String(op.Rat)] || String(op.Rat || "");
            var state = STATE_MAP[String(op.State)] || String(op.State || "");
            var netId = (op.mcc || "") + (op.mnc || "");
            html += "<tr><td>" + escHtml(op.NetworkName || op.Name || "") + '</td><td class="text-mono">' + escHtml(op.mcc || "") + "/" + escHtml(op.mnc || "") + "</td><td>" + escHtml(rat) + "</td><td>" + escHtml(state) + '</td><td><button class="btn-small" ' + actionAttr("connRegNet", [netId]) + ">Register</button></td></tr>";
          });
          html += '</tbody></table><div class="form-actions mt-1"><button class="btn-outline" ' + actionAttr("connAutoNet") + ">Back to Auto</button></div>";
          el2.innerHTML = html;
        }).catch(function() {
          _pollNetSearch(attempt + 1);
        });
      }, 2e3);
    }
    function _connRegNet(networkId) {
      var el = $("#m-netsearch");
      if (el) el.innerHTML += '<div class="page-loading"><div class="spinner"></div> Registering...</div>';
      API.webapi("RegisterNetwork", { NetworkID: networkId }).then(function() {
        alert("Registered on network. Reconnecting...");
        setTimeout(_loadNetwork, 3e3);
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _connAutoNet() {
      API.webapi("SetNetworkSettings", { NetselectionMode: 0 }).then(function() {
        alert("Switched to automatic network selection.");
        setTimeout(_loadNetwork, 3e3);
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _connSaveConn() {
      var params = {
        ConnectMode: $("#m-connmode").value,
        IdleTime: $("#m-idle").value || "0",
        RoamingConnect: $("#m-roaming").checked ? "1" : "0"
      };
      API.webapi("SetConnectionSettings", params).then(function() {
        alert("Connection settings saved.");
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _connConnect() {
      API.webapi("Connect").then(function() {
        alert("Connecting...");
        setTimeout(_loadNetwork, 3e3);
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _connDisconnect() {
      API.webapi("DisConnect").then(function() {
        alert("Disconnected.");
        setTimeout(_loadNetwork, 2e3);
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _connSavePlan() {
      var params = {
        MonthlyPlan: $("#m-planlimit").value || "0",
        BillingDay: $("#m-billday").value || "1",
        AutoDisconnFlag: $("#m-autodisconn").checked ? "1" : "0"
      };
      API.webapi("SetUsageSettings", params).then(function() {
        alert("Data plan saved.");
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _connResetCounters() {
      if (!confirm("Reset data usage counters?")) return;
      API.webapi("SetUsageRecordClear").then(function() {
        alert("Counters reset.");
        setTimeout(_loadNetwork, 1e3);
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _connSetMode() {
      var sel = $("#m-netmode");
      if (!sel) return;
      var mode = sel.value;
      var modeMap = { "auto": "0", "4g3g": "0302", "4g": "03", "3g": "02", "2g": "01" };
      API.webapi("SetNetworkSettings", { NetworkMode: modeMap[mode] || "0" }).then(function() {
        alert("Network mode changed. Reconnecting may take 10-30s.");
        setTimeout(_loadNetwork, 3e3);
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    App.registerPage("connection", renderConnection);
    App._connSetMode = _connSetMode;
    App._connSignalZoom = _connSignalZoom;
    App._connSearchNet = _connSearchNet;
    App._connRegNet = _connRegNet;
    App._connAutoNet = _connAutoNet;
    App._connSaveConn = _connSaveConn;
    App._connConnect = _connConnect;
    App._connDisconnect = _connDisconnect;
    App._connSavePlan = _connSavePlan;
    App._connResetCounters = _connResetCounters;
  })();

  // js/pages/apn.js
  (function() {
    "use strict";
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;
    var _apnList = [], _editingAPN = null;
    function renderAPN(container) {
      container.innerHTML = '<h2>APN Profiles</h2><div id="apn-content"><div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div></div>';
      _loadAPN();
    }
    function _loadAPN() {
      var el = $("#apn-content");
      if (!el) return;
      el.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';
      _editingAPN = null;
      API.webapi("GetProfileList").then(function(profiles) {
        var list = profiles.ProfileList || profiles || [];
        if (!Array.isArray(list)) list = [];
        _apnList = list;
        var html = '<div class="card"><h3>APN Profiles</h3>';
        if (list.length) {
          html += '<table class="data-table"><thead><tr><th>Name</th><th>APN</th><th>Auth</th><th>Default</th><th></th></tr></thead><tbody>';
          list.forEach(function(p, i) {
            var isDefault = p.IsDefault === 1 || p.IsDefault === "1";
            html += "<tr" + (isDefault ? ' class="text-bold"' : "") + "><td>" + escHtml(p.ProfileName || "") + "</td><td>" + escHtml(p.APN || "") + "</td><td>" + escHtml(p.AuthType == 0 ? "None" : p.AuthType == 1 ? "PAP" : p.AuthType == 2 ? "CHAP" : String(p.AuthType || "")) + "</td><td>" + (isDefault ? "Yes" : "") + '</td><td><button class="btn-small" ' + actionAttr("apnEdit", [i]) + ">Edit</button> " + (!isDefault ? '<button class="btn-small" ' + actionAttr("apnDefault", [i]) + ">Set Default</button> " : "") + '<button class="btn-small btn-danger" ' + actionAttr("apnDelete", [i]) + ">Del</button></td></tr>";
          });
          html += "</tbody></table>";
        } else {
          html += '<p class="text-muted">No profiles found</p>';
        }
        html += '<details class="mt-2" id="apn-form"><summary id="apn-form-title">Add Profile</summary><div class="form-row mt-1"><div class="form-group"><label>Profile Name</label><input type="text" id="apn-name" placeholder="My APN"></div><div class="form-group"><label>APN</label><input type="text" id="apn-apn" placeholder="internet"></div></div><div class="form-row"><div class="form-group"><label>Auth Type</label><select id="apn-auth"><option value="0">None</option><option value="1">PAP</option><option value="2">CHAP</option></select></div><div class="form-group"><label>Username</label><input type="text" id="apn-user" placeholder=""></div><div class="form-group"><label>Password</label><input type="text" id="apn-pass" placeholder=""></div></div><div class="form-row"><div class="form-group"><label>PDP Type</label><select id="apn-pdp"><option value="0">IPv4</option><option value="2">IPv4v6</option><option value="1">IPv6</option></select></div></div><div class="form-actions"><button id="apn-submit" ' + actionAttr("apnSave") + '>Add Profile</button><button class="btn-small" id="apn-cancel" style="display:none" ' + actionAttr("apnCancelEdit") + ">Cancel</button></div></details></div>";
        el.innerHTML = html;
      }).catch(function() {
        el.innerHTML = '<div class="card"><p class="text-muted">Failed to load APN profiles</p></div>';
      });
    }
    function _apnEdit(i) {
      var p = _apnList[i];
      if (!p) return;
      var form = $("#apn-form");
      if (form) form.open = true;
      $("#apn-name").value = p.ProfileName || "";
      $("#apn-apn").value = p.APN || "";
      $("#apn-auth").value = String(p.AuthType || 0);
      $("#apn-user").value = p.Username || "";
      $("#apn-pass").value = p.Password || "";
      $("#apn-pdp").value = String(p.PdpType || 0);
      _editingAPN = i;
      var btn = $("#apn-submit");
      if (btn) btn.textContent = "Update Profile";
      var cancel = $("#apn-cancel");
      if (cancel) cancel.style.display = "";
    }
    function _apnCancelEdit() {
      _editingAPN = null;
      var btn = $("#apn-submit");
      if (btn) btn.textContent = "Add Profile";
      var cancel = $("#apn-cancel");
      if (cancel) cancel.style.display = "none";
    }
    function _apnSave() {
      var params = {
        ProfileName: ($("#apn-name") || {}).value,
        APN: ($("#apn-apn") || {}).value,
        AuthType: ($("#apn-auth") || {}).value || "0",
        Username: ($("#apn-user") || {}).value || "",
        Password: ($("#apn-pass") || {}).value || "",
        PdpType: ($("#apn-pdp") || {}).value || "0"
      };
      if (!params.ProfileName || !params.APN) {
        alert("Name and APN required");
        return;
      }
      var method = _editingAPN !== null ? "EditProfile" : "AddNewProfile";
      if (_editingAPN !== null) params.ProfileIndex = String(_editingAPN);
      API.webapi(method, params).then(function() {
        _loadAPN();
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _apnDelete(i) {
      if (!confirm("Delete APN profile?")) return;
      API.webapi("DeleteProfile", { ProfileIndex: String(i) }).then(function() {
        _loadAPN();
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _apnDefault(i) {
      API.webapi("SetDefaultProfile", { ProfileIndex: String(i) }).then(function() {
        _loadAPN();
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    App.registerPage("apn", renderAPN);
    App._apnEdit = _apnEdit;
    App._apnCancelEdit = _apnCancelEdit;
    App._apnSave = _apnSave;
    App._apnDelete = _apnDelete;
    App._apnDefault = _apnDefault;
  })();

  // js/pages/at-terminal.js
  (function() {
    "use strict";
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;
    var _atTerm = null;
    var _atTemplates = null;
    function renderATTerminal(container) {
      container.innerHTML = '<div class="at-card"><div class="at-toolbar"><span class="at-toolbar-title">' + icon("ic-terminal") + ' AT Terminal</span><button class="btn-icon" ' + actionAttr("atClear") + ' title="Clear output">' + icon("ic-delete") + '</button></div><div id="at-terminal" class="at-terminal"><pre><code class="termino-console"></code></pre><div class="at-input-row"><div class="at-combo"><textarea class="termino-input" rows="1" wrap="hard" placeholder="Type AT command..."></textarea><button class="at-combo-btn" ' + actionAttr("atDropdown") + ' data-stop tabindex="-1">\u25BC</button><div class="at-dropdown" id="at-dropdown"></div></div><button class="at-send-btn" ' + actionAttr("atSend") + '>Send</button></div></div><div class="at-footer-note"><svg class="at-warn-icon" viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg> Direct modem access. Write commands may change device behavior.</div></div>';
      var termEl = document.getElementById("at-terminal");
      if (termEl && typeof Termino === "function") {
        _atTerm = Termino(termEl, null, {
          allow_scroll: true,
          prompt: "AT> ",
          command_key: 13,
          terminal_killed_placeholder: "TERMINAL DISABLED",
          terminal_output: ".termino-console",
          terminal_input: ".termino-input",
          disable_terminal_input: false
        });
        _atLoop();
      }
      _loadATTemplates();
      App.setCleanup(function() {
        if (_atTerm) {
          _atTerm.kill();
          _atTerm = null;
        }
      });
    }
    function _atLoop() {
      if (!_atTerm) return;
      _atTerm.input("").then(function(cmd) {
        if (!cmd || !cmd.trim()) {
          _atLoop();
          return;
        }
        cmd = cmd.trim();
        if (!/^AT/i.test(cmd)) {
          _atTerm.output("Error: command must start with AT");
          _atLoop();
          return;
        }
        _atTerm.disable_input();
        API.cgiPost("at.cgi", { action: "send", cmd }).then(function(r) {
          if (r.error) {
            _atTerm.output("Error: " + r.error);
          } else {
            _atTerm.output(escHtml(r.output || "(no response)"));
          }
        }).catch(function(e) {
          _atTerm.output("Error: " + e.message);
        }).then(function() {
          _atTerm.enable_input();
          _atLoop();
        });
      });
    }
    function _loadATTemplates() {
      API.cgiGet("at.cgi", { action: "templates" }).then(function(data) {
        _atTemplates = data && data.templates || [];
        var dd = $("#at-dropdown");
        if (!dd || !_atTemplates.length) return;
        var cats = {};
        _atTemplates.forEach(function(t) {
          var cat = t.cat || "other";
          if (!cats[cat]) cats[cat] = [];
          cats[cat].push(t);
        });
        var catNames = { info: "Info", signal: "Signal", network: "Network", status: "Status", imei: "IMEI", band: "Band Lock", mode: "Mode", ca: "Carrier Agg", system: "System" };
        var html = "";
        Object.keys(cats).forEach(function(cat) {
          html += '<div class="at-dd-cat">' + escHtml(catNames[cat] || cat) + "</div>";
          cats[cat].forEach(function(t) {
            html += '<div class="at-dd-item" data-cmd="' + escHtml(t.cmd) + '"' + (t.warn ? ' data-warn="' + escHtml(t.warn) + '"' : "") + '><span class="at-dd-cmd">' + escHtml(t.cmd) + '</span><span class="at-dd-desc">' + escHtml(t.desc) + (t.warn ? " \u26A0" : "") + "</span></div>";
          });
        });
        dd.innerHTML = html;
        dd.addEventListener("click", function(e) {
          var item = e.target.closest(".at-dd-item");
          if (!item) return;
          var cmd = item.dataset.cmd;
          if (item.dataset.warn && _atTerm) {
            _atTerm.output("\u26A0 Warning: " + item.dataset.warn);
          }
          var termInput2 = document.querySelector("#at-terminal .termino-input");
          if (termInput2) {
            termInput2.value = cmd;
            termInput2.focus();
          }
          dd.classList.remove("open");
        });
      }).catch(function() {
      });
    }
    function _atDropdown() {
      var dd = $("#at-dropdown");
      if (!dd) return;
      var opening = !dd.classList.contains("open");
      dd.classList.toggle("open");
      if (opening) {
        var _close = function(ev) {
          if (!ev.target.closest(".at-combo")) {
            dd.classList.remove("open");
            document.removeEventListener("click", _close);
          }
        };
        setTimeout(function() {
          document.addEventListener("click", _close);
        }, 0);
      }
    }
    function _atSend() {
      var termInput2 = document.querySelector("#at-terminal .termino-input");
      if (!termInput2 || !termInput2.value.trim()) return;
      var evt = new KeyboardEvent("keypress", { keyCode: 13, which: 13, bubbles: true });
      termInput2.dispatchEvent(evt);
    }
    function _atClear() {
      if (_atTerm) _atTerm.clear();
    }
    App.registerPage("at-terminal", renderATTerminal);
    App._atClear = _atClear;
    App._atSend = _atSend;
    App._atDropdown = _atDropdown;
  })();

  // js/pages/clients.js
  (function() {
    "use strict";
    var $ = App.$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;
    var formatBytes = App.formatBytes, formatSpeed = App.formatSpeed;
    var _clientsTimer = null;
    var _clientsDetail = null;
    var _clientDetailChart = null;
    function renderClients(container) {
      container.innerHTML = '<h2>Clients</h2><div class="card"><h3 class="mb-1">Connected Devices</h3><div id="cl-list"><div class="page-loading"><div class="spinner"></div> Loading...</div></div></div><div class="card mt-2 hidden" id="cl-detail-card"><div class="flex-between mb-1"><h3 id="cl-detail-title">Device Details</h3><button class="toggle-btn" ' + actionAttr("closeClientDetail") + '>Close</button></div><div id="cl-detail"></div><div class="chart-container mt-1" id="cl-detail-chart" style="min-height:180px"></div></div>';
      var hash = window.location.hash || "";
      var ipMatch = hash.match(/[?&]ip=([^&]+)/);
      if (ipMatch) _clientsDetail = decodeURIComponent(ipMatch[1]);
      _refreshClients();
      _clientsTimer = setInterval(_refreshClients, 5e3);
      App.setCleanup(function() {
        if (_clientsTimer) {
          clearInterval(_clientsTimer);
          _clientsTimer = null;
        }
        _clientsDetail = null;
        _clientDetailChart = null;
      });
    }
    var SEC_MAP = { 0: "Open", 1: "WEP", 2: "WPA", 3: "WPA2", 4: "WPA/WPA2" };
    var WMODE_2G = { 0: "11b", 1: "11g", 2: "11b/g", 3: "11b/g/n", 4: "11n" };
    var WMODE_5G = { 5: "11a", 6: "11a/n/ac", 7: "11a/n", 8: "11n/ac", 9: "11ac" };
    var BW_2G = { 0: "20/40 MHz", 1: "20 MHz", 2: "40 MHz" };
    var BW_5G = { 0: "20/40/80 MHz", 1: "20 MHz", 2: "40 MHz", 3: "80 MHz", 4: "20/40/80 MHz" };
    var _wifiInfo = null;
    function _refreshClients() {
      var fetches = [
        API.webapi("GetConnectedDeviceList").catch(function() {
          return null;
        }),
        API.cgiGet("traffic.cgi", { action: "status" }).catch(function() {
          return null;
        })
      ];
      if (!_wifiInfo) fetches.push(API.webapi("GetWlanSettings").catch(function() {
        return null;
      }));
      Promise.all(fetches).then(function(results) {
        var devList = results[0], trafficData = results[1];
        if (results[2]) {
          var s = results[2];
          var ap2g = s.AP2G || {}, ap5g = s.AP5G || {};
          _wifiInfo = {
            sec2g: SEC_MAP[ap2g.SecurityMode] || s.WlanAuthMode || "",
            sec5g: SEC_MAP[ap5g.SecurityMode] || "",
            mode2g: WMODE_2G[ap2g.WMode] || s.WlanMode || "",
            mode5g: WMODE_5G[ap5g.WMode] || s.WlanMode_5G || "",
            bw2g: BW_2G[ap2g.Bandwidth] || s.WlanBandwidth || "",
            bw5g: BW_5G[ap5g.Bandwidth] || s.WlanBandwidth_5G || ""
          };
        }
        var devices = devList && devList.ConnectedList ? devList.ConnectedList : [];
        var trafficHosts = trafficData && trafficData.hosts ? trafficData.hosts : [];
        var trafficMap = {};
        for (var i = 0; i < trafficHosts.length; i++) {
          trafficMap[trafficHosts[i].ip] = trafficHosts[i];
        }
        var el = document.getElementById("cl-list");
        if (!el) return;
        if (devices.length === 0) {
          el.innerHTML = '<p class="text-muted">No devices connected</p>';
          return;
        }
        var html = '<table class="data-table cl-table"><thead><tr><th>Client</th><th>Address</th><th>Interface</th><th>Connection</th><th></th></tr></thead><tbody>';
        for (var j = 0; j < devices.length; j++) {
          var dev = devices[j];
          var ip = dev.IPAddress || dev.IpAddress || "";
          var traffic = trafficMap[ip];
          var name = dev.DeviceName || dev.HostName || "";
          if (!name) name = ip || mac;
          var mac = dev.MacAddress || "\u2014";
          var cm = Number(dev.ConnectMode);
          var ifaceLine1 = "bridge0";
          var ifaceLine2 = cm === 0 ? "USB (ecm0)" : cm === 1 ? "2.4 GHz Wi-Fi" : cm === 2 ? "5 GHz Wi-Fi" : "Unknown";
          var connLine1 = "", connLine2 = "";
          if (cm === 1 && _wifiInfo) {
            connLine1 = _wifiInfo.sec2g;
            connLine2 = _wifiInfo.mode2g + " " + _wifiInfo.bw2g;
          } else if (cm === 2 && _wifiInfo) {
            connLine1 = _wifiInfo.sec5g;
            connLine2 = _wifiInfo.mode5g + " " + _wifiInfo.bw5g;
          } else if (cm === 0) {
            connLine1 = "USB";
            connLine2 = "ecm0";
          }
          if (traffic && (traffic.rx_speed > 0 || traffic.tx_speed > 0)) {
            var maxBps = Math.max(traffic.rx_speed, traffic.tx_speed) * 8;
            var unit, div;
            if (maxBps < 1e3) {
              unit = "bps";
              div = 1;
            } else if (maxBps < 1e6) {
              unit = "Kbps";
              div = 1e3;
            } else if (maxBps < 1e9) {
              unit = "Mbps";
              div = 1e6;
            } else {
              unit = "Gbps";
              div = 1e9;
            }
            var dlV = (traffic.rx_speed * 8 / div).toFixed(1);
            var ulV = (traffic.tx_speed * 8 / div).toFixed(1);
            connLine1 = "\u2193" + dlV + "\u2003\u2191" + ulV + " " + unit;
            if (cm === 1 && _wifiInfo) connLine2 = _wifiInfo.sec2g + " " + _wifiInfo.mode2g;
            else if (cm === 2 && _wifiInfo) connLine2 = _wifiInfo.sec5g + " " + _wifiInfo.mode5g;
          }
          var isExpanded = _clientsDetail === ip;
          html += "<tr" + (isExpanded ? ' class="cl-row-active"' : "") + '><td><span class="status-dot green"></span><strong>' + escHtml(name) + '</strong></td><td><a href="#" ' + actionAttr("showClientDetail", [ip]) + ">" + escHtml(ip) + '</a><span class="cl-sub text-mono">' + escHtml(mac) + "</span></td><td>" + escHtml(ifaceLine1) + '<span class="cl-sub">' + escHtml(ifaceLine2) + "</span></td><td>" + escHtml(connLine1) + '<span class="cl-sub">' + escHtml(connLine2) + '</span></td><td class="cl-cell-actions"><button class="toggle-btn" ' + actionAttr("blockClient", [mac, name]) + ' title="Block device">' + icon("ic-firewall") + "</button></td></tr>";
        }
        html += "</tbody></table>";
        el.innerHTML = html;
        if (_clientsDetail) {
          _updateClientDetail(_clientsDetail, devices, trafficData);
        }
      }).catch(function() {
      });
    }
    function _showClientDetail(ip) {
      _clientsDetail = ip;
      var card = document.getElementById("cl-detail-card");
      if (card) card.classList.remove("hidden");
      _refreshClients();
      _loadClientChart(ip);
    }
    function _closeClientDetail() {
      _clientsDetail = null;
      var card = document.getElementById("cl-detail-card");
      if (card) card.classList.add("hidden");
      if (_clientDetailChart) {
        _clientDetailChart.destroy();
        _clientDetailChart = null;
      }
    }
    function _updateClientDetail(ip, devices, trafficData) {
      var card = document.getElementById("cl-detail-card");
      var title = document.getElementById("cl-detail-title");
      var detail = document.getElementById("cl-detail");
      if (!card || !detail) return;
      card.classList.remove("hidden");
      var dev = devices.find(function(d) {
        return (d.IPAddress || d.IpAddress) === ip;
      });
      var traffic = trafficData && trafficData.hosts ? trafficData.hosts.find(function(h) {
        return h.ip === ip;
      }) : null;
      var name = dev ? dev.DeviceName || dev.HostName || ip : ip;
      if (title) title.textContent = name;
      var html = '<div class="cards-grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">';
      if (dev) {
        html += '<div><div class="stat-row"><span class="label">IP</span><span class="value">' + escHtml(dev.IPAddress || dev.IpAddress || "") + '</span></div><div class="stat-row"><span class="label">MAC</span><span class="value text-mono">' + escHtml(dev.MacAddress || "") + '</span></div><div style="display:flex;gap:8px;margin-top:0.5rem"><button class="toggle-btn" ' + actionAttr("renameClient", [dev.MacAddress || "", name]) + ">" + icon("ic-settings") + ' Rename</button><button class="toggle-btn" ' + actionAttr("blockClient", [dev.MacAddress || "", name]) + ">" + icon("ic-firewall") + " Block</button></div></div>";
      }
      if (traffic) {
        var dl = formatSpeed(traffic.rx_speed);
        var ul = formatSpeed(traffic.tx_speed);
        html += '<div><div class="stat-row"><span class="label">Download</span><span class="value">' + dl.value + " " + dl.unit + '</span></div><div class="stat-row"><span class="label">Upload</span><span class="value">' + ul.value + " " + ul.unit + '</span></div><div class="stat-row"><span class="label">Total RX</span><span class="value">' + formatBytes(traffic.rx_total) + '</span></div><div class="stat-row"><span class="label">Total TX</span><span class="value">' + formatBytes(traffic.tx_total) + '</span></div><div class="stat-row"><span class="label">Connections</span><span class="value">' + (traffic.connections || 0) + "</span></div></div>";
      }
      html += "</div>";
      detail.innerHTML = html;
    }
    function _loadClientChart(ip) {
      API.cgiGet("traffic.cgi", { action: "status" }).then(function(data) {
        if (!data || !data.host_chart || !data.host_chart[ip]) return;
        var points = data.host_chart[ip]["0"];
        if (!points || points.length === 0) return;
        var times = points.map(function(p) {
          return p.t;
        });
        var rx = points.map(function(p) {
          return p.rx * 8 / 1e6;
        });
        var tx = points.map(function(p) {
          return p.tx * 8 / 1e6;
        });
        var chartEl = document.getElementById("cl-detail-chart");
        if (!chartEl) return;
        var opts = {
          width: chartEl.clientWidth || 500,
          height: 180,
          cursor: { show: true },
          scales: { x: { time: false }, y: { auto: true, range: [0, null] } },
          axes: [
            { stroke: "rgba(128,128,128,0.5)", grid: { stroke: "rgba(128,128,128,0.1)" } },
            {
              stroke: "rgba(128,128,128,0.5)",
              grid: { stroke: "rgba(128,128,128,0.1)" },
              values: function(u, vals) {
                return vals.map(function(v) {
                  return v.toFixed(1);
                });
              },
              size: 50
            }
          ],
          series: [
            {},
            { label: "DL (Mbps)", stroke: "#0077cc", fill: "rgba(0,119,204,0.1)", width: 2 },
            { label: "UL (Mbps)", stroke: "#2e7d32", fill: "rgba(46,125,50,0.1)", width: 2 }
          ]
        };
        if (_clientDetailChart) {
          _clientDetailChart.setData([times, rx, tx]);
        } else {
          _clientDetailChart = new uPlot(opts, [times, rx, tx], chartEl);
        }
      }).catch(function() {
      });
    }
    function _blockClient(mac, name) {
      if (!confirm('Block device "' + name + '" (' + mac + ")?")) return;
      API.webapi("SetConnectedDeviceBlock", { DeviceName: name, MacAddress: mac }).then(function() {
        _refreshClients();
      }).catch(function(e) {
        alert("Failed to block: " + (e.message || e));
      });
    }
    function _renameClient(mac, currentName) {
      var newName = prompt("Enter new name for device:", currentName);
      if (!newName || newName === currentName) return;
      API.webapi("SetDeviceName", { MacAddress: mac, DeviceName: newName }).then(function() {
        _refreshClients();
      }).catch(function(e) {
        alert("Failed to rename: " + (e.message || e));
      });
    }
    function _unblockClient(mac, name) {
      if (!confirm('Unblock device "' + name + '" (' + mac + ")?")) return;
      API.webapi("SetDeviceUnblock", { DeviceName: name, MacAddress: mac }).then(function() {
        _refreshClients();
      }).catch(function(e) {
        alert("Failed to unblock: " + (e.message || e));
      });
    }
    App.registerPage("clients", renderClients);
    App._refreshClients = _refreshClients;
    App._showClientDetail = _showClientDetail;
    App._closeClientDetail = _closeClientDetail;
    App._blockClient = _blockClient;
    App._unblockClient = _unblockClient;
    App._renameClient = _renameClient;
  })();

  // js/pages/wifi.js
  (function() {
    "use strict";
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;
    function renderWifi(container) {
      container.innerHTML = '<h2>WiFi</h2><div class="wifi-grid"><div id="wifi-tab-2g"><div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div></div><div id="wifi-tab-5g"><div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div></div></div><div class="wifi-save-row"><button ' + actionAttr("saveWifiAll") + ">Save</button></div>";
      _loadWifiSettings();
    }
    var SEC_MAP = { 0: "OPEN", 1: "WEP", 2: "WPA-PSK", 3: "WPA2-PSK", 4: "WPA/WPA2-PSK" };
    var SEC_REV = { "OPEN": 0, "WEP": 1, "WPA-PSK": 2, "WPA2-PSK": 3, "WPA/WPA2-PSK": 4 };
    var WMODE_2G = { 0: "b", 1: "g", 2: "b/g", 3: "b/g/n", 4: "n only" };
    var WMODE_5G = { 5: "a", 6: "a/n/ac", 7: "a/n", 8: "n/ac", 9: "ac only" };
    var WMODE_2G_REV = { "b": 0, "g": 1, "b/g": 2, "b/g/n": 3, "g/n": 3, "n only": 4 };
    var WMODE_5G_REV = { "a": 5, "a/n/ac": 6, "a/n": 7, "n/ac": 8, "ac only": 9 };
    var BW_2G = { 0: "20/40", 1: "20", 2: "40" };
    var BW_5G = { 0: "20/40/80", 1: "20", 2: "40", 3: "80", 4: "20/40/80" };
    var BW_2G_REV = { "20/40": 0, "20": 1, "40": 2 };
    var BW_5G_REV = { "20/40/80": 0, "20": 1, "40": 2, "80": 3 };
    var _wifiSettings = null;
    function _safeSecMode(mode) {
      return mode === 0 ? 0 : 3;
    }
    function _applyWifi(params) {
      var data = { action: "apply" };
      if (params.AP2G) data.AP2G = params.AP2G;
      if (params.AP5G) data.AP5G = params.AP5G;
      if (params.AP2G_guest) data.AP2G_guest = params.AP2G_guest;
      if (params.AP5G_guest) data.AP5G_guest = params.AP5G_guest;
      return API.cgiPost("wifi.cgi", data);
    }
    function _fullParams(overrides2g, overrides5g) {
      var s = _wifiSettings || {};
      var st2g = s.Wlan2gState === 1 || s.Wlan2gState === "1" ? 1 : 0;
      var st5g = s.Wlan5gState === 1 || s.Wlan5gState === "1" ? 1 : 0;
      var sec2g = _safeSecMode(SEC_REV[s.WlanAuthMode] != null ? SEC_REV[s.WlanAuthMode] : 3);
      var sec5g = _safeSecMode(SEC_REV[s.WlanAuthMode_5G] != null ? SEC_REV[s.WlanAuthMode_5G] : 3);
      var ap2g = { ApStatus: st2g, Ssid: s.WlanSSID || "", WpaKey: s.WlanAPPwd || "", SecurityMode: sec2g, WpaType: 1 };
      var ap5g = { ApStatus: st5g, Ssid: s.WlanSSID_5G || "", WpaKey: s.WlanAPPwd_5G || "", SecurityMode: sec5g, WpaType: 1 };
      if (overrides2g) Object.keys(overrides2g).forEach(function(k) {
        ap2g[k] = overrides2g[k];
      });
      if (overrides5g) Object.keys(overrides5g).forEach(function(k) {
        ap5g[k] = overrides5g[k];
      });
      var guestSsid = ap5g.Ssid || (ap2g.Ssid ? ap2g.Ssid + "_5G" : "EE71_5G");
      var guestKey = ap5g.WpaKey || ap2g.WpaKey || "12345678";
      var guest = {
        ApStatus: ap5g.ApStatus,
        Ssid: guestSsid,
        WpaKey: guestKey,
        SecurityMode: ap5g.SecurityMode,
        WpaType: ap5g.WpaType
      };
      return { AP2G: ap2g, AP5G: ap5g, AP2G_guest: guest, AP5G_guest: guest };
    }
    function _toast(msg, isErr) {
      var el = document.getElementById("wifi-toast");
      if (!el) {
        el = document.createElement("div");
        el.id = "wifi-toast";
        el.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:8px 20px;border-radius:8px;font-size:0.85rem;z-index:9999;transition:opacity 0.3s;pointer-events:none;";
        document.body.appendChild(el);
      }
      el.style.background = isErr ? "var(--color-danger,#c62828)" : "var(--color-success,#2e7d32)";
      el.style.color = "#fff";
      el.textContent = msg;
      el.style.opacity = "1";
      clearTimeout(el._t);
      el._t = setTimeout(function() {
        el.style.opacity = "0";
      }, 3e3);
    }
    function _loadWifiSettings() {
      Promise.all([
        API.webapi("GetWlanSettings").catch(function() {
          return null;
        }),
        API.webapi("GetWlanState").catch(function() {
          return null;
        }),
        API.webapi("GetWlanSupportMode").catch(function() {
          return null;
        })
      ]).then(function(results) {
        var settings2 = results[0], state = results[1];
        if (settings2) {
          var ap2g = settings2.AP2G || {};
          var ap5g = settings2.AP5G || {};
          var guest = settings2.AP2G_guest || {};
          var src5g = guest.Ssid && guest.ApStatus != null ? guest : ap5g;
          if (!settings2.WlanSSID && ap2g.Ssid) settings2.WlanSSID = ap2g.Ssid;
          if (!settings2.WlanAPPwd && ap2g.WpaKey) settings2.WlanAPPwd = ap2g.WpaKey;
          if (settings2.WlanChannel == null && ap2g.Channel != null) settings2.WlanChannel = String(ap2g.Channel);
          if (settings2.WlanAuthMode == null && ap2g.SecurityMode != null) settings2.WlanAuthMode = SEC_MAP[ap2g.SecurityMode] || "";
          if (!settings2.WlanMode && ap2g.WMode != null) settings2.WlanMode = WMODE_2G[ap2g.WMode] || "";
          if (!settings2.WlanBandwidth && ap2g.Bandwidth != null) settings2.WlanBandwidth = BW_2G[ap2g.Bandwidth] || "";
          if (!settings2.WlanSSID_5G && src5g.Ssid) settings2.WlanSSID_5G = src5g.Ssid;
          if (!settings2.WlanAPPwd_5G && src5g.WpaKey) settings2.WlanAPPwd_5G = src5g.WpaKey;
          if (settings2.WlanChannel_5G == null && src5g.Channel != null) settings2.WlanChannel_5G = String(src5g.Channel);
          if (settings2.WlanAuthMode_5G == null && src5g.SecurityMode != null) settings2.WlanAuthMode_5G = SEC_MAP[src5g.SecurityMode] || "";
          if (!settings2.WlanMode_5G && src5g.WMode != null) settings2.WlanMode_5G = WMODE_5G[src5g.WMode] || "";
          if (!settings2.WlanBandwidth_5G && src5g.Bandwidth != null) settings2.WlanBandwidth_5G = BW_5G[src5g.Bandwidth] || "";
          if (settings2.Wlan2gState == null && ap2g.ApStatus != null) settings2.Wlan2gState = String(ap2g.ApStatus);
          if (settings2.Wlan5gState == null && src5g.ApStatus != null) settings2.Wlan5gState = String(src5g.ApStatus);
          if (settings2["2GHiddenSSID"] == null && ap2g.SsidHidden != null) settings2["2GHiddenSSID"] = String(ap2g.SsidHidden);
          if (settings2["5GHiddenSSID"] == null && src5g.SsidHidden != null) settings2["5GHiddenSSID"] = String(src5g.SsidHidden);
        }
        _wifiSettings = settings2;
        _render2g(settings2, state);
        _render5g(settings2);
      }).catch(function() {
      });
    }
    function _render2g(settings2, state) {
      var tab2g = $("#wifi-tab-2g");
      if (!tab2g || !settings2) return;
      var wifiOn = settings2.Wlan2gState === 1 || settings2.Wlan2gState === "1" || !settings2.Wlan2gState && state && (state.WlanState === 1 || state.WlanState === "1");
      tab2g.innerHTML = '<div class="card"><h3>2.4 GHz <span class="status-dot ' + (wifiOn ? "green" : "red") + '"></span><span class="flex-spacer"></span><label class="switch"><input type="checkbox" id="wifi-2g-sw"' + (wifiOn ? " checked" : "") + '><span class="slider"></span></label></h3><div class="float-field"><label>Network name (SSID)</label><input type="text" id="w-ssid" value="' + escHtml(settings2.WlanSSID || "") + '" maxlength="32"></div><div class="float-field"><label>Security</label><select id="w-security">' + _securityOptions(settings2.WlanAuthMode || "") + '</select></div><div class="float-field pass-field"><label>Password</label><input type="password" id="w-pass" value="' + escHtml(settings2.WlanAPPwd || "") + '"><button class="pass-eye" ' + actionAttr("togglePassVis", ["w-pass"]) + ' title="Show password">' + icon("ic-eye-off") + '</button></div><div class="wifi-adv-link"><a ' + actionAttr("showWifiAdv", ["2g"]) + ">Advanced settings \u203A</a></div></div>";
      $("#wifi-2g-sw").addEventListener("change", function() {
        var params = _fullParams({ ApStatus: wifiOn ? 0 : 1 }, null);
        _applyWifi(params).then(function() {
          _toast(wifiOn ? "2.4 GHz off" : "2.4 GHz on");
          setTimeout(_loadWifiSettings, 3e3);
        }).catch(function(e) {
          _toast("Error: " + e.message, true);
        });
      });
    }
    function _render5g(settings2) {
      var tab5g = $("#wifi-tab-5g");
      if (!tab5g || !settings2) return;
      var ap5on = settings2.Wlan5gState === 1 || settings2.Wlan5gState === "1" || settings2.WlanAPEnable_5G === "1";
      tab5g.innerHTML = '<div class="card"><h3>5 GHz <span class="status-dot ' + (ap5on ? "green" : "red") + '"></span><span class="flex-spacer"></span><label class="switch"><input type="checkbox" id="wifi-5g-sw"' + (ap5on ? " checked" : "") + '><span class="slider"></span></label></h3><div class="float-field"><label>Network name (SSID)</label><input type="text" id="w5-ssid" value="' + escHtml(settings2.WlanSSID_5G || settings2.WlanSSID || "") + '" maxlength="32"></div><div class="float-field"><label>Security</label><select id="w5-security">' + _securityOptions(settings2.WlanAuthMode_5G || settings2.WlanAuthMode || "") + '</select></div><div class="float-field pass-field"><label>Password</label><input type="password" id="w5-pass" value="' + escHtml(settings2.WlanAPPwd_5G || settings2.WlanAPPwd || "") + '"><button class="pass-eye" ' + actionAttr("togglePassVis", ["w5-pass"]) + ' title="Show password">' + icon("ic-eye-off") + '</button></div><div class="wifi-adv-link"><a ' + actionAttr("showWifiAdv", ["5g"]) + ">Advanced settings \u203A</a></div></div>";
      $("#wifi-5g-sw").addEventListener("change", function() {
        var params = _fullParams(null, { ApStatus: ap5on ? 0 : 1 });
        _applyWifi(params).then(function() {
          _toast(ap5on ? "5 GHz off" : "5 GHz on");
          setTimeout(_loadWifiSettings, 3e3);
        }).catch(function(e) {
          _toast("Error: " + e.message, true);
        });
      });
    }
    function _securityOptions(current) {
      return ["WPA2-PSK", "OPEN"].map(function(s) {
        return '<option value="' + s + '"' + (current === s ? " selected" : "") + ">" + s + "</option>";
      }).join("");
    }
    function _showWifiAdv(band) {
      var s = _wifiSettings;
      if (!s) return;
      var is5g = band === "5g";
      var title = is5g ? "Advanced 5 GHz Settings" : "Advanced 2.4 GHz Settings";
      var prefix = is5g ? "wa5" : "wa2";
      var hideSsid = is5g ? s["5GHiddenSSID"] || s.WlanHideSSID_5G || "0" : s["2GHiddenSSID"] || s.WlanHideSSID || "0";
      var hidden = hideSsid === "1" || hideSsid === 1;
      var mode, modeOpts, channel, channelOpts, bw, bwOpts;
      if (is5g) {
        mode = s.WlanMode_5G || "";
        modeOpts = ["a/n/ac", "a/n", "n/ac", "ac only"];
        channel = s.WlanChannel_5G || "0";
        channelOpts = [0, 36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 149, 153, 157, 161, 165];
        bw = s.WlanBandwidth_5G || "";
        bwOpts = ["20", "40", "80", "20/40/80"];
      } else {
        mode = s.WlanMode || "";
        modeOpts = ["b/g/n", "b/g", "g/n", "n only"];
        channel = s.WlanChannel || "0";
        channelOpts = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
        bw = s.WlanBandwidth || "";
        bwOpts = ["20", "40", "20/40"];
      }
      var fieldsHTML = '<label class="check-field"><input type="checkbox" id="' + prefix + '-hide"' + (hidden ? " checked" : "") + '> Hide SSID</label><div class="float-field"><label>Standard</label><select id="' + prefix + '-mode">' + modeOpts.map(function(m) {
        return '<option value="' + m + '"' + (mode === m ? " selected" : "") + ">" + m + "</option>";
      }).join("") + '</select></div><div class="float-field"><label>Channel</label><select id="' + prefix + '-channel">' + channelOpts.map(function(ch) {
        return '<option value="' + ch + '"' + (String(channel) === String(ch) ? " selected" : "") + ">" + (ch === 0 ? "Auto" : ch) + "</option>";
      }).join("") + '</select></div><div class="float-field"><label>Channel width</label><select id="' + prefix + '-bw">' + bwOpts.map(function(b) {
        return '<option value="' + b + '"' + (bw === b ? " selected" : "") + ">" + b + " MHz</option>";
      }).join("") + "</select></div>";
      _showPanel(title, fieldsHTML, function() {
        var modeRev = is5g ? WMODE_5G_REV : WMODE_2G_REV;
        var bwRev = is5g ? BW_5G_REV : BW_2G_REV;
        var advFields = {
          Channel: parseInt($("#" + prefix + "-channel").value, 10) || 0,
          WMode: modeRev[$("#" + prefix + "-mode").value] || 3,
          Bandwidth: bwRev[$("#" + prefix + "-bw").value] || 0,
          SsidHidden: $("#" + prefix + "-hide").checked ? 1 : 0
        };
        var params = is5g ? _fullParams(null, advFields) : _fullParams(advFields, null);
        _applyWifi(params).then(function() {
          _hidePanel();
          _toast("Saved");
          setTimeout(_loadWifiSettings, 3e3);
        }).catch(function(e) {
          _toast("Error: " + e.message, true);
        });
      });
    }
    function _showPanel(title, fieldsHTML, onSave) {
      _hidePanel();
      var overlay = document.createElement("div");
      overlay.id = "rule-panel-overlay";
      overlay.className = "rule-panel-overlay";
      overlay.innerHTML = '<div class="rule-panel"><h3>' + escHtml(title) + '<button class="close-btn" id="wifi-panel-close">\xD7</button></h3><div>' + fieldsHTML + '</div><div class="form-actions"><button id="wifi-panel-save">Save</button><button class="btn-outline" id="wifi-panel-cancel">Cancel</button></div></div>';
      document.body.appendChild(overlay);
      overlay.addEventListener("click", function(e) {
        if (e.target === overlay) _hidePanel();
      });
      document.getElementById("wifi-panel-close").addEventListener("click", _hidePanel);
      document.getElementById("wifi-panel-cancel").addEventListener("click", _hidePanel);
      document.getElementById("wifi-panel-save").addEventListener("click", onSave);
    }
    function _hidePanel() {
      var overlay = document.getElementById("rule-panel-overlay");
      if (overlay) overlay.remove();
    }
    function _saveWifi24() {
      var pw = ($("#w-pass") || {}).value || "";
      var security = ($("#w-security") || {}).value || "WPA2-PSK";
      if (security !== "OPEN" && pw.length < 8) {
        _toast("Password must be at least 8 characters", true);
        return;
      }
      var params = _fullParams({ Ssid: $("#w-ssid").value, WpaKey: pw, SecurityMode: SEC_REV[security] != null ? SEC_REV[security] : 3 }, null);
      _applyWifi(params).then(function() {
        _toast("Saved");
        setTimeout(_loadWifiSettings, 3e3);
      }).catch(function(e) {
        _toast("Error: " + e.message, true);
      });
    }
    function _saveWifi5g() {
      var pw = ($("#w5-pass") || {}).value || "";
      var security = ($("#w5-security") || {}).value || "WPA2-PSK";
      if (security !== "OPEN" && pw.length < 8) {
        _toast("Password must be at least 8 characters", true);
        return;
      }
      var params = _fullParams(null, { Ssid: $("#w5-ssid").value, WpaKey: pw, SecurityMode: SEC_REV[security] != null ? SEC_REV[security] : 3 });
      _applyWifi(params).then(function() {
        _toast("Saved");
        setTimeout(_loadWifiSettings, 3e3);
      }).catch(function(e) {
        _toast("Error: " + e.message, true);
      });
    }
    function _saveWifiAll() {
      var pw2g = ($("#w-pass") || {}).value || "";
      var sec2g = ($("#w-security") || {}).value || "WPA2-PSK";
      var pw5g = ($("#w5-pass") || {}).value || "";
      var sec5g = ($("#w5-security") || {}).value || "WPA2-PSK";
      if (sec2g !== "OPEN" && pw2g.length < 8) {
        _toast("2.4 GHz password must be at least 8 characters", true);
        return;
      }
      if (sec5g !== "OPEN" && pw5g.length < 8) {
        _toast("5 GHz password must be at least 8 characters", true);
        return;
      }
      var params = _fullParams(
        { Ssid: ($("#w-ssid") || {}).value || "", WpaKey: pw2g, SecurityMode: SEC_REV[sec2g] != null ? SEC_REV[sec2g] : 3 },
        { Ssid: ($("#w5-ssid") || {}).value || "", WpaKey: pw5g, SecurityMode: SEC_REV[sec5g] != null ? SEC_REV[sec5g] : 3 }
      );
      _applyWifi(params).then(function() {
        _toast("Saved");
        setTimeout(_loadWifiSettings, 3e3);
      }).catch(function(e) {
        _toast("Error: " + e.message, true);
      });
    }
    function _togglePassVis(inputId) {
      var inp = document.getElementById(inputId);
      if (!inp) return;
      var show = inp.type === "password";
      inp.type = show ? "text" : "password";
      var btn = inp.parentNode && inp.parentNode.querySelector(".pass-eye");
      if (btn) btn.innerHTML = icon(show ? "ic-eye" : "ic-eye-off");
    }
    App.registerPage("wifi", renderWifi);
    App._saveWifi24 = _saveWifi24;
    App._saveWifi5g = _saveWifi5g;
    App._saveWifiAll = _saveWifiAll;
    App._showWifiAdv = _showWifiAdv;
    App._togglePassVis = _togglePassVis;
  })();

  // js/pages/lan.js
  (function() {
    "use strict";
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;
    var _lanData = null;
    var _dnsData = null;
    var _dhcpExpanded = false;
    var MASKS = [
      ["255.255.255.0", "/24"],
      ["255.255.255.128", "/25"],
      ["255.255.254.0", "/23"],
      ["255.255.252.0", "/22"],
      ["255.255.248.0", "/21"],
      ["255.255.240.0", "/20"],
      ["255.255.0.0", "/16"]
    ];
    function renderLan(container) {
      container.innerHTML = '<h2>LAN</h2><div id="lan-content"><div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div></div>';
      _loadLan();
    }
    function _loadLan() {
      Promise.all([
        API.webapi("GetLanSettings").catch(function() {
          return null;
        }),
        API.webapi("getDNSInfo").catch(function() {
          return null;
        }),
        API.cgiGet("system.cgi", { action: "interfaces" }).catch(function() {
          return null;
        })
      ]).then(function(results) {
        _lanData = results[0];
        _dnsData = results[1];
        var sysIfaces = results[2];
        var el = $("#lan-content");
        if (!el) return;
        var lan = _lanData || {};
        var dns = _dnsData || {};
        var dhcpOn = lan.DHCPServerStatus === 1 || lan.DHCPServerStatus === "1";
        var startIP = lan.StartIPAddress || "";
        var endIP = lan.EndIPAddress || "";
        var poolSize = _poolSize(startIP, endIP);
        var leaseHours = parseInt(lan.DHCPLeaseTime || 24, 10);
        var leaseSec = leaseHours * 3600;
        var html = '<div class="card"><h3>IP Settings</h3><div class="float-field"><label>Hostname</label><input type="text" id="lan-hostname" value="' + escHtml(lan.host_name || "") + '" placeholder="4gee.wifi" maxlength="63"></div><div class="float-field"><label>IP address</label><input type="text" id="lan-ip" value="' + escHtml(lan.IPv4IPAddress || "192.168.1.1") + '"></div><div class="float-field"><label>Subnet mask</label><select id="lan-mask">' + MASKS.map(function(m) {
          return '<option value="' + m[0] + '"' + ((lan.SubnetMask || "255.255.255.0") === m[0] ? " selected" : "") + ">" + m[0] + " (" + m[1] + ")</option>";
        }).join("") + '</select></div><div class="radio-row"><span class="radio-label">DHCP server</span><label class="radio-opt"><input type="radio" name="dhcp-mode" value="1"' + (dhcpOn ? " checked" : "") + '> Enabled</label><label class="radio-opt"><input type="radio" name="dhcp-mode" value="0"' + (!dhcpOn ? " checked" : "") + '> Disabled</label></div><div class="expand-toggle" id="dhcp-toggle" ' + actionAttr("toggleDhcp") + '><span id="dhcp-toggle-text">' + (_dhcpExpanded ? "Hide" : "Show") + ' DHCP settings</span><span class="expand-arrow' + (_dhcpExpanded ? " open" : "") + '" id="dhcp-arrow">\u25BE</span></div><div class="expand-section' + (_dhcpExpanded ? " open" : "") + '" id="dhcp-section"><div class="float-field"><label>Starting IP of the pool</label><input type="text" id="lan-dhcp-start" value="' + escHtml(startIP) + '" placeholder="192.168.1.100"></div><div class="float-field"><label>Address pool size</label><input type="number" id="lan-pool-size" value="' + poolSize + '" min="1" max="254"></div><div class="float-field"><label>Lease time, sec</label><input type="number" id="lan-lease" value="' + leaseSec + '" min="60" max="2592000"></div><div class="float-field"><label>DNS server 1</label><input type="text" id="lan-dns1" value="' + escHtml(dns.DNSAddress1 || lan.DNSAddress1 || "") + '" placeholder="Auto"></div><div class="float-field"><label>DNS server 2</label><input type="text" id="lan-dns2" value="' + escHtml(dns.DNSAddress2 || lan.DNSAddress2 || "") + '" placeholder="Auto"></div></div><div class="form-actions"><button ' + actionAttr("saveLan") + ">Save</button></div></div>";
        var ifaceList = Array.isArray(sysIfaces) ? sysIfaces : [];
        var v6rows = "";
        for (var i = 0; i < ifaceList.length; i++) {
          var iface = ifaceList[i];
          var allAddrs = iface.addrs || [];
          var addrs6 = [];
          for (var j = 0; j < allAddrs.length; j++) {
            var a = typeof allAddrs[j] === "string" ? allAddrs[j] : "";
            if (a.indexOf(":") !== -1) addrs6.push(a);
          }
          if (addrs6.length > 0) {
            v6rows += '<div class="stat-row"><span class="label">' + escHtml(iface.name || "") + '</span><span class="value text-mono text-small">' + addrs6.map(escHtml).join("<br>") + "</span></div>";
          }
        }
        html += '<div class="card mt-2"><h3>IPv6</h3>' + (v6rows || '<p class="text-muted">No IPv6 addresses</p>') + '<p class="text-muted text-small" style="margin-top:0.5rem">IPv6 is managed by the modem firmware and cannot be configured via this interface.</p></div>';
        el.innerHTML = html;
      }).catch(function() {
      });
    }
    function _poolSize(startIP, endIP) {
      if (!startIP || !endIP) return 101;
      var s = startIP.split(".").map(Number);
      var e = endIP.split(".").map(Number);
      if (s.length !== 4 || e.length !== 4) return 101;
      return Math.max(1, e[3] - s[3] + 1);
    }
    function _endIPFromPool(startIP, size) {
      var parts = startIP.split(".").map(Number);
      if (parts.length !== 4) return startIP;
      parts[3] = Math.min(254, parts[3] + size - 1);
      return parts.join(".");
    }
    function _toggleDhcp() {
      _dhcpExpanded = !_dhcpExpanded;
      var section = $("#dhcp-section");
      var text = $("#dhcp-toggle-text");
      var arrow = $("#dhcp-arrow");
      if (section) section.classList.toggle("open", _dhcpExpanded);
      if (text) text.textContent = _dhcpExpanded ? "Hide DHCP settings" : "Show DHCP settings";
      if (arrow) arrow.classList.toggle("open", _dhcpExpanded);
    }
    function _saveLan() {
      var hostname = ($("#lan-hostname") || {}).value || "";
      if (hostname && !/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(hostname)) {
        alert("Invalid hostname");
        return;
      }
      var startIP = $("#lan-dhcp-start").value;
      var poolSize = parseInt($("#lan-pool-size").value, 10) || 101;
      var endIP = _endIPFromPool(startIP, poolSize);
      var leaseSec = parseInt($("#lan-lease").value, 10) || 86400;
      var leaseHours = Math.max(1, Math.round(leaseSec / 3600));
      var dhcpMode = "1";
      var radios = document.querySelectorAll('input[name="dhcp-mode"]');
      for (var i = 0; i < radios.length; i++) {
        if (radios[i].checked) {
          dhcpMode = radios[i].value;
          break;
        }
      }
      var params = {
        host_name: hostname,
        IPv4IPAddress: $("#lan-ip").value,
        SubnetMask: $("#lan-mask").value,
        DHCPServerStatus: dhcpMode,
        StartIPAddress: startIP,
        EndIPAddress: endIP,
        DHCPLeaseTime: String(leaseHours)
      };
      var dns1 = ($("#lan-dns1") || {}).value || "";
      var dns2 = ($("#lan-dns2") || {}).value || "";
      API.webapi("SetLanSettings", params).then(function() {
        if (dns1 || dns2) {
          return API.webapi("setDNSInfo", {
            DNSMode: dns1 || dns2 ? "1" : "0",
            PrimaryDNS: dns1,
            SecondaryDNS: dns2
          }).catch(function() {
          });
        }
      }).then(function() {
        alert("Settings saved. Device may restart networking.");
        setTimeout(_loadLan, 2e3);
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    App.registerPage("lan", renderLan);
    App._toggleDhcp = _toggleDhcp;
    App._saveLan = _saveLan;
  })();

  // js/pages/firewall.js
  (function() {
    "use strict";
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml;
    var formatBytes = App.formatBytes, actionAttr = App.actionAttr;
    var _fwTab = "portfwd";
    var _pfRules = [];
    var _ipfRules = [];
    function renderFirewall(container) {
      container.innerHTML = '<h2>Firewall</h2><div class="card" id="fw-switches"><div class="page-loading"><div class="spinner"></div> Loading...</div></div><div class="tabs" id="fw-tabs"><button class="active" data-tab="portfwd">Port Forward</button><button data-tab="ipfilter">IP Filter</button><button data-tab="urlfilter">URL Filter</button><button data-tab="macfilter">MAC Filter</button><button data-tab="rules">iptables</button></div><div class="tab-content active" id="fw-tab-portfwd"><div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div></div><div class="tab-content" id="fw-tab-ipfilter"><div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div></div><div class="tab-content" id="fw-tab-urlfilter"><div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div></div><div class="tab-content" id="fw-tab-macfilter"><div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div></div><div class="tab-content" id="fw-tab-rules"><div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div></div>';
      $$("#fw-tabs button").forEach(function(btn) {
        btn.addEventListener("click", function() {
          _fwTab = btn.dataset.tab;
          $$("#fw-tabs button").forEach(function(b) {
            b.classList.remove("active");
          });
          btn.classList.add("active");
          $$("#fw-tabs ~ .tab-content").forEach(function(tc) {
            tc.classList.remove("active");
          });
          var target = document.getElementById("fw-tab-" + _fwTab);
          if (target) target.classList.add("active");
          _loadFwTab(_fwTab);
        });
      });
      _loadFwSwitches();
      _loadFwTab("portfwd");
    }
    function _loadFwSwitches() {
      var el = $("#fw-switches");
      if (!el) return;
      API.webapi("getFirewallSwitch").then(function(data) {
        var fw = data.firewall_status === 1 || data.firewall_status === "1";
        var ipf = data.ipflt_status === 1 || data.ipflt_status === "1";
        var wan = data.wan_ping_status === 1 || data.wan_ping_status === "1";
        var pf = data.port_forward_status === 1 || data.port_forward_status === "1";
        el.innerHTML = '<div class="fw-switches-row"><label class="fw-switch-item"><input type="checkbox" id="fw-sw-fw"' + (fw ? " checked" : "") + '> Firewall</label><label class="fw-switch-item"><input type="checkbox" id="fw-sw-ipf"' + (ipf ? " checked" : "") + '> IP Filter</label><label class="fw-switch-item"><input type="checkbox" id="fw-sw-pf"' + (pf ? " checked" : "") + '> Port Forward</label><label class="fw-switch-item"><input type="checkbox" id="fw-sw-wan"' + (wan ? " checked" : "") + '> WAN Ping</label><button class="btn-small" ' + actionAttr("fwSaveSwitches") + ">Save</button></div>";
      }).catch(function() {
        el.innerHTML = "";
      });
    }
    function _fwSaveSwitches() {
      API.webapi("setFirewallSwitch", {
        firewall_status: $("#fw-sw-fw").checked ? 1 : 0,
        ipflt_status: $("#fw-sw-ipf").checked ? 1 : 0,
        port_forward_status: $("#fw-sw-pf").checked ? 1 : 0,
        wan_ping_status: $("#fw-sw-wan").checked ? 1 : 0
      }).then(function() {
        alert("Firewall switches saved.");
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _loadFwTab(tab) {
      switch (tab) {
        case "portfwd":
          return _loadPortFwd();
        case "ipfilter":
          return _loadIpFilter();
        case "urlfilter":
          return _loadUrlFilter();
        case "macfilter":
          return _loadMacFilter();
        case "rules":
          return _loadIptables();
      }
    }
    function _showRulePanel(title, fieldsHTML, onSave) {
      _hideRulePanel();
      var overlay = document.createElement("div");
      overlay.id = "rule-panel-overlay";
      overlay.className = "rule-panel-overlay";
      overlay.innerHTML = '<div class="rule-panel" id="rule-panel"><h3>' + escHtml(title) + '<button class="close-btn" id="rule-panel-close">\xD7</button></h3><div id="rule-panel-fields">' + fieldsHTML + '</div><div class="form-actions"><button id="rule-panel-save">Save</button><button class="btn-outline" id="rule-panel-cancel">Cancel</button></div></div>';
      document.body.appendChild(overlay);
      overlay.addEventListener("click", function(e) {
        if (e.target === overlay) _hideRulePanel();
      });
      document.getElementById("rule-panel-close").addEventListener("click", _hideRulePanel);
      document.getElementById("rule-panel-cancel").addEventListener("click", _hideRulePanel);
      document.getElementById("rule-panel-save").addEventListener("click", function() {
        onSave();
      });
    }
    function _hideRulePanel() {
      var overlay = document.getElementById("rule-panel-overlay");
      if (overlay) overlay.remove();
    }
    function _loadPortFwd() {
      var el = $("#fw-tab-portfwd");
      if (!el) return;
      API.webapi("GetPortFwding").then(function(data) {
        var rules = data && data.PortFwdingList ? data.PortFwdingList : [];
        _pfRules = rules;
        var html = '<div class="card"><h3>Port Forwarding Rules</h3><div class="action-bar"><button ' + actionAttr("showPFPanel", [-1]) + ">+ Add rule</button>" + (rules.length > 0 ? '<button class="btn-outline-danger" ' + actionAttr("deleteAllPF") + ">Delete all rules</button>" : "") + "</div>";
        if (rules.length === 0) {
          html += '<p class="text-muted">No rules configured</p>';
        } else {
          html += '<table class="data-table"><thead><tr><th></th><th>On</th><th>Proto</th><th>Ext Port</th><th>Int IP</th><th>Int Port</th><th>Name</th><th></th></tr></thead><tbody>';
          for (var i = 0; i < rules.length; i++) {
            var r = rules[i];
            var enabled = r.Enable === "1" || r.Enable === 1;
            html += '<tr><td class="drag-handle">\u2807</td><td><label class="switch"><input type="checkbox"' + (enabled ? " checked" : "") + " " + actionAttr("togglePF", [i]) + '><span class="slider"></span></label></td><td>' + escHtml(r.Protocol || "") + "</td><td>" + escHtml(r.WanPort || r.ExternalPort || "") + "</td><td>" + escHtml(r.LanIP || r.InternalIP || "") + "</td><td>" + escHtml(r.LanPort || r.InternalPort || "") + "</td><td>" + escHtml(r.PortFwdingName || "") + '</td><td><button class="btn-icon" ' + actionAttr("showPFPanel", [i]) + '>\u270E</button><button class="btn-icon" ' + actionAttr("delPortFwd", [r.PortFwdingName || String(i)]) + ">" + icon("ic-delete") + "</button></td></tr>";
          }
          html += "</tbody></table>";
        }
        html += "</div>";
        el.innerHTML = html;
      }).catch(function(e) {
        var msg = e.message || "";
        if (/parse error/i.test(msg) || /not support/i.test(msg)) {
          el.innerHTML = '<div class="card"><h3>Port Forwarding Rules</h3><p class="text-muted">Not supported by this device firmware</p></div>';
        } else {
          el.innerHTML = '<div class="card"><p class="text-danger">Error loading: ' + escHtml(msg) + "</p></div>";
        }
      });
    }
    function _showPFPanel(index) {
      var editing = index >= 0 && _pfRules[index];
      var r = editing ? _pfRules[index] : {};
      var title = editing ? "Edit Port Forward Rule" : "Add Port Forward Rule";
      var fields = '<div class="float-field"><label>Name</label><input type="text" id="pf-name" value="' + escHtml(r.PortFwdingName || "") + '" placeholder="HTTP"></div><div class="float-field"><label>Protocol</label><select id="pf-proto"><option' + ((r.Protocol || "TCP") === "TCP" ? " selected" : "") + ">TCP</option><option" + (r.Protocol === "UDP" ? " selected" : "") + ">UDP</option><option" + (r.Protocol === "TCP+UDP" ? " selected" : "") + '>TCP+UDP</option></select></div><div class="float-field"><label>External Port</label><input type="text" id="pf-ext" value="' + escHtml(r.WanPort || r.ExternalPort || "") + '" placeholder="8080"></div><div class="float-field"><label>Internal IP</label><input type="text" id="pf-ip" value="' + escHtml(r.LanIP || r.InternalIP || "") + '" placeholder="192.168.1."></div><div class="float-field"><label>Internal Port</label><input type="text" id="pf-int" value="' + escHtml(r.LanPort || r.InternalPort || "") + '" placeholder="80"></div>';
      _showRulePanel(title, fields, function() {
        var params = {
          PortFwdingName: $("#pf-name").value,
          Protocol: $("#pf-proto").value,
          WanPort: $("#pf-ext").value,
          LanIP: $("#pf-ip").value,
          LanPort: $("#pf-int").value,
          Enable: "1"
        };
        if (!params.PortFwdingName || !params.WanPort || !params.LanIP || !params.LanPort) {
          alert("All fields required");
          return;
        }
        var doAdd = function() {
          API.webapi("addPortFwding", params).then(function() {
            _hideRulePanel();
            _loadPortFwd();
          }).catch(function(e) {
            alert("Error: " + e.message);
          });
        };
        if (editing) {
          API.webapi("deletePortFwding", { PortFwdingName: r.PortFwdingName }).then(doAdd).catch(doAdd);
        } else {
          doAdd();
        }
      });
    }
    function _togglePF(i) {
      var r = _pfRules[i];
      if (!r) return;
      var newEnable = r.Enable === "1" || r.Enable === 1 ? "0" : "1";
      API.webapi("SetPortFwding", {
        PortFwdingName: r.PortFwdingName,
        Enable: newEnable
      }).then(_loadPortFwd).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _delPortFwd(name) {
      if (!confirm('Delete port forward rule "' + name + '"?')) return;
      API.webapi("deletePortFwding", { PortFwdingName: name }).then(function() {
        _loadPortFwd();
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _deleteAllPF() {
      if (!confirm("Delete ALL port forwarding rules?")) return;
      var chain = Promise.resolve();
      _pfRules.forEach(function(r) {
        chain = chain.then(function() {
          return API.webapi("deletePortFwding", { PortFwdingName: r.PortFwdingName });
        });
      });
      chain.then(_loadPortFwd).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _loadIpFilter() {
      var el = $("#fw-tab-ipfilter");
      if (!el) return;
      API.webapi("GetIPFilterList").then(function(data) {
        var rules = data && data.IPFilterList ? data.IPFilterList : [];
        _ipfRules = rules;
        var html = '<div class="card"><h3>IP Filter Rules</h3><div class="action-bar"><button ' + actionAttr("showIPFPanel", [-1]) + ">+ Add rule</button>" + (rules.length > 0 ? '<button class="btn-outline-danger" ' + actionAttr("deleteAllIPF") + ">Delete all rules</button>" : "") + "</div>";
        if (rules.length === 0) {
          html += '<p class="text-muted">No rules configured</p>';
        } else {
          html += '<table class="data-table"><thead><tr><th></th><th>#</th><th>Action</th><th>Proto</th><th>Source IP</th><th>Src Port</th><th>Dest IP</th><th>Dst Port</th><th></th></tr></thead><tbody>';
          for (var i = 0; i < rules.length; i++) {
            var r = rules[i];
            html += '<tr><td class="drag-handle">\u2807</td><td>' + (i + 1) + "</td><td>" + escHtml(r.FilterAction || "") + "</td><td>" + escHtml(r.Protocol || "") + "</td><td>" + (r.StartIP ? escHtml(r.StartIP) : '<span class="text-muted">Any</span>') + "</td><td>" + (r.StartPort ? escHtml(r.StartPort) : '<span class="text-muted">Any</span>') + "</td><td>" + (r.EndIP ? escHtml(r.EndIP) : '<span class="text-muted">Any</span>') + "</td><td>" + (r.EndPort ? escHtml(r.EndPort) : '<span class="text-muted">Any</span>') + '</td><td><button class="btn-icon" ' + actionAttr("showIPFPanel", [i]) + '>\u270E</button><button class="btn-icon" ' + actionAttr("delIpFilter", [i]) + ">" + icon("ic-delete") + "</button></td></tr>";
          }
          html += "</tbody></table>";
        }
        html += "</div>";
        el.innerHTML = html;
      }).catch(function(e) {
        var msg = e.message || "";
        if (/parse error/i.test(msg) || /not support/i.test(msg)) {
          el.innerHTML = '<div class="card"><h3>IP Filter Rules</h3><p class="text-muted">Not supported by this device firmware</p></div>';
        } else {
          el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(msg) + "</p></div>";
        }
      });
    }
    function _showIPFPanel(index) {
      var editing = index >= 0 && _ipfRules[index];
      var r = editing ? _ipfRules[index] : {};
      var title = editing ? "Edit Firewall Rule" : "Add Firewall Rule";
      var fields = '<div class="float-field"><label>Action</label><select id="ipf-action"><option value="Accept"' + ((r.FilterAction || "Accept") === "Accept" ? " selected" : "") + '>Accept</option><option value="Deny"' + (r.FilterAction === "Deny" ? " selected" : "") + '>Deny</option></select></div><div class="float-field"><label>Protocol</label><select id="ipf-proto"><option' + ((r.Protocol || "TCP") === "TCP" ? " selected" : "") + ">TCP</option><option" + (r.Protocol === "UDP" ? " selected" : "") + ">UDP</option><option" + (r.Protocol === "TCP+UDP" ? " selected" : "") + '>TCP+UDP</option></select></div><div class="float-field"><label>Source IP</label><input type="text" id="ipf-sip" value="' + escHtml(r.StartIP || "") + '" placeholder="Any"></div><div class="float-field"><label>Source Port</label><input type="text" id="ipf-sport" value="' + escHtml(r.StartPort || "") + '" placeholder="Any"></div><div class="float-field"><label>Destination IP</label><input type="text" id="ipf-eip" value="' + escHtml(r.EndIP || "") + '" placeholder="Any"></div><div class="float-field"><label>Destination Port</label><input type="text" id="ipf-eport" value="' + escHtml(r.EndPort || "") + '" placeholder="Any"></div>';
      _showRulePanel(title, fields, function() {
        var params = {
          StartIP: $("#ipf-sip").value,
          EndIP: $("#ipf-eip").value,
          StartPort: $("#ipf-sport").value,
          EndPort: $("#ipf-eport").value,
          Protocol: $("#ipf-proto").value,
          FilterAction: $("#ipf-action").value
        };
        var doAdd = function() {
          API.webapi("addIPFilter", params).then(function() {
            _hideRulePanel();
            _loadIpFilter();
          }).catch(function(e) {
            alert("Error: " + e.message);
          });
        };
        if (editing) {
          API.webapi("deleteIPFilter", { Index: String(index) }).then(doAdd).catch(doAdd);
        } else {
          doAdd();
        }
      });
    }
    function _delIpFilter(index) {
      if (!confirm("Delete IP filter rule?")) return;
      API.webapi("deleteIPFilter", { Index: String(index) }).then(function() {
        _loadIpFilter();
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _deleteAllIPF() {
      if (!confirm("Delete ALL IP filter rules?")) return;
      var chain = Promise.resolve();
      for (var i = _ipfRules.length - 1; i >= 0; i--) {
        (function(idx) {
          chain = chain.then(function() {
            return API.webapi("deleteIPFilter", { Index: String(idx) });
          });
        })(i);
      }
      chain.then(_loadIpFilter).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _loadMacFilter() {
      var tab = $("#fw-tab-macfilter");
      if (!tab) return;
      Promise.all([
        API.webapi("GetMacFilterSettings").catch(function() {
          return null;
        }),
        API.webapi("GetMacFilterObjectSettings").catch(function() {
          return null;
        })
      ]).then(function(results) {
        var filterSt = results[0], filterObj = results[1];
        var mode = filterSt ? filterSt.MacFilterMode || "0" : "0";
        var entries = filterObj && filterObj.MacFilterList ? filterObj.MacFilterList : [];
        tab.innerHTML = '<div class="card"><h3>MAC Address Filter</h3><div class="form-group"><label>Filter Mode</label><select id="mf-mode"><option value="0"' + (mode === "0" ? " selected" : "") + '>Disabled</option><option value="1"' + (mode === "1" ? " selected" : "") + '>Whitelist (allow only listed)</option><option value="2"' + (mode === "2" ? " selected" : "") + '>Blacklist (block listed)</option></select></div><div class="form-actions mb-2"><button ' + actionAttr("saveMacFilterMode") + '>Save Mode</button></div><h3>MAC Addresses</h3><div id="mf-list">' + (entries.length === 0 ? '<p class="text-muted">No entries</p>' : '<table class="data-table"><thead><tr><th>MAC Address</th><th>Name</th><th></th></tr></thead><tbody>' + entries.map(function(e, i) {
          return '<tr><td class="text-mono">' + escHtml(e.MacAddress || "") + "</td><td>" + escHtml(e.DeviceName || "") + '</td><td><button class="toggle-btn" ' + actionAttr("delMacFilter", [i]) + ">" + icon("ic-delete") + "</button></td></tr>";
        }).join("") + "</tbody></table>") + '</div><div class="form-row mt-2"><div class="form-group"><label>Add MAC</label><input type="text" id="mf-mac" placeholder="AA:BB:CC:DD:EE:FF" maxlength="17"></div><div class="form-group"><label>Name (optional)</label><input type="text" id="mf-name" placeholder="Device name"></div></div><div class="form-actions"><button ' + actionAttr("addMacFilter") + ">Add</button></div></div>";
      }).catch(function() {
      });
    }
    function _saveMacFilterMode() {
      var mode = $("#mf-mode").value;
      API.webapi("SetMacFilterSettings", { MacFilterMode: mode }).then(function() {
        _loadMacFilter();
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _addMacFilter() {
      var mac = ($("#mf-mac") || {}).value || "";
      var name = ($("#mf-name") || {}).value || "";
      if (!/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(mac)) {
        alert("Invalid MAC format (AA:BB:CC:DD:EE:FF)");
        return;
      }
      API.webapi("SetMacFilterObjectSettings", {
        MacAddress: mac.toUpperCase(),
        DeviceName: name,
        Action: "add"
      }).then(function() {
        _loadMacFilter();
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _delMacFilter(index) {
      if (!confirm("Remove this MAC filter entry?")) return;
      API.webapi("SetMacFilterObjectSettings", {
        Index: String(index),
        Action: "delete"
      }).then(function() {
        _loadMacFilter();
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _loadUrlFilter() {
      var el = $("#fw-tab-urlfilter");
      if (!el) return;
      API.webapi("getUrlFilterSettings").then(function(data) {
        var policy = data.filter_policy || "0";
        var denyList = data.UrlDenyList || [];
        var allowList = data.UrlAllowList || [];
        var activeList = policy === "1" ? allowList : denyList;
        var html = '<div class="card"><h3>URL Filter</h3><div class="form-group"><label>Filter Policy</label><select id="uf-policy"><option value="0"' + (policy === "0" ? " selected" : "") + '>Block listed URLs</option><option value="1"' + (policy === "1" ? " selected" : "") + ">Allow only listed URLs</option></select></div>";
        if (activeList.length === 0) {
          html += '<p class="text-muted">No URLs configured</p>';
        } else {
          html += '<table class="data-table"><thead><tr><th>URL</th><th></th></tr></thead><tbody>';
          activeList.forEach(function(u, i) {
            var url = typeof u === "string" ? u : u.Url || u.url || "";
            html += "<tr><td>" + escHtml(url) + '</td><td><button class="btn-icon" ' + actionAttr("fwDelUrl", [i]) + ">" + icon("ic-delete") + "</button></td></tr>";
          });
          html += "</tbody></table>";
        }
        html += '<div class="form-row mt-2"><div class="form-group" style="flex:1"><input type="text" id="uf-url" placeholder="example.com" maxlength="256"></div><button ' + actionAttr("fwAddUrl") + ">Add URL</button></div></div>";
        el.innerHTML = html;
      }).catch(function(e) {
        var msg = e.message || "";
        if (/parse error/i.test(msg) || /not support/i.test(msg)) {
          el.innerHTML = '<div class="card"><h3>URL Filter</h3><p class="text-muted">Not supported by this device firmware</p></div>';
        } else {
          el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(msg) + "</p></div>";
        }
      });
    }
    function _fwAddUrl() {
      var inp = $("#uf-url");
      var policy = ($("#uf-policy") || {}).value || "0";
      if (!inp || !inp.value.trim()) {
        alert("Enter a URL");
        return;
      }
      API.webapi("getUrlFilterSettings").then(function(data) {
        var denyList = data.UrlDenyList || [];
        var allowList = data.UrlAllowList || [];
        var url = inp.value.trim();
        if (policy === "1") {
          allowList.push(url);
        } else {
          denyList.push(url);
        }
        return API.webapi("SetUrlFilterSettings", {
          filter_policy: policy,
          UrlDenyList: denyList,
          UrlAllowList: allowList
        });
      }).then(function() {
        _loadUrlFilter();
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _fwDelUrl(index) {
      var policy = ($("#uf-policy") || {}).value || "0";
      API.webapi("getUrlFilterSettings").then(function(data) {
        var denyList = data.UrlDenyList || [];
        var allowList = data.UrlAllowList || [];
        if (policy === "1") {
          allowList.splice(index, 1);
        } else {
          denyList.splice(index, 1);
        }
        return API.webapi("SetUrlFilterSettings", {
          filter_policy: policy,
          UrlDenyList: denyList,
          UrlAllowList: allowList
        });
      }).then(function() {
        _loadUrlFilter();
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _loadIptables() {
      var el = $("#fw-tab-rules");
      if (!el) return;
      API.cgiGet("system.cgi", { action: "iptables" }).then(function(data) {
        if (!data) {
          el.innerHTML = '<div class="card"><p class="text-muted">No data</p></div>';
          return;
        }
        var tables = data.tables || data;
        var html = "";
        var hasAny = false;
        for (var tableName in tables) {
          if (!tables.hasOwnProperty(tableName)) continue;
          if (tableName === "error") continue;
          var chains = tables[tableName];
          if (typeof chains !== "object") continue;
          hasAny = true;
          html += '<div class="card mb-2"><h3>Table: ' + escHtml(tableName) + "</h3>";
          for (var chainName in chains) {
            if (!chains.hasOwnProperty(chainName)) continue;
            var chain = chains[chainName];
            var policy = chain.policy ? " (policy: " + escHtml(chain.policy) + ")" : "";
            html += '<h4 class="text-small mt-1">' + escHtml(chainName) + policy + "</h4>";
            if (!chain.rules || chain.rules.length === 0) {
              html += '<p class="text-muted text-small">No rules</p>';
              continue;
            }
            html += '<table class="data-table"><thead><tr><th>#</th><th>Target</th><th>Proto</th><th>In</th><th>Out</th><th>Src</th><th>Dst</th><th>Extra</th><th>Pkts</th><th>Bytes</th></tr></thead><tbody>';
            for (var k = 0; k < chain.rules.length; k++) {
              var r = chain.rules[k];
              html += "<tr><td>" + (r.num || "") + "</td><td><strong>" + escHtml(r.target || "") + "</strong></td><td>" + escHtml(r.proto || "") + "</td><td>" + escHtml(r.in || "*") + "</td><td>" + escHtml(r.out || "*") + "</td><td>" + escHtml(r.src || "") + "</td><td>" + escHtml(r.dst || "") + '</td><td class="text-small">' + escHtml(r.extra || "") + '</td><td class="text-right">' + escHtml(r.pkts || "") + '</td><td class="text-right">' + escHtml(r.bytes || "") + "</td></tr>";
            }
            html += "</tbody></table>";
          }
          html += "</div>";
        }
        el.innerHTML = hasAny && html ? html : '<div class="card"><p class="text-muted">No tables</p></div>';
      }).catch(function(e) {
        el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(e.message) + "</p></div>";
      });
    }
    App.registerPage("firewall", renderFirewall);
    App._fwSaveSwitches = _fwSaveSwitches;
    App._showPFPanel = _showPFPanel;
    App._togglePF = _togglePF;
    App._delPortFwd = _delPortFwd;
    App._deleteAllPF = _deleteAllPF;
    App._showIPFPanel = _showIPFPanel;
    App._delIpFilter = _delIpFilter;
    App._deleteAllIPF = _deleteAllIPF;
    App._fwAddUrl = _fwAddUrl;
    App._fwDelUrl = _fwDelUrl;
    App._saveMacFilterMode = _saveMacFilterMode;
    App._addMacFilter = _addMacFilter;
    App._delMacFilter = _delMacFilter;
  })();

  // js/pages/upnp.js
  (function() {
    "use strict";
    var $ = App.$, icon = App.icon, escHtml = App.escHtml;
    function renderUpnp(container) {
      container.innerHTML = '<h2>UPnP</h2><div id="upnp-content"><div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div></div>';
      _loadUpnp();
    }
    function _loadUpnp() {
      var el = $("#upnp-content");
      if (!el) return;
      Promise.all([
        API.webapi("GetUpnpSettings"),
        API.cgiGet("system.cgi", { action: "iptables" }).catch(function() {
          return null;
        })
      ]).then(function(results) {
        var data = results[0], iptData = results[1];
        var enabled = data && (data.UpnpEnable === 1 || data.UpnpEnable === "1");
        var mappingsHtml = "";
        if (iptData && iptData.nat) {
          var miniChain = iptData.nat.MINIUPNPD;
          if (miniChain && miniChain.rules && miniChain.rules.length > 0) {
            mappingsHtml = '<h4 class="mt-2">Active Mappings</h4><table class="data-table"><thead><tr><th>Proto</th><th>Destination</th><th>Target</th><th>Extra</th></tr></thead><tbody>' + miniChain.rules.map(function(r) {
              return "<tr><td>" + escHtml(r.proto || "") + "</td><td>" + escHtml(r.dst || "") + "</td><td>" + escHtml(r.target || "") + '</td><td class="text-small">' + escHtml(r.extra || "") + "</td></tr>";
            }).join("") + "</tbody></table>";
          } else {
            mappingsHtml = '<p class="text-muted mt-1">No active UPnP mappings</p>';
          }
        }
        el.innerHTML = '<div class="card"><div class="flex-between mb-2"><h3>UPnP / NAT-PMP</h3><button class="toggle-btn ' + (enabled ? "on" : "") + '" id="upnp-toggle">' + icon("ic-power") + " " + (enabled ? "Enabled" : "Disabled") + '</button></div><p class="text-small text-muted">UPnP allows applications on your network to automatically set up port forwarding rules.</p>' + mappingsHtml + "</div>";
        $("#upnp-toggle").addEventListener("click", function() {
          API.webapi("SetUpnpSettings", { UpnpEnable: enabled ? "0" : "1" }).then(function() {
            setTimeout(_loadUpnp, 1e3);
          }).catch(function(e) {
            alert("Error: " + e.message);
          });
        });
      }).catch(function(e) {
        el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(e.message) + "</p></div>";
      });
    }
    App.registerPage("upnp", renderUpnp);
  })();

  // js/pages/ttl-fix.js
  (function() {
    "use strict";
    var $ = App.$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;
    function renderTtlFix(container) {
      container.innerHTML = '<h2>TTL Fix</h2><div id="ttl-content"><div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div></div>';
      _loadTtl();
    }
    function _loadTtl() {
      var el = $("#ttl-content");
      if (!el) return;
      API.cgiGet("ttl.cgi", { action: "status" }).then(function(data) {
        var active = data && data.active;
        var ttl = data ? data.ttl : 64;
        var iface = data ? data.iface || "rmnet+" : "rmnet+";
        el.innerHTML = '<div class="card"><div class="flex-between mb-2"><h3>TTL / Hop Limit</h3><button class="toggle-btn ' + (active ? "on" : "") + '" id="ttl-toggle">' + icon("ic-power") + " " + (active ? "Active" : "Inactive") + '</button></div><p class="text-small text-muted mb-2">Normalizes TTL/Hop Limit on outbound traffic to prevent carrier tethering detection.</p><div class="form-row"><div class="form-group"><label>TTL Value</label><input type="number" id="ttl-val" value="' + ttl + '" min="1" max="255"></div><div class="form-group"><label>Interface</label><select id="ttl-iface"><option value="rmnet+"' + (iface === "rmnet+" ? " selected" : "") + '>rmnet+ (WAN only)</option><option value="+"' + (iface === "+" ? " selected" : "") + '>All interfaces</option><option value="custom"' + (iface !== "rmnet+" && iface !== "+" ? " selected" : "") + '>Custom</option></select></div><div class="form-group" id="ttl-custom-wrap" style="' + (iface !== "rmnet+" && iface !== "+" ? "" : "display:none") + '"><label>Custom Interface</label><input type="text" id="ttl-custom" value="' + escHtml(iface !== "rmnet+" && iface !== "+" ? iface : "") + '" placeholder="wwan0"></div></div><div class="form-actions"><button ' + actionAttr("saveTtl") + '>Save TTL</button></div><div class="mt-2 text-small text-muted">IPv4 rules: ' + (data ? data.ipv4_rules : "?") + " | IPv6 rules: " + (data ? data.ipv6_rules : "?") + (data && !data.init_exists ? '<br><span class="text-danger">Warning: ttl_fix init script not found</span>' : "") + "</div></div>";
        $("#ttl-iface").addEventListener("change", function() {
          var cw = $("#ttl-custom-wrap");
          if (cw) cw.style.display = this.value === "custom" ? "" : "none";
        });
        $("#ttl-toggle").addEventListener("click", function() {
          API.cgiPost("ttl.cgi", { action: active ? "disable" : "enable" }).then(function() {
            setTimeout(_loadTtl, 1e3);
          }).catch(function(e) {
            alert("Error: " + e.message);
          });
        });
      }).catch(function(e) {
        el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(e.message) + "</p></div>";
      });
    }
    function _saveTtl() {
      var val = parseInt($("#ttl-val").value, 10);
      if (isNaN(val) || val < 1 || val > 255) {
        alert("TTL must be 1-255");
        return;
      }
      var ifaceSel = ($("#ttl-iface") || {}).value || "rmnet+";
      var iface = ifaceSel === "custom" ? ($("#ttl-custom") || {}).value || "rmnet+" : ifaceSel;
      API.cgiPost("ttl.cgi", { action: "set", ttl: val, iface }).then(function() {
        _loadTtl();
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    App.registerPage("ttl-fix", renderTtlFix);
    App._saveTtl = _saveTtl;
  })();

  // js/pages/ussd.js
  (function() {
    "use strict";
    var $ = App.$, escHtml = App.escHtml, actionAttr = App.actionAttr;
    var OPERATORS = [
      { name: "MegaFon", codes: [
        { label: "Balance", code: "*100#" },
        { label: "Packages", code: "*558#" },
        { label: "Own Number", code: "*205#" }
      ] },
      { name: "MTS", codes: [
        { label: "Balance", code: "*100#" },
        { label: "Packages", code: "*100*1#" },
        { label: "Own Number", code: "*111*0887#" }
      ] },
      { name: "Beeline", codes: [
        { label: "Balance", code: "*102#" },
        { label: "Own Number", code: "*110*10#" }
      ] },
      { name: "Tele2", codes: [
        { label: "Balance", code: "*105#" },
        { label: "Packages", code: "*155*0#" },
        { label: "Own Number", code: "*201#" }
      ] },
      { name: "Yota", codes: [
        { label: "Balance", code: "*100#" },
        { label: "Packages", code: "*101#" },
        { label: "Own Number", code: "*103#" }
      ] }
    ];
    var _pollTimer = null;
    var _sessionActive = false;
    function renderUSSD(container) {
      var quickHtml = '<div class="ussd-quick-grid">';
      OPERATORS.forEach(function(op) {
        quickHtml += '<button class="ussd-quick-btn" ' + actionAttr("ussdSend", [op.codes[0].code]) + ">" + escHtml(op.name) + '<span class="ussd-quick-code">' + escHtml(op.codes[0].code) + "</span></button>";
      });
      quickHtml += "</div>";
      var moreHtml = '<details class="ussd-more"><summary>More codes</summary><div class="ussd-codes-table">';
      OPERATORS.forEach(function(op) {
        moreHtml += '<div class="ussd-op-row"><span class="ussd-op-name">' + escHtml(op.name) + '</span><div class="ussd-op-btns">';
        op.codes.forEach(function(c) {
          moreHtml += '<button class="btn-small" ' + actionAttr("ussdSend", [c.code]) + ">" + escHtml(c.label) + ' <span class="text-muted">' + escHtml(c.code) + "</span></button>";
        });
        moreHtml += "</div></div>";
      });
      moreHtml += "</div></details>";
      container.innerHTML = '<h2>USSD</h2><div class="card"><h3>Quick Balance</h3>' + quickHtml + '</div><div class="card mt-2">' + moreHtml + '</div><div class="card mt-2"><h3>Custom USSD</h3><div class="form-row"><div class="form-group" style="flex:1"><input type="text" id="ussd-input" placeholder="*100#" maxlength="64"></div><button ' + actionAttr("ussdSendCustom") + '>Send</button></div></div><div class="card mt-2" id="ussd-result-card" style="display:none"><h3>Response</h3><pre id="ussd-response" class="code-block ussd-response"></pre><div id="ussd-session" style="display:none"><div class="form-row mt-1"><div class="form-group" style="flex:1"><input type="text" id="ussd-reply" placeholder="Reply..."></div><button ' + actionAttr("ussdSendReply") + '>Reply</button><button class="btn-outline" ' + actionAttr("ussdEnd") + ">End Session</button></div></div></div>";
      var inp = $("#ussd-input");
      if (inp) inp.addEventListener("keydown", function(e) {
        if (e.key === "Enter") {
          e.preventDefault();
          _ussdSendCustom();
        }
      });
      App.setCleanup(function() {
        if (_pollTimer) {
          clearInterval(_pollTimer);
          _pollTimer = null;
        }
        _sessionActive = false;
      });
    }
    function _ussdSend(code) {
      _doSend(code);
    }
    function _ussdSendCustom() {
      var inp = $("#ussd-input");
      if (!inp || !inp.value.trim()) return;
      _doSend(inp.value.trim());
    }
    function _ussdSendReply() {
      var inp = $("#ussd-reply");
      if (!inp || !inp.value.trim()) return;
      _doSend(inp.value.trim());
      inp.value = "";
    }
    function _doSend(code) {
      var card = $("#ussd-result-card");
      var resp = $("#ussd-response");
      if (card) card.style.display = "";
      if (resp) resp.textContent = "Sending " + code + "...";
      _showSession(false);
      if (_pollTimer) clearInterval(_pollTimer);
      API.webapi("SendUSSD", { UssdContent: code }).then(function() {
        _pollResult(0);
      }).catch(function(e) {
        if (resp) resp.textContent = "Error: " + e.message;
      });
    }
    function _pollResult(attempt) {
      if (attempt > 15) {
        var resp = $("#ussd-response");
        if (resp) resp.textContent = "No response \u2014 USSD may not work on LTE.\nTry switching to 3G mode in Connection > Network Mode.";
        return;
      }
      _pollTimer = setTimeout(function() {
        API.webapi("GetUSSDSendResult").then(function(r) {
          var resp2 = $("#ussd-response");
          if (!r || !r.UssdContent) {
            _pollResult(attempt + 1);
            return;
          }
          if (resp2) resp2.textContent = r.UssdContent || "(empty response)";
          if (r.UssdType === 1 || r.UssdType === "1") {
            _sessionActive = true;
            _showSession(true);
          } else {
            _sessionActive = false;
            _showSession(false);
          }
        }).catch(function(e) {
          _pollResult(attempt + 1);
        });
      }, 1e3);
    }
    function _showSession(show) {
      var el = $("#ussd-session");
      if (el) el.style.display = show ? "" : "none";
    }
    function _ussdEnd() {
      API.webapi("SetUSSDEnd").then(function() {
        _sessionActive = false;
        _showSession(false);
        var resp = $("#ussd-response");
        if (resp) resp.textContent += "\n--- Session ended ---";
      }).catch(function(e) {
        var resp = $("#ussd-response");
        if (resp) resp.textContent += "\nError ending session: " + e.message;
      });
    }
    App.registerPage("ussd", renderUSSD);
    App._ussdSend = _ussdSend;
    App._ussdSendCustom = _ussdSendCustom;
    App._ussdSendReply = _ussdSendReply;
    App._ussdEnd = _ussdEnd;
  })();

  // js/pages/sms.js
  (function() {
    "use strict";
    var icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr, timeAgo = App.formatTimeAgo;
    function renderSms(container) {
      container.innerHTML = '<div class="sms-sticky-header"><h2>SMS</h2><div class="tab-bar"><button class="tab-btn active" ' + actionAttr("smsTab", ["inbox"]) + '>Inbox</button><button class="tab-btn" ' + actionAttr("smsTab", ["forward"]) + '>Forward</button></div></div><div id="sms-inbox" class="tab-content active"></div><div id="sms-compose" class="tab-content"></div><div id="sms-forward" class="tab-content"></div>';
      _smsTab("inbox");
    }
    function _smsTab(tab) {
      ["inbox", "compose", "forward"].forEach(function(t) {
        var el = document.getElementById("sms-" + t);
        if (el) el.classList.toggle("active", t === tab);
      });
      var barTabs = ["inbox", "forward"];
      var btns = document.querySelectorAll(".tab-bar .tab-btn");
      btns.forEach(function(b, i) {
        b.classList.toggle("active", barTabs[i] === tab);
      });
      var composeBtn = document.querySelector(".sms-compose-btn");
      if (composeBtn) composeBtn.classList.toggle("active", tab === "compose");
      var pc = document.getElementById("page-content");
      if (pc) pc.classList.remove("chat-active");
      if (tab === "inbox") _loadSmsInbox();
      else if (tab === "compose") _loadSmsCompose();
      else if (tab === "forward") _loadSmsForward();
    }
    function _timeAgoShort(dateStr) {
      var m = (dateStr || "").match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
      if (!m) return dateStr || "\u2014";
      var d = new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]);
      var now = /* @__PURE__ */ new Date();
      var diffMs = now - d;
      if (diffMs < 0) return dateStr;
      var diffMin = Math.floor(diffMs / 6e4);
      var diffHr = Math.floor(diffMin / 60);
      if (diffMin < 1) return "just now";
      if (diffMin < 60) return diffMin + " min ago";
      if (diffHr < 24) {
        var rm = diffMin % 60;
        return rm > 0 ? diffHr + "h " + rm + "m ago" : diffHr + "h ago";
      }
      var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      var msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      var dayDiff = Math.round((today - msgDay) / 864e5);
      if (dayDiff === 1) return "Yesterday";
      if (dayDiff < 7) return dayDiff + " days ago";
      var dd = (d.getDate() < 10 ? "0" : "") + d.getDate();
      var mm = (d.getMonth() < 9 ? "0" : "") + (d.getMonth() + 1);
      return dd + "." + mm + "." + d.getFullYear();
    }
    function _avatarLetters(name) {
      var s = (name || "").trim();
      if (!s) return "?";
      if (/^\+?\d[\d\s\-()]*$/.test(s)) return "#";
      var words = s.split(/\s+/);
      if (words.length >= 2) return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
      var caps = s.match(/[A-ZА-ЯЁ]/g);
      if (caps && caps.length >= 2) return (caps[0] + caps[1]).toUpperCase();
      return s.substring(0, 2).toUpperCase();
    }
    function _formatTime(dateStr) {
      var parts = (dateStr || "").split(" ");
      return parts[1] ? parts[1].substring(0, 5) : "";
    }
    function _formatDate(dateStr) {
      var parts = (dateStr || "").match(/^(\d{2})-(\d{2})-(\d{4})/);
      if (!parts) return dateStr || "";
      var now = /* @__PURE__ */ new Date();
      var y = +parts[3], m = +parts[2] - 1, d = +parts[1];
      if (y === now.getFullYear() && m === now.getMonth() && d === now.getDate()) return "Today";
      var yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      if (y === yest.getFullYear() && m === yest.getMonth() && d === yest.getDate()) return "Yesterday";
      return parts[1] + "." + parts[2] + "." + parts[3];
    }
    function _loadSmsInbox() {
      var el = document.getElementById("sms-inbox");
      if (!el) return;
      el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading messages...</div>';
      Promise.all([
        API.webapi("GetSMSStorageState"),
        API.webapi("GetSMSContactList", { Page: 0, ContactNum: 50 })
      ]).then(function(results) {
        var storage = results[0], contacts = results[1];
        var used = parseInt(storage.TUseCount || storage.UsedNum || 0, 10);
        var left = parseInt(storage.LeftCount || 0, 10);
        var total = parseInt(storage.MaxCount || storage.TotalNum || 0, 10) || used + left;
        var contactList = contacts.SMSContactList || [];
        var html = '<div class="sms-storage-row"><span>Storage ' + used + "/" + total + '</span><progress value="' + used + '" max="' + (total || 1) + '"></progress><button class="sms-compose-btn" ' + actionAttr("smsTab", ["compose"]) + ' title="New message">' + icon("ic-edit") + "</button></div>";
        if (contactList.length === 0) {
          html += '<p class="text-muted" style="text-align:center;padding:2rem 0">No messages</p>';
        } else {
          html += '<div class="chat-list">';
          contactList.forEach(function(c) {
            var rawPhone = c.PhoneNumber;
            var phoneStr = Array.isArray(rawPhone) ? rawPhone[0] || "" : rawPhone || "";
            var preview = ((c.LatestContent || c.SMSContent || "") + "").substring(0, 50);
            var unreadCount = parseInt(c.UnreadCount || 0, 10);
            var totalCount = parseInt(c.TotalNum || c.TSMSCount || 0, 10);
            var letter = _avatarLetters(phoneStr);
            html += '<div class="chat-item" ' + actionAttr("openSmsThread", [phoneStr, c.ContactId]) + '><div class="chat-avatar">' + escHtml(letter) + '</div><div class="chat-item-body"><div class="chat-item-top"><span class="chat-item-name">' + escHtml(phoneStr) + '</span><span class="chat-item-time">' + escHtml(_timeAgoShort(c.LatestTime || c.SMSTime || "")) + '</span></div><div class="chat-item-bottom"><span class="chat-item-preview">' + escHtml(preview) + "</span>" + (unreadCount > 0 ? '<span class="badge-unread">' + unreadCount + "</span>" : totalCount > 0 ? '<span class="badge-unread muted">' + totalCount + "</span>" : "") + '</div></div><button class="chat-item-del" data-stop ' + actionAttr("deleteSmsThread", [c.ContactId || ""]) + ">&times;</button></div>";
          });
          html += "</div>";
        }
        el.innerHTML = html;
      }).catch(function(e) {
        el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(e.message) + "</p></div>";
      });
    }
    function _openSmsThread(phone, contactId) {
      var el = document.getElementById("sms-inbox");
      if (!el) return;
      el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading thread...</div>';
      return API.webapi("GetSMSContentList", {
        ContactId: parseInt(contactId, 10) || 0,
        Page: 0,
        PhoneNumber: phone
      }).then(function(msgs) {
        var list = (msgs.SMSContentList || []).slice().reverse();
        var letter = _avatarLetters(phone);
        var html = '<div class="chat-wrap"><div class="chat-header"><button ' + actionAttr("smsTab", ["inbox"]) + ' class="chat-back">\u2190</button><div class="chat-avatar sm">' + escHtml(letter) + '</div><span class="chat-header-name">' + escHtml(phone) + "</span></div>";
        if (list.length === 0) {
          html += '<p class="text-muted" style="text-align:center;padding:2rem 0">No messages in thread</p>';
        } else {
          html += '<div class="chat-messages">';
          var prevDate = "", prevType = null;
          list.forEach(function(m) {
            var isSent = m.SMSType === 2 || m.SMSType === "2";
            var dir = isSent ? "out" : "in";
            var smsId = m.SMSId || m.SmsId || "";
            var hasReport = m.sms_report && m.sms_report !== 0 && m.sms_report !== "0" || m.ReportStatus && m.ReportStatus !== 0 && m.ReportStatus !== "0";
            var curDate = _formatDate(m.SMSTime || "");
            var grouped = prevType === dir && curDate === prevDate;
            if (curDate && curDate !== prevDate) {
              html += '<div class="chat-date-sep"><span>' + escHtml(curDate) + "</span></div>";
            }
            html += '<div class="chat-msg ' + dir + (grouped ? " grouped" : "") + '">';
            html += '<div class="chat-msg-text">' + escHtml(m.SMSContent || "") + "</div>";
            html += '<div class="chat-msg-meta">';
            if (smsId) html += '<a href="#" ' + actionAttr("deleteSingleSms", [smsId, phone]) + ' class="chat-msg-del">delete</a>';
            html += '<span class="chat-msg-time">' + escHtml(_formatTime(m.SMSTime || "")) + "</span>";
            if (isSent) {
              html += '<svg class="icon-xs' + (hasReport ? " read" : "") + '"><use href="#' + (hasReport ? "ic-check-all" : "ic-check") + '"/></svg>';
            }
            html += "</div></div>";
            prevDate = curDate;
            prevType = dir;
          });
          html += "</div>";
        }
        html += '<div class="chat-input-bar"><textarea id="sms-reply-text" rows="1" placeholder="Message"></textarea><button ' + actionAttr("sendSms", [phone]) + ' class="chat-send-btn"><svg class="icon"><use href="#ic-send"/></svg></button></div></div>';
        el.innerHTML = html;
        var pc = document.getElementById("page-content");
        if (pc) pc.classList.add("chat-active");
        var chatMsgs = el.querySelector(".chat-messages");
        if (chatMsgs) chatMsgs.scrollTop = chatMsgs.scrollHeight;
        var replyText = document.getElementById("sms-reply-text");
        var sendBtn = document.querySelector(".chat-send-btn");
        if (replyText && sendBtn) {
          replyText.addEventListener("input", function() {
            sendBtn.classList.toggle("active", replyText.value.trim().length > 0);
          });
        }
        API.webapi("SetNewSMSFlag").catch(function() {
        });
      }).catch(function(e) {
        el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(e.message) + "</p></div>";
      });
    }
    function _loadSmsCompose() {
      var el = document.getElementById("sms-compose");
      if (!el) return;
      el.innerHTML = '<div class="compose-to-row"><label>To:</label><input type="tel" id="sms-to" placeholder="Enter number..."></div><div id="compose-contacts"><div class="page-loading"><div class="spinner"></div></div></div><div id="compose-editor" class="hidden"><div class="compose-recipient" id="compose-recipient-display"></div><textarea id="sms-text" rows="3" placeholder="Type your message..."></textarea><div class="stat-row"><span class="label" id="sms-char-count">0 / 160</span><span class="value" id="sms-parts">1 part</span></div><div id="sms-send-status"></div><div class="chat-input-bar"><button ' + actionAttr("sendSmsCompose") + ' class="chat-send-btn"><svg class="icon"><use href="#ic-send"/></svg></button></div></div>';
      _loadComposeContacts();
      var toInput = document.getElementById("sms-to");
      if (toInput) {
        toInput.addEventListener("input", function() {
          var q = toInput.value.trim().toLowerCase();
          var items = el.querySelectorAll(".chat-item");
          items.forEach(function(item) {
            var name = (item.getAttribute("data-search") || "").toLowerCase();
            item.style.display = !q || name.indexOf(q) !== -1 ? "" : "none";
          });
          var editor = document.getElementById("compose-editor");
          var contacts = document.getElementById("compose-contacts");
          if (/^\+?\d{3,}$/.test(toInput.value.trim())) {
            if (editor) editor.classList.remove("hidden");
            if (contacts) contacts.classList.add("hidden");
            var disp = document.getElementById("compose-recipient-display");
            if (disp) disp.textContent = toInput.value.trim();
            var textArea = document.getElementById("sms-text");
            if (textArea && !textArea._bound) {
              textArea._bound = true;
              textArea.addEventListener("input", _smsCharCount);
            }
          } else {
            if (editor) editor.classList.add("hidden");
            if (contacts) contacts.classList.remove("hidden");
          }
        });
        toInput.addEventListener("keydown", function(e) {
          if (e.key === "Enter") {
            e.preventDefault();
            var v = toInput.value.trim();
            if (/^\+?\d{3,}$/.test(v)) _selectComposeRecipient(v, v);
          }
        });
      }
    }
    function _loadComposeContacts() {
      var el = document.getElementById("compose-contacts");
      if (!el) return;
      Promise.all([
        API.webapi("getPhoneBookInitState").then(function(r) {
          if (parseInt(r.state, 10) !== 0) return [];
          return API.webapi("getPhoneBooklistInfo", { Page: 1 }).then(function(pb) {
            return (pb.PhoneBookList || []).map(function(c) {
              return { name: c.Name || "", phone: c.PhoneNumber || "", source: "sim" };
            });
          });
        }).catch(function() {
          return [];
        }),
        API.webapi("GetSMSContactList", { Page: 0, ContactNum: 50 }).then(function(r) {
          return (r.SMSContactList || []).filter(function(c) {
            var ph = Array.isArray(c.PhoneNumber) ? c.PhoneNumber[0] || "" : c.PhoneNumber || "";
            return /^\+?\d[\d\s\-()]*$/.test(ph);
          }).map(function(c) {
            var ph = Array.isArray(c.PhoneNumber) ? c.PhoneNumber[0] || "" : c.PhoneNumber || "";
            return { name: "", phone: ph, preview: c.LatestContent || "", source: "sms" };
          });
        }).catch(function() {
          return [];
        })
      ]).then(function(results) {
        var simContacts = results[0];
        var smsContacts = results[1];
        var seen = {};
        var all = [];
        simContacts.forEach(function(c) {
          if (!c.phone) return;
          var key2 = c.phone.replace(/[\s\-()]/g, "").toLowerCase();
          if (!seen[key2]) {
            seen[key2] = true;
            all.push(c);
          }
        });
        smsContacts.forEach(function(c) {
          if (!c.phone) return;
          var key2 = c.phone.replace(/[\s\-()]/g, "").toLowerCase();
          if (!seen[key2]) {
            seen[key2] = true;
            all.push(c);
          }
        });
        if (all.length === 0) {
          el.innerHTML = '<p class="text-muted" style="text-align:center;padding:1rem 0">No contacts. Type a number above.</p>';
          return;
        }
        var html = '<div class="chat-list">';
        all.forEach(function(c) {
          var displayName = c.name || c.phone;
          var subtitle = c.name ? c.phone : (c.preview || "").substring(0, 50);
          var letter = _avatarLetters(displayName);
          var searchStr = escHtml((c.name + " " + c.phone).trim());
          html += '<div class="chat-item" ' + actionAttr("selectComposeRecipient", [c.phone, displayName]) + ' data-search="' + searchStr + '"><div class="chat-avatar">' + escHtml(letter) + '</div><div class="chat-item-body"><div class="chat-item-top"><span class="chat-item-name">' + escHtml(displayName) + "</span>" + (c.source === "sim" ? '<span class="chat-item-time">SIM</span>' : "") + "</div>" + (subtitle ? '<div class="chat-item-bottom"><span class="chat-item-preview">' + escHtml(subtitle) + "</span></div>" : "") + "</div></div>";
        });
        html += "</div>";
        el.innerHTML = html;
      });
    }
    function _selectComposeRecipient(phone, name) {
      var toInput = document.getElementById("sms-to");
      var editor = document.getElementById("compose-editor");
      var contacts = document.getElementById("compose-contacts");
      var disp = document.getElementById("compose-recipient-display");
      if (toInput) toInput.value = phone;
      if (disp) disp.textContent = name && name !== phone ? name + " (" + phone + ")" : phone;
      if (editor) editor.classList.remove("hidden");
      if (contacts) contacts.classList.add("hidden");
      var textArea = document.getElementById("sms-text");
      if (textArea) {
        if (!textArea._bound) {
          textArea._bound = true;
          textArea.addEventListener("input", _smsCharCount);
        }
        textArea.focus();
      }
    }
    function _smsCharCount() {
      var text = document.getElementById("sms-text");
      if (!text) return;
      var len = text.value.length;
      var parts = len <= 160 ? 1 : Math.ceil(len / 153);
      var el = document.getElementById("sms-char-count");
      if (el) el.textContent = len + " / " + (parts === 1 ? 160 : 153 * parts);
      var elP = document.getElementById("sms-parts");
      if (elP) elP.textContent = parts + " part" + (parts > 1 ? "s" : "");
    }
    function _smsTimestamp() {
      var d = /* @__PURE__ */ new Date();
      var pad = function(n) {
        return n < 10 ? "0" + n : "" + n;
      };
      return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    }
    function _retryOpenThread(phone, attempts, delay) {
      var el = document.getElementById("sms-inbox");
      if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading thread...</div>';
      return API.webapi("GetSMSContentList", {
        ContactId: 0,
        Page: 0,
        PhoneNumber: phone
      }).then(function() {
        return _openSmsThread(phone);
      }).catch(function(e) {
        if (attempts <= 1) {
          if (el) el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(e.message) + "</p></div>";
          return;
        }
        return new Promise(function(r) {
          setTimeout(r, delay);
        }).then(function() {
          return _retryOpenThread(phone, attempts - 1, delay);
        });
      });
    }
    function _pollSendResult(maxAttempts) {
      var attempts = 0;
      var limit = maxAttempts || 10;
      return new Promise(function(resolve, reject) {
        var timer = setInterval(function() {
          attempts++;
          API.webapi("GetSendSMSResult").then(function(r) {
            var st = parseInt(r.SendStatus, 10);
            if (st === 2) {
              clearInterval(timer);
              resolve();
            } else if (st === 1 || st === 3) {
            } else if (attempts >= limit) {
              clearInterval(timer);
              reject(new Error("Send timed out (status " + st + ")"));
            } else {
              clearInterval(timer);
              reject(new Error("Send failed (status " + st + ")"));
            }
          }).catch(function(e) {
            clearInterval(timer);
            reject(e);
          });
        }, 3e3);
      });
    }
    function _clearSendStatus(bar) {
      if (!bar) return;
      var el = bar.previousElementSibling;
      if (el && el.classList.contains("chat-send-status")) el.remove();
    }
    function _showSendStatus(bar, msg, isError) {
      if (!bar) return;
      _clearSendStatus(bar);
      var div = document.createElement("div");
      div.className = "chat-send-status" + (isError ? " error" : "");
      div.textContent = msg;
      bar.parentNode.insertBefore(div, bar);
      if (isError) setTimeout(function() {
        div.remove();
      }, 8e3);
    }
    function _sendSms(phone) {
      var textEl = document.getElementById("sms-reply-text");
      if (!textEl || !textEl.value.trim()) return;
      var bar = document.querySelector(".chat-input-bar");
      var btn = document.querySelector(".chat-send-btn");
      if (btn) {
        btn.disabled = true;
        btn.classList.add("sending");
      }
      if (textEl) textEl.disabled = true;
      _clearSendStatus(bar);
      API.webapi("SendSMS", {
        SMSId: -1,
        PhoneNumber: phone,
        SMSContent: textEl.value.trim(),
        SMSTime: _smsTimestamp()
      }).then(function() {
        return _pollSendResult(10);
      }).then(function() {
        textEl.value = "";
        textEl.dispatchEvent(new Event("input"));
        if (btn) {
          btn.disabled = false;
          btn.classList.remove("sending");
        }
        if (textEl) textEl.disabled = false;
        btn = null;
        textEl = null;
        return new Promise(function(r) {
          setTimeout(r, 5e3);
        });
      }).then(function() {
        return _retryOpenThread(phone, 3, 3e3);
      }).catch(function(e) {
        if (bar) {
          var msg = e.apiMessage || e.message || "Send failed";
          if (e.code) msg += " [" + e.code + "]";
          _showSendStatus(bar, msg, true);
        }
      }).then(function() {
        if (btn) {
          btn.disabled = false;
          btn.classList.remove("sending");
        }
        if (textEl) textEl.disabled = false;
      });
    }
    function _sendSmsCompose() {
      var to = document.getElementById("sms-to");
      var text = document.getElementById("sms-text");
      var status = document.getElementById("sms-send-status");
      var sendBtn = document.querySelector(".chat-send-btn");
      if (!to || !text || !to.value.trim() || !text.value.trim()) {
        if (status) status.innerHTML = '<p class="text-danger">Recipient and message required</p>';
        return;
      }
      var phone = to.value.trim();
      if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.classList.add("sending");
      }
      if (text) text.disabled = true;
      if (status) status.innerHTML = "";
      API.webapi("SendSMS", {
        SMSId: -1,
        PhoneNumber: phone,
        SMSContent: text.value.trim(),
        SMSTime: _smsTimestamp()
      }).then(function() {
        return _pollSendResult(10);
      }).then(function() {
        _smsTab("inbox");
        return new Promise(function(r) {
          setTimeout(r, 5e3);
        });
      }).then(function() {
        return _retryOpenThread(phone, 3, 3e3);
      }).catch(function(e) {
        var msg = e.apiMessage || e.message || "Send failed";
        if (e.code) msg += " [" + e.code + "]";
        if (status) status.innerHTML = '<p class="text-danger">' + escHtml(msg) + "</p>";
      }).then(function() {
        if (sendBtn) {
          sendBtn.disabled = false;
          sendBtn.classList.remove("sending");
        }
        if (text) text.disabled = false;
      });
    }
    function _deleteSingleSms(smsId, phone) {
      if (!confirm("Delete this message?")) return;
      API.webapi("DeleteSMS", { DelFlag: 0, SMSId: parseInt(smsId, 10) }).then(function() {
        _openSmsThread(phone);
      }).catch(function(e) {
        alert("Delete failed: " + (e.message || e));
      });
    }
    function _deleteSmsThread(contactId) {
      if (!confirm("Delete all messages in this thread?")) return;
      API.webapi("DeleteSMS", { DelFlag: 1, ContactId: parseInt(contactId, 10) }).then(function() {
        _loadSmsInbox();
      }).catch(function() {
        _loadSmsInbox();
      });
    }
    function _loadSmsForward() {
      var el = document.getElementById("sms-forward");
      if (!el) return;
      el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading...</div>';
      Promise.all([
        API.webapi("getSMSAutoRedirectSetting").catch(function() {
          return {};
        }),
        API.cgiGet("sms_fwd.cgi", { action: "status" }).catch(function() {
          return {};
        })
      ]).then(function(results) {
        var redirect = results[0];
        var conf = results[1];
        var phoneEnabled = parseInt(redirect.redirect_flag, 10) === 1;
        var phoneTarget = redirect.redirect_number || "";
        el.innerHTML = '<div class="card"><h3>Phone Redirect</h3><p class="text-muted text-small">Built-in modem feature \u2014 forwards incoming SMS to another number</p><label><input type="checkbox" id="fwd-phone-enabled"' + (phoneEnabled ? " checked" : "") + '> Enable SMS redirect</label><label>Target Number</label><input type="tel" id="fwd-phone-target" value="' + escHtml(phoneTarget) + '" placeholder="+1234567890"><button ' + actionAttr("savePhoneRedirect") + ' style="margin-top:0.5rem">Save</button><div id="fwd-phone-status"></div></div><div class="card"><h3>Telegram Forwarding</h3><label><input type="checkbox" id="fwd-tg-enabled"' + (conf.telegram_enabled ? " checked" : "") + "> Enable Telegram forwarding</label><label>Bot Token " + (conf.has_token ? '<span class="text-muted text-small">(configured: ' + escHtml(conf.telegram_bot_token) + ")</span>" : "") + '</label><input type="text" id="fwd-tg-token" value="" placeholder="' + (conf.has_token ? "Enter new token to change" : "123456:ABC-DEF1234...") + '"><div class="flex-center" style="gap:0.5rem;margin:0.5rem 0"><button class="btn-small" ' + actionAttr("smsBotInfo") + '>Bot Info</button><button class="btn-small" ' + actionAttr("smsRecentChats") + '>Recent Chats</button></div><div id="fwd-bot-info"></div><label>Chat ID</label><input type="text" id="fwd-tg-chatid" value="' + escHtml(conf.telegram_chat_id || "") + '" placeholder="-1001234567890"><div id="fwd-chat-list"></div><button class="btn-small" ' + actionAttr("smsTestTelegram") + ' style="margin-top:0.5rem">Send Test Message</button><div id="fwd-test-result"></div></div><div class="card"><h3>Daemon Options</h3><label>Filter Numbers (comma-separated, empty = all)</label><input type="text" id="fwd-filter" value="' + escHtml(conf.filter_numbers || "") + '" placeholder="+1234567890,+0987654321"><div class="stat-row"><span class="label">Detection</span><span class="value">Event-driven (inotify)</span></div><div class="stat-row"><span class="label">Daemon Status</span><span class="value ' + (conf.running ? "text-success" : "text-danger") + '">' + (conf.running ? "Running" : "Stopped") + "</span></div><button " + actionAttr("saveTelegramForward") + '>Save Telegram Config</button><div id="fwd-save-status"></div></div>';
      }).catch(function(e) {
        el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(e.message) + "</p></div>";
      });
    }
    function _savePhoneRedirect() {
      var status = document.getElementById("fwd-phone-status");
      if (status) status.innerHTML = '<div class="page-loading"><div class="spinner"></div> Saving...</div>';
      var enabled = document.getElementById("fwd-phone-enabled").checked;
      var target = (document.getElementById("fwd-phone-target").value || "").trim();
      if (enabled && !target) {
        if (status) status.innerHTML = '<p class="text-danger">Target number is required</p>';
        return;
      }
      API.webapi("setSMSAutoRedirectSetting", {
        redirect_flag: enabled ? 1 : 0,
        redirect_number: target,
        SMSTime: _smsTimestamp()
      }).then(function() {
        if (status) status.innerHTML = '<p class="text-success">Phone redirect ' + (enabled ? "enabled" : "disabled") + "</p>";
      }).catch(function(e) {
        if (status) status.innerHTML = '<p class="text-danger">Error: ' + escHtml(e.message) + "</p>";
      });
    }
    function _saveTelegramForward() {
      var status = document.getElementById("fwd-save-status");
      if (status) status.innerHTML = '<div class="page-loading"><div class="spinner"></div> Saving...</div>';
      var data = {
        action: "save",
        telegram_enabled: document.getElementById("fwd-tg-enabled").checked ? 1 : 0,
        telegram_bot_token: document.getElementById("fwd-tg-token").value.trim(),
        telegram_chat_id: document.getElementById("fwd-tg-chatid").value.trim(),
        phone_enabled: 0,
        phone_target: "",
        filter_numbers: document.getElementById("fwd-filter").value.trim()
      };
      API.cgiPost("sms_fwd.cgi", data).then(function(result) {
        if (result.ok) {
          if (status) status.innerHTML = '<p class="text-success">Telegram config saved</p>';
        } else {
          if (status) status.innerHTML = '<p class="text-danger">Error: ' + escHtml(result.error || "Unknown") + "</p>";
        }
      }).catch(function(e) {
        if (status) status.innerHTML = '<p class="text-danger">Error: ' + escHtml(e.message) + "</p>";
      });
    }
    function _smsTestTelegram() {
      var status = document.getElementById("fwd-test-result");
      if (status) status.innerHTML = '<div class="page-loading"><div class="spinner"></div> Sending test...</div>';
      var data = {
        action: "test_telegram",
        telegram_bot_token: document.getElementById("fwd-tg-token").value.trim(),
        telegram_chat_id: document.getElementById("fwd-tg-chatid").value.trim()
      };
      API.cgiPost("sms_fwd.cgi", data).then(function(result) {
        if (result.ok) {
          if (status) status.innerHTML = '<p class="text-success">' + escHtml(result.message) + "</p>";
        } else {
          if (status) status.innerHTML = '<p class="text-danger">' + escHtml(result.error || "Failed") + "</p>";
        }
      }).catch(function(e) {
        if (status) status.innerHTML = '<p class="text-danger">Error: ' + escHtml(e.message) + "</p>";
      });
    }
    function _smsBotInfo() {
      var el = document.getElementById("fwd-bot-info");
      if (!el) return;
      el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
      API.cgiGet("sms_fwd.cgi", { action: "bot_info" }).then(function(result) {
        if (result.ok) {
          el.innerHTML = '<div class="stat-row"><span class="label">Bot</span><span class="value">@' + escHtml(result.username) + " (" + escHtml(result.first_name) + ')</span></div><div class="stat-row"><span class="label">Link</span><span class="value"><a href="' + escHtml(result.link) + '" target="_blank">' + escHtml(result.link) + "</a></span></div>";
        } else {
          el.innerHTML = '<p class="text-danger">' + escHtml(result.error || "Failed") + "</p>";
        }
      }).catch(function(e) {
        el.innerHTML = '<p class="text-danger">Error: ' + escHtml(e.message) + "</p>";
      });
    }
    function _smsRecentChats() {
      var el = document.getElementById("fwd-chat-list");
      if (!el) return;
      el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
      API.cgiGet("sms_fwd.cgi", { action: "recent_chats" }).then(function(result) {
        if (result.ok && result.chats) {
          if (result.chats.length === 0) {
            el.innerHTML = '<p class="text-muted">No recent chats. Send a message to the bot first.</p>';
          } else {
            var html = '<table class="data-table"><thead><tr><th>Chat ID</th><th>Name</th><th>Type</th><th></th></tr></thead><tbody>';
            result.chats.forEach(function(c) {
              html += '<tr><td class="text-mono">' + escHtml(c.id) + "</td><td>" + escHtml(c.title) + "</td><td>" + escHtml(c.type) + '</td><td><button class="btn-small" ' + actionAttr("smsSetChatId", [c.id]) + ">Use</button></td></tr>";
            });
            html += "</tbody></table>";
            el.innerHTML = html;
          }
        } else {
          el.innerHTML = '<p class="text-danger">' + escHtml(result.error || "Failed") + "</p>";
        }
      }).catch(function(e) {
        el.innerHTML = '<p class="text-danger">Error: ' + escHtml(e.message) + "</p>";
      });
    }
    function _smsSetChatId(id) {
      var el = document.getElementById("fwd-tg-chatid");
      if (el) el.value = id;
    }
    App.registerPage("sms", renderSms);
    App._smsTab = _smsTab;
    App._openSmsThread = _openSmsThread;
    App._deleteSmsThread = _deleteSmsThread;
    App._deleteSingleSms = _deleteSingleSms;
    App._sendSms = _sendSms;
    App._sendSmsCompose = _sendSmsCompose;
    App._selectComposeRecipient = _selectComposeRecipient;
    App._smsCharCount = _smsCharCount;
    App._savePhoneRedirect = _savePhoneRedirect;
    App._saveTelegramForward = _saveTelegramForward;
    App._smsTestTelegram = _smsTestTelegram;
    App._smsBotInfo = _smsBotInfo;
    App._smsRecentChats = _smsRecentChats;
    App._smsSetChatId = _smsSetChatId;
  })();

  // js/pages/vpn.js
  (function() {
    "use strict";
    var icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;
    var formatBytes = App.formatBytes;
    var _wgStatus = null;
    var _awgStatus = null;
    var _ssStatus = null;
    var _vpnTimer = null;
    function renderVpn(container) {
      container.innerHTML = '<h2>VPN</h2><div id="vpn-wg" class="vpn-card"></div><div id="vpn-awg" class="vpn-card"></div><div id="vpn-ss" class="vpn-card"></div>';
      _loadAll();
      _vpnTimer = setInterval(_refreshVpn, 3e3);
      App.setCleanup(function() {
        if (_vpnTimer) {
          clearInterval(_vpnTimer);
          _vpnTimer = null;
        }
      });
    }
    function _loadAll() {
      _loadWg();
      _loadAwg();
      _loadSs();
    }
    function _reorderVpn() {
      var active = null;
      if (_wgStatus && _wgStatus.up) active = "vpn-wg";
      else if (_awgStatus && _awgStatus.up) active = "vpn-awg";
      else if (_ssStatus && _ssStatus.running) active = "vpn-ss";
      if (!active) return;
      var el = document.getElementById(active);
      if (!el || !el.parentNode) return;
      var h2 = el.parentNode.querySelector("h2");
      var ref = h2 ? h2.nextSibling : el.parentNode.firstChild;
      if (el === ref) return;
      var cards = el.parentNode.querySelectorAll(".vpn-card");
      var firstRects = {};
      for (var i = 0; i < cards.length; i++)
        firstRects[cards[i].id] = cards[i].getBoundingClientRect();
      el.parentNode.insertBefore(el, ref);
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var first = firstRects[card.id];
        if (!first) continue;
        var last = card.getBoundingClientRect();
        var dy = first.top - last.top;
        if (Math.abs(dy) < 1) continue;
        card.style.transform = "translateY(" + dy + "px)";
        card.style.transition = "none";
        card.offsetHeight;
        card.style.transition = "transform 0.3s ease";
        card.style.transform = "";
      }
    }
    function _refreshVpn() {
      if (document.getElementById("vpn-wg")) {
        API.cgiGet("wireguard.cgi", { action: "status" }).then(function(status) {
          _wgStatus = status;
          var el = document.getElementById("vpn-wg");
          if (el) _renderWg(el, status);
          _reorderVpn();
        }).catch(function() {
        });
      }
      if (document.getElementById("vpn-awg")) {
        API.cgiGet("amneziawg.cgi", { action: "status" }).then(function(status) {
          _awgStatus = status;
          var el = document.getElementById("vpn-awg");
          if (el) _renderAwg(el, status);
          _reorderVpn();
        }).catch(function() {
        });
      }
      if (document.getElementById("vpn-ss")) {
        API.cgiGet("shadowsocks.cgi", { action: "status" }).then(function(status) {
          _ssStatus = status;
          var el = document.getElementById("vpn-ss");
          if (el) _renderSs(el, status);
          _reorderVpn();
        }).catch(function() {
        });
      }
    }
    function _loadWg() {
      var el = document.getElementById("vpn-wg");
      if (!el) return;
      el.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading WireGuard...</div></div>';
      API.cgiGet("wireguard.cgi", { action: "status" }).then(function(status) {
        _wgStatus = status;
        _renderWg(el, status);
        _reorderVpn();
      }).catch(function(e) {
        el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(e.message) + "</p></div>";
      });
    }
    function _renderWg(el, status) {
      var up = status.up;
      var switchDisabled = !status.has_wg ? " disabled" : "";
      var html = '<div class="card">';
      html += '<div class="card-header">';
      html += "<h3>" + icon("ic-vpn") + " WireGuard</h3>";
      html += '<label class="switch"><input type="checkbox" id="wg-toggle"' + (up ? " checked" : "") + switchDisabled + '><span class="slider"></span></label>';
      html += "</div>";
      var peer = status.peers && status.peers.length > 0 ? status.peers[0] : null;
      var hasPeerHandshake = peer && peer.latest_handshake && peer.latest_handshake !== "never" && peer.latest_handshake !== "";
      if (up) {
        if (hasPeerHandshake) {
          html += '<div class="vpn-status"><span class="status-dot on"></span><span class="text-success">Connected</span></div>';
        } else if (peer) {
          html += '<div class="vpn-status"><span class="status-dot orange"></span><span class="text-warn">Interface Up</span> <span class="text-muted text-small">\u2022 awaiting handshake</span></div>';
        } else {
          html += '<div class="vpn-status"><span class="status-dot orange"></span><span class="text-warn">Interface Up</span> <span class="text-muted text-small">\u2022 no peers</span></div>';
        }
        html += '<div class="vpn-info">';
        if (status.address) html += '<div class="stat-row"><span class="label">Address</span><span class="value text-mono">' + escHtml(status.address) + "</span></div>";
        if (status.interface && status.interface.listen_port && status.interface.listen_port !== "0") {
          html += '<div class="stat-row"><span class="label">Listen Port</span><span class="value">' + escHtml(status.interface.listen_port) + "</span></div>";
        }
        if (status.interface && status.interface.public_key && status.interface.public_key !== "(none)") {
          html += '<div class="stat-row"><span class="label">Public Key</span><span class="value text-mono text-small">' + escHtml(status.interface.public_key) + "</span></div>";
        }
        html += "</div>";
        if (peer) {
          html += '<div class="vpn-peer-block">';
          html += '<div class="vpn-peer-title">Peer</div>';
          html += '<div class="vpn-info">';
          if (peer.endpoint && peer.endpoint !== "(none)") {
            html += '<div class="stat-row"><span class="label">Endpoint</span><span class="value text-mono">' + escHtml(peer.endpoint) + "</span></div>";
          }
          if (peer.allowed_ips) {
            html += '<div class="stat-row"><span class="label">Allowed IPs</span><span class="value text-mono">' + escHtml(peer.allowed_ips) + "</span></div>";
          }
          html += '<div class="stat-row"><span class="label">Handshake</span><span class="value">' + (hasPeerHandshake ? escHtml(peer.latest_handshake) : '<span class="text-muted">never</span>') + "</span></div>";
          html += '<div class="stat-row"><span class="label">Transfer</span><span class="value">\u2193 ' + formatBytes(peer.transfer_rx) + " \u2191 " + formatBytes(peer.transfer_tx) + "</span></div>";
          if (peer.persistent_keepalive && peer.persistent_keepalive !== "off" && peer.persistent_keepalive !== "0") {
            html += '<div class="stat-row"><span class="label">Keepalive</span><span class="value">' + escHtml(peer.persistent_keepalive) + "s</span></div>";
          }
          html += "</div></div>";
        }
      } else if (status.has_config) {
        html += '<div class="vpn-status"><span class="status-dot off"></span><span class="text-muted">Disconnected</span></div>';
        if (status.endpoint) {
          html += '<div class="vpn-endpoint">' + escHtml(status.endpoint) + "</div>";
        }
      } else {
        html += '<div class="text-muted">No configuration. Import a config to get started.</div>';
      }
      html += '<div class="vpn-buttons">';
      html += '<button class="btn-outline" ' + actionAttr("wgEditModal") + ">Edit Config</button>";
      html += "</div>";
      html += '<div id="wg-action-status"></div>';
      html += "</div>";
      el.innerHTML = html;
      var wgToggle = document.getElementById("wg-toggle");
      if (wgToggle) {
        wgToggle.addEventListener("change", function() {
          if (this.checked) _wgEnable();
          else _wgDisable();
        });
      }
    }
    function _wgEnable() {
      var st = document.getElementById("wg-action-status");
      if (st) st.innerHTML = '<div class="page-loading"><div class="spinner"></div> Enabling...</div>';
      API.cgiPost("wireguard.cgi", { action: "enable" }).then(function(r) {
        if (r.ok) {
          _loadAll();
        } else {
          _wgError(r.error);
        }
      }).catch(function(e) {
        _wgError(e.message);
      });
    }
    function _wgDisable() {
      var st = document.getElementById("wg-action-status");
      if (st) st.innerHTML = '<div class="page-loading"><div class="spinner"></div> Disabling...</div>';
      API.cgiPost("wireguard.cgi", { action: "disable" }).then(function(r) {
        if (r.ok) {
          _loadAll();
        } else {
          _wgError(r.error);
        }
      }).catch(function(e) {
        _wgError(e.message);
      });
    }
    function _wgError(msg) {
      var st = document.getElementById("wg-action-status");
      if (st) st.innerHTML = '<p class="text-danger">' + escHtml(msg) + "</p>";
      setTimeout(_loadWg, 1500);
    }
    function _showPanel(title, contentHTML) {
      _vpnCloseModal();
      var overlay = document.createElement("div");
      overlay.id = "rule-panel-overlay";
      overlay.className = "rule-panel-overlay";
      overlay.innerHTML = '<div class="rule-panel"><h3>' + escHtml(title) + '<button class="close-btn" id="vpn-panel-close">\xD7</button></h3>' + contentHTML + "</div>";
      document.body.appendChild(overlay);
      overlay.addEventListener("click", function(e) {
        if (e.target === overlay) _vpnCloseModal();
      });
      document.getElementById("vpn-panel-close").addEventListener("click", _vpnCloseModal);
    }
    function _wgImportModal() {
      var html = '<textarea id="wg-import-text" rows="14" class="text-mono text-small" placeholder="[Interface]\nPrivateKey = ...\nAddress = 10.0.0.2/24\nDNS = 1.1.1.1\n\n[Peer]\nPublicKey = ...\nEndpoint = vpn.example.com:51820\nAllowedIPs = 0.0.0.0/0\nPersistentKeepalive = 25"></textarea>';
      html += '<div id="wg-import-status"></div>';
      html += '<div class="form-actions">';
      html += '<button id="vpn-panel-save">Save & Apply</button>';
      html += '<button class="btn-outline" id="vpn-panel-genkey">Generate Keys</button>';
      html += "</div>";
      html += '<div id="wg-keygen"></div>';
      _showPanel("Import WireGuard Config", html);
      document.getElementById("vpn-panel-save").addEventListener("click", _wgSaveImport);
      document.getElementById("vpn-panel-genkey").addEventListener("click", _wgGenKey);
    }
    function _wgEditModal() {
      var html = '<div id="wg-edit-loading"><div class="page-loading"><div class="spinner"></div> Loading config...</div></div>';
      html += '<textarea id="wg-edit-text" rows="14" class="text-mono text-small" style="display:none"></textarea>';
      html += '<div id="wg-edit-status"></div>';
      html += '<div class="form-actions">';
      html += '<button id="vpn-panel-save">Save & Apply</button>';
      html += '<button class="btn-outline" id="vpn-panel-cancel">Cancel</button>';
      html += "</div>";
      _showPanel("Edit WireGuard Config", html);
      document.getElementById("vpn-panel-save").addEventListener("click", _wgSaveEdit);
      document.getElementById("vpn-panel-cancel").addEventListener("click", _vpnCloseModal);
      API.cgiGet("wireguard.cgi", { action: "config" }).then(function(r) {
        var loading = document.getElementById("wg-edit-loading");
        var textarea = document.getElementById("wg-edit-text");
        if (loading) loading.style.display = "none";
        if (textarea) {
          textarea.value = r.config || "";
          textarea.style.display = "";
        }
      }).catch(function(e) {
        var loading = document.getElementById("wg-edit-loading");
        if (loading) loading.innerHTML = '<p class="text-danger">' + escHtml(e.message) + "</p>";
      });
    }
    function _wgSaveConfig(textareaId, statusId) {
      var textarea = document.getElementById(textareaId);
      var st = document.getElementById(statusId);
      if (!textarea || !textarea.value.trim()) {
        if (st) st.innerHTML = '<p class="text-danger">Config is empty</p>';
        return;
      }
      if (st) st.innerHTML = '<div class="page-loading"><div class="spinner"></div> Saving...</div>';
      API.cgiPost("wireguard.cgi", { action: "save", config: textarea.value }).then(function(r) {
        if (r.ok) {
          _vpnCloseModal();
          _loadWg();
        } else {
          if (st) st.innerHTML = '<p class="text-danger">' + escHtml(r.error) + "</p>";
        }
      }).catch(function(e) {
        if (st) st.innerHTML = '<p class="text-danger">' + escHtml(e.message) + "</p>";
      });
    }
    function _wgSaveImport() {
      _wgSaveConfig("wg-import-text", "wg-import-status");
    }
    function _wgSaveEdit() {
      _wgSaveConfig("wg-edit-text", "wg-edit-status");
    }
    function _wgGenKey() {
      var el = document.getElementById("wg-keygen");
      if (!el) return;
      el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
      API.cgiPost("wireguard.cgi", { action: "generate_key" }).then(function(r) {
        if (r.private_key) {
          el.innerHTML = '<div style="margin-top:0.5rem;padding:0.5rem;background:var(--bg-surface-secondary);border-radius:8px;font-size:0.78rem"><div><strong>Private:</strong> <span class="text-mono">' + escHtml(r.private_key) + '</span></div><div><strong>Public:</strong> <span class="text-mono">' + escHtml(r.public_key) + '</span></div><p class="text-muted" style="margin:0.25rem 0 0;font-size:0.75rem">Copy private key into [Interface] PrivateKey. Share public key with peer.</p></div>';
        } else {
          el.innerHTML = '<p class="text-danger">' + escHtml(r.error || "Failed") + "</p>";
        }
      }).catch(function(e) {
        el.innerHTML = '<p class="text-danger">' + escHtml(e.message) + "</p>";
      });
    }
    function _loadAwg() {
      var el = document.getElementById("vpn-awg");
      if (!el) return;
      el.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading AmneziaWG...</div></div>';
      API.cgiGet("amneziawg.cgi", { action: "status" }).then(function(status) {
        _awgStatus = status;
        _renderAwg(el, status);
        _reorderVpn();
      }).catch(function(e) {
        el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(e.message) + "</p></div>";
      });
    }
    function _renderAwg(el, status) {
      var up = status.up;
      var switchDisabled = !status.has_awg ? " disabled" : "";
      var html = '<div class="card">';
      html += '<div class="card-header">';
      html += "<h3>" + icon("ic-vpn") + " AmneziaWG</h3>";
      html += '<label class="switch"><input type="checkbox" id="awg-toggle"' + (up ? " checked" : "") + switchDisabled + '><span class="slider"></span></label>';
      html += "</div>";
      var peer = status.peers && status.peers.length > 0 ? status.peers[0] : null;
      var hasPeerHandshake = peer && peer.latest_handshake && peer.latest_handshake !== "never" && peer.latest_handshake !== "";
      if (up) {
        if (hasPeerHandshake) {
          html += '<div class="vpn-status"><span class="status-dot on"></span><span class="text-success">Connected</span></div>';
        } else if (peer) {
          html += '<div class="vpn-status"><span class="status-dot orange"></span><span class="text-warn">Interface Up</span> <span class="text-muted text-small">\u2022 awaiting handshake</span></div>';
        } else {
          html += '<div class="vpn-status"><span class="status-dot orange"></span><span class="text-warn">Interface Up</span> <span class="text-muted text-small">\u2022 no peers</span></div>';
        }
        html += '<div class="vpn-info">';
        if (status.address) html += '<div class="stat-row"><span class="label">Address</span><span class="value text-mono">' + escHtml(status.address) + "</span></div>";
        if (status.interface && status.interface.listen_port && status.interface.listen_port !== "0") {
          html += '<div class="stat-row"><span class="label">Listen Port</span><span class="value">' + escHtml(status.interface.listen_port) + "</span></div>";
        }
        if (status.interface && status.interface.public_key && status.interface.public_key !== "(none)") {
          html += '<div class="stat-row"><span class="label">Public Key</span><span class="value text-mono text-small">' + escHtml(status.interface.public_key) + "</span></div>";
        }
        html += "</div>";
        if (peer) {
          html += '<div class="vpn-peer-block">';
          html += '<div class="vpn-peer-title">Peer</div>';
          html += '<div class="vpn-info">';
          if (peer.endpoint && peer.endpoint !== "(none)") {
            html += '<div class="stat-row"><span class="label">Endpoint</span><span class="value text-mono">' + escHtml(peer.endpoint) + "</span></div>";
          }
          if (peer.allowed_ips) {
            html += '<div class="stat-row"><span class="label">Allowed IPs</span><span class="value text-mono">' + escHtml(peer.allowed_ips) + "</span></div>";
          }
          html += '<div class="stat-row"><span class="label">Handshake</span><span class="value">' + (hasPeerHandshake ? escHtml(peer.latest_handshake) : '<span class="text-muted">never</span>') + "</span></div>";
          html += '<div class="stat-row"><span class="label">Transfer</span><span class="value">\u2193 ' + formatBytes(peer.transfer_rx) + " \u2191 " + formatBytes(peer.transfer_tx) + "</span></div>";
          if (peer.persistent_keepalive && peer.persistent_keepalive !== "off" && peer.persistent_keepalive !== "0") {
            html += '<div class="stat-row"><span class="label">Keepalive</span><span class="value">' + escHtml(peer.persistent_keepalive) + "s</span></div>";
          }
          html += "</div></div>";
        }
      } else if (status.has_config) {
        html += '<div class="vpn-status"><span class="status-dot off"></span><span class="text-muted">Disconnected</span></div>';
        if (status.endpoint) {
          html += '<div class="vpn-endpoint">' + escHtml(status.endpoint) + "</div>";
        }
      } else {
        html += '<div class="text-muted">No configuration. Import a config to get started.</div>';
      }
      html += '<div class="vpn-buttons">';
      html += '<button class="btn-outline" ' + actionAttr("awgEditModal") + ">Edit Config</button>";
      html += "</div>";
      html += '<div id="awg-action-status"></div>';
      html += "</div>";
      el.innerHTML = html;
      var awgToggle = document.getElementById("awg-toggle");
      if (awgToggle) {
        awgToggle.addEventListener("change", function() {
          if (this.checked) _awgEnable();
          else _awgDisable();
        });
      }
    }
    function _awgEnable() {
      var st = document.getElementById("awg-action-status");
      if (st) st.innerHTML = '<div class="page-loading"><div class="spinner"></div> Enabling...</div>';
      API.cgiPost("amneziawg.cgi", { action: "enable" }).then(function(r) {
        if (r.ok) {
          _loadAll();
        } else {
          _awgError(r.error);
        }
      }).catch(function(e) {
        _awgError(e.message);
      });
    }
    function _awgDisable() {
      var st = document.getElementById("awg-action-status");
      if (st) st.innerHTML = '<div class="page-loading"><div class="spinner"></div> Disabling...</div>';
      API.cgiPost("amneziawg.cgi", { action: "disable" }).then(function(r) {
        if (r.ok) {
          _loadAll();
        } else {
          _awgError(r.error);
        }
      }).catch(function(e) {
        _awgError(e.message);
      });
    }
    function _awgError(msg) {
      var st = document.getElementById("awg-action-status");
      if (st) st.innerHTML = '<p class="text-danger">' + escHtml(msg) + "</p>";
      setTimeout(_loadAwg, 1500);
    }
    function _awgImportModal() {
      var html = '<textarea id="awg-import-text" rows="14" class="text-mono text-small" placeholder="[Interface]\nPrivateKey = ...\nAddress = 10.0.0.2/24\nJc = 4\nJmin = 40\nJmax = 70\nS1 = 0\nS2 = 0\nH1 = 1\nH2 = 2\nH3 = 3\nH4 = 4\n\n[Peer]\nPublicKey = ...\nEndpoint = vpn.example.com:51820\nAllowedIPs = 0.0.0.0/0\nPersistentKeepalive = 25"></textarea>';
      html += '<div id="awg-import-status"></div>';
      html += '<div class="form-actions">';
      html += '<button id="vpn-panel-save">Save & Apply</button>';
      html += '<button class="btn-outline" id="vpn-panel-genkey">Generate Keys</button>';
      html += "</div>";
      html += '<div id="awg-keygen"></div>';
      _showPanel("Import AmneziaWG Config", html);
      document.getElementById("vpn-panel-save").addEventListener("click", _awgSaveImport);
      document.getElementById("vpn-panel-genkey").addEventListener("click", _awgGenKey);
    }
    function _awgEditModal() {
      var html = '<div id="awg-edit-loading"><div class="page-loading"><div class="spinner"></div> Loading config...</div></div>';
      html += '<textarea id="awg-edit-text" rows="14" class="text-mono text-small" style="display:none"></textarea>';
      html += '<div id="awg-edit-status"></div>';
      html += '<div class="form-actions">';
      html += '<button id="vpn-panel-save">Save & Apply</button>';
      html += '<button class="btn-outline" id="vpn-panel-cancel">Cancel</button>';
      html += "</div>";
      _showPanel("Edit AmneziaWG Config", html);
      document.getElementById("vpn-panel-save").addEventListener("click", _awgSaveEdit);
      document.getElementById("vpn-panel-cancel").addEventListener("click", _vpnCloseModal);
      API.cgiGet("amneziawg.cgi", { action: "config" }).then(function(r) {
        var loading = document.getElementById("awg-edit-loading");
        var textarea = document.getElementById("awg-edit-text");
        if (loading) loading.style.display = "none";
        if (textarea) {
          textarea.value = r.config || "";
          textarea.style.display = "";
        }
      }).catch(function(e) {
        var loading = document.getElementById("awg-edit-loading");
        if (loading) loading.innerHTML = '<p class="text-danger">' + escHtml(e.message) + "</p>";
      });
    }
    function _awgSaveConfig(textareaId, statusId) {
      var textarea = document.getElementById(textareaId);
      var st = document.getElementById(statusId);
      if (!textarea || !textarea.value.trim()) {
        if (st) st.innerHTML = '<p class="text-danger">Config is empty</p>';
        return;
      }
      if (st) st.innerHTML = '<div class="page-loading"><div class="spinner"></div> Saving...</div>';
      API.cgiPost("amneziawg.cgi", { action: "save", config: textarea.value }).then(function(r) {
        if (r.ok) {
          _vpnCloseModal();
          _loadAwg();
        } else {
          if (st) st.innerHTML = '<p class="text-danger">' + escHtml(r.error) + "</p>";
        }
      }).catch(function(e) {
        if (st) st.innerHTML = '<p class="text-danger">' + escHtml(e.message) + "</p>";
      });
    }
    function _awgSaveImport() {
      _awgSaveConfig("awg-import-text", "awg-import-status");
    }
    function _awgSaveEdit() {
      _awgSaveConfig("awg-edit-text", "awg-edit-status");
    }
    function _awgGenKey() {
      var el = document.getElementById("awg-keygen");
      if (!el) return;
      el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
      API.cgiPost("amneziawg.cgi", { action: "generate_key" }).then(function(r) {
        if (r.private_key) {
          el.innerHTML = '<div style="margin-top:0.5rem;padding:0.5rem;background:var(--bg-surface-secondary);border-radius:8px;font-size:0.78rem"><div><strong>Private:</strong> <span class="text-mono">' + escHtml(r.private_key) + '</span></div><div><strong>Public:</strong> <span class="text-mono">' + escHtml(r.public_key) + '</span></div><p class="text-muted" style="margin:0.25rem 0 0;font-size:0.75rem">Copy private key into [Interface] PrivateKey. Share public key with peer.</p></div>';
        } else {
          el.innerHTML = '<p class="text-danger">' + escHtml(r.error || "Failed") + "</p>";
        }
      }).catch(function(e) {
        el.innerHTML = '<p class="text-danger">' + escHtml(e.message) + "</p>";
      });
    }
    function _loadSs() {
      var el = document.getElementById("vpn-ss");
      if (!el) return;
      el.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading ShadowSocks...</div></div>';
      API.cgiGet("shadowsocks.cgi", { action: "status" }).then(function(status) {
        _ssStatus = status;
        _renderSs(el, status);
        _reorderVpn();
      }).catch(function(e) {
        el.innerHTML = '<div class="card"><p class="text-danger">Error: ' + escHtml(e.message) + "</p></div>";
      });
    }
    function _renderSs(el, status) {
      var running = status.running;
      var switchDisabled = !status.has_bin ? " disabled" : "";
      if (!status.has_config && !running) switchDisabled = " disabled";
      var html = '<div class="card">';
      html += '<div class="card-header">';
      html += "<h3>" + icon("ic-vpn") + " ShadowSocks</h3>";
      html += '<label class="switch"><input type="checkbox" id="ss-toggle"' + (running ? " checked" : "") + switchDisabled + '><span class="slider"></span></label>';
      html += "</div>";
      if (running) {
        html += '<div class="vpn-status"><span class="status-dot on"></span><span class="text-success">Running</span>';
        if (status.name) html += ' <span class="text-muted text-small">\u2022 ' + escHtml(status.name) + "</span>";
        html += "</div>";
        if (status.server) {
          html += '<div class="vpn-endpoint">' + escHtml(status.server) + ":" + status.server_port + " \u2022 " + escHtml(status.method || "") + "</div>";
        }
      } else if (status.has_config) {
        html += '<div class="vpn-status"><span class="status-dot off"></span><span class="text-muted">Stopped</span>';
        if (status.name) html += ' <span class="text-muted text-small">\u2022 ' + escHtml(status.name) + "</span>";
        html += "</div>";
        if (status.server) {
          html += '<div class="vpn-endpoint">' + escHtml(status.server) + ":" + status.server_port + "</div>";
        }
      } else {
        html += '<div class="text-muted">Configure server to enable</div>';
      }
      html += '<div class="vpn-buttons">';
      html += '<button class="btn-outline" ' + actionAttr("ssConfigModal") + ">Configure</button>";
      html += "</div>";
      html += '<div id="ss-action-status"></div>';
      html += "</div>";
      el.innerHTML = html;
      var ssToggle = document.getElementById("ss-toggle");
      if (ssToggle) {
        ssToggle.addEventListener("change", function() {
          if (this.checked) _ssEnable();
          else _ssDisable();
        });
      }
    }
    function _ssEnable() {
      var st = document.getElementById("ss-action-status");
      if (st) st.innerHTML = '<div class="page-loading"><div class="spinner"></div> Enabling...</div>';
      API.cgiPost("shadowsocks.cgi", { action: "enable" }).then(function(r) {
        if (r.ok) {
          _loadAll();
        } else {
          _ssError(r.error);
        }
      }).catch(function(e) {
        _ssError(e.message);
      });
    }
    function _ssDisable() {
      var st = document.getElementById("ss-action-status");
      if (st) st.innerHTML = '<div class="page-loading"><div class="spinner"></div> Disabling...</div>';
      API.cgiPost("shadowsocks.cgi", { action: "disable" }).then(function(r) {
        if (r.ok) {
          _loadAll();
        } else {
          _ssError(r.error);
        }
      }).catch(function(e) {
        _ssError(e.message);
      });
    }
    function _ssError(msg) {
      var st = document.getElementById("ss-action-status");
      if (st) st.innerHTML = '<p class="text-danger">' + escHtml(msg) + "</p>";
      setTimeout(_loadSs, 1500);
    }
    function _ssConfigModal() {
      var s = _ssStatus || {};
      var methods = ["chacha20-ietf-poly1305", "aes-256-gcm", "aes-128-gcm", "aes-256-cfb", "aes-128-cfb", "chacha20-ietf", "xchacha20-ietf-poly1305"];
      var html = "<label>Name</label>";
      html += '<input type="text" id="ss-name" value="' + escHtml(s.name || "") + '" placeholder="e.g. FR VPN">';
      html += "<label>Server Address</label>";
      html += '<input type="text" id="ss-server" value="' + escHtml(s.server || "") + '" placeholder="vpn.example.com">';
      html += "<label>Port</label>";
      html += '<input type="number" id="ss-port" value="' + (s.server_port || "") + '" placeholder="8388" min="1" max="65535">';
      html += "<label>Password</label>";
      html += '<div class="pass-field"><input type="password" id="ss-password" value="" placeholder="' + (s.password ? "Enter new to change" : "Password") + '">';
      html += '<button class="pass-eye" ' + actionAttr("togglePassVis", ["ss-password"]) + ' title="Show password">' + icon("ic-eye-off") + "</button></div>";
      html += "<label>Encryption Method</label>";
      html += '<select id="ss-method">';
      methods.forEach(function(m) {
        html += '<option value="' + m + '"' + (m === s.method ? " selected" : "") + ">" + m + "</option>";
      });
      html += "</select>";
      html += '<div style="border-top:1px solid var(--border-color);margin-top:1rem;padding-top:0.75rem">';
      html += "<label>Import SS / Outline URI</label>";
      html += '<div style="display:flex;gap:8px"><input type="text" id="ss-uri" placeholder="ss://... or ssconf://..." style="flex:1;margin:0">';
      html += '<button class="btn-outline" ' + actionAttr("ssParseUri") + ' style="white-space:nowrap">Import</button></div>';
      html += '<div id="ss-import-status"></div>';
      html += "</div>";
      html += '<div id="ss-save-status"></div>';
      html += '<div class="form-actions">';
      html += '<button id="vpn-panel-save">Save</button>';
      html += '<button class="btn-outline" id="vpn-panel-cancel">Cancel</button>';
      html += "</div>";
      _showPanel("ShadowSocks Configuration", html);
      document.getElementById("vpn-panel-save").addEventListener("click", _ssSave);
      document.getElementById("vpn-panel-cancel").addEventListener("click", _vpnCloseModal);
    }
    function _ssSave() {
      var st = document.getElementById("ss-save-status");
      if (st) st.innerHTML = '<div class="page-loading"><div class="spinner"></div> Saving...</div>';
      var data = {
        action: "save",
        name: (document.getElementById("ss-name") || {}).value || "",
        server: (document.getElementById("ss-server") || {}).value || "",
        server_port: parseInt((document.getElementById("ss-port") || {}).value, 10) || 0,
        password: (document.getElementById("ss-password") || {}).value || "",
        method: (document.getElementById("ss-method") || {}).value || "chacha20-ietf-poly1305"
      };
      if (!data.server || !data.server_port) {
        if (st) st.innerHTML = '<p class="text-danger">Server and port required</p>';
        return;
      }
      API.cgiPost("shadowsocks.cgi", data).then(function(r) {
        if (r.ok) {
          _vpnCloseModal();
          _loadSs();
        } else {
          if (st) st.innerHTML = '<p class="text-danger">' + escHtml(r.error) + "</p>";
        }
      }).catch(function(e) {
        if (st) st.innerHTML = '<p class="text-danger">' + escHtml(e.message) + "</p>";
      });
    }
    function _ssParseUri() {
      var uriEl = document.getElementById("ss-uri");
      var st = document.getElementById("ss-import-status");
      if (!uriEl || !uriEl.value.trim()) {
        if (st) st.innerHTML = '<p class="text-danger">Paste an ss:// URI</p>';
        return;
      }
      if (st) st.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
      API.cgiPost("shadowsocks.cgi", { action: "parse_uri", uri: uriEl.value.trim() }).then(function(r) {
        if (r.ok) {
          var n = document.getElementById("ss-name");
          if (n && r.name) n.value = r.name;
          var s = document.getElementById("ss-server");
          if (s) s.value = r.server || "";
          var p = document.getElementById("ss-port");
          if (p) p.value = r.server_port || "";
          var pw = document.getElementById("ss-password");
          if (pw) pw.value = r.password || "";
          var m = document.getElementById("ss-method");
          if (m) m.value = r.method || "chacha20-ietf-poly1305";
          if (st) st.innerHTML = '<p class="text-success">Imported. Click Save to apply.</p>';
        } else {
          if (st) st.innerHTML = '<p class="text-danger">' + escHtml(r.error) + "</p>";
        }
      }).catch(function(e) {
        if (st) st.innerHTML = '<p class="text-danger">' + escHtml(e.message) + "</p>";
      });
    }
    function _vpnCloseModal() {
      var overlay = document.getElementById("rule-panel-overlay");
      if (overlay) overlay.remove();
    }
    App.registerPage("vpn", renderVpn);
    App._vpnCloseModal = _vpnCloseModal;
    App._wgImportModal = _wgImportModal;
    App._wgEditModal = _wgEditModal;
    App._wgSaveImport = _wgSaveImport;
    App._wgSaveEdit = _wgSaveEdit;
    App._wgGenKey = _wgGenKey;
    App._awgImportModal = _awgImportModal;
    App._awgEditModal = _awgEditModal;
    App._awgSaveImport = _awgSaveImport;
    App._awgSaveEdit = _awgSaveEdit;
    App._awgGenKey = _awgGenKey;
    App._ssConfigModal = _ssConfigModal;
    App._ssSave = _ssSave;
    App._ssParseUri = _ssParseUri;
  })();

  // js/pages/diagnostics.js
  (function() {
    "use strict";
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;
    function renderDiagnostics(container) {
      container.innerHTML = '<h2>Diagnostics</h2><div class="tabs" id="diag-tabs"><button class="active" data-tab="sysinfo">System Info</button><button data-tab="ports">Open Ports</button></div><div class="tab-content active" id="diag-tab-sysinfo"></div><div class="tab-content" id="diag-tab-ports"></div>';
      $$("#diag-tabs button").forEach(function(btn) {
        btn.addEventListener("click", function() {
          $$("#diag-tabs button").forEach(function(b) {
            b.classList.remove("active");
          });
          btn.classList.add("active");
          $$("#diag-tabs ~ .tab-content").forEach(function(tc) {
            tc.classList.remove("active");
          });
          var target = document.getElementById("diag-tab-" + btn.dataset.tab);
          if (target) target.classList.add("active");
        });
      });
      _renderSysInfo();
      _renderOpenPorts();
    }
    function _renderSysInfo() {
      var tab = $("#diag-tab-sysinfo");
      if (!tab) return;
      tab.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';
      Promise.all([
        API.webapi("GetSystemInfo").catch(function() {
          return null;
        }),
        API.cgiGet("system.cgi", { action: "memory" }).catch(function() {
          return null;
        }),
        API.cgiGet("system.cgi", { action: "cpu" }).catch(function() {
          return null;
        }),
        API.cgiGet("system.cgi", { action: "storage" }).catch(function() {
          return null;
        })
      ]).then(function(results) {
        var info = results[0] || {};
        var mem = results[1] || {};
        var cpu = results[2] || {};
        var storage = results[3] || {};
        var html = '<div class="card"><h3>Hardware &amp; Firmware</h3><div class="stat-row"><span class="label">Device Name</span><span class="value">' + escHtml(info.DeviceName || "") + '</span></div><div class="stat-row"><span class="label">Model</span><span class="value">' + escHtml(info.DeviceModel || info.ProductName || "") + '</span></div><div class="stat-row"><span class="label">IMEI</span><span class="value text-mono">' + escHtml(info.Imei || "") + '</span></div><div class="stat-row"><span class="label">Firmware</span><span class="value">' + escHtml((info.SwVersion || info.SWversion || info.FWversion || "").replace(/\n/g, "")) + '</span></div><div class="stat-row"><span class="label">Hardware Rev</span><span class="value">' + escHtml(info.HwVersion || info.HWversion || "") + '</span></div><div class="stat-row"><span class="label">Uptime</span><span class="value">' + App.formatUptime(info.UpTime || info.Uptime) + "</span></div></div>";
        if (mem.total || cpu.load) {
          html += '<div class="card mt-2"><h3>Resources</h3>';
          if (cpu.load != null) {
            html += '<div class="stat-row"><span class="label">CPU Load</span><span class="value">' + escHtml(String(cpu.load)) + "%</span></div>";
          }
          if (mem.total) {
            var memUsed = mem.total - (mem.free || 0) - (mem.buffers || 0) - (mem.cached || 0);
            var memPct = mem.total > 0 ? Math.round(memUsed / mem.total * 100) : 0;
            html += '<div class="stat-row"><span class="label">Memory</span><span class="value">' + App.formatBytes(memUsed) + " / " + App.formatBytes(mem.total) + " (" + memPct + "%)</span></div>";
          }
          if (storage.partitions) {
            var parts = storage.partitions;
            for (var i = 0; i < parts.length; i++) {
              var p = parts[i];
              html += '<div class="stat-row"><span class="label">' + escHtml(p.mount || p.name || "") + '</span><span class="value">' + App.formatBytes(p.used) + " / " + App.formatBytes(p.total) + "</span></div>";
            }
          }
          html += "</div>";
        }
        html += _buildToolsHtml();
        html += _buildSyslogHtml();
        html += _buildDmesgHtml();
        tab.innerHTML = html;
        _diagSyslog();
        _diagDmesg();
      }).catch(function() {
        tab.innerHTML = '<div class="card"><p class="text-muted">Failed to load system info</p></div>' + _buildToolsHtml() + _buildSyslogHtml() + _buildDmesgHtml();
        _diagSyslog();
        _diagDmesg();
      });
    }
    var _diagSettingsOpen = false;
    function _buildToolsHtml() {
      return '<div class="card mt-2"><h3>Network Tools</h3><div class="diag-util-row"><span class="diag-util-label">Utility</span><label class="diag-radio"><input type="radio" name="d-util" value="ping" checked data-onchange="diagUtilChange"> Ping</label><label class="diag-radio"><input type="radio" name="d-util" value="traceroute" data-onchange="diagUtilChange"> Traceroute</label><label class="diag-radio"><input type="radio" name="d-util" value="iperf3" data-onchange="diagUtilChange"> iPerf3</label></div><div class="form-group"><label for="d-host">Host address</label><input type="text" id="d-host" placeholder="8.8.8.8 or hostname" maxlength="253"></div><a href="#" class="diag-settings-link" ' + actionAttr("diagToggleSettings") + '><span id="d-settings-label">Show settings</span> <span id="d-settings-arrow">\u25BE</span></a><div id="d-settings" class="diag-settings" style="display:none"><div id="d-set-ping"><div class="form-row"><div class="form-group" style="flex:1"><label>Count</label><input type="number" id="d-ping-count" value="4" min="1" max="20"></div><div class="form-group" style="flex:2"></div></div></div><div id="d-set-trace" style="display:none"><div class="form-row"><div class="form-group" style="flex:1"><label>Max hops</label><input type="number" id="d-trace-hops" value="30" min="1" max="30"></div><div class="form-group" style="flex:2"></div></div></div><div id="d-set-iperf" style="display:none"><div class="form-row"><div class="form-group" style="flex:1"><label>Port</label><input type="number" id="d-iperf-port" value="5201" min="1" max="65535"></div><div class="form-group" style="flex:1"><label>Duration (s)</label><input type="number" id="d-iperf-dur" value="10" min="1" max="30"></div><div class="form-group" style="flex:1"><label>Protocol</label><div style="display:flex;gap:12px;padding-top:4px"><label class="diag-radio"><input type="radio" name="d-iperf-proto" value="tcp" checked> TCP</label><label class="diag-radio"><input type="radio" name="d-iperf-proto" value="udp"> UDP</label></div></div></div></div></div><pre id="d-output" class="code-block diag-output" style="display:none"></pre><button ' + actionAttr("diagRun") + ">\u25B6 Start the test</button></div>";
    }
    function _diagUtilChange() {
      var util = _getSelectedUtil();
      var host = $("#d-host");
      if (host) {
        host.placeholder = util === "iperf3" ? "iperf.example.com" : "8.8.8.8 or hostname";
      }
      var sets = { ping: $("#d-set-ping"), trace: $("#d-set-trace"), iperf: $("#d-set-iperf") };
      if (sets.ping) sets.ping.style.display = util === "ping" ? "" : "none";
      if (sets.trace) sets.trace.style.display = util === "traceroute" ? "" : "none";
      if (sets.iperf) sets.iperf.style.display = util === "iperf3" ? "" : "none";
    }
    function _diagToggleSettings() {
      _diagSettingsOpen = !_diagSettingsOpen;
      var el = $("#d-settings");
      var label = $("#d-settings-label");
      var arrow = $("#d-settings-arrow");
      if (el) el.style.display = _diagSettingsOpen ? "" : "none";
      if (label) label.textContent = _diagSettingsOpen ? "Hide settings" : "Show settings";
      if (arrow) arrow.textContent = _diagSettingsOpen ? "\u25B4" : "\u25BE";
    }
    function _getSelectedUtil() {
      var radios = document.querySelectorAll('input[name="d-util"]');
      for (var i = 0; i < radios.length; i++) {
        if (radios[i].checked) return radios[i].value;
      }
      return "ping";
    }
    function _diagRun() {
      var util = _getSelectedUtil();
      if (util === "ping") _diagPing();
      else if (util === "traceroute") _diagTrace();
      else if (util === "iperf3") _diagIperf();
    }
    function _showOutput(text) {
      var pre = $("#d-output");
      if (pre) {
        pre.style.display = "";
        pre.textContent = text;
      }
    }
    function _diagPing() {
      var target = ($("#d-host") || {}).value;
      var count = parseInt(($("#d-ping-count") || {}).value) || 4;
      if (!target) return;
      _showOutput("Running ping...");
      API.cgiPost("diag.cgi", { action: "ping", target, count }).then(function(r) {
        _showOutput(r.output || r.error || "No output");
      }).catch(function(e) {
        _showOutput("Error: " + e.message);
      });
    }
    function _diagTrace() {
      var target = ($("#d-host") || {}).value;
      var maxhops = parseInt(($("#d-trace-hops") || {}).value) || 30;
      if (!target) return;
      _showOutput("Running traceroute...");
      API.cgiPost("diag.cgi", { action: "traceroute", target, maxhops }).then(function(r) {
        _showOutput(r.output || r.error || "No output");
      }).catch(function(e) {
        _showOutput("Error: " + e.message);
      });
    }
    function _diagIperf() {
      var server = ($("#d-host") || {}).value;
      var port = parseInt(($("#d-iperf-port") || {}).value) || 5201;
      var dur = parseInt(($("#d-iperf-dur") || {}).value) || 10;
      var proto = "tcp";
      var radios = document.querySelectorAll('input[name="d-iperf-proto"]');
      for (var i = 0; i < radios.length; i++) {
        if (radios[i].checked) proto = radios[i].value;
      }
      if (!server) return;
      _showOutput("Running iperf3 (" + proto + ", " + dur + "s)...");
      API.cgiPost("diag.cgi", { action: "iperf3", server, port, duration: dur, proto }).then(function(r) {
        _showOutput(r.output || r.error || "No output");
      }).catch(function(e) {
        _showOutput("Error: " + e.message);
      });
    }
    function _buildSyslogHtml() {
      return '<div class="card mt-2"><h3>Syslog</h3><div class="form-row"><div class="form-group" style="flex:2"><input type="text" id="d-syslog-filter" placeholder="Filter (fixed string)"></div><div class="form-group" style="flex:1"><input type="number" id="d-syslog-lines" value="50" min="1" max="1000"></div><div class="form-group"><button ' + actionAttr("diagSyslog") + '>Load</button></div></div><pre id="d-syslog" class="text-small" style="max-height:500px;overflow:auto;white-space:pre-wrap">Loading...</pre></div>';
    }
    function _diagSyslog() {
      var filter = ($("#d-syslog-filter") || {}).value || "";
      var lines = parseInt(($("#d-syslog-lines") || {}).value) || 50;
      var pre = $("#d-syslog");
      if (pre) pre.textContent = "Loading...";
      var params = { action: "syslog", lines };
      if (filter) params.filter = filter;
      API.cgiGet("diag.cgi", params).then(function(r) {
        if (pre) pre.textContent = r.output || "(empty)";
      }).catch(function(e) {
        if (pre) pre.textContent = "Error: " + e.message;
      });
    }
    function _buildDmesgHtml() {
      return '<div class="card mt-2"><h3>Dmesg</h3><div class="form-row"><div class="form-group" style="flex:1"><input type="number" id="d-dmesg-lines" value="100" min="1" max="1000"></div><div class="form-group"><button ' + actionAttr("diagDmesg") + '>Load</button></div></div><pre id="d-dmesg" class="text-small" style="max-height:500px;overflow:auto;white-space:pre-wrap">Loading...</pre></div>';
    }
    function _diagDmesg() {
      var lines = parseInt(($("#d-dmesg-lines") || {}).value) || 50;
      var pre = $("#d-dmesg");
      if (pre) pre.textContent = "Loading...";
      API.cgiGet("diag.cgi", { action: "dmesg", lines }).then(function(r) {
        if (pre) pre.textContent = r.output || "(empty)";
      }).catch(function(e) {
        if (pre) pre.textContent = "Error: " + e.message;
      });
    }
    function _renderOpenPorts() {
      var tab = $("#diag-tab-ports");
      if (!tab) return;
      tab.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';
      _diagLoadPorts();
    }
    function _diagLoadPorts() {
      var tab = $("#diag-tab-ports");
      if (!tab) return;
      API.cgiGet("system.cgi", { action: "open_ports" }).then(function(data) {
        var ports = Array.isArray(data) ? data : data && data.ports ? data.ports : [];
        if (ports.length === 0) {
          tab.innerHTML = '<div class="card"><h3>Listening Ports</h3><p class="text-muted">No open ports found</p><div class="form-actions"><button ' + actionAttr("diagRefreshPorts") + ">" + icon("ic-refresh") + " Refresh</button></div></div>";
          return;
        }
        tab.innerHTML = '<div class="card"><h3>Listening Ports</h3><table class="data-table"><thead><tr><th>Proto</th><th>Address</th><th>Port</th><th>PID</th><th>Process</th></tr></thead><tbody>' + ports.map(function(p) {
          var addr = p.addr || p.address || "";
          var port = p.port || "";
          if (!addr && !port && p.local) {
            var loc = p.local;
            var li = loc.lastIndexOf(":");
            if (li > 0) {
              addr = loc.substring(0, li);
              port = loc.substring(li + 1);
            } else {
              addr = loc;
            }
          }
          return "<tr><td>" + escHtml(p.proto || "") + '</td><td class="text-mono text-small">' + escHtml(addr) + "</td><td>" + escHtml(String(port)) + "</td><td>" + escHtml(String(p.pid || "")) + "</td><td>" + escHtml(p.process || p.program || "") + "</td></tr>";
        }).join("") + '</tbody></table><div class="form-actions mt-1"><button ' + actionAttr("diagRefreshPorts") + ">" + icon("ic-refresh") + " Refresh</button></div></div>";
      }).catch(function(e) {
        tab.innerHTML = '<div class="card"><h3>Listening Ports</h3><p class="text-danger">Error: ' + escHtml(e.message) + '</p><div class="form-actions"><button ' + actionAttr("diagRefreshPorts") + ">" + icon("ic-refresh") + " Refresh</button></div></div>";
      });
    }
    function _diagRefreshPorts() {
      _diagLoadPorts();
    }
    App.registerPage("diagnostics", renderDiagnostics);
    App._diagRun = _diagRun;
    App._diagUtilChange = _diagUtilChange;
    App._diagToggleSettings = _diagToggleSettings;
    App._diagPing = _diagPing;
    App._diagTrace = _diagTrace;
    App._diagIperf = _diagIperf;
    App._diagSyslog = _diagSyslog;
    App._diagDmesg = _diagDmesg;
    App._diagRefreshPorts = _diagRefreshPorts;
  })();

  // js/pages/speedtest.js
  (function() {
    "use strict";
    var BASE_URL = "http://ee71.speedtestcustom.com:8877/cgi-bin/speedtest.cgi";
    function renderSpeedtest(container) {
      var theme = document.documentElement.getAttribute("data-theme") || "light";
      var accent = getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim();
      var url = BASE_URL + "?theme=" + encodeURIComponent(theme) + "&accent=" + encodeURIComponent(accent);
      container.innerHTML = '<h2>Speed Test</h2><div class="st-iframe-wrap"><div id="st-loading" class="page-loading"><span class="spinner"></span> Loading\u2026</div><iframe id="st-frame" class="st-iframe" src="' + url + '" allow="autoplay" allowfullscreen scrolling="no"></iframe></div>';
      var frame = document.getElementById("st-frame");
      frame.onload = function() {
        var el = document.getElementById("st-loading");
        if (el) el.style.display = "none";
      };
      App.setCleanup(function() {
        var f = document.getElementById("st-frame");
        if (f) f.src = "about:blank";
      });
    }
    App.registerPage("speedtest", renderSpeedtest);
  })();

  // js/pages/settings.js
  (function() {
    "use strict";
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;
    function renderSettings(container) {
      container.innerHTML = '<h2>Settings</h2><div class="tabs" id="set-tabs"><button class="active" data-tab="system">General</button><button data-tab="admin">Admin</button><button data-tab="sim">SIM</button><button data-tab="power">Power</button><button data-tab="usb">USB</button></div><div class="tab-content active" id="set-tab-system"></div><div class="tab-content" id="set-tab-admin"></div><div class="tab-content" id="set-tab-sim"></div><div class="tab-content" id="set-tab-power"></div><div class="tab-content" id="set-tab-usb"></div>';
      var _loadedTabs = {};
      var _tabLoaders = {
        system: _loadSystem,
        admin: _loadAdmin,
        sim: _loadSIM,
        power: _loadPower,
        usb: _loadUSB
      };
      function _activateTab(name) {
        $$("#set-tabs button").forEach(function(b) {
          b.classList.remove("active");
        });
        var btn = document.querySelector('#set-tabs button[data-tab="' + name + '"]');
        if (btn) btn.classList.add("active");
        $$("#set-tabs ~ .tab-content").forEach(function(tc) {
          tc.classList.remove("active");
        });
        var target = document.getElementById("set-tab-" + name);
        if (target) target.classList.add("active");
        if (!_loadedTabs[name] && _tabLoaders[name]) {
          _loadedTabs[name] = true;
          _tabLoaders[name]();
        }
      }
      $$("#set-tabs button").forEach(function(btn) {
        btn.addEventListener("click", function() {
          _activateTab(btn.dataset.tab);
        });
      });
      _activateTab("system");
    }
    function _loadSystem() {
      var tab = $("#set-tab-system");
      if (!tab) return;
      tab.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';
      API.webapi("GetSystemInfo").then(function(info) {
        tab.innerHTML = '<div class="card"><h3>Device</h3><div class="form-group"><label>Device Name</label><input type="text" id="s-devname" value="' + escHtml(info.DeviceName || "") + '" maxlength="32"></div><div class="stat-row"><span class="label">Firmware</span><span class="value">' + escHtml((info.SwVersion || info.SWversion || info.FWversion || "").replace(/\n/g, "")) + '</span></div><div class="form-actions"><button ' + actionAttr("setDeviceName") + '>Save Name</button></div></div><div class="card mt-2"><h3>Actions</h3><div class="form-row"><button class="btn-warn" ' + actionAttr("setReboot") + '>Reboot Device</button><button class="btn-danger" ' + actionAttr("setFactoryReset") + '>Factory Reset</button></div></div><div class="card mt-2"><h3>FOTA Update</h3><div class="stat-row"><span class="label">Current FW</span><span class="value">' + escHtml((info.SwVersion || info.SWversion || "").replace(/\n/g, "")) + "</span></div><button " + actionAttr("setCheckUpdate") + '>Check for Updates</button><div id="s-fota-result" class="mt-1"></div></div>';
      }).catch(function() {
        tab.innerHTML = '<div class="card"><p class="text-muted">Failed to load system info</p></div>';
      });
    }
    function _setDeviceName() {
      var name = ($("#s-devname") || {}).value;
      if (!name) {
        alert("Name required");
        return;
      }
      API.webapi("SetDeviceName", { DeviceName: name }).then(function() {
        alert("Device name saved.");
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _setReboot() {
      if (!confirm("Reboot the device? This will disconnect all clients.")) return;
      API.webapi("SetDeviceReboot").then(function() {
        alert("Rebooting... Please wait 30-60 seconds.");
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _setFactoryReset() {
      if (!confirm("WARNING: Factory reset will erase ALL settings and restore stock firmware defaults. Continue?")) return;
      if (!confirm("Are you sure? This cannot be undone.")) return;
      API.webapi("SetDeviceReset").then(function() {
        alert("Factory reset initiated. Device will restart.");
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _setCheckUpdate() {
      var el = $("#s-fota-result");
      if (el) el.textContent = "Checking...";
      API.webapi("SetCheckNewVersion").then(function() {
        setTimeout(function() {
          API.webapi("GetDeviceUpgradeState").then(function(r) {
            if (el) el.textContent = "State: " + (r.State || r.status || JSON.stringify(r));
          }).catch(function() {
            if (el) el.textContent = "No update available";
          });
        }, 3e3);
      }).catch(function(e) {
        if (el) el.textContent = "Error: " + e.message;
      });
    }
    function _loadAdmin() {
      var tab = $("#set-tab-admin");
      if (!tab) return;
      tab.innerHTML = '<div class="card"><h3>Change Password</h3><div class="form-group"><label>Current Password</label><div class="pass-field"><input type="password" id="s-pw-old"><button class="pass-eye" ' + actionAttr("togglePassVis", ["s-pw-old"]) + ' title="Show password">' + icon("ic-eye-off") + '</button></div></div><div class="form-group"><label>New Password</label><div class="pass-field"><input type="password" id="s-pw-new"><button class="pass-eye" ' + actionAttr("togglePassVis", ["s-pw-new"]) + ' title="Show password">' + icon("ic-eye-off") + '</button></div></div><div class="form-group"><label>Confirm New Password</label><div class="pass-field"><input type="password" id="s-pw-confirm"><button class="pass-eye" ' + actionAttr("togglePassVis", ["s-pw-confirm"]) + ' title="Show password">' + icon("ic-eye-off") + '</button></div></div><div class="form-actions"><button ' + actionAttr("setChangePassword") + ">Change Password</button></div></div>";
    }
    function _setChangePassword() {
      var oldPw = ($("#s-pw-old") || {}).value;
      var newPw = ($("#s-pw-new") || {}).value;
      var confirmPw = ($("#s-pw-confirm") || {}).value;
      if (!oldPw || !newPw) {
        alert("All fields required");
        return;
      }
      if (newPw !== confirmPw) {
        alert("Passwords do not match");
        return;
      }
      if (newPw.length < 4) {
        alert("Password too short (min 4 chars)");
        return;
      }
      API.webapi("GetDeviceSt").then(function(st) {
        var salt = st.Salt || "";
        return Promise.all([
          API._pbkdf2Sha512(oldPw, salt),
          API._pbkdf2Sha512(newPw, salt)
        ]).then(function(hashes) {
          return API.webapi("ChangePassword", {
            UserName: API._xorEncrypt("admin"),
            CurrPassword: hashes[0],
            NewPassword: hashes[1]
          });
        });
      }).then(function() {
        alert("Password changed. Please log in again.");
        App.navigate("login");
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _loadPower() {
      var tab = $("#set-tab-power");
      if (!tab) return;
      tab.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';
      API.cgiGet("power.cgi", { action: "status" }).then(function(p) {
        tab.innerHTML = '<div class="card"><h3>Power Management</h3><div class="form-group"><label><input type="checkbox" id="s-pwr-autooff"' + (p.auto_off_enable == 1 ? " checked" : "") + '> Auto power-off when idle</label></div><div class="form-group"><label>Auto-off timeout (minutes)</label><input type="number" id="s-pwr-autooff-time" value="' + Math.round((p.auto_off_time || 1800) / 60) + '" min="1" max="120"></div><div class="form-group"><label><input type="checkbox" id="s-pwr-wifioff"' + (p.wifi_off_enable == 1 ? " checked" : "") + '> WiFi off when no clients</label></div><div class="form-group"><label>WiFi-off timeout (minutes)</label><input type="number" id="s-pwr-wifioff-time" value="' + Math.round((p.wifi_off_time || 600) / 60) + '" min="1" max="120"></div><div class="form-group"><label><input type="checkbox" id="s-pwr-led"' + (p.led_off_no_client == 1 ? " checked" : "") + '> LEDs off when no clients</label></div><div class="form-actions"><button ' + actionAttr("setPowerSave") + ">Save</button></div></div>";
      }).catch(function() {
        tab.innerHTML = '<div class="card"><p class="text-muted">Failed to load power settings</p></div>';
      });
    }
    function _setPowerSave() {
      var params = {
        action: "save",
        auto_off_enable: $("#s-pwr-autooff").checked ? 1 : 0,
        auto_off_time: (parseInt($("#s-pwr-autooff-time").value) || 30) * 60,
        wifi_off_enable: $("#s-pwr-wifioff").checked ? 1 : 0,
        wifi_off_time: (parseInt($("#s-pwr-wifioff-time").value) || 10) * 60,
        led_off_no_client: $("#s-pwr-led").checked ? 1 : 0
      };
      API.cgiPost("power.cgi", params).then(function(r) {
        if (r.error) {
          alert(r.error);
          return;
        }
        alert("Power settings saved.");
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    var SIM_STATE_MAP = {
      "0": "No SIM",
      "1": "PIN required",
      "2": "PIN verified",
      "3": "PUK required",
      "4": "SIM error",
      "5": "Ready",
      "6": "SIM locked",
      "255": "Unknown"
    };
    function _loadSIM() {
      var tab = $("#set-tab-sim");
      if (!tab) return;
      tab.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';
      API.webapi("GetSimStatus").then(function(sim) {
        var simState = String(sim.SIMState || "255");
        var pinState = String(sim.PinState || "0");
        var pinEnabled = pinState === "1";
        var pinRemain = sim.PinRemainingTimes || "3";
        var pukRemain = sim.PukRemainingTimes || "10";
        var stateLabel = SIM_STATE_MAP[simState] || "State " + simState;
        var needsPin = simState === "1";
        var needsPuk = simState === "3";
        var html = '<div class="card"><h3>SIM Status</h3><div class="stat-row"><span class="label">State</span><span class="value">' + escHtml(stateLabel) + '</span></div><div class="stat-row"><span class="label">PIN Enabled</span><span class="value">' + (pinEnabled ? "Yes" : "No") + '</span></div><div class="stat-row"><span class="label">PIN Attempts</span><span class="value">' + escHtml(String(pinRemain)) + '</span></div><div class="stat-row"><span class="label">PUK Attempts</span><span class="value">' + escHtml(String(pukRemain)) + "</span></div></div>";
        if (needsPin) {
          html += '<div class="card mt-2"><h3>Unlock PIN</h3><div class="form-group"><label>PIN Code</label><input type="password" id="s-pin-code" maxlength="8" placeholder="Enter PIN"></div><div class="form-actions"><button ' + actionAttr("simUnlockPin") + ">Unlock</button></div></div>";
        }
        if (needsPuk) {
          html += '<div class="card mt-2"><h3>Unlock PUK</h3><div class="form-group"><label>PUK Code</label><input type="password" id="s-puk-code" maxlength="8" placeholder="Enter PUK"></div><div class="form-group"><label>New PIN</label><input type="password" id="s-puk-newpin" maxlength="8" placeholder="New PIN"></div><div class="form-actions"><button ' + actionAttr("simUnlockPuk") + ">Unlock</button></div></div>";
        }
        if (!needsPin && !needsPuk && simState !== "0" && simState !== "4") {
          html += '<div class="card mt-2"><h3>' + (pinEnabled ? "Disable" : "Enable") + ' PIN</h3><div class="form-group"><label>Current PIN</label><input type="password" id="s-pin-toggle" maxlength="8" placeholder="Enter current PIN"></div><div class="form-actions"><button ' + actionAttr("simTogglePin", [pinEnabled ? "0" : "1"]) + ">" + (pinEnabled ? "Disable PIN" : "Enable PIN") + "</button></div></div>";
          if (pinEnabled) {
            html += '<div class="card mt-2"><h3>Change PIN</h3><div class="form-group"><label>Current PIN</label><input type="password" id="s-pin-old" maxlength="8"></div><div class="form-group"><label>New PIN</label><input type="password" id="s-pin-new" maxlength="8"></div><div class="form-actions"><button ' + actionAttr("simChangePin") + ">Change PIN</button></div></div>";
          }
        }
        tab.innerHTML = html;
      }).catch(function() {
        tab.innerHTML = '<div class="card"><p class="text-muted">Failed to load SIM status</p></div>';
      });
    }
    function _simUnlockPin() {
      var pin = ($("#s-pin-code") || {}).value;
      if (!pin) {
        alert("Enter PIN");
        return;
      }
      API.webapi("UnlockPin", { Pin: pin, State: 1 }).then(function() {
        alert("PIN verified.");
        _loadSIM();
      }).catch(function(e) {
        alert("Error: " + e.message);
        _loadSIM();
      });
    }
    function _simUnlockPuk() {
      var puk = ($("#s-puk-code") || {}).value;
      var pin = ($("#s-puk-newpin") || {}).value;
      if (!puk || !pin) {
        alert("Enter PUK and new PIN");
        return;
      }
      API.webapi("UnlockPuk", { Puk: puk, Pin: pin }).then(function() {
        alert("PUK verified, new PIN set.");
        _loadSIM();
      }).catch(function(e) {
        alert("Error: " + e.message);
        _loadSIM();
      });
    }
    function _simTogglePin(newState) {
      var pin = ($("#s-pin-toggle") || {}).value;
      if (!pin) {
        alert("Enter current PIN");
        return;
      }
      API.webapi("ChangePinState", { Pin: pin, State: parseInt(newState, 10) }).then(function() {
        alert(newState === "1" ? "PIN enabled." : "PIN disabled.");
        _loadSIM();
      }).catch(function(e) {
        alert("Error: " + e.message);
        _loadSIM();
      });
    }
    function _simChangePin() {
      var old = ($("#s-pin-old") || {}).value;
      var nw = ($("#s-pin-new") || {}).value;
      if (!old || !nw) {
        alert("Enter current and new PIN");
        return;
      }
      if (nw.length < 4) {
        alert("PIN must be at least 4 digits");
        return;
      }
      API.webapi("ChangePinCode", { CurrentPin: old, NewPin: nw }).then(function() {
        alert("PIN changed.");
        _loadSIM();
      }).catch(function(e) {
        alert("Error: " + e.message);
        _loadSIM();
      });
    }
    var USB_FUNC_MAP = {
      0: "ADB",
      2: "ECM (QC)",
      7: "DIAG",
      9: "Serial",
      15: "RNDIS",
      16: "ECM",
      18: "Mass Storage"
    };
    var USB_SYSFS_NAMES = {
      "ffs": "ADB",
      "diag": "DIAG",
      "serial": "Serial",
      "rndis_qc": "RNDIS",
      "ecm": "ECM",
      "ecm_qc": "ECM (QC)",
      "mass_storage": "Mass Storage",
      "rmnet": "RMNET",
      "ncm": "NCM"
    };
    function _humanFuncs(funcs) {
      if (!funcs) return "";
      return funcs.split(",").map(function(f) {
        f = f.trim();
        return USB_SYSFS_NAMES[f] || f;
      }).join(", ");
    }
    function _parseActiveFuncs(slots) {
      var last = -1;
      for (var i = slots.length - 1; i >= 0; i--) {
        if (slots[i] !== 0 && slots[i] < 4294967295) {
          last = i;
          break;
        }
      }
      var active = [];
      for (var i = 0; i <= last; i++) {
        if (slots[i] < 4294967295) active.push(slots[i]);
      }
      return active;
    }
    function _funcLabel(id) {
      return USB_FUNC_MAP[id] || "func_" + id;
    }
    var USB_NET_MODES = [
      { id: 16, name: "ECM", desc: "Ethernet Control Model (macOS, Linux)" },
      { id: 15, name: "RNDIS", desc: "Remote NDIS (Windows)" },
      { id: 2, name: "ECM (QC)", desc: "Qualcomm ECM variant" }
    ];
    var USB_PRESETS = [
      { key: "adb", label: "ADB + DIAG + Serial + MS", funcs: [7, 0, 9, 18] },
      { key: "adb_only", label: "ADB + MS", funcs: [0, 18] },
      { key: "diag_only", label: "DIAG + MS (QXDM)", funcs: [7, 18] },
      { key: "stock", label: "Stock (MS only)", funcs: [18] },
      { key: "custom", label: "Custom...", funcs: [] }
    ];
    var USB_CUSTOM_FUNCS = [
      { id: 7, name: "DIAG", desc: "Qualcomm DIAG (QXDM)" },
      { id: 0, name: "ADB", desc: "Android Debug Bridge" },
      { id: 9, name: "Serial", desc: "AT command port" },
      { id: 18, name: "Mass Storage", desc: "USB mass storage" }
    ];
    function _detectPreset(extraFuncs) {
      for (var i = 0; i < USB_PRESETS.length; i++) {
        var p = USB_PRESETS[i];
        if (p.key === "custom") continue;
        if (p.funcs.length !== extraFuncs.length) continue;
        var match = true;
        for (var j = 0; j < p.funcs.length; j++) {
          if (p.funcs[j] !== extraFuncs[j]) {
            match = false;
            break;
          }
        }
        if (match) return p.key;
      }
      return "custom";
    }
    function _renderKernelEntry(osLabel, entry) {
      var pid = entry.pid;
      var pidHex = ("0000" + pid.toString(16).toUpperCase()).slice(-4);
      var active = _parseActiveFuncs(entry.funcs);
      var funcLabels = active.map(_funcLabel).join(", ");
      var idx = entry.index;
      var netMode = active.length > 0 ? active[0] : 16;
      var extra = active.slice(1);
      var preset = _detectPreset(extra);
      var netHtml = "";
      for (var i = 0; i < USB_NET_MODES.length; i++) {
        var m = USB_NET_MODES[i];
        netHtml += '<option value="' + m.id + '"' + (m.id === netMode ? " selected" : "") + ">" + escHtml(m.name) + " \u2014 " + escHtml(m.desc) + "</option>";
      }
      var presetHtml = "";
      for (var i = 0; i < USB_PRESETS.length; i++) {
        var p = USB_PRESETS[i];
        presetHtml += '<option value="' + p.key + '"' + (preset === p.key ? " selected" : "") + ">" + escHtml(p.label) + "</option>";
      }
      var customHtml = '<div id="s-usb-custom-' + idx + '" class="usb-custom-funcs"' + (preset !== "custom" ? ' style="display:none"' : "") + ">";
      for (var i = 0; i < USB_CUSTOM_FUNCS.length; i++) {
        var f = USB_CUSTOM_FUNCS[i];
        var checked = extra.indexOf(f.id) !== -1 ? " checked" : "";
        customHtml += '<label class="usb-func-check"><input type="checkbox" id="s-usb-f' + f.id + "-" + idx + '" value="' + f.id + '"' + checked + ' data-onchange="usbSelChange" data-args="[' + idx + ']"> ' + escHtml(f.name) + ' <span class="text-muted text-small">' + escHtml(f.desc) + "</span></label>";
      }
      customHtml += "</div>";
      return '<div class="card mt-2"><h3>' + escHtml(osLabel) + ' <span class="text-mono text-small text-muted">(entry ' + idx + ')</span></h3><div class="stat-row"><span class="label">Current Functions</span><span class="value text-small">' + escHtml(funcLabels || "none") + '</span></div><div class="stat-row"><span class="label">Matching PID</span><span class="value text-mono" id="s-usb-pid-' + idx + '">0x' + pidHex + '</span></div><div class="form-group"><label>Network Mode</label><select id="s-usb-net-' + idx + '" data-onchange="usbSelChange" data-args="[' + idx + ']">' + netHtml + '</select></div><div class="form-group"><label>Functions</label><select id="s-usb-preset-' + idx + '" data-onchange="usbSelChange" data-args="[' + idx + ']">' + presetHtml + "</select></div>" + customHtml + '<div class="form-actions"><button ' + actionAttr("setUSBPatch", [idx]) + ">Apply Patch</button></div></div>";
    }
    function _usbPresetChange(idx) {
      var sel = $("#s-usb-preset-" + idx);
      var box = $("#s-usb-custom-" + idx);
      if (!sel || !box) return;
      box.style.display = sel.value === "custom" ? "" : "none";
    }
    function _usbSelChange(idx) {
      _usbPresetChange(idx);
      _updateUSBPreview(idx);
    }
    var _ktEntries = null;
    function _findMatchingPID(funcs) {
      if (!_ktEntries) return null;
      for (var i = 0; i < _ktEntries.length; i++) {
        var e = _ktEntries[i];
        var active = _parseActiveFuncs(e.funcs);
        if (active.length !== funcs.length) continue;
        var match = true;
        for (var j = 0; j < active.length; j++) {
          if (active[j] !== funcs[j]) {
            match = false;
            break;
          }
        }
        if (match) return e.pid;
      }
      return null;
    }
    function _updateUSBPreview(idx) {
      var netSel = $("#s-usb-net-" + idx);
      var presetSel = $("#s-usb-preset-" + idx);
      var pidEl = $("#s-usb-pid-" + idx);
      if (!netSel || !presetSel || !pidEl) return;
      var netId = parseInt(netSel.value);
      var preset = presetSel.value;
      var extraIds;
      if (preset === "custom") {
        extraIds = [];
        for (var i = 0; i < USB_CUSTOM_FUNCS.length; i++) {
          var cb = $("#s-usb-f" + USB_CUSTOM_FUNCS[i].id + "-" + idx);
          if (cb && cb.checked) extraIds.push(USB_CUSTOM_FUNCS[i].id);
        }
      } else {
        for (var i = 0; i < USB_PRESETS.length; i++) {
          if (USB_PRESETS[i].key === preset) {
            extraIds = USB_PRESETS[i].funcs;
            break;
          }
        }
      }
      if (!extraIds) return;
      var allFuncs = [netId].concat(extraIds);
      var matchPID = _findMatchingPID(allFuncs);
      var labels = allFuncs.map(_funcLabel).join(", ");
      if (matchPID) {
        var pidHex = ("0000" + matchPID.toString(16).toUpperCase()).slice(-4);
        pidEl.innerHTML = "0x" + pidHex;
      } else {
        pidEl.innerHTML = "custom";
      }
    }
    function _loadUSB() {
      var tab = $("#set-tab-usb");
      if (!tab) return;
      tab.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';
      Promise.all([
        API.cgiGet("usbcomp.cgi", { action: "status" }).catch(function() {
          return null;
        }),
        API.cgiGet("usbcomp.cgi", { action: "kernel_table" }).catch(function() {
          return null;
        })
      ]).then(function(results) {
        var status = results[0] || {};
        var kt = results[1];
        var html = '<div class="card"><h3>USB Status</h3><div class="stat-row"><span class="label">Active PID</span><span class="value text-mono">0x' + escHtml(status.pid || "?") + '</span></div><div class="stat-row"><span class="label">Functions</span><span class="value text-small">' + _humanFuncs(status.functions) + '</span></div><div class="stat-row"><span class="label">Enabled</span><span class="value">' + (status.enabled == 1 ? "Yes" : "No") + "</span></div></div>";
        var patchableEntries = [];
        if (kt && !kt.error && kt.entries) {
          _ktEntries = kt.entries;
          var macEntry = null, winEntry = null;
          for (var i = 0; i < kt.entries.length; i++) {
            if (kt.entries[i].index === 14) macEntry = kt.entries[i];
            if (kt.entries[i].index === 5) winEntry = kt.entries[i];
          }
          if (macEntry) {
            html += _renderKernelEntry("macOS", macEntry);
            patchableEntries.push(14);
          }
          if (winEntry) {
            html += _renderKernelEntry("Windows / Linux", winEntry);
            patchableEntries.push(5);
          }
        } else {
          html += '<div class="card mt-2"><p class="text-muted">Kernel table not available' + (kt && kt.error ? ": " + escHtml(kt.error) : "") + "</p></div>";
        }
        tab.innerHTML = html;
        for (var i = 0; i < patchableEntries.length; i++) {
          _usbPresetChange(patchableEntries[i]);
        }
      }).catch(function(e) {
        tab.innerHTML = '<div class="card"><p class="text-muted">Failed to load USB info: ' + escHtml(e.message) + "</p></div>";
      });
    }
    function _setUSBPatch(entryIdx) {
      var netSel = $("#s-usb-net-" + entryIdx);
      var presetSel = $("#s-usb-preset-" + entryIdx);
      if (!netSel || !presetSel) return;
      var netId = parseInt(netSel.value);
      var preset = presetSel.value;
      var extraIds, presetLabel;
      if (preset === "custom") {
        extraIds = [];
        for (var i = 0; i < USB_CUSTOM_FUNCS.length; i++) {
          var cb = $("#s-usb-f" + USB_CUSTOM_FUNCS[i].id + "-" + entryIdx);
          if (cb && cb.checked) extraIds.push(USB_CUSTOM_FUNCS[i].id);
        }
        if (extraIds.length === 0) {
          alert("Select at least one function.");
          return;
        }
        presetLabel = "Custom (" + extraIds.map(_funcLabel).join(" + ") + ")";
      } else {
        for (var i = 0; i < USB_PRESETS.length; i++) {
          if (USB_PRESETS[i].key === preset) {
            extraIds = USB_PRESETS[i].funcs;
            presetLabel = USB_PRESETS[i].label;
            break;
          }
        }
        if (!extraIds) return;
      }
      var allFuncs = [netId].concat(extraIds);
      var funcsStr = allFuncs.join(",");
      var netName = _funcLabel(netId);
      var label = netName + " + " + presetLabel;
      var osName = entryIdx === 14 ? "macOS" : "Windows / Linux";
      if (!confirm("Set " + osName + " USB mode to " + label + "?\nTakes effect on next USB reconnect.")) return;
      API.cgiPost("usbcomp.cgi", { action: "patch_entry", index: entryIdx, funcs: funcsStr }).then(function(r) {
        if (r.error) {
          alert("Error: " + r.error);
          return;
        }
        _loadUSB();
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    App.registerPage("settings", renderSettings);
    App._setReboot = _setReboot;
    App._setFactoryReset = _setFactoryReset;
    App._setCheckUpdate = _setCheckUpdate;
    App._setDeviceName = _setDeviceName;
    App._setChangePassword = _setChangePassword;
    App._simUnlockPin = _simUnlockPin;
    App._simUnlockPuk = _simUnlockPuk;
    App._simTogglePin = _simTogglePin;
    App._simChangePin = _simChangePin;
    App._setPowerSave = _setPowerSave;
    App._setUSBPatch = _setUSBPatch;
    App._usbPresetChange = _usbPresetChange;
    App._usbSelChange = _usbSelChange;
  })();

  // js/pages/ssh.js
  (function() {
    "use strict";
    var $ = App.$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;
    function renderSSH(container) {
      container.innerHTML = '<h2>SSH</h2><div id="ssh-content"><div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div></div>';
      _loadSSH();
    }
    function _loadSSH() {
      var el = $("#ssh-content");
      if (!el) return;
      el.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';
      Promise.all([
        API.cgiGet("ssh.cgi", { action: "status" }).catch(function() {
          return null;
        }),
        API.cgiGet("ssh.cgi", { action: "keys" }).catch(function() {
          return null;
        })
      ]).then(function(results) {
        var status = results[0], keys = results[1];
        var s = status || {};
        var keysHtml = "";
        if (keys && keys.length) {
          keysHtml = '<table class="data-table"><thead><tr><th>#</th><th>Type</th><th>Key</th><th>Comment</th><th></th></tr></thead><tbody>' + keys.map(function(k, i) {
            return "<tr><td>" + i + "</td><td>" + escHtml(k.type) + '</td><td class="text-mono text-small">' + escHtml(k.key_prefix) + "</td><td>" + escHtml(k.comment) + '</td><td><button class="btn-small btn-danger" ' + actionAttr("sshRemoveKey", [i]) + ">Remove</button></td></tr>";
          }).join("") + "</tbody></table>";
        } else {
          keysHtml = '<p class="text-muted">No authorized keys</p>';
        }
        el.innerHTML = '<div class="card"><h3>Dropbear SSH</h3><div class="stat-row"><span class="label">Status</span><span class="value">' + (s.running ? "Running (PID " + escHtml(s.pid) + ")" : "Stopped") + '</span></div><div class="stat-row"><span class="label">Port</span><span class="value">' + (s.port || 22) + "</span></div>" + (s.host_keys ? s.host_keys.map(function(hk) {
          return '<div class="stat-row"><span class="label">' + escHtml(hk.type) + ' key</span><span class="value text-mono text-small">' + escHtml(hk.fingerprint) + "</span></div>";
        }).join("") : "") + '</div><div class="card mt-2"><h3>Authorized Keys</h3>' + keysHtml + '<div class="form-group mt-2"><label>Add SSH Key</label><input type="text" id="ssh-newkey" placeholder="ssh-ed25519 AAAA..."></div><button ' + actionAttr("sshAddKey") + ">Add Key</button></div>";
      }).catch(function() {
        el.innerHTML = '<div class="card"><p class="text-muted">Failed to load SSH status</p></div>';
      });
    }
    function _sshAddKey() {
      var key2 = ($("#ssh-newkey") || {}).value;
      if (!key2) return;
      API.cgiPost("ssh.cgi", { action: "add_key", key: key2 }).then(function(r) {
        if (r.error) {
          alert(r.error);
          return;
        }
        _loadSSH();
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _sshRemoveKey(idx) {
      if (!confirm("Remove this SSH key?")) return;
      API.cgiPost("ssh.cgi", { action: "remove_key", index: idx }).then(function(r) {
        if (r.error) {
          alert(r.error);
          return;
        }
        _loadSSH();
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    App.registerPage("ssh", renderSSH);
    App._sshAddKey = _sshAddKey;
    App._sshRemoveKey = _sshRemoveKey;
  })();

  // js/pages/backup.js
  (function() {
    "use strict";
    var $ = App.$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;
    var _backupData = null;
    function renderBackup(container) {
      container.innerHTML = '<h2>Backup &amp; Restore</h2><div class="card"><h3>Export Config</h3><p class="text-small">Download all custom settings as JSON file.</p><button ' + actionAttr("backupExport") + '>Export Configuration</button><div id="backup-export-status" class="mt-1"></div></div><div class="card mt-2"><h3>Import Config</h3><p class="text-small">Upload a previously exported ee71-config.json file.</p><input type="file" id="backup-import-file" accept=".json"><div class="form-actions mt-1"><button ' + actionAttr("backupValidate") + '>Validate</button></div><div id="backup-import-result" class="mt-1"></div></div>';
    }
    function _backupExport() {
      var el = $("#backup-export-status");
      if (el) el.textContent = "Gathering settings...";
      Promise.all([
        API.webapi("GetWlanSettings").catch(function() {
          return null;
        }),
        API.webapi("GetLanSettings").catch(function() {
          return null;
        }),
        API.cgiGet("ttl.cgi", { action: "status" }).catch(function() {
          return null;
        }),
        API.cgiGet("wireguard.cgi", { action: "config" }).catch(function() {
          return null;
        }),
        API.cgiGet("shadowsocks.cgi", { action: "config" }).catch(function() {
          return null;
        }),
        API.cgiGet("sms_fwd.cgi", { action: "config" }).catch(function() {
          return null;
        }),
        API.cgiGet("ssh.cgi", { action: "status" }).catch(function() {
          return null;
        }),
        API.cgiGet("ssh.cgi", { action: "keys" }).catch(function() {
          return null;
        }),
        API.cgiGet("usbcomp.cgi", { action: "status" }).catch(function() {
          return null;
        }),
        API.cgiGet("power.cgi", { action: "status" }).catch(function() {
          return null;
        }),
        API.webapi("GetProfileList").catch(function() {
          return null;
        })
      ]).then(function(r) {
        var wifi = r[0], lan = r[1], ttl = r[2], wg = r[3], ss = r[4];
        var sms = r[5], ssh = r[6], sshKeys = r[7], usb = r[8], power = r[9], apn = r[10];
        var config = {
          version: 1,
          timestamp: Math.floor(Date.now() / 1e3)
        };
        if (wifi) {
          var ap2g = wifi.AP2G || {};
          var ap5g = wifi.AP5G || {};
          config.wifi = {
            ssid_24: ap2g.Ssid || wifi.WlanSSID || "",
            password_24: ap2g.WpaKey || wifi.WlanAPPwd || "",
            channel_24: ap2g.Channel != null ? String(ap2g.Channel) : wifi.WlanChannel || "0",
            mode_24: wifi.WlanMode || "",
            bandwidth_24: wifi.WlanBandwidth || "",
            ssid_5g: ap5g.Ssid || wifi.WlanSSID_5G || "",
            password_5g: ap5g.WpaKey || wifi.WlanAPPwd_5G || "",
            channel_5g: ap5g.Channel != null ? String(ap5g.Channel) : wifi.WlanChannel_5G || "0",
            mode_5g: wifi.WlanMode_5G || "",
            bandwidth_5g: wifi.WlanBandwidth_5G || ""
          };
        }
        if (lan) config.network = {
          gateway: lan.IPv4IPAddress || lan.GatewayIP || "",
          subnet: lan.SubnetMask || "",
          dhcp_start: lan.StartIPAddress || lan.DhcpStartIP || "",
          dhcp_end: lan.EndIPAddress || lan.DhcpEndIP || "",
          dhcp_lease: lan.DHCPLeaseTime || lan.DhcpLeaseTime || "",
          hostname: lan.host_name || ""
        };
        if (ttl) config.firewall = { ttl };
        if (wg && !wg.error) config.wireguard = wg;
        if (ss && ss.server) config.shadowsocks = ss;
        if (sms && !sms.error) config.sms_forward = sms;
        if (ssh) {
          config.ssh = { port: ssh.port || 22 };
          if (sshKeys && sshKeys.length) config.ssh.keys = sshKeys;
        }
        if (usb) config.usb = { pid: usb.pid || "", functions: usb.functions || "" };
        if (power) config.power = {
          auto_off_enable: power.auto_off_enable,
          auto_off_time: power.auto_off_time,
          wifi_off_enable: power.wifi_off_enable,
          wifi_off_time: power.wifi_off_time,
          led_off: power.led_off_no_client
        };
        var apnList = apn && (apn.ProfileList || apn);
        if (Array.isArray(apnList) && apnList.length) config.apn = apnList;
        var blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "ee71-config.json";
        a.click();
        URL.revokeObjectURL(url);
        if (el) el.textContent = "Exported.";
      }).catch(function(e) {
        if (el) el.textContent = "Export failed: " + e.message;
      });
    }
    function _backupValidate() {
      var input = $("#backup-import-file");
      var result = $("#backup-import-result");
      if (!input || !input.files || !input.files[0]) {
        if (result) result.textContent = "Select a file first";
        return;
      }
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var data = JSON.parse(e.target.result);
          if (data.version !== 1) {
            if (result) result.textContent = "Unsupported config version: " + (data.version || "none");
            return;
          }
          var sections = [];
          if (data.wifi) sections.push("wifi");
          if (data.network) sections.push("network");
          if (data.firewall) sections.push("firewall");
          if (data.wireguard) sections.push("wireguard");
          if (data.shadowsocks) sections.push("shadowsocks");
          if (data.sms_forward) sections.push("sms_forward");
          if (data.ssh) sections.push("ssh");
          if (data.usb) sections.push("usb");
          if (data.power) sections.push("power");
          if (data.apn) sections.push("apn");
          _backupData = data;
          if (result) result.innerHTML = "Valid config v1. Sections: " + escHtml(sections.join(", ") || "none") + '<br><button class="mt-1" ' + actionAttr("backupImport") + ">Import Now</button>";
        } catch (ex) {
          if (result) result.textContent = "Invalid JSON file";
        }
      };
      reader.readAsText(input.files[0]);
    }
    function _backupImport() {
      var result = $("#backup-import-result");
      if (!_backupData) {
        if (result) result.textContent = "Validate a file first";
        return;
      }
      if (!confirm("Import will overwrite current settings. Continue?")) return;
      _doImport(_backupData, result);
    }
    function _doImport(data, el) {
      var tasks = [];
      var applied = [];
      if (data.wifi) {
        var wp = {};
        var ap2g = {};
        if (data.wifi.ssid_24) ap2g.Ssid = data.wifi.ssid_24;
        if (data.wifi.password_24) ap2g.WpaKey = data.wifi.password_24;
        if (data.wifi.channel_24) ap2g.Channel = parseInt(data.wifi.channel_24) || 0;
        var ap5g = {};
        if (data.wifi.ssid_5g) ap5g.Ssid = data.wifi.ssid_5g;
        if (data.wifi.password_5g) ap5g.WpaKey = data.wifi.password_5g;
        if (data.wifi.channel_5g) ap5g.Channel = parseInt(data.wifi.channel_5g) || 0;
        if (Object.keys(ap2g).length) wp.AP2G = ap2g;
        if (Object.keys(ap5g).length) wp.AP5G = ap5g;
        tasks.push(API.webapi("SetWlanSettings", wp).then(function() {
          applied.push("wifi");
        }));
      }
      if (data.network) {
        var np = {};
        if (data.network.gateway) np.IPv4IPAddress = data.network.gateway;
        if (data.network.subnet) np.SubnetMask = data.network.subnet;
        if (data.network.dhcp_start) np.StartIPAddress = data.network.dhcp_start;
        if (data.network.dhcp_end) np.EndIPAddress = data.network.dhcp_end;
        if (data.network.dhcp_lease) np.DHCPLeaseTime = data.network.dhcp_lease;
        tasks.push(API.webapi("SetLanSettings", np).then(function() {
          applied.push("network");
        }));
      }
      if (data.firewall && data.firewall.ttl) {
        var t = data.firewall.ttl;
        tasks.push(API.cgiPost("ttl.cgi", {
          action: "set",
          ttl: parseInt(t.value) || 64,
          iface: t.iface || "rmnet+"
        }).then(function() {
          applied.push("firewall");
          if (t.active) return API.cgiPost("ttl.cgi", { action: "enable" });
        }));
      }
      if (data.wireguard && data.wireguard.config) {
        tasks.push(API.cgiPost("wireguard.cgi", {
          action: "save",
          config: data.wireguard.config
        }).then(function() {
          applied.push("wireguard");
        }));
      }
      if (data.shadowsocks && data.shadowsocks.server) {
        tasks.push(API.cgiPost("shadowsocks.cgi", {
          action: "save",
          server: data.shadowsocks.server,
          server_port: data.shadowsocks.server_port,
          password: data.shadowsocks.password,
          method: data.shadowsocks.method
        }).then(function() {
          applied.push("shadowsocks");
        }));
      }
      if (data.sms_forward) {
        var sf = data.sms_forward;
        tasks.push(API.cgiPost("sms_fwd.cgi", {
          action: "save",
          telegram_enabled: sf.telegram_enabled || 0,
          telegram_bot_token: sf.telegram_bot_token || "",
          telegram_chat_id: sf.telegram_chat_id || "",
          phone_enabled: sf.phone_enabled || 0,
          phone_target: sf.phone_target || "",
          poll_interval: sf.poll_interval || 30,
          filter_numbers: sf.filter_numbers || ""
        }).then(function() {
          applied.push("sms_forward");
        }));
      }
      if (data.ssh && data.ssh.port) {
        tasks.push(API.cgiPost("ssh.cgi", {
          action: "save",
          port: data.ssh.port
        }).then(function() {
          applied.push("ssh");
        }));
      }
      if (data.power) {
        tasks.push(API.cgiPost("power.cgi", {
          action: "save",
          auto_off_enable: data.power.auto_off_enable,
          auto_off_time: data.power.auto_off_time,
          wifi_off_enable: data.power.wifi_off_enable,
          wifi_off_time: data.power.wifi_off_time,
          led_off_no_client: data.power.led_off
        }).then(function() {
          applied.push("power");
        }));
      }
      if (data.apn && Array.isArray(data.apn)) {
        data.apn.forEach(function(p) {
          if (!p.ProfileName || !p.APN) return;
          tasks.push(API.webapi("AddNewProfile", {
            ProfileName: p.ProfileName,
            APN: p.APN,
            AuthType: String(p.AuthType || 0),
            Username: p.Username || "",
            Password: p.Password || "",
            PdpType: String(p.PdpType || 0)
          }).then(function() {
            applied.push("apn");
          }));
        });
      }
      if (el) el.textContent = "Importing...";
      Promise.all(tasks.map(function(t2) {
        return t2.catch(function(e) {
          return e;
        });
      })).then(function() {
        _backupData = null;
        if (el) el.textContent = "Imported: " + (applied.join(", ") || "none") + ". Some settings may require restart.";
      });
    }
    App.registerPage("backup", renderBackup);
    App._backupExport = _backupExport;
    App._backupValidate = _backupValidate;
    App._backupImport = _backupImport;
  })();

  // js/pages/about.js
  (function() {
    "use strict";
    var icon = App.icon, escHtml = App.escHtml, formatUptime = App.formatUptime;
    function fmtMB(kb) {
      var v = parseInt(kb, 10);
      if (isNaN(v) || v === 0) return "0";
      return (v / 1024).toFixed(1) + " MB";
    }
    function renderAbout(container) {
      container.innerHTML = '<h2>About</h2><div class="card"><div class="stat-row"><span class="label">Firmware</span><span class="value" id="a-fw">\u2014</span></div><div class="stat-row"><span class="label">Hardware</span><span class="value" id="a-hw">\u2014</span></div><div class="stat-row"><span class="label">IMEI</span><span class="value" id="a-imei">\u2014</span></div><div class="stat-row"><span class="label">MAC Address</span><span class="value" id="a-mac">\u2014</span></div><div class="stat-row"><span class="label">Uptime</span><span class="value" id="a-uptime">\u2014</span></div><div class="stat-row"><span class="label">Kernel</span><span class="value" id="a-kernel">\u2014</span></div><div class="stat-row"><span class="label">Web UI</span><span class="value">Custom v1.0</span></div></div><div class="card mt-2"><h3>Storage</h3><div id="a-storage" class="text-small">Loading...</div></div><div class="card mt-2"><h3>Memory</h3><div id="a-memory" class="text-small">Loading...</div></div>';
      Promise.all([
        API.webapi("GetSystemInfo").catch(function() {
          return null;
        }),
        API.cgiGet("system.cgi", { action: "storage" }).catch(function() {
          return null;
        }),
        API.cgiGet("system.cgi", { action: "memory" }).catch(function() {
          return null;
        })
      ]).then(function(results) {
        var info = results[0], storage = results[1], memory = results[2];
        var el = function(id) {
          return document.getElementById(id);
        };
        if (info) {
          if (el("a-fw")) el("a-fw").textContent = (info.SwVersion || info.SWversion || info.FWversion || "\u2014").replace(/\n/g, "");
          if (el("a-hw")) el("a-hw").textContent = info.HwVersion || info.HWversion || "\u2014";
          if (el("a-imei")) el("a-imei").textContent = info.IMEI || info.Imei || "\u2014";
          if (el("a-mac")) el("a-mac").textContent = info.MacAddress || "\u2014";
        }
        API.cgiGet("system.cgi", { action: "uptime" }).then(function(u) {
          if (u && u.seconds != null && el("a-uptime")) el("a-uptime").textContent = formatUptime(u.seconds);
        }).catch(function() {
        });
        var fsList = Array.isArray(storage) ? storage : storage && storage.filesystems ? storage.filesystems : [];
        fsList = fsList.filter(function(fs) {
          var name = fs.fs || fs.filesystem || "";
          return name !== "tmpfs" && name !== "devtmpfs" && name !== "rootfs" && name !== "none";
        });
        if (fsList.length > 0) {
          var elSt = el("a-storage");
          if (elSt) {
            elSt.innerHTML = '<table class="data-table"><thead><tr><th>Mount</th><th>Size</th><th>Used</th><th>Avail</th><th>Use</th></tr></thead><tbody>' + fsList.map(function(fs) {
              var pct = parseInt(fs.pct || fs.use_pct || 0, 10);
              return "<tr><td>" + escHtml(fs.mount || fs.mounted_on || "") + '</td><td class="text-right">' + fmtMB(fs.size) + '</td><td class="text-right">' + fmtMB(fs.used) + '</td><td class="text-right">' + fmtMB(fs.avail || fs.available) + '</td><td class="text-right">' + (pct ? pct + "%" : "\u2014") + "</td></tr>";
            }).join("") + "</tbody></table>";
          }
        }
        if (memory) {
          var elMem = el("a-memory");
          if (elMem) {
            var memLabels = { MemTotal: "Total", MemFree: "Free", MemAvailable: "Available", Buffers: "Buffers", Cached: "Cached", SwapTotal: "Swap", SwapFree: "Swap Free" };
            var items = ["MemTotal", "MemFree", "MemAvailable", "Buffers", "Cached", "SwapTotal", "SwapFree"];
            elMem.innerHTML = items.filter(function(k) {
              return memory[k] !== void 0;
            }).map(function(k) {
              return '<div class="stat-row"><span class="label">' + (memLabels[k] || k) + '</span><span class="value">' + fmtMB(memory[k]) + "</span></div>";
            }).join("");
          }
        }
        API.cgiGet("system.cgi", { action: "kernel" }).then(function(kData) {
          if (kData && kData.version) {
            var elK = el("a-kernel");
            if (elK) elK.textContent = kData.version;
          }
        }).catch(function() {
        });
      }).catch(function() {
      });
    }
    App.registerPage("about", renderAbout);
  })();

  // js/pages/mobile-settings.js
  (function() {
    "use strict";
    var $ = App.$, $$ = App.$$, icon = App.icon, escHtml = App.escHtml, actionAttr = App.actionAttr;
    var _atTerm = null;
    var _atTemplates = null;
    var _apnList = [];
    var _editingAPN = null;
    function renderMobileSettings(container) {
      container.innerHTML = '<h2>Settings</h2><div class="tabs" id="mset-tabs"><button class="active" data-tab="network">Network</button><button data-tab="apn">APN</button><button data-tab="at">AT Terminal</button></div><div class="tab-content active" id="mset-tab-network"></div><div class="tab-content" id="mset-tab-apn"></div><div class="tab-content" id="mset-tab-at"></div>';
      var _loadedTabs = {};
      var _tabLoaders = {
        network: _loadNetwork,
        apn: _loadAPN,
        at: _loadAT
      };
      function _activateTab(name) {
        $$("#mset-tabs button").forEach(function(b) {
          b.classList.remove("active");
        });
        var btn = document.querySelector('#mset-tabs button[data-tab="' + name + '"]');
        if (btn) btn.classList.add("active");
        $$("#mset-tabs ~ .tab-content").forEach(function(tc) {
          tc.classList.remove("active");
        });
        var target = document.getElementById("mset-tab-" + name);
        if (target) target.classList.add("active");
        if (!_loadedTabs[name] && _tabLoaders[name]) {
          _loadedTabs[name] = true;
          _tabLoaders[name]();
        }
      }
      $$("#mset-tabs button").forEach(function(btn) {
        btn.addEventListener("click", function() {
          _activateTab(btn.dataset.tab);
        });
      });
      _activateTab("network");
      App.setCleanup(function() {
        if (_atTerm) {
          _atTerm.kill();
          _atTerm = null;
        }
        if (_msNetSearchTimer) {
          clearTimeout(_msNetSearchTimer);
          _msNetSearchTimer = null;
        }
        _atTemplates = null;
        _apnList = [];
        _editingAPN = null;
      });
    }
    var _msNetSearchTimer = null;
    function _loadNetwork() {
      var tab = $("#mset-tab-network");
      if (!tab) return;
      tab.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';
      Promise.all([
        API.webapi("GetConnectionSettings").catch(function() {
          return null;
        }),
        API.webapi("GetNetworkInfo").catch(function() {
          return null;
        }),
        API.webapi("GetConnectionState").catch(function() {
          return null;
        }),
        API.webapi("GetUsageSettings").catch(function() {
          return null;
        })
      ]).then(function(results) {
        var connSettings = results[0], netInfo = results[1], connSt = results[2], usage = results[3];
        var cs = connSettings || {};
        var us = usage || {};
        var currentMode = cs.NetselectionMode || cs.NetworkMode || "auto";
        var netSelMode = cs.NetselectionMode || "0";
        var connMode = cs.ConnectMode || "0";
        var roaming = cs.RoamingConnect || "0";
        var idleTime = cs.IdleTime || "0";
        var connected = connSt && (connSt.ConnectionStatus === 2 || connSt.ConnectionStatus === "2");
        tab.innerHTML = '<div class="card"><h3>Network Mode</h3><div class="form-group"><label>Preferred Mode</label><select id="ms-netmode"><option value="auto"' + (currentMode === "auto" || currentMode === "0" ? " selected" : "") + '>Auto (4G/3G/2G)</option><option value="4g3g"' + (currentMode === "4g3g" || currentMode === "0302" ? " selected" : "") + '>4G + 3G</option><option value="4g"' + (currentMode === "4g" || currentMode === "03" ? " selected" : "") + '>4G Only (LTE)</option><option value="3g"' + (currentMode === "3g" || currentMode === "02" ? " selected" : "") + '>3G Only (WCDMA)</option><option value="2g"' + (currentMode === "2g" || currentMode === "01" ? " selected" : "") + '>2G Only (GSM)</option></select></div><div class="form-actions"><button ' + actionAttr("msetNetMode") + '>Apply Mode</button></div></div><div class="card mt-2"><h3>Operator Selection</h3><div class="form-group"><label><input type="radio" name="ms-netsel" id="ms-netsel-auto" value="0"' + (netSelMode === "0" || netSelMode === 0 ? " checked" : "") + '> Automatic</label><label><input type="radio" name="ms-netsel" id="ms-netsel-manual" value="1"' + (netSelMode === "1" || netSelMode === 1 ? " checked" : "") + '> Manual</label></div><div class="form-actions"><button ' + actionAttr("msetSearchNet") + '>Search Networks</button></div><div id="ms-netsearch"></div></div><div class="card mt-2"><h3>Connection</h3><div class="form-group"><label>Connect Mode</label><select id="ms-connmode"><option value="0"' + (connMode === "0" || connMode === 0 ? " selected" : "") + '>Auto</option><option value="1"' + (connMode === "1" || connMode === 1 ? " selected" : "") + '>Manual</option></select></div><div class="form-group"><label>Idle Timeout (min)</label><input type="number" id="ms-idle" value="' + (parseInt(idleTime, 10) || 0) + '" min="0" max="120"></div><div class="form-group"><label><input type="checkbox" id="ms-roaming"' + (roaming === "1" || roaming === 1 ? " checked" : "") + '> Connect while roaming</label></div><div class="form-actions"><button ' + actionAttr("msetSaveConn") + ">Save</button>" + (connected ? '<button class="btn-outline" ' + actionAttr("msetDisconnect") + ">Disconnect</button>" : '<button class="btn-outline" ' + actionAttr("msetConnect") + ">Connect</button>") + '</div></div><div class="card mt-2"><h3>Data Plan</h3><div class="stat-row"><span class="label">Used</span><span class="value">' + App.formatBytes(us.UsedData || 0) + " / " + App.formatBytes((us.MonthlyPlan || 0) * 1048576) + '</span></div><div class="form-group"><label>Monthly Limit (MB)</label><input type="number" id="ms-planlimit" value="' + (parseInt(us.MonthlyPlan, 10) || 0) + '" min="0" max="999999"></div><div class="form-group"><label>Billing Day (1-31)</label><input type="number" id="ms-billday" value="' + (parseInt(us.BillingDay, 10) || 1) + '" min="1" max="31"></div><div class="form-group"><label><input type="checkbox" id="ms-autodisconn"' + (us.AutoDisconnFlag === "1" || us.AutoDisconnFlag === 1 ? " checked" : "") + '> Auto-disconnect at limit</label></div><div class="form-actions"><button ' + actionAttr("msetSavePlan") + '>Save Plan</button><button class="btn-outline" ' + actionAttr("msetResetCounters") + '>Reset Counters</button></div></div><div class="card mt-2"><h3>IP Addresses</h3><div class="stat-row"><span class="label">IPv4</span><span class="value" id="ms-ipv4">' + escHtml(connSt && (connSt.IPv4Adrress || connSt.IPAddress) || "\u2014") + '</span></div><div class="stat-row"><span class="label">IPv6</span><span class="value text-mono text-small" id="ms-ipv6">' + escHtml(connSt && connSt.IPv6Adrress || "\u2014") + '</span></div></div><div class="card mt-2"><h3>Data Counters</h3><div class="stat-row"><span class="label">Session RX</span><span class="value" id="ms-rx">' + App.formatBytes(connSt && connSt.DlBytes || 0) + '</span></div><div class="stat-row"><span class="label">Session TX</span><span class="value" id="ms-tx">' + App.formatBytes(connSt && connSt.UlBytes || 0) + '</span></div><div class="stat-row"><span class="label">Duration</span><span class="value" id="ms-dur">' + App.formatUptime(connSt && connSt.ConnectionTime || 0) + "</span></div></div>";
      }).catch(function() {
        tab.innerHTML = '<div class="card"><p class="text-muted">Failed to load network info</p></div>';
      });
    }
    function _msetNetMode() {
      var sel = $("#ms-netmode");
      if (!sel) return;
      var mode = sel.value;
      var modeMap = { "auto": "0", "4g3g": "0302", "4g": "03", "3g": "02", "2g": "01" };
      API.webapi("SetNetworkSettings", { NetworkMode: modeMap[mode] || "0" }).then(function() {
        alert("Network mode changed. Reconnecting may take 10-30s.");
        setTimeout(_loadNetwork, 3e3);
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _msetSearchNet() {
      var el = $("#ms-netsearch");
      if (!el) return;
      el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Searching (up to 60s)...</div>';
      API.webapi("SetNetworkSettings", { NetselectionMode: 1 }).then(function() {
        return API.webapi("SearchNetwork", { NetworkID: "" });
      }).then(function() {
        _msPollNetSearch(0);
      }).catch(function(e) {
        el.innerHTML = '<p class="text-danger">Search failed: ' + escHtml(e.message) + "</p>";
      });
    }
    function _msPollNetSearch(attempt) {
      if (attempt > 30) {
        var el = $("#ms-netsearch");
        if (el) el.innerHTML = '<p class="text-muted">Search timeout</p>';
        return;
      }
      _msNetSearchTimer = setTimeout(function() {
        API.webapi("SearchNetworkResult").then(function(r) {
          if (!r || r.SearchState !== 2 && r.SearchState !== "2") {
            _msPollNetSearch(attempt + 1);
            return;
          }
          var list = r.ListNetworkItem || [];
          var el2 = $("#ms-netsearch");
          if (!el2) return;
          if (!list.length) {
            el2.innerHTML = '<p class="text-muted">No operators found</p>';
            return;
          }
          var RAT_MAP = { "0": "2G", "2": "3G", "7": "4G" };
          var STATE_MAP = { "0": "Unknown", "1": "Available", "2": "Current", "3": "Forbidden" };
          var html = '<table class="data-table mt-1"><thead><tr><th>Operator</th><th>MCC/MNC</th><th>RAT</th><th>State</th><th></th></tr></thead><tbody>';
          list.forEach(function(op) {
            var rat = RAT_MAP[String(op.Rat)] || String(op.Rat || "");
            var state = STATE_MAP[String(op.State)] || String(op.State || "");
            var netId = (op.mcc || "") + (op.mnc || "");
            html += "<tr><td>" + escHtml(op.NetworkName || op.Name || "") + '</td><td class="text-mono">' + escHtml(op.mcc || "") + "/" + escHtml(op.mnc || "") + "</td><td>" + escHtml(rat) + "</td><td>" + escHtml(state) + '</td><td><button class="btn-small" ' + actionAttr("msetRegNet", [netId]) + ">Register</button></td></tr>";
          });
          html += '</tbody></table><div class="form-actions mt-1"><button class="btn-outline" ' + actionAttr("msetAutoNet") + ">Back to Auto</button></div>";
          el2.innerHTML = html;
        }).catch(function() {
          _msPollNetSearch(attempt + 1);
        });
      }, 2e3);
    }
    function _msetRegNet(networkId) {
      API.webapi("RegisterNetwork", { NetworkID: networkId }).then(function() {
        alert("Registered on network.");
        setTimeout(_loadNetwork, 3e3);
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _msetAutoNet() {
      API.webapi("SetNetworkSettings", { NetselectionMode: 0 }).then(function() {
        alert("Switched to auto.");
        setTimeout(_loadNetwork, 3e3);
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _msetSaveConn() {
      API.webapi("SetConnectionSettings", {
        ConnectMode: $("#ms-connmode").value,
        IdleTime: $("#ms-idle").value || "0",
        RoamingConnect: $("#ms-roaming").checked ? "1" : "0"
      }).then(function() {
        alert("Saved.");
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _msetConnect() {
      API.webapi("Connect").then(function() {
        alert("Connecting...");
        setTimeout(_loadNetwork, 3e3);
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _msetDisconnect() {
      API.webapi("DisConnect").then(function() {
        alert("Disconnected.");
        setTimeout(_loadNetwork, 2e3);
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _msetSavePlan() {
      API.webapi("SetUsageSettings", {
        MonthlyPlan: $("#ms-planlimit").value || "0",
        BillingDay: $("#ms-billday").value || "1",
        AutoDisconnFlag: $("#ms-autodisconn").checked ? "1" : "0"
      }).then(function() {
        alert("Saved.");
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _msetResetCounters() {
      if (!confirm("Reset data usage counters?")) return;
      API.webapi("SetUsageRecordClear").then(function() {
        alert("Counters reset.");
        setTimeout(_loadNetwork, 1e3);
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _loadAPN() {
      var tab = $("#mset-tab-apn");
      if (!tab) return;
      tab.innerHTML = '<div id="ms-apn-content"><div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div></div>';
      _loadAPNContent();
    }
    function _loadAPNContent() {
      var el = $("#ms-apn-content");
      if (!el) return;
      el.innerHTML = '<div class="card"><div class="page-loading"><div class="spinner"></div> Loading...</div></div>';
      _editingAPN = null;
      API.webapi("GetProfileList").then(function(profiles) {
        var list = profiles.ProfileList || profiles || [];
        if (!Array.isArray(list)) list = [];
        _apnList = list;
        var html = '<div class="card"><h3>APN Profiles</h3>';
        if (list.length) {
          html += '<table class="data-table"><thead><tr><th>Name</th><th>APN</th><th>Auth</th><th>Default</th><th></th></tr></thead><tbody>';
          list.forEach(function(p, i) {
            var isDefault = p.IsDefault === 1 || p.IsDefault === "1";
            html += "<tr" + (isDefault ? ' class="text-bold"' : "") + "><td>" + escHtml(p.ProfileName || "") + "</td><td>" + escHtml(p.APN || "") + "</td><td>" + escHtml(p.AuthType == 0 ? "None" : p.AuthType == 1 ? "PAP" : p.AuthType == 2 ? "CHAP" : String(p.AuthType || "")) + "</td><td>" + (isDefault ? "Yes" : "") + '</td><td><button class="btn-small" ' + actionAttr("msetApnEdit", [i]) + ">Edit</button> " + (!isDefault ? '<button class="btn-small" ' + actionAttr("msetApnDef", [i]) + ">Set Default</button> " : "") + '<button class="btn-small btn-danger" ' + actionAttr("msetApnDel", [i]) + ">Del</button></td></tr>";
          });
          html += "</tbody></table>";
        } else {
          html += '<p class="text-muted">No profiles found</p>';
        }
        html += '<details class="mt-2" id="ms-apn-form"><summary>Add Profile</summary><div class="form-row mt-1"><div class="form-group"><label>Profile Name</label><input type="text" id="ms-apn-name" placeholder="My APN"></div><div class="form-group"><label>APN</label><input type="text" id="ms-apn-apn" placeholder="internet"></div></div><div class="form-row"><div class="form-group"><label>Auth Type</label><select id="ms-apn-auth"><option value="0">None</option><option value="1">PAP</option><option value="2">CHAP</option></select></div><div class="form-group"><label>Username</label><input type="text" id="ms-apn-user" placeholder=""></div><div class="form-group"><label>Password</label><input type="text" id="ms-apn-pass" placeholder=""></div></div><div class="form-row"><div class="form-group"><label>PDP Type</label><select id="ms-apn-pdp"><option value="0">IPv4</option><option value="2">IPv4v6</option><option value="1">IPv6</option></select></div></div><div class="form-actions"><button id="ms-apn-submit" ' + actionAttr("msetApnSave") + '>Add Profile</button><button class="btn-small" id="ms-apn-cancel" style="display:none" ' + actionAttr("msetApnCancel") + ">Cancel</button></div></details></div>";
        el.innerHTML = html;
      }).catch(function() {
        el.innerHTML = '<div class="card"><p class="text-muted">Failed to load APN profiles</p></div>';
      });
    }
    function _msetApnEdit(i) {
      var p = _apnList[i];
      if (!p) return;
      var form = $("#ms-apn-form");
      if (form) form.open = true;
      $("#ms-apn-name").value = p.ProfileName || "";
      $("#ms-apn-apn").value = p.APN || "";
      $("#ms-apn-auth").value = String(p.AuthType || 0);
      $("#ms-apn-user").value = p.Username || "";
      $("#ms-apn-pass").value = p.Password || "";
      $("#ms-apn-pdp").value = String(p.PdpType || 0);
      _editingAPN = i;
      var btn = $("#ms-apn-submit");
      if (btn) btn.textContent = "Update Profile";
      var cancel = $("#ms-apn-cancel");
      if (cancel) cancel.style.display = "";
    }
    function _msetApnCancel() {
      _editingAPN = null;
      var btn = $("#ms-apn-submit");
      if (btn) btn.textContent = "Add Profile";
      var cancel = $("#ms-apn-cancel");
      if (cancel) cancel.style.display = "none";
    }
    function _msetApnSave() {
      var params = {
        ProfileName: ($("#ms-apn-name") || {}).value,
        APN: ($("#ms-apn-apn") || {}).value,
        AuthType: ($("#ms-apn-auth") || {}).value || "0",
        Username: ($("#ms-apn-user") || {}).value || "",
        Password: ($("#ms-apn-pass") || {}).value || "",
        PdpType: ($("#ms-apn-pdp") || {}).value || "0"
      };
      if (!params.ProfileName || !params.APN) {
        alert("Name and APN required");
        return;
      }
      var method = _editingAPN !== null ? "EditProfile" : "AddNewProfile";
      if (_editingAPN !== null) params.ProfileIndex = String(_editingAPN);
      API.webapi(method, params).then(function() {
        _loadAPNContent();
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _msetApnDel(i) {
      if (!confirm("Delete APN profile?")) return;
      API.webapi("DeleteProfile", { ProfileIndex: String(i) }).then(function() {
        _loadAPNContent();
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _msetApnDef(i) {
      API.webapi("SetDefaultProfile", { ProfileIndex: String(i) }).then(function() {
        _loadAPNContent();
      }).catch(function(e) {
        alert("Error: " + e.message);
      });
    }
    function _loadAT() {
      var tab = $("#mset-tab-at");
      if (!tab) return;
      tab.innerHTML = '<div class="at-card"><div class="at-toolbar"><span class="at-toolbar-title">' + icon("ic-terminal") + ' AT Terminal</span><button class="btn-icon" ' + actionAttr("msetAtClear") + ' title="Clear output">' + icon("ic-delete") + '</button></div><div id="ms-at-terminal" class="at-terminal"><pre><code class="termino-console"></code></pre><div class="at-input-row"><div class="at-combo"><textarea class="termino-input" rows="1" wrap="hard" placeholder="Type AT command..."></textarea><button class="at-combo-btn" ' + actionAttr("msetAtDrop") + ' data-stop tabindex="-1">\u25BC</button><div class="at-dropdown" id="ms-at-dropdown"></div></div><button class="at-send-btn" ' + actionAttr("msetAtSend") + '>Send</button></div></div><div class="at-footer-note"><svg class="at-warn-icon" viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg> Direct modem access. Write commands may change device behavior.</div></div>';
      var termEl = document.getElementById("ms-at-terminal");
      if (termEl && typeof Termino === "function") {
        _atTerm = Termino(termEl, null, {
          allow_scroll: true,
          prompt: "AT> ",
          command_key: 13,
          terminal_killed_placeholder: "TERMINAL DISABLED",
          terminal_output: ".termino-console",
          terminal_input: ".termino-input",
          disable_terminal_input: false
        });
        _atLoop();
      }
      _loadATTemplates();
    }
    function _atLoop() {
      if (!_atTerm) return;
      _atTerm.input("").then(function(cmd) {
        if (!cmd || !cmd.trim()) {
          _atLoop();
          return;
        }
        cmd = cmd.trim();
        if (!/^AT/i.test(cmd)) {
          _atTerm.output("Error: command must start with AT");
          _atLoop();
          return;
        }
        _atTerm.disable_input();
        API.cgiPost("at.cgi", { action: "send", cmd }).then(function(r) {
          if (r.error) {
            _atTerm.output("Error: " + r.error);
          } else {
            _atTerm.output(escHtml(r.output || "(no response)"));
          }
        }).catch(function(e) {
          _atTerm.output("Error: " + e.message);
        }).then(function() {
          _atTerm.enable_input();
          _atLoop();
        });
      });
    }
    function _loadATTemplates() {
      API.cgiGet("at.cgi", { action: "templates" }).then(function(data) {
        _atTemplates = data && data.templates || [];
        var dd = $("#ms-at-dropdown");
        if (!dd || !_atTemplates.length) return;
        var cats = {};
        _atTemplates.forEach(function(t) {
          var cat = t.cat || "other";
          if (!cats[cat]) cats[cat] = [];
          cats[cat].push(t);
        });
        var catNames = { info: "Info", signal: "Signal", network: "Network", status: "Status", imei: "IMEI", band: "Band Lock", mode: "Mode", ca: "Carrier Agg", system: "System" };
        var html = "";
        Object.keys(cats).forEach(function(cat) {
          html += '<div class="at-dd-cat">' + escHtml(catNames[cat] || cat) + "</div>";
          cats[cat].forEach(function(t) {
            html += '<div class="at-dd-item" data-cmd="' + escHtml(t.cmd) + '"' + (t.warn ? ' data-warn="' + escHtml(t.warn) + '"' : "") + '><span class="at-dd-cmd">' + escHtml(t.cmd) + '</span><span class="at-dd-desc">' + escHtml(t.desc) + (t.warn ? " \u26A0" : "") + "</span></div>";
          });
        });
        dd.innerHTML = html;
        dd.addEventListener("click", function(e) {
          var item = e.target.closest(".at-dd-item");
          if (!item) return;
          var cmd = item.dataset.cmd;
          if (item.dataset.warn && _atTerm) {
            _atTerm.output("\u26A0 Warning: " + item.dataset.warn);
          }
          var termInput2 = document.querySelector("#ms-at-terminal .termino-input");
          if (termInput2) {
            termInput2.value = cmd;
            termInput2.focus();
          }
          dd.classList.remove("open");
        });
      }).catch(function() {
      });
    }
    function _msetAtDrop() {
      var dd = $("#ms-at-dropdown");
      if (!dd) return;
      var opening = !dd.classList.contains("open");
      dd.classList.toggle("open");
      if (opening) {
        var _close = function(ev) {
          if (!ev.target.closest(".at-combo")) {
            dd.classList.remove("open");
            document.removeEventListener("click", _close);
          }
        };
        setTimeout(function() {
          document.addEventListener("click", _close);
        }, 0);
      }
    }
    function _msetAtSend() {
      var termInput2 = document.querySelector("#ms-at-terminal .termino-input");
      if (!termInput2 || !termInput2.value.trim()) return;
      var evt = new KeyboardEvent("keypress", { keyCode: 13, which: 13, bubbles: true });
      termInput2.dispatchEvent(evt);
    }
    function _msetAtClear() {
      if (_atTerm) _atTerm.clear();
    }
    App.registerPage("mobile-settings", renderMobileSettings);
    App._msetNetMode = _msetNetMode;
    App._msetSearchNet = _msetSearchNet;
    App._msetRegNet = _msetRegNet;
    App._msetAutoNet = _msetAutoNet;
    App._msetSaveConn = _msetSaveConn;
    App._msetConnect = _msetConnect;
    App._msetDisconnect = _msetDisconnect;
    App._msetSavePlan = _msetSavePlan;
    App._msetResetCounters = _msetResetCounters;
    App._msetApnEdit = _msetApnEdit;
    App._msetApnCancel = _msetApnCancel;
    App._msetApnSave = _msetApnSave;
    App._msetApnDel = _msetApnDel;
    App._msetApnDef = _msetApnDef;
    App._msetAtClear = _msetAtClear;
    App._msetAtSend = _msetAtSend;
    App._msetAtDrop = _msetAtDrop;
  })();

  // js/app-boot.js
  document.addEventListener("DOMContentLoaded", App.init);
})();
/**!
 * @license Termino.js - A JavaScript library to make custom terminals in the browser with support for executing your own custom functions!
 * VERSION: 2.0.0
 * LICENSED UNDER MIT LICENSE
 * MORE INFO CAN BE FOUND AT https://github.com/MarketingPipeline/Termino.js/
 */
/*! https://github.com/leeoniya/uPlot (v1.6.32) */
