/* =========================================================================
   utils.js — core helpers, RNG, math, color, DOM, formatting
   Exposes window.CAFE.util
   ========================================================================= */
(function (CAFE) {
  "use strict";

  const TAU = Math.PI * 2;

  // ---- Seeded-ish RNG (mulberry32) for repeatable flavor ----
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const util = {
    TAU,
    makeRng,
    rng: makeRng((Math.random() * 1e9) | 0),

    // ---- math ----
    clamp: (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v),
    lerp: (a, b, t) => a + (b - a) * t,
    invLerp: (a, b, v) => (b === a ? 0 : (v - a) / (b - a)),
    map: (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c),
    dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
    dist2: (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; },
    angle: (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax),
    sign: (x) => (x < 0 ? -1 : x > 0 ? 1 : 0),
    rand: (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a)),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    chance: (p) => Math.random() < p,
    choice: (arr) => arr[(Math.random() * arr.length) | 0],
    shuffle: (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; },
    pick: (obj) => { // weighted {key:weight}
      let total = 0; for (const k in obj) total += obj[k];
      let r = Math.random() * total;
      for (const k in obj) { r -= obj[k]; if (r <= 0) return k; }
      return Object.keys(obj)[0];
    },
    round: (v, d = 0) => { const m = Math.pow(10, d); return Math.round(v * m) / m; },

    // ---- easing ----
    easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
    easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    easeOutBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    easeOutElastic: (t) => { const c4 = (2 * Math.PI) / 3; return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1; },

    // ---- color ----
    rgba: (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`,
    hexToRgb: (hex) => {
      const h = hex.replace('#', '');
      const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    },
    colorLerp: (c1, c2, t) => {
      const a = typeof c1 === 'string' ? util.hexToRgb(c1) : c1;
      const b = typeof c2 === 'string' ? util.hexToRgb(c2) : c2;
      return `rgb(${Math.round(util.lerp(a.r, b.r, t))},${Math.round(util.lerp(a.g, b.g, t))},${Math.round(util.lerp(a.b, b.b, t))})`;
    },

    // ---- formatting ----
    money: (n) => {
      const v = Math.round(n);
      // Persian digits optional via data attribute; default western with $.
      return '$' + v.toLocaleString('en-US');
    },
    // Persian/Arabic-Indic digits for flavor
    faNum: (n) => {
      const d = '۰۱۲۳۴۵۶۷۸۹';
      return String(n).replace(/[0-9]/g, c => d[c]);
    },
    timeOfDay: (t) => { // t in 0..1 -> "HH:MM" over 08:00..20:00
      const startMin = 8 * 60, endMin = 20 * 60;
      const m = Math.floor(util.lerp(startMin, endMin, util.clamp(t, 0, 1)));
      const h = Math.floor(m / 60), mm = m % 60;
      return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    },
    clockEmoji: (t) => {
      const h = Math.floor(util.lerp(8, 20, util.clamp(t, 0, 1)));
      return h < 12 ? '🌅' : h < 17 ? '☀️' : h < 19 ? '🌇' : '🌙';
    },
    stars: (rep) => {
      const s = util.clamp(Math.round(rep / 20), 1, 5);
      return '★'.repeat(s) + '☆'.repeat(5 - s);
    },
    pct: (v) => Math.round(v * 100) + '%',

    // ---- DOM ----
    $: (sel, root = document) => root.querySelector(sel),
    $$: (sel, root = document) => Array.from(root.querySelectorAll(sel)),
    el: (tag, cls, html) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (html != null) e.innerHTML = html;
      return e;
    },
    on: (e, ev, fn, opts) => e.addEventListener(ev, fn, opts),
    clear: (e) => { while (e.firstChild) e.removeChild(e.firstChild); },

    // ---- misc ----
    uid: () => (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)),
    debounce: (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; },
    deepClone: (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o))),
    formatList: (arr) => arr.join('، '),

    // A tiny tween manager used for UI number animations etc.
    Tweens: {
      list: [],
      add(obj, key, to, dur, ease) {
        this.list.push({ obj, key, from: obj[key], to, t: 0, dur, ease: ease || util.easeOutCubic });
      },
      update(dt) {
        for (let i = this.list.length - 1; i >= 0; i--) {
          const tw = this.list[i];
          tw.t += dt;
          const k = util.clamp(tw.t / tw.dur, 0, 1);
          tw.obj[tw.key] = util.lerp(tw.from, tw.to, tw.ease(k));
          if (k >= 1) this.list.splice(i, 1);
        }
      }
    }
  };

  CAFE.util = util;
})(window.CAFE = window.CAFE || {});
