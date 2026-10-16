/* =========================================================================
   game.js — Game engine: state, loop, simulation, economy, day cycle,
   events, input, save/load. Exposes window.CAFE.Game
   ========================================================================= */
(function (CAFE) {
  "use strict";
  const U = CAFE.util, D = CAFE.data, I = CAFE.i18n, A = CAFE.audio, FX = CAFE.FX, S = CAFE.Save, Ach = CAFE.Achievements;

  class Game {
    constructor() {
      this.state = null;
      this.stations = {};
      this.queueSlots = []; this.waitSlots = []; this.tables = [];
      this.readyTickets = [];
      this.particles = [];
      this.customers = []; this.employees = [];
      this.hover = null;
      this.modalPause = false;
      this.spawnAcc = 0;
      this.scheduledEvents = [];
      this.activeEffects = [];
      this.eventTimers = [];
      this.nextDaySpawnMult = 1;
      this.criticMode = null;
      this._lastSave = 0;
      this._achTimer = 0;
      this._frame = 0;
    }

    /* --------------------------- lifecycle -------------------------------- */
    init(canvas) {
      this.canvas = canvas;
      this.audio = CAFE.audio;
      this.fx = CAFE.FX;
      this.renderer = new CAFE.Renderer(this, canvas);
      FX.init(this);
      CAFE.UI.init(this);
      this.bindInput();
      const data = S.load(this);
      if (data) { this.loadGame(data); CAFE.UI.toast('بازی بازیابی شد 💾'); }
      else this.newGame();
      CAFE.i18n.translateDom(document);
      CAFE.UI.refreshAll();
      this.last = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }

    newGame() {
      const C = D.CONFIG;
      this.state = {
        cash: C.START_CASH, day: 1, reputation: C.START_REP,
        dayTime: 0, dayTimeSec: 0, open: false, paused: false, speed: 1,
        queueCap: C.START_QUEUE, waitCap: C.START_WAIT, tablesActive: C.START_TABLES,
        staffSlots: 1,
        upgrades: {}, unlocked: [],
        stats: { totalServed: 0, totalSales: 0, perfectCount: 0, walkouts: 0, revenueTotal: 0, daysPlayed: 1, eventsExperienced: 0, varietySet: {}, bestDayRevenue: 0, tipSum: 0, tipCount: 0 },
        achievements: {}, flags: {}, settings: { volume: 0.7, muted: false, music: true, quality: 'high' },
        tutorialDone: false,
        dayHistory: [], goalBonusCollected: {},
        activeEffects: [], eventTimers: [], nextEventDay: null
      };
      D.MENU.forEach(m => { if (!m.unlock) this.state.unlocked.push(m.id); });
      this.buildRuntime();
      this.day = { revenue: 0, tips: 0, served: 0, perfect: 0, walkouts: 0, ingredientCost: 0 };
    }

    loadGame(d) {
      const C = D.CONFIG;
      this.state = {
        cash: d.cash, day: d.day, reputation: d.reputation, dayTime: d.dayTime || 0, dayTimeSec: d.dayTimeSec || 0,
        open: false, paused: false, speed: 1,
        queueCap: d.queueCap || C.START_QUEUE, waitCap: d.waitCap || C.START_WAIT, tablesActive: d.tablesActive || C.START_TABLES,
        staffSlots: d.staffSlots || 1,
        upgrades: d.upgrades || {}, unlocked: d.unlocked || [],
        stats: d.stats, achievements: d.achievements || {}, flags: d.flags || {},
        settings: d.settings || { volume: 0.7, muted: false, music: true, quality: 'high' },
        tutorialDone: d.tutorialDone || false,
        dayHistory: d.dayHistory || [], goalBonusCollected: d.goalBonusCollected || {},
        activeEffects: [], eventTimers: [], nextEventDay: null
      };
      if (!this.state.upgrades.up_staff) this.state.upgrades.up_staff = 0;
      this.buildRuntime();
      this.day = { revenue: 0, tips: 0, served: 0, perfect: 0, walkouts: 0, ingredientCost: 0 };
      // recreate employees
      this.employees = (d.employees || []).map(ed => {
        const e = new CAFE.Employee(this, ed);
        e.assignRole(ed.role || null);
        return e;
      });
      // apply audio settings
      A.setVolume(this.state.settings.volume);
      A.setMuted(this.state.settings.muted);
    }

    buildRuntime() {
      const C = D.CONFIG, L = D.LAYOUT;
      this.queueSlots = new Array(U.clamp(this.state.queueCap, 1, L.queue.length)).fill(null);
      this.waitSlots = new Array(U.clamp(this.state.waitCap, 1, L.waiting.length)).fill(null);
      this.tables = L.tables.slice(0, U.clamp(this.state.tablesActive, 1, L.tables.length)).map(t => ({ x: t.x, y: t.y, r: t.r, occ: 0 }));
      this.stations = {};
      ['bar', 'oven', 'tea'].forEach(k => {
        const lvl = this.state.upgrades['up_' + k] || 0;
        this.stations[k] = { key: k, level: lvl, queue: [], current: null, busyBy: null, brokenRemain: 0, minigame: { active: false, marker: 0, dir: 1, locked: false, lockMarker: 0, quality: 0 } };
      });
    }

    /* --------------------------- slot helpers ----------------------------- */
    get readyDrinks() { return this.readyTickets; }

    takeQueueSlot(c) { for (let i = 0; i < this.queueSlots.length; i++) { if (!this.queueSlots[i]) { this.queueSlots[i] = c; return i; } } return -1; }
    freeQueueSlot(i) { if (i >= 0 && i < this.queueSlots.length) this.queueSlots[i] = null; }
    takeWaitSlot(c) { for (let i = 0; i < this.waitSlots.length; i++) { if (!this.waitSlots[i]) { this.waitSlots[i] = c; return i; } } return -1; }
    freeWaitSlot(i) { if (i >= 0 && i < this.waitSlots.length) this.waitSlots[i] = null; }
    freeTableCount() { return this.tables.filter(t => t.occ < 2).length; }
    freeTable() { return this.freeTableCount() > 0; }
    takeTable(c) {
      for (let i = 0; i < this.tables.length; i++) {
        const t = this.tables[i];
        if (t.occ < 2) {
          t.occ++;
          const seat = { x: t.x + (c && c.facing === -1 ? -24 : 24), y: t.y + 8 };
          return { ref: t, seat };
        }
      }
      return null;
    }
    releaseTable(c) { if (c.table && c.table.ref) { c.table.ref.occ = Math.max(0, c.table.ref.occ - 1); } c.table = null; }

    unlockedMenu() { return D.MENU.filter(m => this.state.unlocked.indexOf(m.id) >= 0); }

    /* --------------------------- tickets ----------------------------------- */
    createTickets(customer) {
      customer.tickets = [];
      for (const item of customer.items) {
        const st = this.stations[item.station];
        const prepTime = item.prep * Math.pow(0.85, st.level) * this.eventSpeedMult();
        const tk = { id: U.uid(), customerId: customer.id, item, station: item.station, status: 'pending', quality: 0, progress: 0, prepTime, startedBy: null };
        st.queue.push(tk);
        customer.tickets.push(tk);
      }
    }
    isOrderReady(customer) {
      if (!customer.tickets || customer.tickets.length === 0) return false;
      return customer.tickets.every(t => t.status === 'ready');
    }

    /* --------------------------- economy ----------------------------------- */
    addCash(n) { this.state.cash = Math.max(0, this.state.cash + n); }
    spend(n) { if (this.state.cash >= n) { this.state.cash -= n; return true; } return false; }

    /* --------------------------- serving ----------------------------------- */
    takeOrder(customer) {
      if (customer.state !== 'queued' || customer.orderTaken) return false;
      return customer.takeOrder();
    }

    onServed(customer) {
      if (customer.paid) return;
      customer.paid = true;
      const items = customer.items;
      let price = 0, cost = 0;
      items.forEach(it => { price += it.price; cost += it.cost; });
      const avgQ = customer.tickets.reduce((s, t) => s + (t.quality || 0.6), 0) / customer.tickets.length;
      let label = avgQ >= 0.92 ? 'perfect' : avgQ >= 0.75 ? 'good' : avgQ >= 0.55 ? 'ok' : 'bad';
      const ruined = avgQ < 0.35;
      // tip
      let tipFrac = D.CONFIG.TIP_BASE + (this.state.upgrades.up_decor || 0) * 0.02;
      if (label === 'perfect') tipFrac += D.CONFIG.TIP_PERFECT - D.CONFIG.TIP_BASE;
      if (customer.dineIn) tipFrac += 0.10;
      if (customer.loyal) tipFrac += 0.35;
      tipFrac += (this.state.upgrades.up_loyal || 0) * 0.02;
      tipFrac = U.clamp(tipFrac, 0, 0.9);
      const tip = price * tipFrac * (0.6 + 0.4 * avgQ);
      const revenue = price + tip;
      const ingMult = this.eventIngredientMult();
      const ingCost = cost * ingMult;
      this.state.cash += revenue - ingCost;
      // stats
      const st = this.state.stats;
      st.totalServed++; st.totalSales += items.length;
      if (label === 'perfect') { st.perfectCount++; FX.star(customer.x, customer.y - 30); A.play('perfect'); }
      items.forEach(it => { st.varietySet[it.id] = true; });
      st.revenueTotal += revenue; st.tipSum += tip; st.tipCount++;
      this.day.revenue += revenue; this.day.tips += tip; this.day.served++; this.day.ingredientCost += ingCost;
      if (label === 'perfect') this.day.perfect++;
      // reputation
      let rep = 0;
      if (ruined) rep = -D.CONFIG.REP_LOSS_BAD * 2;
      else if (label === 'bad') rep = -D.CONFIG.REP_LOSS_BAD;
      else if (label === 'ok') rep = 0.4;
      else if (label === 'good') rep = D.CONFIG.REP_GAIN_GOOD;
      else rep = D.CONFIG.REP_GAIN_PERFECT;
      rep *= this.eventRepGainMult();
      this.addReputation(rep, customer.x, customer.y);
      // particles + audio
      FX.coin(customer.x, customer.y - 10, revenue);
      const lbl = label === 'perfect' ? 'عالی! ⭐' : label === 'good' ? 'خوب 👍' : label === 'ok' ? 'قبول' : 'ضعیف';
      FX.text(customer.x, customer.y - 34, lbl, label === 'bad' || ruined ? '#ef6b5a' : '#6fcf73', 15);
      if (customer.dineIn) FX.heart(customer.x, customer.y - 20);
      A.play('coin');
      // remove ready tickets for this customer
      this.readyTickets = this.readyTickets.filter(t => t.customerId !== customer.id);
      this.checkAchievements();
    }

    onWalkout(customer, reason) {
      if (customer._walked) return; customer._walked = true;
      this.state.reputation = U.clamp(this.state.reputation - D.CONFIG.REP_LOSS_WALK, 0, 100);
      this.state.stats.walkouts++;
      this.day.walkouts++;
      // remove pending/ready tickets of this customer
      for (const k of ['bar', 'oven', 'tea']) {
        const st = this.stations[k];
        st.queue = st.queue.filter(t => t.customerId !== customer.id);
        if (st.current && st.current.customerId === customer.id) { st.current = null; st.busyBy = null; st.minigame.active = false; }
      }
      this.readyTickets = this.readyTickets.filter(t => t.customerId !== customer.id);
      FX.text(customer.x, customer.y - 30, 'رفت! 💢', '#ef6b5a', 15);
      A.play('error');
      CAFE.UI.toast('مشتری ناراضی رفت — اعتبار کم شد 💢', 'bad');
    }

    addReputation(delta, x, y) {
      const before = Math.round(this.state.reputation / 20);
      this.state.reputation = U.clamp(this.state.reputation + delta, 0, 100);
      const after = Math.round(this.state.reputation / 20);
      if (delta > 0 && x != null) FX.text(x + 18, y - 10, I.t('rep_up') + Math.round(delta), '#6fcf73', 13);
      if (after > before) { CAFE.UI.toast('⭐ ' + I.t('stars') + ' ' + U.stars(this.state.reputation), 'gold'); A.play('ding'); }
    }

    /* --------------------------- day cycle -------------------------------- */
    openCafe() {
      if (this.state.open) { this.closeDay(); return; }
      A.init(); A.resume(); if (this.state.settings.music) A.startMusic();
      this.state.open = true; this.state.paused = false; this.state.speed = 1;
      this.state.dayTime = 0; this.state.dayTimeSec = 0;
      this.day = { revenue: 0, tips: 0, served: 0, perfect: 0, walkouts: 0, ingredientCost: 0 };
      this.spawnAcc = 0; this.activeEffects = []; this.eventTimers = [];
      this.criticMode = null;
      this.scheduleEvents();
      CAFE.UI.toast(I.t('open_cafe') + ' ☕');
    }

    scheduleEvents() {
      this.scheduledEvents = [];
      const count = U.randInt(0, 2);
      for (let i = 0; i < count; i++) {
        const ev = U.choice(D.EVENTS);
        const at = U.rand(8, D.CONFIG.DAY_LENGTH - 8);
        this.scheduledEvents.push({ at, ev, fired: false });
      }
    }

    closeDay() {
      this.state.open = false; this.state.speed = 1;
      A.stopMusic();
      this.endDaySummary();
    }

    endDaySummary() {
      const C = D.CONFIG, st = this.state, day = this.day;
      const rent = C.RENT_BASE + C.RENT_PER_SEAT * st.tablesActive;
      const wages = this.employees.reduce((s, e) => s + e.wage, 0);
      const expenses = rent + wages + day.ingredientCost;
      const net = day.revenue - expenses;
      this.addCash(-expenses);
      // critic effect
      if (this.criticMode === 'risk') {
        const avgQ = day.served > 0 ? day.perfect / Math.max(1, day.served) : 0.6;
        const d = (avgQ - 0.5) * 8;
        this.addReputation(d);
        CAFE.UI.toast(d >= 0 ? 'منتقد راضی بود! اعتبار +' : 'منتقد ناراضی بود 😕', d >= 0 ? 'good' : 'bad');
      } else if (this.criticMode === 'good') {
        this.addReputation(3);
      }
      this.criticMode = null;
      // goal
      const goal = Math.round(C.GOAL_BASE * Math.pow(C.GOAL_GROWTH, st.day - 1));
      const met = day.revenue >= goal;
      let bonus = 0;
      if (met && !st.goalBonusCollected[st.day]) { bonus = Math.round(goal * 0.2); this.addCash(bonus); st.goalBonusCollected[st.day] = true; }
      // stats
      st.stats.daysPlayed = st.day;
      st.stats.bestDayRevenue = Math.max(st.stats.bestDayRevenue, Math.round(day.revenue));
      st.dayHistory.unshift({ day: st.day, revenue: Math.round(day.revenue), profit: Math.round(net), served: day.served, walkouts: day.walkouts });
      if (st.dayHistory.length > 20) st.dayHistory.length = 20;
      st.flags.noWalkoutDay = (day.walkouts === 0 && day.served > 0);
      // clear leftover customers
      this.customers = []; this.readyTickets = [];
      for (const k of ['bar', 'oven', 'tea']) { const s = this.stations[k]; s.queue = []; s.current = null; s.busyBy = null; s.minigame.active = false; }
      this.checkAchievements();
      this.save();
      CAFE.UI.showSummary({ day: st.day, revenue: Math.round(day.revenue), tips: Math.round(day.tips), expenses: Math.round(expenses), rent, wages, ing: Math.round(day.ingredientCost), net: Math.round(net), served: day.served, perfect: day.perfect, walkouts: day.walkouts, rep: st.reputation, goal, met, bonus, next: () => this.nextDay() });
    }

    nextDay() {
      this.state.day++;
      this.state.open = false;
      this.save();
      CAFE.UI.refreshAll();
    }

    /* --------------------------- spawning ---------------------------------- */
    updateSpawning(simDt) {
      const C = D.CONFIG;
      const intensity = D.spawnIntensity(this.state.dayTime);
      const repMult = 0.7 + 0.55 * (this.state.reputation / 100);
      const marketMult = 1 + 0.18 * (this.state.upgrades.up_market || 0);
      const mult = this.nextDaySpawnMult * this.eventSpawnMult() * repMult * marketMult;
      this.spawnAcc += C.BASE_SPAWN * intensity * mult * simDt;
      const cap = this.queueSlots.length + this.waitSlots.length + this.tables.length * 2;
      let guard = 0;
      while (this.spawnAcc >= 1 && this.customers.length < cap && guard < 6) {
        this.spawnAcc -= 1; guard++;
        if (!this.hasFreeQueueSlot()) { this.spawnAcc = 0; break; }
        const c = new CAFE.Customer(this);
        if (c.queueSlot < 0) break; // safety; will retry as lobby
        this.customers.push(c);
      }
      this.nextDaySpawnMult = 1; // only applies for the day it was set
    }
    hasFreeQueueSlot() { return this.queueSlots.some(s => !s); }

    spawnCustomer(loyal) {
      const c = new CAFE.Customer(this);
      if (c.queueSlot < 0) return null;
      if (loyal) { c.loyal = true; c.color = '#e8b84b'; }
      this.customers.push(c);
      return c;
    }

    /* --------------------------- main update ------------------------------ */
    loop(ts) {
      let dt = (ts - this.last) / 1000; this.last = ts;
      if (dt > 0.1) dt = 0.1; // clamp big gaps
      this.update(dt);
      this.renderer.render(dt);
      CAFE.UI.updateHUD();
      requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
      this._frame++;
      const simDt = (this.state.open && !this.state.paused && !this.modalPause) ? dt * this.state.speed : 0;
      if (simDt > 0) {
        this.state.dayTimeSec += simDt;
        this.state.dayTime = U.clamp(this.state.dayTimeSec / D.CONFIG.DAY_LENGTH, 0, 1);
        this.updateSpawning(simDt);
        for (const c of this.customers) c.update(simDt);
        for (const e of this.employees) e.update(simDt);
        this.updateStations(simDt);
        this.updateEffects(simDt);
        this.updateScheduledEvents();
        // remove dead customers
        for (let i = this.customers.length - 1; i >= 0; i--) if (this.customers[i].dead) this.customers.splice(i, 1);
        // end of day
        if (this.state.dayTimeSec >= D.CONFIG.DAY_LENGTH) { this.state.dayTimeSec = D.CONFIG.DAY_LENGTH; this.closeDay(); }
      }
      FX.update(simDt > 0 ? simDt : dt);
      // periodic achievement + autosave
      this._achTimer += dt;
      if (this._achTimer > 1.5) { this._achTimer = 0; this.checkAchievements(); }
      if (this.state.open && (ts_now() - this._lastSave) > 8000) { this._lastSave = ts_now(); this.save(); }
    }

    updateStations(simDt) {
      for (const k of ['bar', 'oven', 'tea']) {
        const st = this.stations[k];
        if (st.brokenRemain > 0) st.brokenRemain = Math.max(0, st.brokenRemain - simDt);
        // minigame marker
        const mg = st.minigame;
        if (mg.active && !mg.locked) {
          mg.marker += mg.dir * D.CONFIG.MINIGAME_SPEED * simDt;
          if (mg.marker >= 1) { mg.marker = 1; mg.dir = -1; }
          if (mg.marker <= 0) { mg.marker = 0; mg.dir = 1; }
        }
        // progress of current
        if (st.current) {
          st.current.progress += simDt / st.current.prepTime;
          if (st.current.progress >= 1) this.finishTicket(st);
        }
      }
    }

    finishTicket(st) {
      const tk = st.current;
      const mg = st.minigame;
      let q;
      if (mg.locked) {
        const d = Math.abs(mg.lockMarker - 0.5);
        const z = D.CONFIG.MINIGAME_ZONE;
        let bonus = 0;
        if (d < z) bonus = 0.25; else if (d < z * 2) bonus = 0.10; else if (d < z * 3) bonus = 0; else bonus = -0.18;
        q = U.clamp(0.7 + 0.04 * st.level + bonus, 0.1, 1);
      } else {
        q = U.clamp(0.7 + 0.04 * st.level + U.rand(-0.04, 0.04), 0.4, 0.95);
      }
      tk.quality = q; tk.status = 'ready';
      this.readyTickets.push(tk);
      FX.steam(st.__x || (D.LAYOUT.stations[st.key].x + 75), st.__y || (D.LAYOUT.stations[st.key].y + 48));
      FX.sparkle(D.LAYOUT.stations[st.key].x + 75, D.LAYOUT.stations[st.key].y + 40);
      A.play('ding');
      st.current = null; st.busyBy = null; mg.active = false; mg.locked = false; mg.marker = 0; mg.dir = 1;
    }

    updateEffects(simDt) {
      for (let i = this.activeEffects.length - 1; i >= 0; i--) {
        this.activeEffects[i].remaining -= simDt;
        if (this.activeEffects[i].remaining <= 0) this.activeEffects.splice(i, 1);
      }
    }

    eventIngredientMult() { let m = 1; this.activeEffects.forEach(e => { if (e.effect.ingredientMult) m = Math.min(m, e.effect.ingredientMult); }); return m; }
    eventSpawnMult() { let m = 1; this.activeEffects.forEach(e => { if (e.effect.spawnMult) m = Math.max(m, e.effect.spawnMult); }); return m; }
    eventDineinMult() { let m = 1; this.activeEffects.forEach(e => { if (e.effect.dineinMult) m = Math.min(m, e.effect.dineinMult); }); return m; }
    eventRepGainMult() { let m = 1; this.activeEffects.forEach(e => { if (e.effect.repGainMult) m = Math.max(m, e.effect.repGainMult); }); return m; }
    eventSpeedMult() { let m = 1; this.activeEffects.forEach(e => { if (e.effect.speedMult) m = Math.max(m, e.effect.speedMult); }); return m; }

    updateScheduledEvents() {
      for (const se of this.scheduledEvents) {
        if (!se.fired && this.state.dayTimeSec >= se.at) { se.fired = true; this.fireEvent(se.ev); }
      }
    }

    fireEvent(ev) {
      this.state.stats.eventsExperienced++;
      A.play('bell');
      if (ev.kind === 'choice') {
        CAFE.UI.showEvent(ev, (choice) => this.applyEventChoice(ev, choice));
      } else {
        this.applyEventEffect(ev, ev.effect);
        if (ev.toast) CAFE.UI.toast(ev.icon + ' ' + ev.toast, 'gold');
        if (ev.id === 'loyal') { const c = this.spawnCustomer(true); if (c) CAFE.UI.toast('💖 یک مشتری وفادار رسید!', 'gold'); }
        if (ev.id === 'breakdown') { const k = U.choice(['bar', 'oven', 'tea']); this.stations[k].brokenRemain = ev.seconds; CAFE.UI.toast('⚠️ ' + D.LAYOUT.stations[k].label + ' خراب شد!', 'bad'); A.play('warn'); }
        if (ev.id === 'rainy') A.play('rain');
        if (ev.id === 'rush') FX.shakeIt(4);
      }
    }

    applyEventEffect(ev, effect) {
      if (!effect) return;
      const remaining = effect.days ? (D.CONFIG.DAY_LENGTH - this.state.dayTimeSec) : (effect.seconds || 0);
      this.activeEffects.push({ id: ev.id, remaining: Math.max(remaining, 1), effect });
    }

    applyEventChoice(ev, choice) {
      if (choice.cost) { if (!this.spend(choice.cost)) { CAFE.UI.toast(I.t('not_enough_cash'), 'bad'); return; } }
      if (choice.rep) this.addReputation(choice.rep);
      if (choice.nextSpawn) this.nextDaySpawnMult = choice.nextSpawn;
      if (choice.prepCritic) this.criticMode = 'good';
      if (choice.riskCritic) this.criticMode = 'risk';
      if (choice.toast) CAFE.UI.toast(choice.toast, choice.rep > 0 ? 'good' : 'gold');
    }

    /* --------------------------- input ------------------------------------- */
    bindInput() {
      const cv = this.canvas;
      const toWorld = (e) => {
        const r = cv.getBoundingClientRect();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
        const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
        return this.renderer.screenToWorld(x, y);
      };
      const down = (e) => {
        if (this.modalPause) return;
        const p = toWorld(e); this.handleClick(p.x, p.y);
      };
      const move = (e) => { const p = toWorld(e); this.handleHover(p.x, p.y); };
      U.on(cv, 'mousedown', down);
      U.on(cv, 'mousemove', move);
      U.on(cv, 'touchstart', (e) => { e.preventDefault(); down(e); }, { passive: false });
      U.on(cv, 'touchmove', (e) => { e.preventDefault(); move(e); }, { passive: false });
    }

    hitTest(x, y) {
      // customers first (top), then employees, then stations
      let best = null, bestD = 1e9;
      for (const c of this.customers) { const d = U.dist2(x, y, c.x, c.y - 6); if (d < 26 * 26 && d < bestD) { best = c; bestD = d; } }
      for (const e of this.employees) { const d = U.dist2(x, y, e.x, e.y - 6); if (d < 26 * 26 && d < bestD) { best = e; bestD = d; } }
      if (best) return { type: 'entity', obj: best };
      for (const k of ['bar', 'oven', 'tea']) {
        const s = D.LAYOUT.stations[k];
        if (x >= s.x - 6 && x <= s.x + s.w + 6 && y >= s.y - 6 && y <= s.y + s.h + 60) return { type: 'station', key: k };
      }
      return null;
    }

    handleHover(x, y) {
      const h = this.hitTest(x, y);
      this.hover = h ? h.obj : null;
      this.canvas.style.cursor = h ? 'pointer' : 'default';
    }

    handleClick(x, y) {
      const h = this.hitTest(x, y);
      if (!h) return;
      if (h.type === 'entity') {
        const o = h.obj;
        if (o instanceof CAFE.Customer && o.state === 'queued' && !o.orderTaken) { this.takeOrder(o); A.play('tap'); }
        else if (o instanceof CAFE.Employee) { CAFE.UI.toast(o.name + ' — ' + (o.role ? I.t('staff_' + o.role) : I.t('staff_free')), ''); }
        return;
      }
      if (h.type === 'station') this.stationClick(h.key);
    }

    stationClick(key) {
      const st = this.stations[key];
      if (st.brokenRemain > 0) { CAFE.UI.toast('⚠️ ' + D.LAYOUT.stations[key].label + ' خرابه!', 'bad'); A.play('warn'); return; }
      const mg = st.minigame;
      if (mg.active) {
        if (!mg.locked) { mg.locked = true; mg.lockMarker = mg.marker; A.play('tap'); }
        return;
      }
      if (st.current) { if (st.busyBy && st.busyBy !== 'player') CAFE.UI.toast(I.t('staff_auto'), ''); return; }
      if (st.queue.length === 0) { CAFE.UI.toast(I.t('no_order'), ''); A.play('tap'); return; }
      // start manual prep
      const tk = st.queue.shift();
      st.current = tk; st.busyBy = 'player'; tk.status = 'preparing'; tk.startedBy = 'player'; tk.progress = 0;
      st.minigame = { active: true, marker: 0, dir: 1, locked: false, lockMarker: 0, quality: 0 };
      A.play('brew');
    }

    /* --------------------------- achievements ----------------------------- */
    checkAchievements() {
      const newly = Ach.check(this);
      if (newly.length) {
        newly.forEach((id, i) => {
          const a = D.ACH_BY_ID[id];
          setTimeout(() => { CAFE.UI.showAchievement(a); A.play('unlock'); }, i * 400);
        });
        this.save();
      }
    }

    /* --------------------------- shop/upgrades ---------------------------- */
    buyUpgrade(id) {
      const u = D.UPG_BY_ID[id]; if (!u) return false;
      const level = this.state.upgrades[id] || 0;
      if (u.type === 'recipe') {
        if (this.state.upgrades[id]) { CAFE.UI.toast(I.t('shop_owned'), ''); return false; }
        if (!this.spend(u.base)) { CAFE.UI.toast(I.t('not_enough_cash'), 'bad'); return false; }
        this.state.upgrades[id] = 1;
        if (u.unlock && this.state.unlocked.indexOf(u.unlock) < 0) this.state.unlocked.push(u.unlock);
        CAFE.UI.toast('🔓 ' + I.t('recipe_unlocked'), 'good'); A.play('unlock');
        this.save(); CAFE.UI.renderShop(); return true;
      }
      if (level >= u.max) { CAFE.UI.toast(I.t('shop_max'), ''); return false; }
      const cost = D.upgradeCost(u, level);
      if (!this.spend(cost)) { CAFE.UI.toast(I.t('not_enough_cash'), 'bad'); return false; }
      this.state.upgrades[id] = level + 1;
      // apply effects
      if (id === 'up_bar' || id === 'up_tea' || id === 'up_oven') { const k = id.split('_')[1]; this.stations[k].level = level + 1; }
      if (id === 'up_seats') { this.state.tablesActive = U.clamp(this.state.tablesActive + 1, 1, D.LAYOUT.tables.length); this.buildRuntime(); }
      if (id === 'up_queue') { this.state.queueCap = U.clamp(this.state.queueCap + 1, 1, D.LAYOUT.queue.length); this.buildRuntime(); }
      if (id === 'up_wait') { this.state.waitCap = U.clamp(this.state.waitCap + 2, 1, D.LAYOUT.waiting.length); this.buildRuntime(); }
      if (id === 'up_staff') { this.state.staffSlots++; }
      CAFE.UI.toast('✅ ' + I.t('upgrade_bought'), 'good'); A.play('unlock');
      this.save(); CAFE.UI.renderShop(); CAFE.UI.refreshAll(); return true;
    }

    /* --------------------------- staff ------------------------------------- */
    hireEmployee(opts) {
      if (this.employees.length >= this.state.staffSlots) { CAFE.UI.toast(I.t('staff_noslots'), 'bad'); return false; }
      const cost = 40 + opts.skill * 12;
      if (!this.spend(cost)) { CAFE.UI.toast(I.t('not_enough_cash'), 'bad'); return false; }
      const e = new CAFE.Employee(this, opts);
      e.assignRole(opts.role || null);
      this.employees.push(e);
      CAFE.UI.toast('👋 ' + I.t('employee_added') + ': ' + e.name, 'good'); A.play('hire');
      this.save(); CAFE.UI.renderStaff(); CAFE.UI.refreshAll(); return true;
    }
    fireEmployee(e) {
      const i = this.employees.indexOf(e); if (i < 0) return;
      // free any station claim
      const st = e.stationKey ? this.stations[e.stationKey] : null;
      if (st && st.busyBy === e.id && st.current) { st.current = null; st.busyBy = null; st.minigame.active = false; }
      this.employees.splice(i, 1);
      CAFE.UI.toast('🚪 ' + I.t('employee_fired'), ''); A.play('trash');
      this.save(); CAFE.UI.renderStaff(); CAFE.UI.refreshAll();
    }
    assignRole(e, role) {
      const st = e.stationKey ? this.stations[e.stationKey] : null;
      if (st && st.busyBy === e.id && st.current) { st.current = null; st.busyBy = null; st.minigame.active = false; }
      e.assignRole(role);
      this.save(); CAFE.UI.renderStaff();
    }

    /* --------------------------- save/load --------------------------------- */
    save() { S.save(this); }
    resetGame() { S.clear(); location.reload(); }

    /* --------------------------- speed/pause ------------------------------ */
    setSpeed(n) {
      if (this.state.speed === n && n !== 0) { this.state.paused = !this.state.paused; }
      else { this.state.speed = n; this.state.paused = false; }
    }
  }

  function ts_now() { return performance.now(); }

  CAFE.Game = Game;
})(window.CAFE = window.CAFE || {});
