/* =========================================================================
   render.js — Canvas renderer: world, stations, characters, particles,
   lighting, and the brew mini-game overlay. Exposes window.CAFE.Renderer
   ========================================================================= */
(function (CAFE) {
  "use strict";
  const U = CAFE.util, D = CAFE.data, I = CAFE.i18n;

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  class Renderer {
    constructor(game, canvas) {
      this.game = game; this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.W = D.WORLD.w; this.H = D.WORLD.h;
      this.view = { scale: 1, ox: 0, oy: 0 };
      this.hover = null;
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }

    resize() {
      const c = this.canvas;
      const cw = c.clientWidth || window.innerWidth, ch = c.clientHeight || window.innerHeight;
      c.width = Math.floor(cw * this.dpr); c.height = Math.floor(ch * this.dpr);
      const scale = Math.min(cw / this.W, ch / this.H);
      this.view.scale = scale;
      this.view.ox = (cw - this.W * scale) / 2;
      this.view.oy = (ch - this.H * scale) / 2;
    }

    screenToWorld(sx, sy) {
      return { x: (sx - this.view.ox) / this.view.scale, y: (sy - this.view.oy) / this.view.scale };
    }

    render(dt) {
      const ctx = this.ctx, g = this.game;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      // background fill (letterbox)
      ctx.fillStyle = '#0d0907'; ctx.fillRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);

      const sh = CAFE.FX.shakeOffset ? CAFE.FX.shakeOffset() : { x: 0, y: 0 };
      ctx.save();
      ctx.translate(this.view.ox + sh.x, this.view.oy + sh.y);
      ctx.scale(this.view.scale, this.view.scale);

      this.drawFloor(ctx);
      this.drawWalls(ctx);
      this.drawStations(ctx);
      this.drawCounter(ctx);
      this.drawTables(ctx);
      this.drawDoor(ctx);
      this.drawPickup(ctx);
      this.drawEntities(ctx);
      this.drawParticles(ctx);
      this.drawMinigame(ctx);
      this.drawSelection(ctx);
      this.drawLighting(ctx);

      ctx.restore();
    }

    /* ----------------------------- floor --------------------------------- */
    drawFloor(ctx) {
      const W = this.W, H = this.H;
      ctx.fillStyle = '#6b4a32'; ctx.fillRect(0, 0, W, H);
      // wood planks
      ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.lineWidth = 2;
      for (let y = 40; y < H; y += 46) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      for (let x = 30; x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.globalAlpha = .06; ctx.stroke(); ctx.globalAlpha = 1; }
      // rug in dining area
      ctx.fillStyle = 'rgba(120,40,40,0.35)';
      rr(ctx, 440, 300, 560, 300, 30); ctx.fill();
      ctx.strokeStyle = 'rgba(255,210,150,0.25)'; ctx.lineWidth = 3; rr(ctx, 452, 312, 536, 276, 24); ctx.stroke();
      // subtle center highlight
      const grd = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, 620);
      grd.addColorStop(0, 'rgba(255,220,170,0.10)'); grd.addColorStop(1, 'rgba(0,0,0,0.18)');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    }

    drawWalls(ctx) {
      // top wall / kitchen backsplash
      ctx.fillStyle = '#3a2a1d'; ctx.fillRect(0, 0, this.W, 96);
      ctx.fillStyle = '#4a3526'; ctx.fillRect(0, 90, this.W, 10);
      // tiles on backsplash
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      for (let x = 0; x < this.W; x += 64) for (let y = 8; y < 88; y += 32) { ctx.fillRect(x + 2, y + 2, 60, 28); }
      // window with light
      ctx.fillStyle = 'rgba(255,238,200,0.18)'; rr(ctx, 430, 18, 170, 56, 8); ctx.fill();
      ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 4; rr(ctx, 430, 18, 170, 56, 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(515, 18); ctx.lineTo(515, 74); ctx.moveTo(430, 46); ctx.lineTo(600, 46); ctx.stroke();
    }

    /* ---------------------------- stations ------------------------------- */
    drawStations(ctx) {
      const g = this.game;
      for (const key of ['bar', 'oven', 'tea']) {
        const def = D.LAYOUT.stations[key]; const st = g.stations[key];
        const { x, y, w, h } = def;
        // body
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        const base = st.level > 0 ? '#6d5238' : '#5a4632';
        grad.addColorStop(0, U.colorLerp(base, '#8a6a48', 0.4)); grad.addColorStop(1, base);
        ctx.fillStyle = grad; rr(ctx, x, y, w, h, 12); ctx.fill();
        ctx.restore();
        // metal top
        ctx.fillStyle = '#9a9aa2'; rr(ctx, x, y, w, 16, 8); ctx.fill();
        ctx.fillStyle = '#c8c8d0'; rr(ctx, x + 4, y + 2, w - 8, 6, 4); ctx.fill();
        // label
        ctx.fillStyle = '#f3e9dd'; ctx.font = '700 16px Tahoma, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(def.label + ' ' + def.icon, x + w / 2, y + 42);
        // level pips
        for (let i = 0; i < 5; i++) { ctx.fillStyle = i < st.level ? '#ffd166' : 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(x + 18 + i * 14, y + 64, 4, 0, U.TAU); ctx.fill(); }
        // station-specific visuals
        if (key === 'bar') { ctx.fillStyle = '#2a2a2e'; rr(ctx, x + w / 2 - 16, y + 50, 32, 22, 4); ctx.fill(); ctx.fillStyle = '#1a1a1d'; ctx.beginPath(); ctx.arc(x + w / 2, y + 50, 8, 0, U.TAU); ctx.fill(); }
        if (key === 'oven') { ctx.fillStyle = 'rgba(255,140,60,0.5)'; rr(ctx, x + w / 2 - 22, y + 50, 44, 18, 4); ctx.fill(); ctx.fillStyle = '#ffb86b'; rr(ctx, x + w / 2 - 18, y + 53, 36, 12, 3); ctx.fill(); }
        if (key === 'tea') { ctx.fillStyle = '#7fb0c8'; rr(ctx, x + w / 2 - 14, y + 52, 28, 20, 6); ctx.fill(); ctx.fillStyle = '#cfe6f0'; rr(ctx, x + w / 2 - 8, y + 46, 16, 8, 3); ctx.fill(); }
        // queue badge
        if (st.queue.length > 0) {
          ctx.fillStyle = '#ef6b5a'; ctx.beginPath(); ctx.arc(x + w - 10, y + 10, 12, 0, U.TAU); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.font = '700 13px Tahoma'; ctx.fillText(st.queue.length, x + w - 10, y + 11);
        }
        // preparing progress
        if (st.current) {
          const p = U.clamp(st.current.progress, 0, 1);
          ctx.fillStyle = 'rgba(0,0,0,0.4)'; rr(ctx, x + 10, y + h - 16, w - 20, 9, 4); ctx.fill();
          ctx.fillStyle = st.current.startedBy && st.current.startedBy.indexOf('emp') === 0 ? '#6fcf73' : '#f6a13c';
          rr(ctx, x + 10, y + h - 16, (w - 20) * p, 9, 4); ctx.fill();
        }
        // broken overlay
        if (st.brokenUntil > g.state.dayTimeSec) {
          ctx.fillStyle = 'rgba(120,20,20,0.45)'; rr(ctx, x, y, w, h, 12); ctx.fill();
          ctx.fillStyle = '#ffd166'; ctx.font = '30px sans-serif'; ctx.fillText('⚠️', x + w / 2, y + h / 2 + 6);
        }
        ctx.restore();
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }

    /* ----------------------------- counter ------------------------------- */
    drawCounter(ctx) {
      const c = D.LAYOUT.counter;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8;
      const grad = ctx.createLinearGradient(c.x, c.y, c.x, c.y + c.h);
      grad.addColorStop(0, '#8a5a34'); grad.addColorStop(1, '#5e3c22');
      ctx.fillStyle = grad; rr(ctx, c.x, c.y, c.w, c.h, 14); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#caa06a'; rr(ctx, c.x, c.y, c.w, 12, 8); ctx.fill();
      // wood grain
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1.5;
      for (let y = c.y + 20; y < c.y + c.h; y += 12) { ctx.beginPath(); ctx.moveTo(c.x + 6, y); ctx.lineTo(c.x + c.w - 6, y); ctx.stroke(); }
      // bell + label
      ctx.fillStyle = '#f3e9dd'; ctx.font = '700 15px Tahoma'; ctx.textAlign = 'center'; ctx.fillText('پیشخوان', c.x + c.w / 2, c.y + c.h - 14);
      ctx.textAlign = 'left';
    }

    drawPickup(ctx) {
      const p = D.LAYOUT.pickup;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, p.x - 26, p.y - 6, 52, 22, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(255,209,102,0.5)'; ctx.lineWidth = 2; rr(ctx, p.x - 26, p.y - 6, 52, 22, 6); ctx.stroke();
      // draw ready drinks waiting to be grabbed
      const ready = this.game.readyDrinks;
      ready.slice(0, 5).forEach((tk, i) => this.drawCup(ctx, p.x - 18 + i * 16, p.y + 2, tk.item.color, 9));
    }

    drawDoor(ctx) {
      const d = D.LAYOUT.door;
      ctx.fillStyle = '#2a1c12'; rr(ctx, d.x - 34, d.y - 70, 56, 72, 8); ctx.fill();
      ctx.fillStyle = '#3a2818'; rr(ctx, d.x - 28, d.y - 64, 44, 64, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,170,0.12)'; rr(ctx, d.x - 22, d.y - 58, 32, 56, 4); ctx.fill();
      // mat
      ctx.fillStyle = '#7a4a2a'; rr(ctx, d.x - 40, d.y - 6, 70, 16, 6); ctx.fill();
      ctx.fillStyle = '#f3e9dd'; ctx.font = '700 12px Tahoma'; ctx.textAlign = 'center'; ctx.fillText('ورودی', d.x - 6, d.y - 30); ctx.textAlign = 'left';
    }

    /* ------------------------------ tables -------------------------------- */
    drawTables(ctx) {
      const g = this.game;
      for (let i = 0; i < g.state.tablesActive; i++) {
        const t = D.LAYOUT.tables[i]; if (!t) continue;
        // chairs
        ctx.fillStyle = '#3a2818';
        this.drawChair(ctx, t.x - 26, t.y + 10); this.drawChair(ctx, t.x + 26, t.y + 10);
        // table shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(t.x, t.y + t.r * 0.7, t.r * 1.05, t.r * 0.5, 0, 0, U.TAU); ctx.fill();
        // top
        const grd = ctx.createRadialGradient(t.x - 6, t.y - 6, 4, t.x, t.y, t.r);
        grd.addColorStop(0, '#caa06a'); grd.addColorStop(1, '#8a5a34');
        ctx.fillStyle = grd; ctx.beginPath(); ctx.ellipse(t.x, t.y, t.r, t.r * 0.7, 0, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2; ctx.stroke();
      }
    }
    drawChair(ctx, x, y) {
      ctx.save(); ctx.fillStyle = '#4a3220'; rr(ctx, x - 9, y - 6, 18, 14, 4); ctx.fill();
      ctx.fillStyle = '#5e3c22'; rr(ctx, x - 9, y - 14, 18, 10, 4); ctx.fill(); ctx.restore();
    }

    /* ----------------------------- entities ------------------------------ */
    drawEntities(ctx) {
      const g = this.game;
      // employees first (behind), then customers
      g.employees.forEach(e => this.drawCharacter(ctx, e, { apron: true, role: e.role, name: e.name, staff: true }));
      g.customers.forEach(c => this.drawCharacter(ctx, c, { customer: true, bubble: c.bubble, patience: c.patience, state: c.state, orderTaken: c.orderTaken, mood: c.mood, dineIn: c.dineIn }));
    }

    drawCharacter(ctx, e, o) {
      const bob = e.moving ? Math.sin(e.walkPhase || 0) * 2 : 0;
      const x = e.x, y = e.y - bob, s = e.size || 15;
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x, e.y + s * 0.9, s * 0.9, s * 0.4, 0, 0, U.TAU); ctx.fill();
      // body
      ctx.fillStyle = o.apron ? '#caa06a' : (e.color || '#888');
      rr(ctx, x - s * 0.7, y - s * 0.2, s * 1.4, s * 1.2, s * 0.5); ctx.fill();
      if (o.apron) { ctx.fillStyle = '#e8e2d8'; rr(ctx, x - s * 0.42, y - s * 0.1, s * 0.84, s * 1.0, s * 0.3); ctx.fill(); }
      // head
      ctx.fillStyle = e.skin || '#f1c9a5'; ctx.beginPath(); ctx.arc(x, y - s * 0.7, s * 0.62, 0, U.TAU); ctx.fill();
      // hair
      ctx.fillStyle = e.hair || '#2b2b2b'; ctx.beginPath(); ctx.arc(x, y - s * 0.85, s * 0.64, Math.PI, U.TAU); ctx.fill();
      ctx.fillRect(x - s * 0.64, y - s * 0.85, s * 1.28, s * 0.18);
      // eyes
      ctx.fillStyle = '#2a2018';
      ctx.beginPath(); ctx.arc(x - s * 0.22, y - s * 0.68, 1.6, 0, U.TAU); ctx.arc(x + s * 0.22, y - s * 0.68, 1.6, 0, U.TAU); ctx.fill();
      // staff name tag
      if (o.staff) {
        ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(x + s * 0.5, y - s * 0.2, 3, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#f3e9dd'; ctx.font = '700 10px Tahoma'; ctx.textAlign = 'center'; ctx.fillText(o.role === 'cashier' ? '📋' : '☕', x, y - s * 1.5); ctx.textAlign = 'left';
      }
      // order / status bubble
      if (o.bubble !== undefined && o.bubble !== '' && (o.state === 'queued' || o.state === 'waiting' || o.state === 'toPickup')) {
        this.drawBubble(ctx, x, y - s * 1.9, o.bubble, o.patience, o.state);
      }
    }

    drawBubble(ctx, x, y, text, patience, state) {
      const w = text && text.length > 1 ? 40 : 28, h = 26;
      let bx = x - w / 2, by = y - h;
      ctx.fillStyle = '#fdf6ea';
      ctx.strokeStyle = '#caa06a'; ctx.lineWidth = 2;
      rr(ctx, bx, by, w, h, 9); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 5, by + h); ctx.lineTo(x + 5, by + h); ctx.lineTo(x, by + h + 7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a2a1d'; ctx.font = '700 15px Tahoma'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text || '?', x, by + h / 2 + 1);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      // patience ring
      if (patience != null && (state === 'queued' || state === 'waiting')) {
        const col = patience > 0.5 ? '#6fcf73' : patience > 0.25 ? '#f6a13c' : '#ef6b5a';
        ctx.strokeStyle = col; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, by - 4, 16, -Math.PI / 2, -Math.PI / 2 + U.TAU * U.clamp(patience, 0, 1)); ctx.stroke();
      }
    }

    drawCup(ctx, x, y, color, r) {
      ctx.fillStyle = color || '#6b4a32';
      rr(ctx, x - r, y - r, r * 2, r * 2.1, r * 0.5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; rr(ctx, x - r + 2, y - r + 2, r * 0.7, r * 1.6, 3); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x + r * 0.9, y, r * 0.7, -1, 1); ctx.stroke();
    }

    /* ---------------------------- particles ------------------------------ */
    drawParticles(ctx) {
      const ps = this.game.particles;
      for (const p of ps) {
        const a = U.clamp(p.life / p.maxLife, 0, 1);
        if (p.type === 'text') {
          ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.font = '800 ' + (p.size || 16) + 'px Tahoma'; ctx.textAlign = 'center';
          ctx.fillText(p.text, p.x, p.y); ctx.textAlign = 'left'; ctx.globalAlpha = 1;
        } else if (p.type === 'steam') {
          ctx.globalAlpha = a * 0.5; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.4 - a), 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1;
        } else if (p.type === 'heart') {
          ctx.globalAlpha = a; ctx.fillStyle = p.color; this.heart(ctx, p.x, p.y, p.size); ctx.globalAlpha = 1;
        } else if (p.type === 'coin') {
          ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, U.TAU); ctx.fill();
          ctx.fillStyle = '#b8860b'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.55, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1;
        } else if (p.type === 'spark' || p.type === 'star') {
          ctx.globalAlpha = a; ctx.fillStyle = p.color; this.star(ctx, p.x, p.y, p.size); ctx.globalAlpha = 1;
        } else {
          ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1;
        }
      }
    }
    heart(ctx, x, y, s) {
      ctx.beginPath(); ctx.moveTo(x, y + s * 0.3);
      ctx.bezierCurveTo(x, y, x - s, y - s * 0.2, x - s, y - s * 0.6);
      ctx.bezierCurveTo(x - s, y - s, x, y - s, x, y - s * 0.4);
      ctx.bezierCurveTo(x, y - s, x + s, y - s, x + s, y - s * 0.6);
      ctx.bezierCurveTo(x + s, y - s * 0.2, x, y, x, y + s * 0.3);
      ctx.fill();
    }
    star(ctx, x, y, s) {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a1 = -Math.PI / 2 + i * U.TAU / 5, a2 = a1 + U.TAU / 10;
        ctx.lineTo(x + Math.cos(a1) * s, y + Math.sin(a1) * s);
        ctx.lineTo(x + Math.cos(a2) * s * 0.45, y + Math.sin(a2) * s * 0.45);
      }
      ctx.closePath(); ctx.fill();
    }

    /* ---------------------------- mini-game ------------------------------ */
    drawMinigame(ctx) {
      const g = this.game;
      for (const key of ['bar', 'oven', 'tea']) {
        const st = g.stations[key]; const mg = st.minigame;
        if (!mg || !mg.active) continue;
        const def = D.LAYOUT.stations[key];
        const bw = 150, bh = 18, bx = def.x + def.w / 2 - bw / 2, by = def.y + def.h + 44;
        // panel
        ctx.fillStyle = 'rgba(20,14,10,0.85)'; rr(ctx, bx - 10, by - 26, bw + 20, bh + 40, 10); ctx.fill();
        ctx.strokeStyle = '#f6a13c'; ctx.lineWidth = 2; rr(ctx, bx - 10, by - 26, bw + 20, bh + 40, 10); ctx.stroke();
        ctx.fillStyle = '#ffd166'; ctx.font = '700 13px Tahoma'; ctx.textAlign = 'center'; ctx.fillText('بزن! ⏱', def.x + def.w / 2, by - 12);
        // track
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; rr(ctx, bx, by, bw, bh, 8); ctx.fill();
        // green zone
        const z = D.CONFIG.MINIGAME_ZONE;
        ctx.fillStyle = 'rgba(111,207,115,0.85)'; rr(ctx, bx + bw * (0.5 - z), by, bw * z * 2, bh, 4); ctx.fill();
        ctx.fillStyle = 'rgba(111,207,115,0.4)'; rr(ctx, bx + bw * (0.5 - z * 0.5), by, bw * z, bh, 4); ctx.fill();
        // marker
        const mx = bx + bw * U.clamp(mg.marker, 0, 1);
        ctx.fillStyle = mg.locked ? '#ffd166' : '#fff';
        ctx.fillRect(mx - 2.5, by - 4, 5, bh + 8);
        ctx.textAlign = 'left';
      }
    }

    drawSelection(ctx) {
      const g = this.game; if (!g.hover) return;
      const e = g.hover;
      if (e.x == null) return;
      ctx.strokeStyle = 'rgba(255,209,102,0.9)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(e.x, e.y + (e.size || 15) * 0.9, (e.size || 15) * 1.1, (e.size || 15) * 0.5, 0, 0, U.TAU); ctx.stroke();
    }

    /* ----------------------------- lighting ------------------------------ */
    drawLighting(ctx) {
      const t = this.game.state.dayTime;
      // day tint: warm midday, cool/dim evening
      let col, alpha;
      if (t < 0.5) { col = '255,210,150'; alpha = U.lerp(0.0, 0.10, t / 0.5); }
      else if (t < 0.8) { col = '255,180,120'; alpha = 0.10; }
      else { col = '40,60,120'; alpha = U.lerp(0.12, 0.34, (t - 0.8) / 0.2); }
      ctx.fillStyle = 'rgba(' + col + ',' + alpha + ')'; ctx.fillRect(0, 0, this.W, this.H);
      // vignette
      const vg = ctx.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.35, this.W / 2, this.H / 2, this.H * 0.8);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, this.W, this.H);
      // flash
      if (CAFE.FX.flash) { ctx.fillStyle = 'rgba(' + CAFE.FX.flash.color + ',' + (CAFE.FX.flash.alpha * (CAFE.FX.flashLife / 0.35)) + ')'; ctx.fillRect(0, 0, this.W, this.H); }
    }
  }

  CAFE.Renderer = Renderer;
})(window.CAFE = window.CAFE || {});
