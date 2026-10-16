/* =========================================================================
   ui.js — HUD, sidebar panels, modals, toasts, settings, help, hire,
   achievements, tutorial. Exposes window.CAFE.UI
   ========================================================================= */
(function (CAFE) {
  "use strict";
  const U = CAFE.util, D = CAFE.data, I = CAFE.i18n, A = CAFE.audio;

  const UI = {
    game: null, currentTab: 'menu',
    init(game) {
      this.game = game;
      this.hudCash = U.$('#hud-cash-val');
      this.hudDay = U.$('#hud-day-val');
      this.hudRep = U.$('#hud-rep-val');
      this.hudPhase = U.$('#hud-phase');
      this.hudClockFill = U.$('#hud-clock-fill');
      this.hudClockTime = U.$('#hud-clock-time');
      this.hudRev = U.$('#hud-rev');
      this.hudServed = U.$('#hud-served');
      this.btnOpen = U.$('#btn-open');
      this.openLabel = U.$('#open-label');
      this.btnSound = U.$('#btn-sound');
      this.tabBody = U.$('#tab-body');
      this.modalRoot = U.$('#modal-root');
      this.toastRoot = U.$('#toasts');
      this.tut = U.$('#tutorial');

      // tabs
      U.$$('#tabs .tab').forEach(t => U.on(t, 'click', () => {
        U.$$('#tabs .tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        this.currentTab = t.getAttribute('data-tab');
        this.renderTab(this.currentTab);
        A.play('tap');
      }));
      // open / close
      U.on(this.btnOpen, 'click', () => { this.game.openCafe(); A.play('tap'); });
      // speed
      U.$$('.speed').forEach(b => U.on(b, 'click', () => { this.game.setSpeed(parseInt(b.getAttribute('data-speed'), 10)); A.play('tap'); }));
      // sound
      U.on(this.btnSound, 'click', () => {
        const m = A.toggleMute();
        this.btnSound.textContent = m ? '🔇' : '🔊';
        if (!m && this.game.state.settings.music && this.game.state.open) A.startMusic();
        this.game.state.settings.muted = m; this.game.save();
      });
      // settings / help
      U.on(U.$('#btn-settings'), 'click', () => this.showSettings());
      U.on(U.$('#btn-help'), 'click', () => this.showHelp());

      this.renderTab('menu');
    },

    refreshAll() { this.renderTab(this.currentTab); this.updateHUD(); I.translateDom(document); },

    /* ----------------------------- HUD ------------------------------------ */
    updateHUD() {
      const g = this.game, s = g.state; if (!s) return;
      this.hudCash.textContent = U.money(s.cash);
      this.hudDay.textContent = I.t('stats_day') + ' ' + s.day;
      this.hudRep.textContent = U.stars(s.reputation);
      const phase = s.open ? D.phaseName(s.dayTime) : 'closed';
      this.hudPhase.textContent = I.t('st_' + phase);
      this.hudClockFill.style.width = (s.dayTime * 100).toFixed(1) + '%';
      this.hudClockTime.textContent = U.timeOfDay(s.dayTime) + ' ' + U.clockEmoji(s.dayTime);
      this.hudRev.textContent = U.money(g.day ? g.day.revenue : 0);
      this.hudServed.textContent = g.day ? g.day.served : 0;
      // buttons
      this.openLabel.textContent = s.open ? I.t('close_cafe') : I.t('open_cafe');
      this.btnOpen.classList.toggle('opening', s.open);
      [1, 2, 3].forEach(n => {
        const b = U.$('#spd-' + n);
        const active = s.open && !s.paused && s.speed === n;
        b.classList.toggle('active', active);
      });
      this.btnSound.textContent = s.settings.muted ? '🔇' : '🔊';
    },

    /* --------------------------- tab router ------------------------------- */
    renderTab(name) {
      if (name === 'menu') this.renderMenu();
      else if (name === 'staff') this.renderStaff();
      else if (name === 'shop') this.renderShop();
      else if (name === 'stats') this.renderStats();
    },

    /* ----------------------------- Menu ----------------------------------- */
    renderMenu() {
      const body = this.tabBody; U.clear(body);
      body.appendChild(U.el('div', 'section-title', I.t('menu_title')));
      D.MENU.forEach(m => {
        const isUnlocked = this.game.state.unlocked.indexOf(m.id) >= 0;
        const card = U.el('div', 'menu-item' + (isUnlocked ? '' : ' locked'));
        card.innerHTML =
          `<div class="emoji">${m.emoji}</div>
           <div class="info">
             <div class="name">${m.name}</div>
             <div class="meta">${I.t('menu_cat_' + m.cat)} • ${I.t('menu_price')}: <span class="price">$${m.price}</span> • ${I.t('menu_cost')}: $${m.cost} • ⏱ ${m.prep}s</div>
           </div>
           ${isUnlocked ? '<div class="tag ok">' + I.t('menu_unlocked') + '</div>' : '<div class="tag locked">🔒</div>'}`;
        card.onclick = () => this.itemDetail(m, isUnlocked);
        body.appendChild(card);
      });
      body.appendChild(U.el('div', 'empty-note', I.t('menu_tip')));
    },
    itemDetail(m, unlocked) {
      const html = `
        <div style="text-align:center;font-size:46px;margin:-4px 0 8px">${m.emoji}</div>
        <div class="kv"><span>${I.t('menu_price')}</span><span class="v">$${m.price}</span></div>
        <div class="kv"><span>${I.t('menu_cost')}</span><span class="v">$${m.cost}</span></div>
        <div class="kv"><span>${I.t('menu_prep')}</span><span class="v">${m.prep}s</span></div>
        <div class="kv"><span>${I.t('menu_cat_' + m.cat)}</span><span class="v">${unlocked ? I.t('menu_unlocked') : '🔒'}</span></div>
        <p class="lead" style="margin-top:10px">${m.desc || ''}</p>`;
      this.modal({ title: m.name, bodyHTML: html, actions: [{ label: I.t('close'), cls: 'btn-primary', onClick: (c) => c() }] });
    },

    /* ----------------------------- Staff ---------------------------------- */
    renderStaff() {
      const g = this.game, body = this.tabBody; U.clear(body);
      body.appendChild(U.el('div', 'section-title', I.t('staff_title') + ` (${g.employees.length}/${g.state.staffSlots})`));
      if (g.employees.length === 0) body.appendChild(U.el('div', 'empty-note', I.t('staff_none')));
      const roles = [['cashier', I.t('staff_cashier')], ['bar', I.t('staff_bar')], ['oven', I.t('staff_oven')], ['tea', I.t('staff_tea')]];
      g.employees.forEach(e => {
        const card = U.el('div', 'card');
        const sel = `<select class="btn btn-sm" style="padding:4px 8px">
          ${roles.map(r => `<option value="${r[0]}" ${e.role === r[0] ? 'selected' : ''}>${r[1]}</option>`).join('')}
          <option value="" ${!e.role ? 'selected' : ''}>${I.t('staff_free')}</option>
        </select>`;
        card.innerHTML =
          `<div class="row">
             <div class="grow">
               <div class="title">${e.gender === 'female' ? '👩' : '👨'} ${e.name}</div>
               <div class="sub">${I.t('staff_skill')}: ${e.skill}/10 • ${I.t('staff_wage')}: $${e.wage}/${I.t('daily')}</div>
               <div class="bar-mini"><i style="width:${e.skill * 10}%"></i></div>
             </div>
           </div>
           <div class="row" style="margin-top:8px">
             <div class="grow">${sel}</div>
             <button class="btn btn-sm" data-fire>🚪 ${I.t('staff_fire')}</button>
           </div>`;
        card.querySelector('select').onchange = (ev) => g.assignRole(e, ev.target.value || null);
        card.querySelector('[data-fire]').onclick = () => { if (confirm(I.t('fire_confirm') || 'اخراج شود؟')) g.fireEmployee(e); };
        body.appendChild(card);
      });
      const hire = U.el('button', 'btn btn-primary btn-block', '➕ ' + I.t('staff_hire'));
      hire.onclick = () => this.showHire();
      body.appendChild(hire);
      if (g.employees.length >= g.state.staffSlots) body.appendChild(U.el('div', 'empty-note', I.t('staff_noslots')));
    },

    /* ------------------------------ Shop ---------------------------------- */
    renderShop() {
      const g = this.game, body = this.tabBody; U.clear(body);
      const groups = [
        { t: I.t('shop_machine'), ids: ['up_bar', 'up_tea', 'up_oven'] },
        { t: I.t('shop_expansion'), ids: ['up_seats', 'up_queue', 'up_wait'] },
        { t: I.t('shop_ambiance'), ids: ['up_decor', 'up_market', 'up_loyal'] },
        { t: I.t('shop_staff'), ids: ['up_staff'] },
        { t: I.t('shop_recipe'), ids: ['unlock_mocha', 'unlock_matcha', 'unlock_cake', 'unlock_sandwich'] }
      ];
      groups.forEach(grp => {
        body.appendChild(U.el('div', 'section-title', grp.t));
        grp.ids.forEach(id => body.appendChild(this.shopCard(D.UPG_BY_ID[id])));
      });
    },
    shopCard(u) {
      const g = this.game, level = g.state.upgrades[u.id] || 0;
      const isRecipe = u.type === 'recipe';
      const maxed = !isRecipe && level >= u.max;
      const owned = isRecipe && level > 0;
      const cost = isRecipe ? u.base : D.upgradeCost(u, level);
      const afford = g.state.cash >= cost;
      const card = U.el('div', 'card');
      let right;
      if (owned) right = `<div class="tag ok">${I.t('shop_owned')}</div>`;
      else if (maxed) right = `<div class="tag">${I.t('shop_max')}</div>`;
      else right = `<button class="btn btn-sm ${afford ? 'btn-primary' : ''}" ${afford ? '' : 'disabled'}>${I.t('shop_buy')} $${cost}</button>`;
      const lvl = isRecipe ? '' : `<span class="tag">${I.t('shop_level')} ${level}/${u.max}</span>`;
      card.innerHTML =
        `<div class="row"><div class="grow">
            <div class="title">${u.icon} ${u.name}</div>
            <div class="sub">${u.desc}</div>${lvl}
          </div><div>${right}</div></div>`;
      if (!owned && !maxed) { const b = card.querySelector('button'); if (b) b.onclick = () => g.buyUpgrade(u.id); }
      return card;
    },

    /* ------------------------------ Stats --------------------------------- */
    renderStats() {
      const g = this.game, s = g.state, st = s.stats, body = this.tabBody; U.clear(body);
      body.appendChild(U.el('div', 'section-title', I.t('stats_title')));
      const grid = U.el('div', 'summary-grid');
      grid.innerHTML =
        `<div class="cell"><div class="k">${I.t('stats_cash')}</div><div class="v">${U.money(s.cash)}</div></div>
         <div class="cell"><div class="k">${I.t('stats_day')}</div><div class="v">${s.day}</div></div>
         <div class="cell"><div class="k">${I.t('stats_rep')}</div><div class="v">${U.stars(s.reputation)}</div></div>
         <div class="cell"><div class="k">${I.t('stats_served')}</div><div class="v">${st.totalServed}</div></div>
         <div class="cell"><div class="k">${I.t('stats_revenue')}</div><div class="v">${U.money(st.revenueTotal)}</div></div>
         <div class="cell"><div class="k">${I.t('stats_perfect')}</div><div class="v">${st.perfectCount}</div></div>
         <div class="cell"><div class="k">${I.t('stats_walkout')}</div><div class="v">${st.walkouts}</div></div>
         <div class="cell"><div class="k">${I.t('stats_best_day')}</div><div class="v">${U.money(st.bestDayRevenue)}</div></div>`;
      body.appendChild(grid);
      body.appendChild(U.el('div', 'section-title', I.t('stats_ach')));
      const ag = U.el('div');
      D.ACHIEVEMENTS.forEach(a => {
        const on = !!s.achievements[a.id];
        const d = U.el('div', 'card');
        d.innerHTML = `<div class="row"><div style="font-size:22px">${a.icon}</div>
          <div class="grow"><div class="title">${a.name} ${on ? '<span class="tag ok">✓</span>' : '<span class="tag locked">' + I.t('ach_locked') + '</span>'}</div>
          <div class="sub">${a.desc}</div></div></div>`;
        ag.appendChild(d);
      });
      body.appendChild(ag);
      body.appendChild(U.el('div', 'section-title', I.t('stats_history')));
      if (s.dayHistory.length === 0) body.appendChild(U.el('div', 'empty-note', I.t('stats_none')));
      s.dayHistory.slice(0, 10).forEach(h => {
        const d = U.el('div', 'kv');
        d.innerHTML = `<span>${I.t('summary_title')} ${h.day}</span><span class="v">${U.money(h.revenue)} • ${h.served} 👥</span>`;
        body.appendChild(d);
      });
      const rb = U.el('button', 'btn btn-sm', '🗑 ' + I.t('stats_reset')); rb.style.marginTop = '12px';
      rb.onclick = () => this.confirmReset(); body.appendChild(rb);
    },

    confirmReset() {
      this.modal({
        title: I.t('settings_reset'), lead: I.t('settings_reset_confirm'), pause: true,
        actions: [
          { label: I.t('cancel'), onClick: (c) => c() },
          { label: I.t('settings_reset'), cls: 'btn-primary', onClick: (c) => { c(); this.game.resetGame(); } }
        ]
      });
    },

    /* ----------------------------- Toasts --------------------------------- */
    toast(msg, type) {
      const t = U.el('div', 'toast' + (type ? ' ' + type : ''), msg);
      this.toastRoot.appendChild(t);
      setTimeout(() => { t.classList.add('fade'); setTimeout(() => t.remove(), 400); }, 2600);
      // limit
      while (this.toastRoot.children.length > 5) this.toastRoot.removeChild(this.toastRoot.firstChild);
    },

    /* ----------------------------- Modal ---------------------------------- */
    modal({ title, lead, bodyHTML, actions, pause }) {
      const root = this.modalRoot; U.clear(root);
      const back = U.el('div', 'modal-back');
      const m = U.el('div', 'modal');
      if (title) m.appendChild(U.el('h2', null, title));
      if (lead) m.appendChild(U.el('p', 'lead', lead));
      if (bodyHTML) m.appendChild(U.el('div', null, bodyHTML));
      const act = U.el('div', 'actions');
      (actions || []).forEach(a => {
        const btn = U.el('button', 'btn ' + (a.cls || ''), a.label);
        btn.onclick = () => a.onClick && a.onClick(close);
        act.appendChild(btn);
      });
      if (actions && actions.length) m.appendChild(act);
      back.appendChild(m); root.appendChild(back);
      const close = () => { U.clear(root); if (pause) this.game.modalPause = false; };
      if (pause) this.game.modalPause = true;
      return { close, node: m };
    },

    showSummary(d) {
      const goalHTML =
        `<div class="kv"><span>${I.t('summary_goal')}</span><span class="v">${U.money(d.goal)} ${d.met ? '✅' : '❌'}</span></div>`;
      const bodyHTML =
        `<div class="summary-grid">
           <div class="cell"><div class="k">${I.t('summary_rev')}</div><div class="v">${U.money(d.revenue)}</div></div>
           <div class="cell"><div class="k">${I.t('summary_served')}</div><div class="v">${d.served}</div></div>
           <div class="cell"><div class="k">${I.t('summary_perfect')}</div><div class="v">${d.perfect}</div></div>
           <div class="cell"><div class="k">${I.t('summary_walkout')}</div><div class="v">${d.walkouts}</div></div>
         </div>
         <div class="kv"><span>${I.t('summary_rent')}</span><span class="v">-${U.money(d.rent)}</span></div>
         <div class="kv"><span>${I.t('summary_wages')}</span><span class="v">-${U.money(d.wages)}</span></div>
         <div class="kv"><span>${I.t('summary_expense')} (${I.t('menu_cost')})</span><span class="v">-${U.money(d.ing)}</span></div>
         <div class="kv"><span>${I.t('summary_profit')}</span><span class="v">${U.money(d.net)}</span></div>
         ${d.met ? `<div class="kv"><span>${I.t('summary_bonus')}</span><span class="v" style="color:var(--gold)">+${U.money(d.bonus)} 🎁</span></div>` : ''}
         ${goalHTML}
         <div class="kv"><span>${I.t('summary_rep')}</span><span class="v">${U.stars(d.rep)}</span></div>`;
      this.modal({
        title: I.t('summary_title') + ' — ' + I.t('stats_day') + ' ' + d.day,
        lead: d.met ? I.t('summary_met') : I.t('summary_miss'),
        bodyHTML, pause: true,
        actions: [{ label: I.t('summary_next'), cls: 'btn-primary', onClick: (c) => { c(); d.next(); } }]
      });
    },

    showEvent(ev, cb) {
      const actions = ev.choices.map(ch => ({
        label: ch.label, cls: 'btn-primary',
        onClick: (c) => { c(); cb(ch); }
      }));
      this.modal({ title: ev.icon + '  ' + ev.name, lead: ev.desc, actions, pause: true });
    },

    showAchievement(a) {
      const pop = U.el('div', 'ach-pop',
        `<div class="medal">${a.icon}</div><div><div style="font-weight:800">${I.t('ach_unlocked')}</div><div style="font-size:13px">${a.name}</div></div>`);
      U.$('#game-root').appendChild(pop);
      setTimeout(() => pop.remove(), 3600);
    },

    /* ---------------------------- Settings -------------------------------- */
    showSettings() {
      const g = this.game, s = g.state.settings;
      const wrap = U.el('div');
      wrap.innerHTML =
        `<div class="field"><label>${I.t('settings_volume')}</label>
           <input type="range" min="0" max="1" step="0.05" value="${s.volume}" id="set-vol"></div>
         <div class="field"><label>${I.t('settings_music')}</label><br>
           <button class="btn btn-sm" id="set-music">${s.music ? '🔊 ' + I.t('settings_on') : '🔇 ' + I.t('settings_off')}</button></div>
         <div class="field"><label>${I.t('settings_lang')}</label><br>
           <button class="btn btn-sm" id="set-fa">${I.t('settings_fa')}</button>
           <button class="btn btn-sm" id="set-en">${I.t('settings_en')}</button></div>
         <div class="field"><label>${I.t('settings_quality')}</label><br>
           <button class="btn btn-sm" id="set-q">${s.quality === 'high' ? I.t('settings_high') : I.t('settings_low')}</button></div>
         <div class="field"><button class="btn btn-sm" id="set-reset" style="color:var(--bad)">🗑 ${I.t('settings_reset')}</button></div>`;
      this.modal({ title: I.t('settings_title'), bodyHTML: '', actions: [{ label: I.t('close'), cls: 'btn-primary', onClick: (c) => c() }], pause: true, bodyNode: wrap });
      // wire after node inserted
      const node = this.modalRoot.querySelector('.modal'); node.insertBefore(wrap, node.querySelector('.actions'));
      const vol = wrap.querySelector('#set-vol');
      vol.oninput = () => { s.volume = parseFloat(vol.value); A.setVolume(s.volume); g.save(); };
      const musicBtn = wrap.querySelector('#set-music');
      musicBtn.onclick = () => { s.music = !s.music; musicBtn.textContent = s.music ? '🔊 ' + I.t('settings_on') : '🔇 ' + I.t('settings_off'); if (s.music && g.state.open && !s.muted) A.startMusic(); else A.stopMusic(); g.save(); };
      wrap.querySelector('#set-fa').onclick = () => this.switchLang('fa');
      wrap.querySelector('#set-en').onclick = () => this.switchLang('en');
      const q = wrap.querySelector('#set-q');
      q.onclick = () => { s.quality = s.quality === 'high' ? 'low' : 'high'; q.textContent = s.quality === 'high' ? I.t('settings_high') : I.t('settings_low'); g.save(); };
      wrap.querySelector('#set-reset').onclick = () => this.confirmReset();
    },
    switchLang(lang) {
      I.setLang(lang); this.game.state.settings.lang = lang; this.game.save();
      I.translateDom(document); this.refreshAll();
    },

    /* ------------------------------ Help ---------------------------------- */
    showHelp() {
      this.modal({ title: I.t('help_title'), bodyHTML: '<p class="lead">' + I.t('help_text') + '</p>', actions: [{ label: I.t('close'), cls: 'btn-primary', onClick: (c) => c() }] });
    },

    /* ------------------------------ Hire ---------------------------------- */
    showHire() {
      const g = this.game;
      const fn = U.choice(D.FIRST_M.concat(D.FIRST_F));
      const wrap = U.el('div');
      wrap.innerHTML =
        `<div class="field"><label>${I.t('staff_name')}</label><input class="btn btn-sm" id="hire-name" value="${fn}" style="width:100%;text-align:right"></div>
         <div class="field"><label>${I.t('staff_gender')}</label><br>
           <button class="btn btn-sm" id="hire-m">${I.t('staff_male')}</button>
           <button class="btn btn-sm" id="hire-f">${I.t('staff_female')}</button></div>
         <div class="field"><label>${I.t('hire_pick_role')}</label>
           <select class="btn btn-sm" id="hire-role" style="width:100%">
             <option value="cashier">${I.t('staff_cashier')}</option>
             <option value="bar">${I.t('staff_bar')}</option>
             <option value="oven">${I.t('staff_oven')}</option>
             <option value="tea">${I.t('staff_tea')}</option>
           </select></div>
         <div class="sub" id="hire-cost"></div>`;
      const m = this.modal({ title: I.t('hire_title'), bodyHTML: '', actions: [{ label: I.t('cancel'), onClick: (c) => c() }, { label: I.t('hire'), cls: 'btn-primary', onClick: (c) => {
        const name = wrap.querySelector('#hire-name').value || fn;
        const gender = wrap.querySelector('#hire-m').classList.contains('active') ? 'male' : 'female';
        const role = wrap.querySelector('#hire-role').value;
        const cost = 40 + curSkill * 12;
        if (!g.spend(cost)) { this.toast(I.t('not_enough_cash'), 'bad'); return; }
        g.hireEmployee({ name, gender, skill: curSkill, role });
        c();
      } }], pause: true, bodyNode: wrap });
      const node = this.modalRoot.querySelector('.modal'); node.insertBefore(wrap, node.querySelector('.actions'));
      let gender = 'male'; const bm = wrap.querySelector('#hire-m'), bf = wrap.querySelector('#hire-f');
      let curSkill = U.randInt(3, 9);
      const setG = (x) => { bm.classList.toggle('active', x === 'male'); bf.classList.toggle('active', x === 'female'); gender = x; };
      bm.classList.add('active'); bm.onclick = () => setG('male'); bf.onclick = () => setG('female');
      const upd = () => { wrap.querySelector('#hire-cost').textContent = I.t('staff_hire_cost') + ': $' + (40 + curSkill * 12); };
      upd();
    },

    /* ---------------------------- Tutorial -------------------------------- */
    showTutorial() {
      if (this.game.state.tutorialDone) return;
      const steps = [
        { h: 'خوش‌آمدی! ☕', p: 'روی دکمه «باز کردن کافه» پایین سمت چپ بزن تا مشتری‌ها بیان.' },
        { h: 'سفارش‌گیری', p: 'وقتی مشتری «؟» بالای سرش ظاهر شد، روی خودش کلیک کن تا سفارش رو ثبت کنی.' },
        { h: 'آماده‌سازی', p: 'روی دستگاه (اسپرسو/فر/دم‌کن) کلیک کن تا نوبت بعدی درست بشه. دوباره کلیک کن وقتی نشانگر تو نوار سبزه تا «عالی» بشه!' },
        { h: 'پیشرفت', p: 'با پولت از تب «فروشگاه» دستگاه و میز بخر و از تب «کارکنان» کارمند استخدام کن تا کارها خودکار انجام بشه. به ۵ ستاره برس!' }
      ];
      let i = 0;
      const box = this.tut; box.style.display = 'block'; box.style.left = '16px'; box.style.bottom = '84px'; box.style.right = 'auto'; box.style.top = 'auto';
      const render = () => {
        box.innerHTML = `<h4>${steps[i].h}</h4><p>${steps[i].p}</p>
          <div class="step-dots">${steps.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
          <div class="tut-actions">
            <button class="btn btn-sm" id="tut-skip">${I.t('tutorial_skip')}</button>
            <button class="btn btn-sm btn-primary" id="tut-next">${i < steps.length - 1 ? I.t('tutorial_next') : I.t('done')}</button>
          </div>`;
        box.querySelector('#tut-skip').onclick = () => this.endTutorial();
        box.querySelector('#tut-next').onclick = () => { if (i < steps.length - 1) { i++; render(); } else this.endTutorial(); };
      };
      render();
    },
    endTutorial() { this.tut.style.display = 'none'; this.game.state.tutorialDone = true; this.game.save(); }
  };

  CAFE.UI = UI;
})(window.CAFE = window.CAFE || {});
