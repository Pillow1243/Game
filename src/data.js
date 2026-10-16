/* =========================================================================
   data.js — all game content & balance: menu, stations, upgrades, events,
   achievements, names, world layout, configuration. Exposes window.CAFE.data
   ========================================================================= */
(function (CAFE) {
  "use strict";
  const U = CAFE.util;

  /* ----------------------------- World layout ---------------------------- */
  // Virtual game world (logical pixels). Rendered scaled to fit the canvas.
  const WORLD = { w: 1024, h: 640 };

  const LAYOUT = {
    door:   { x: 64,  y: 596 },
    counter:{ x: 130, y: 452, w: 250, h: 70 }, // desk; front edge y=522
    pickup: { x: 372, y: 486 },

    // queue slots (wait to order) in front of counter
    queue: [
      { x: 150, y: 588 }, { x: 190, y: 588 }, { x: 230, y: 588 },
      { x: 270, y: 588 }, { x: 310, y: 588 }, { x: 350, y: 588 }
    ],
    // waiting slots (after order, waiting for drink) to the right
    waiting: [
      { x: 452, y: 566 }, { x: 452, y: 612 }, { x: 506, y: 566 },
      { x: 506, y: 612 }, { x: 560, y: 566 }, { x: 560, y: 612 }
    ],

    // stations (kitchen) at the top
    stations: {
      bar:  { x: 250, y: 158, w: 150, h: 96, key: 'bar',  label: 'اسپرسو', icon: '⚙️' },
      oven: { x: 520, y: 158, w: 150, h: 96, key: 'oven', label: 'فر',     icon: '🔥' },
      tea:  { x: 790, y: 158, w: 150, h: 96, key: 'tea',  label: 'دم‌کن',  icon: '🍵' }
    },

    // tables: up to 8 spots (center + radius); seats computed in game.
    // First START_TABLES are active; upgrades reveal more.
    tables: [
      { x: 628, y: 430, r: 30 }, { x: 858, y: 430, r: 30 },
      { x: 492, y: 360, r: 28 }, { x: 742, y: 330, r: 28 },
      { x: 958, y: 360, r: 28 }, { x: 560, y: 540, r: 28 },
      { x: 800, y: 540, r: 28 }, { x: 940, y: 540, r: 28 }
    ],

    staffArea: { x: 936, y: 92 }
  };

  /* ------------------------------- Menu ---------------------------------- */
  // cat: coffee|tea|food ; station: bar|tea|oven
  const MENU = [
    { id:'espresso',   name:'اسپرسو',     emoji:'☕', cat:'coffee', station:'bar',  price:3.0,  cost:0.6, prep:2.2, color:'#3a2317', unlock:null,        desc:'قهوه غلیظ و تلخ کلاسیک.' },
    { id:'americano',  name:'آمریکانو',   emoji:'☕', cat:'coffee', station:'bar',  price:4.0,  cost:0.7, prep:2.6, color:'#4a2c1a', unlock:null,        desc:'اسپرسو با آب داغ.' },
    { id:'latte',      name:'لاته',       emoji:'🥛', cat:'coffee', station:'bar',  price:5.0,  cost:1.1, prep:3.2, color:'#dbب', unlock:null },
    { id:'cappuccino', name:'کاپوچینو',   emoji:'☕', cat:'coffee', station:'bar',  price:5.0,  cost:1.1, prep:3.2, color:'#e2c39b', unlock:null,        desc:'اسپرسو با فوم شیر.' },
    { id:'mocha',      name:'موکا',       emoji:'🍫', cat:'coffee', station:'bar',  price:6.0,  cost:1.4, prep:3.6, color:'#6b3f25', unlock:'unlock_mocha', desc:'اسپرسو، شکلات و شیر.' },
    { id:'hotchoco',   name:'شکلات‌داغ',  emoji:'🍫', cat:'coffee', station:'bar',  price:4.5,  cost:0.9, prep:3.0, color:'#b07a4a', unlock:null,        desc:'شکلات غلیظ و گرم.' },
    { id:'chai',       name:'چای ماسالا', emoji:'🍵', cat:'tea',    station:'tea',  price:4.5,  cost:0.8, prep:2.6, color:'#c98a4b', unlock:null,        desc:'چای ادویه‌دار هندی.' },
    { id:'greentea',   name:'چای سبز',    emoji:'🍵', cat:'tea',    station:'tea',  price:3.5,  cost:0.4, prep:2.0, color:'#9bc77a', unlock:null,        desc:'چای سبز ملایم.' },
    { id:'matcha',     name:'لاته مچ‌مچ', emoji:'🍵', cat:'tea',    station:'tea',  price:6.0,  cost:1.2, prep:3.0, color:'#8fbf6b', unlock:'unlock_matcha', desc:'پودر چای سبز ژاپنی.' },
    { id:'croissant',  name:'کروسان',     emoji:'🥐', cat:'food',   station:'oven', price:4.0,  cost:1.2, prep:4.5, color:'#d8a85a', unlock:null,        desc:'شیرینی کره‌ای ترد.' },
    { id:'muffin',     name:'مافین',      emoji:'🧁', cat:'food',   station:'oven', price:3.5,  cost:0.9, prep:4.0, color:'#a8643c', unlock:null,        desc:'کیک فنجانی میوه‌ای.' },
    { id:'cheesecake', name:'چیزکیک',     emoji:'🍰', cat:'food',   station:'oven', price:6.0,  cost:1.5, prep:4.5, color:'#e9d9a8', unlock:'unlock_cake',  desc:'کیک پنیری لوکس.' },
    { id:'sandwich',   name:'ساندویچ',    emoji:'🥪', cat:'food',   station:'oven', price:6.5,  cost:2.0, prep:5.0, color:'#c79a5a', unlock:'unlock_sandwich', desc:'ساندویچ گرم و مقوی.' }
  ];
  // fix a typo color
  MENU[2].color = '#d9b48f'; MENU[2].unlock = null; MENU[2].desc = 'اسپرسو با شیر زیاد.';

  const MENU_BY_ID = {};
  MENU.forEach(m => MENU_BY_ID[m.id] = m);

  /* ----------------------------- Upgrades ------------------------------- */
  // type: machine|expansion|ambiance|marketing|staff|recipe
  // repeatable ones use cost = base * growth^level, maxLevel.
  const UPGRADES = [
    { id:'up_bar',    type:'machine',   name:'دستگاه اسپرسوی حرفه‌ای', icon:'⚙️', base:130, growth:1.7, max:5, desc:'سرعت و کیفیت قهوه +', target:'bar' },
    { id:'up_tea',    type:'machine',   name:'دم‌کن بهتر',            icon:'🍵', base:110, growth:1.7, max:5, desc:'سرعت و کیفیت نوشیدنی‌ها +', target:'tea' },
    { id:'up_oven',   type:'machine',   name:'فر صنعتی',              icon:'🔥', base:120, growth:1.7, max:5, desc:'سرعت و کیفیت شیرینی +', target:'oven' },
    { id:'up_seats',  type:'expansion', name:'میز و صندلی بیشتر',     icon:'🪑', base:95,  growth:1.8, max:6, desc:'ظرفیت نشستن مشتریان +۱' },
    { id:'up_queue',  type:'expansion', name:'پیشخوان بزرگتر',        icon:'🚶', base:70,  growth:1.7, max:4, desc:'ظرفیت صف سفارش +۱' },
    { id:'up_wait',   type:'expansion', name:'سالن انتظار',          icon:'🛋️', base:60,  growth:1.6, max:5, desc:'ظرفیت انتظار برای نوشیدنی +۲' },
    { id:'up_decor',  type:'ambiance',  name:'دکوراسیون و فضای سبز',  icon:'🪴', base:150, growth:1.6, max:5, desc:'اعتبار و انعام بیشتر' },
    { id:'up_market', type:'marketing', name:'کمپین بازاریابی',       icon:'📣', base:130, growth:1.6, max:5, desc:'ورود مشتری بیشتر' },
    { id:'up_loyal',  type:'marketing', name:'باشگاه مشتریان',        icon:'💳', base:110, growth:1.6, max:4, desc:'انعام و بازگشت مشتری +' },
    { id:'up_staff',  type:'staff',     name:'مجوز استخدام',          icon:'📋', base:200, growth:1.8, max:5, desc:'یک جایگاه کارمندی دیگر' },
    // one-time recipe unlocks
    { id:'unlock_mocha',      type:'recipe', name:'باز کردن موکا',        icon:'🍫', base:140, max:1, desc:'موکا به منو اضافه می‌شود', unlock:'mocha' },
    { id:'unlock_matcha',     type:'recipe', name:'باز کردن لاته مچ‌مچ', icon:'🍵', base:160, max:1, desc:'لاته مچ‌مچ به منو اضافه می‌شود', unlock:'matcha' },
    { id:'unlock_cake',       type:'recipe', name:'باز کردن چیزکیک',     icon:'🍰', base:180, max:1, desc:'چیزکیک به منو اضافه می‌شود', unlock:'cheesecake' },
    { id:'unlock_sandwich',   type:'recipe', name:'باز کردن ساندویچ',    icon:'🥪', base:200, max:1, desc:'ساندویچ به منو اضافه می‌شود', unlock:'sandwich' }
  ];
  const UPG_BY_ID = {};
  UPGRADES.forEach(u => UPG_BY_ID[u.id] = u);

  function upgradeCost(u, level) {
    if (u.type === 'recipe') return u.base;
    return Math.round(u.base * Math.pow(u.growth, level));
  }

  /* ----------------------------- Events ---------------------------------- */
  // weight = relative chance per day; kind: choice|passive
  const EVENTS = [
    { id:'influencer', name:'اینفلوئنسر معروف', icon:'📸', weight:8, kind:'choice',
      desc:'یک اینفلوئنسر با دنبال‌کننده‌های زیاد می‌خواد از کافه شما بازدید کنه.',
      choices:[
        { label:'دعوتش کن (۵۰$)', cost:50, rep:4, nextSpawn:1.5, toast:'اینفلوئنسر آمد! اعتبار +۴' },
        { label:'نادیده بگیر', rep:0, toast:'فرصت تبلیغ رو از دست دادی.' }
      ] },
    { id:'critic', name:'منتقد غذای مخفی', icon:'🕵️', weight:7, kind:'choice',
      desc:'یک منتقد ناشناس قصد داره کیفیت رو بسنجه. برای آماده‌سازی ۸۰$ خرج کن.',
      choices:[
        { label:'آماده‌سازی (۸۰$)', cost:80, prepCritic:true, toast:'منتقد تحت تأثیر آمادگی قرار گرفت!' },
        { label:'ریسک کن', riskCritic:true, toast:'منتقد بدون آمادگی اومد…' }
      ] },
    { id:'supplier', name:'تخفیف تامین‌کننده', icon:'📦', weight:10, kind:'passive', days:1,
      desc:'تامین‌کننده مواد اولیه رو ۳۰٪ ارزان‌تر می‌ده (امروز).', effect:{ ingredientMult:0.7 }, toast:'مواد اولیه ۳۰٪ ارزان‌تر 📦' },
    { id:'breakdown', name:'خرابی دستگاه', icon:'🔧', weight:9, kind:'passive', seconds:18,
      desc:'یکی از دستگاه‌ها خراب شد! برای چند ثانیه از کار می‌افته.', effect:{ breakdown:true }, toast:'⚠️ یک دستگاه خراب شد!' },
    { id:'rainy', name:'روز بارانی', icon:'🌧️', weight:10, kind:'passive', days:1,
      desc:'با‎اران مشتری‌های بیشتری قهوه می‌خوان اما کمتر می‌نشینن.', effect:{ rain:true, spawnMult:1.25, dineinMult:0.6 }, toast:'🌧️ هوا بارانی — تقاضای قهوه بیشتر' },
    { id:'rush', name:'ساعت شلوغی', icon:'⏱️', weight:11, kind:'passive', seconds:30,
      desc:'ناگهان جمعیت زیادی می‌رسن! آماده‌ای؟', effect:{ spawnMult:2.2 }, toast:'⏱️ ساعت شلوغی! مشتری دوبرابر' },
    { id:'festival', name:'جشن محلی', icon:'🎉', weight:8, kind:'passive', days:1,
      desc:'جشن محلی نزدیک کافه برپاست — مشتری بیشتر و اعتبار بیشتر!', effect:{ spawnMult:1.4, repGainMult:1.4 }, toast:'🎉 جشن محلی — مشتری و اعتبار +' },
    { id:'power', name:'قطعی برق', icon:'💡', weight:7, kind:'passive', seconds:16,
      desc:'برق قطع شد! دستگاه‌ها کندتر کار می‌کنن.', effect:{ speedMult:1.5 }, toast:'💡 قطعی برق — دستگاه‌ها کندتر' },
    { id:'loyal', name:'مشتری وفادار', icon:'💖', weight:9, kind:'passive', seconds:0,
      desc:'یک مشتری قدیمی برگشت و می‌خواد خوب ازش پذیرایی کنی.', effect:{ loyalTip:true }, toast:'💖 یک مشتری وفادار رسید!' }
  ];
  const EVENT_BY_ID = {};
  EVENTS.forEach(e => EVENT_BY_ID[e.id] = e);

  /* --------------------------- Achievements ----------------------------- */
  const ACHIEVEMENTS = [
    { id:'first_sale', icon:'💰', name:'اولین فروش', desc:'اولین نوشیدنی رو بفروش.' },
    { id:'serve_50',   icon:'🤝', name:'پیشخدمت دوست‌داشتنی', desc:'۵۰ مشتری را سرویس کن.' },
    { id:'serve_100',  icon:'⚡', name:'سرویس برق‌آسا', desc:'۱۰۰ مشتری را سرویس کن.' },
    { id:'serve_500',  icon:'👑', name:'افسانه کافه', desc:'۵۰۰ مشتری را سرویس کن.' },
    { id:'perfect_25', icon:'🎯', name:'استاد قهوه', desc:'۲۵ نوشیدنی عالی درست کن.' },
    { id:'rep_5',      icon:'⭐', name:'پنج ستاره', desc:'به اعتبار ۵ ستاره برس.' },
    { id:'rich_2k',    icon:'🤑', name:'میلیاردر کافه', desc:'۲۰۰۰$ پول نقد داشته باش.' },
    { id:'day_30',     icon:'📅', name:'یک ماه تلاش', desc:'به روز ۳۰ برس.' },
    { id:'staff_3',    icon:'👥', name:'تیم رویایی', desc:'۳ کارمند استخدام کن.' },
    { id:'variety',    icon:'🍽️', name:'منوی متنوع', desc:'یکی از هر آیتم منو بفروش.' },
    { id:'no_walkout', icon:'🛡️', name:'میزبان بی‌نقص', desc:'یک روز بدون خروج مشتری ناراضی.' },
    { id:'events_10',  icon:'🎲', name:'آماده هر اتفاقی', desc:'۱۰ رخداد تصادفی رو تجربه کن.' }
  ];
  const ACH_BY_ID = {};
  ACHIEVEMENTS.forEach(a => ACH_BY_ID[a.id] = a);

  /* ------------------------------- Names -------------------------------- */
  const FIRST_M = ['آریا','کیان','سینا','امیر','دانیال','پوریا','مهران','رادین','بهرام','نیما','آرتین','سهند'];
  const FIRST_F = ['سارا','النا','نیلوفر','مریم','آوا','پریا','رها','یاسمین','دلارام','کیمیا','بهار','ستایش'];
  const CUST_NAMES = ['آقای رضایی','خانم محمدی','دانشجو','کارمند عصبی','عکاس','نویسنده','دانش‌آموز','گردشگر','معمار','برنامه‌نویس','مادربزرگ','دوست‌صمیمی'];

  /* ------------------------------ Config -------------------------------- */
  const CONFIG = {
    WORLD,
    LAYOUT,
    DAY_LENGTH: 95,           // seconds at 1x
    START_CASH: 250,
    START_REP: 40,            // ~2.5 stars
    BASE_SPAWN: 0.34,         // customers/sec at intensity 1 (before rep/marketing)
    PATIENCE_ORDER: 17,       // sec waiting to place order
    PATIENCE_ITEM: 30,        // sec waiting for the drink
    DINEIN_BASE: 0.55,        // chance to dine-in when seats free
    CONSUME_TIME: [10, 18],   // sec seated
    TIP_BASE: 0.12,           // base tip fraction of price
    TIP_PERFECT: 0.45,
    REP_GAIN_GOOD: 0.9,       // per good service
    REP_GAIN_PERFECT: 1.8,
    REP_LOSS_WALK: 2.4,       // per walkout
    REP_LOSS_BAD: 0.8,        // per badly-made drink served
    RENT_BASE: 30,            // daily rent
    RENT_PER_SEAT: 3,
    WAGE_BASE: 22,            // per employee/day
    GOAL_BASE: 90,            // day-1 revenue goal
    GOAL_GROWTH: 1.18,
    EMPLOYEE_SKILL_SPEED: 0.12, // each skill point adds this fraction speed
    MINIGAME_ZONE: 0.16,      // half-width of perfect zone (fraction)
    MINIGAME_SPEED: 1.25,     // marker speed (cycles/sec)
    START_TABLES: 2,
    START_QUEUE: 4,
    START_WAIT: 4
  };

  // Spawn intensity curve over the day (t in 0..1)
  function spawnIntensity(t) {
    // morning rush peak ~0.25, afternoon ~0.55, evening ~0.8
    const morning = Math.exp(-Math.pow((t - 0.26) / 0.14, 2));
    const afternoon = 0.62 * Math.exp(-Math.pow((t - 0.56) / 0.18, 2));
    const evening = 0.7 * Math.exp(-Math.pow((t - 0.82) / 0.13, 2));
    const open = U.clamp((t - 0.02) / 0.06, 0, 1);   // ramp at open
    const close = U.clamp((1 - t) / 0.07, 0, 1);     // ramp at close
    return U.clamp((Math.max(morning, afternoon, evening) * 0.9 + 0.12) * open * close, 0, 1);
  }
  function phaseName(t) {
    if (t < 0.05) return 'opening';
    if (t < 0.45) return 'morning';
    if (t < 0.70) return 'afternoon';
    if (t < 0.92) return 'evening';
    return 'closing';
  }

  CAFE.data = {
    WORLD, LAYOUT, MENU, MENU_BY_ID, UPGRADES, UPG_BY_ID, EVENTS, EVENT_BY_ID,
    ACHIEVEMENTS, ACH_BY_ID, FIRST_M, FIRST_F, CUST_NAMES, CONFIG,
    upgradeCost, spawnIntensity, phaseName
  };
})(window.CAFE = window.CAFE || {});
