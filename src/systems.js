/* =========================================================================
   systems.js — FX/particles, Save/Load (localStorage), Achievements tracker
   Exposes window.CAFE.FX, .Save, .Achievements
   ========================================================================= */
(function (CAFE) {
  "use strict";
  const U = CAFE.util;

  /* ------------------------------- FX ------------------------------------ */
  const FX = {
    game: null, shake: 0, flash: null, _t: 0,
    init(game) { this.game = game; this.shake = 0; this.flash = null; this._t = 0; },
    spawn(p) { if (this.game) this.game.particles.push(new CAFE.Particle(p)); },
    text(x, y, str, color, size) {
      this.spawn({ x, y, vx: U.rand(-6, 6), vy: -34, life: 1.15, type: 'text', text: str, color: color || '#ffd166', size: size || 16 });
    },
    coin(x, y, amount) {
      this.text(x, y - 8, '+$' + Math.round(amount), '#ffd166', 17);
      for (let i = 0; i < 6; i++) this.spawn({ x, y, vx: U.rand(-50, 50), vy: U.rand(-120, -40), life: U.rand(.4, .8), type: 'coin', color: '#ffd166', size: U.rand(3, 5), gravity: 320 });
    },
    heart(x, y) {
      for (let i = 0; i < 3; i++) this.spawn({ x: x + U.rand(-6, 6), y, vx: U.rand(-10, 10), vy: U.rand(-30, -18), life: U.rand(.9, 1.4), type: 'heart', color: '#ef6b8a', size: U.rand(8, 12) });
    },
    steam(x, y) {
      for (let i = 0; i < 3; i++) this.spawn({ x: x + U.rand(-5, 5), y, vx: U.rand(-8, 8), vy: U.rand(-34, -20), life: U.rand(.7, 1.2), type: 'steam', color: '#ffffff', size: U.rand(4, 7) });
    },
    sparkle(x, y) {
      for (let i = 0; i < 8; i++) { const a = U.rand(0, U.TAU); this.spawn({ x, y, vx: Math.cos(a) * U.rand(20, 70), vy: Math.sin(a) * U.rand(20, 70), life: U.rand(.4, .8), type: 'spark', color: '#ffe08a', size: U.rand(2, 4) }); }
    },
    star(x, y) {
      for (let i = 0; i < 14; i++) { const a = U.rand(0, U.TAU); const s = U.rand(40, 130); this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(.5, 1), type: 'star', color: '#ffd166', size: U.rand(3, 6), gravity: 60 }); }
    },
    shakeIt(a) { this.shake = Math.max(this.shake, a); },
    flashIt(color, alpha) { this.flash = { color, alpha }; this.flashLife = 0.35; },
    update(dt) {
      this._t += dt;
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);
      if (this.flash) { this.flashLife -= dt; if (this.flashLife <= 0) this.flash = null; }
      const ps = this.game ? this.game.particles : [];
      for (let i = ps.length - 1; i >= 0; i--) { ps[i].update(dt); if (ps[i].dead) ps.splice(i, 1); }
    },
    shakeOffset() {
      if (this.shake <= 0) return { x: 0, y: 0 };
      return { x: U.rand(-this.shake, this.shake), y: U.rand(-this.shake, this.shake) };
    }
  };

  /* ------------------------------- Save ---------------------------------- */
  const SAVE_KEY = 'cafe_tycoon_save_v1';
  const Save = {
    save(game) {
      try {
        const s = game.state;
        const data = {
          v: 1,
          cash: s.cash, day: s.day, reputation: s.reputation, dayTime: s.dayTime, dayTimeSec: s.dayTimeSec,
          open: s.open,
          upgrades: s.upgrades,          // {id: level}
          unlocked: s.unlocked,          // array of item ids
          queueCap: s.queueCap, waitCap: s.waitCap, tablesActive: s.tablesActive,
          staffSlots: s.staffSlots,
          stats: s.stats,
          achievements: s.achievements,  // {id:true}
          flags: s.flags,
          settings: s.settings,
          tutorialDone: s.tutorialDone,
          inventory: s.inventory,
          dayHistory: s.dayHistory,
          goalBonusCollected: s.goalBonusCollected,
          activeEffects: s.activeEffects,
          eventTimers: s.eventTimers,
          nextEventDay: s.nextEventDay
        };
        data.employees = game.employees.map(e => ({ id: e.id, name: e.name, gender: e.gender, skill: e.skill, wage: e.wage, role: e.role }));
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        return true;
      } catch (e) { console.warn('save failed', e); return false; }
    },
    load(game) {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) { return null; }
    },
    has() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } },
    clear() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
  };

  /* ---------------------------- Achievements ----------------------------- */
  const Achievements = {
    check(game) {
      const s = game.state, st = s.stats, out = [];
      const unlock = (id) => { if (!s.achievements[id]) { s.achievements[id] = true; out.push(id); } };
      if (st.totalServed >= 1) unlock('first_sale');
      if (st.totalServed >= 50) unlock('serve_50');
      if (st.totalServed >= 100) unlock('serve_100');
      if (st.totalServed >= 500) unlock('serve_500');
      if (st.perfectCount >= 25) unlock('perfect_25');
      if (s.reputation >= 90) unlock('rep_5');
      if (s.cash >= 2000) unlock('rich_2k');
      if (st.daysPlayed >= 30) unlock('day_30');
      if (game.employees.length >= 3) unlock('staff_3');
      if (CAFE.data.MENU.every(m => st.varietySet[m.id])) unlock('variety');
      if (s.flags.noWalkoutDay) unlock('no_walkout');
      if (st.eventsExperienced >= 10) unlock('events_10');
      return out;
    }
  };

  CAFE.FX = FX;
  CAFE.Save = Save;
  CAFE.Achievements = Achievements;
})(window.CAFE = window.CAFE || {});
