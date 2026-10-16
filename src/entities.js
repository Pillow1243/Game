/* =========================================================================
   entities.js — Customer, Employee, Particle classes + movement/ticket helpers
   Exposes window.CAFE.Customer, .Employee, .Particle
   ========================================================================= */
(function (CAFE) {
  "use strict";
  const U = CAFE.util, D = CAFE.data;

  const SHIRTS = ['#c0504d','#4f81bd','#9bbb59','#8064a2','#f6a13c','#4bacc6','#d98880','#7f9a65','#b084cc','#e2804a'];
  const SKINS  = ['#f1c9a5','#e0ac86','#c68642','#8d5524','#ffdbac','#a86b3c'];
  const HAIRS  = ['#2b2b2b','#4a2c17','#6b4423','#1c1c1c','#7a5230','#3a2a1a','#5a3a22','#2e2018'];

  /* --------------------------- Movement helper --------------------------- */
  function moveToward(e, dt, speed) {
    if (!e.target) { e.moving = false; return true; }
    const sp = (speed || e.speed || 70);
    const dx = e.target.x - e.x, dy = e.target.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d < 1.5) { e.x = e.target.x; e.y = e.target.y; e.moving = false; return true; }
    e.facing = dx < 0 ? -1 : 1;
    const step = sp * dt;
    if (step >= d) { e.x = e.target.x; e.y = e.target.y; e.moving = false; return true; }
    e.x += (dx / d) * step; e.y += (dy / d) * step;
    e.moving = true; e.walkPhase = (e.walkPhase || 0) + step * 0.06;
    return false;
  }
  function setTarget(e, p) { e.target = p ? { x: p.x, y: p.y } : null; }

  /* ------------------------------ Customer ------------------------------- */
  class Customer {
    constructor(game) {
      this.game = game;
      this.id = U.uid();
      this.x = D.LAYOUT.door.x; this.y = D.LAYOUT.door.y;
      this.speed = U.rand(58, 86);
      this.size = 15;
      this.color = U.choice(SHIRTS);
      this.skin = U.choice(SKINS);
      this.hair = U.choice(HAIRS);
      this.name = U.choice(D.CUST_NAMES);
      this.walkPhase = U.rand(0, 6);
      this.facing = 1; this.moving = false;
      this.state = 'entering';
      this.orderTaken = false;
      this.items = [];           // chosen menu items (after order)
      this.dineIn = false;
      this.table = null; this.seat = null;
      this.patienceOrderMax = D.CONFIG.PATIENCE_ORDER * U.rand(0.9, 1.15);
      this.patienceOrder = this.patienceOrderMax;
      this.patienceItemMax = D.CONFIG.PATIENCE_ITEM * U.rand(0.9, 1.12);
      this.patienceItem = this.patienceItemMax;
      this.bubble = '?';
      this.mood = 1;             // 1 happy -> 0 angry
      this.dead = false;
      this.paid = false;
      this.queueSlot = -1; this.waitSlot = -1;
      this.loyal = false;
      this.consumeTimer = 0;
      // assign queue slot
      this.queueSlot = game.takeQueueSlot(this);
      if (this.queueSlot < 0) { this.state = 'lobby'; this.target = { x: D.LAYOUT.door.x + 20, y: D.LAYOUT.door.y - 10 }; }
      else setTarget(this, D.LAYOUT.queue[this.queueSlot]);
    }

    get patience() {
      return this.orderTaken ? this.patienceItem / this.patienceItemMax
                             : this.patienceOrder / this.patienceOrderMax;
    }

    takeOrder() {
      if (this.orderTaken || this.state !== 'queued') return false;
      const g = this.game;
      this.orderTaken = true;
      this.state = 'waiting';
      // build items
      const menu = g.unlockedMenu();
      const n = 1 + (U.chance(0.32 + g.state.reputation / 320) ? 1 : 0);
      this.items = [];
      for (let i = 0; i < n; i++) this.items.push(U.choice(menu));
      // dine-in?
      this.dineIn = U.chance(D.CONFIG.DINEIN_BASE * (g.eventDineinMult()) * (g.freeTable() ? 1 : 0));
      this.bubble = this.items.map(it => it.emoji).join('');
      // free queue slot, take a waiting slot
      g.freeQueueSlot(this.queueSlot); this.queueSlot = -1;
      this.waitSlot = g.takeWaitSlot(this);
      if (this.waitSlot < 0) { // no waiting room: keep near counter, will retry
        this.target = { x: D.LAYOUT.counter.x + D.LAYOUT.counter.w + 20, y: D.LAYOUT.counter.y + 30 };
      } else setTarget(this, D.LAYOUT.waiting[this.waitSlot]);
      // create tickets
      g.createTickets(this);
      g.audio.play('order');
      return true;
    }

    update(dt) {
      const g = this.game;
      switch (this.state) {
        case 'entering':
          if (moveToward(this, dt)) { this.state = 'queued'; this.bubble = '?'; }
          break;
        case 'lobby':
          if (this.queueSlot < 0) {
            const s = g.takeQueueSlot(this);
            if (s >= 0) { this.queueSlot = s; this.state = 'entering'; setTarget(this, D.LAYOUT.queue[s]); }
          }
          break;
        case 'queued':
          this.patienceOrder -= dt;
          if (this.patienceOrder <= 0) this.walkout('order');
          break;
        case 'waiting': {
          // if no wait slot yet, try to get one
          if (this.waitSlot < 0) { const s = g.takeWaitSlot(this); if (s >= 0) { this.waitSlot = s; setTarget(this, D.LAYOUT.waiting[s]); } }
          this.patienceItem -= dt;
          if (this.patienceItem <= 0) { this.walkout('item'); break; }
          if (g.isOrderReady(this)) { this.state = 'toPickup'; setTarget(this, D.LAYOUT.pickup); }
          break;
        }
        case 'toPickup':
          if (moveToward(this, dt)) {
            g.onServed(this);
            // choose dine-in or exit
            if (this.dineIn) {
              const t = g.takeTable(this);
              if (t) { this.table = t; this.state = 'toTable'; setTarget(this, t.seat); }
              else { this.dineIn = false; this.state = 'toExit'; setTarget(this, D.LAYOUT.door); }
            } else { this.state = 'toExit'; setTarget(this, D.LAYOUT.door); }
          }
          break;
        case 'toTable':
          if (moveToward(this, dt)) { this.state = 'seated'; this.consumeTimer = U.rand(D.CONFIG.CONSUME_TIME[0], D.CONFIG.CONSUME_TIME[1]); this.bubble = ''; g.fx.heart(this.x, this.y - 20); }
          break;
        case 'seated':
          this.consumeTimer -= dt;
          if (this.consumeTimer <= 0) { this.state = 'toExit'; setTarget(this, D.LAYOUT.door); }
          break;
        case 'toExit':
        case 'leaving':
          if (moveToward(this, dt)) { this.dead = true; g.releaseTable(this); if (this.waitSlot >= 0) g.freeWaitSlot(this.waitSlot); }
          break;
      }
    }

    walkout(reason) {
      if (this.state === 'toExit' || this.state === 'leaving' || this.dead) return;
      this.game.onWalkout(this, reason);
      this.state = 'leaving';
      if (this.queueSlot >= 0) { this.game.freeQueueSlot(this.queueSlot); this.queueSlot = -1; }
      if (this.waitSlot >= 0) { this.game.freeWaitSlot(this.waitSlot); this.waitSlot = -1; }
      this.bubble = '💢';
      setTarget(this, D.LAYOUT.door);
    }
  }

  /* ------------------------------ Employee ------------------------------- */
  class Employee {
    constructor(game, opts) {
      this.game = game;
      this.id = U.uid();
      this.name = opts.name;
      this.gender = opts.gender || 'male';
      this.skill = U.clamp(opts.skill || U.randInt(3, 8), 1, 10);
      this.wage = Math.round(D.CONFIG.WAGE_BASE * (0.7 + this.skill * 0.09));
      this.role = null;          // 'cashier' | 'bar' | 'oven' | 'tea'
      this.stationKey = null;
      this.x = D.LAYOUT.staffArea.x; this.y = D.LAYOUT.staffArea.y;
      this.speed = U.rand(80, 105);
      this.color = this.gender === 'female' ? '#d98aa6' : '#5b8fb0';
      this.skin = U.choice(SKINS); this.hair = U.choice(HAIRS);
      this.walkPhase = U.rand(0, 6); this.facing = -1; this.moving = false;
      this.state = 'break';      // 'break' | 'toWork' | 'working' | 'toBreak'
      this.currentTicket = null;
      this.target = null;
    }

    assignRole(role) {
      this.role = role;
      this.stationKey = (role === 'bar' || role === 'oven' || role === 'tea') ? role : null;
    }

    stationFront() {
      const s = D.LAYOUT.stations[this.stationKey];
      return { x: s.x + s.w / 2, y: s.y + s.h + 26 };
    }

    update(dt) {
      const g = this.game;
      if (this.role === 'cashier') {
        // find a queued customer without a cashier
        const cust = g.customers.find(c => c.state === 'queued' && !c.orderTaken && !c._cashierClaim);
        if (cust) {
          cust._cashierClaim = this.id;
          this.state = 'toWork';
          this.target = { x: cust.x + 26, y: cust.y - 6 };
          if (moveToward(this, dt)) { cust.takeOrder(); this.state = 'break'; this.target = { x: D.LAYOUT.staffArea.x, y: D.LAYOUT.staffArea.y }; }
        } else { this.idle(dt); }
        return;
      }
      if (this.stationKey) {
        const st = g.stations[this.stationKey];
        if (st.brokenUntil > g.state.dayTimeSec) { this.idle(dt); return; }
        if (!st.current && st.queue.length > 0 && !st.busyBy) {
          // grab next ticket
          const t = st.queue.shift();
          st.current = t; st.busyBy = this.id; t.status = 'preparing'; t.startedBy = 'emp:' + this.id;
          this.currentTicket = t;
          this.state = 'toWork';
          this.target = this.stationFront();
          g.audio.play('brew');
        }
        if (st.current && st.busyBy === this.id) {
          // ensure at station
          if (!this.target || U.dist(this.x, this.y, this.target.x, this.target.y) > 4) this.target = this.stationFront();
          moveToward(this, dt);
          st.current.progress += dt / st.current.prepTime;
          if (st.current.progress >= 1) {
            const q = U.clamp(0.7 + (this.skill - 5) * 0.022 + U.rand(-0.05, 0.05), 0.2, 1);
            st.current.quality = q; st.current.status = 'ready';
            g.readyTickets.push(st.current);
            g.fx.steam(st.x, st.y); g.fx.sparkle(st.x, st.y - 10);
            g.audio.play('ding');
            st.current = null; st.busyBy = null; this.currentTicket = null; this.state = 'break';
            this.target = { x: D.LAYOUT.staffArea.x, y: D.LAYOUT.staffArea.y };
          }
        } else if (!st.current) { this.idle(dt); }
        return;
      }
      this.idle(dt);
    }

    idle(dt) {
      if (this.state !== 'break') { this.state = 'break'; this.target = { x: D.LAYOUT.staffArea.x + U.rand(-20, 20), y: D.LAYOUT.staffArea.y + U.rand(-10, 14) }; }
      moveToward(this, dt);
    }
  }

  /* ------------------------------ Particle ------------------------------- */
  class Particle {
    constructor(opts) {
      this.x = opts.x; this.y = opts.y;
      this.vx = opts.vx || 0; this.vy = opts.vy || 0;
      this.life = opts.life || 1; this.maxLife = this.life;
      this.type = opts.type || 'dot';
      this.color = opts.color || '#fff';
      this.size = opts.size || 4;
      this.text = opts.text || '';
      this.gravity = opts.gravity != null ? opts.gravity : 0;
      this.dead = false;
    }
    update(dt) {
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.vy += this.gravity * dt;
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
    }
  }

  CAFE.Customer = Customer;
  CAFE.Employee = Employee;
  CAFE.Particle = Particle;
  CAFE.moveToward = moveToward;
  CAFE.setTarget = setTarget;
})(window.CAFE = window.CAFE || {});
