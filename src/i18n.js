/* =========================================================================
   i18n.js — bilingual (Persian default + English) string tables and helpers.
   Exposes window.CAFE.i18n
   ========================================================================= */
(function (CAFE) {
  "use strict";

  const FA = {
    game_title: 'کافه‌داری حرفه‌ای', game_subtitle: 'شبیه‌ساز مدیریت کافه',
    loading: 'در حال بارگذاری…', start_game: 'شروع بازی',
    tab_menu: 'منو', tab_staff: 'کارکنان', tab_shop: 'فروشگاه', tab_stats: 'آمار',
    open_cafe: 'باز کردن کافه', close_cafe: 'بستن کافه', today_revenue: 'درآمد امروز:', served: 'سرو شده:',
    // phases
    st_opening:'شروع کار', st_morning:'صبح شلوغ', st_afternoon:'بعدازظهر', st_evening:'عصر', st_closing:'آماده بستن', st_closed:'باز نشده',
    // common
    yes:'بله', no:'خیر', close:'بستن', ok:'تأیید', cancel:'انصراف', next:'بعدی', back:'قبلی',
    buy:'خرید', hire:'استخدام', fire:'اخراج', assign:'تعیین', confirm:'تأیید', done:'انجام', daily:'روزانه',
    // menu
    menu_title:'منوی کافه', menu_unlocked:'باز شده', menu_locked:'قفل', menu_price:'قیمت', menu_cost:'هزینه ساخت',
    menu_prep:'زمان', menu_cat_coffee:'قهوه', menu_cat_tea:'نوشیدنی', menu_cat_food:'شیرینی/غذا',
    menu_tip:'روی هر آیتم بزن تا جزئیاتش رو ببینی.', menu_emoji:'آیکون',
    // staff
    staff_title:'کارکنان', staff_hire:'استخدام کارمند جدید', staff_none:'هنوز کارمندی نداری.',
    staff_slot:'جایگاه', staff_free:'آزاد', staff_cashier:'پیشخوان (سفارش‌گیر)', staff_bar:'اسپرسو',
    staff_oven:'فر', staff_tea:'دم‌کن', staff_skill:'مهارت', staff_wage:'حقوق', staff_assign:'تعیین محل',
    staff_fire:'اخراج', staff_role:'نقش', staff_hire_cost:'هزینه استخدام', staff_noslots:'جایگاه کارمندی نداری — از فروشگاه بخر.', fire_confirm:'مطمئنی می‌خوای اخراجش کنی؟',
    staff_auto:'خودکار توسط کارمند', staff_idle:'بیکار', staff_working:'در حال کار', staff_break:'استراحت',
    staff_gender:'جنسیت', staff_male:'پسر', staff_female:'دختر', staff_name:'نام',
    hire_title:'استخدام کارمند', hire_pick_role:'نقش را انتخاب کن:', hire_name_ph:'نام کارمند',
    // shop
    shop_title:'فروشگاه و ارتقا', shop_machine:'دستگاه‌ها', shop_expansion:'توسعه فضا', shop_ambiance:'فضا و مشتری',
    shop_staff:'کارکنان', shop_recipe:'آیتم‌های جدید منو', shop_level:'سطح', shop_max:'حداکثر', shop_owned:'خریداری شد',
    shop_cost:'هزینه', shop_cash:'پول کافی نیست', shop_buy:'خرید', shop_empty:'همه موارد خریداری شد.',
    shop_effect:'اثر', shop_next:'بعدی',
    // stats
    stats_title:'آمار و عملکرد', stats_cash:'پول نقد', stats_day:'روز', stats_rep:'اعتبار', stats_served:'مشتری سرویس‌شده',
    stats_revenue:'درآمد کل', stats_perfect:'نوشیدنی عالی', stats_walkout:'خروج ناراضی', stats_best_day:'بهترین روز',
    stats_avg_tip:'میانگین انعام', stats_ach:'دستاوردها', stats_history:'تاریخچه روزها', stats_reset:'ریست بازی',
    stats_total_sales:'تعداد فروش', stats_unlocked:'آیتم‌های باز شده', stats_none:'هنوز دستاوردی نداری.',
    // settings
    settings_title:'تنظیمات', settings_volume:'حجم صدا', settings_music:'موسیقی', settings_lang:'زبان',
    settings_quality:'کیفیت گرافیک', settings_fa:'فارسی', settings_en:'انگلیسی',
    settings_reset:'ریست کامل بازی', settings_reset_confirm:'همه پیشرفت پاک می‌شود. مطمئنی؟',
    settings_high:'بالا', settings_low:'پایین', settings_on:'روشن', settings_off:'خاموش',
    // help
    help_title:'راهنمای بازی', help_text:'🎯 هدف: کافه‌ای پررونق بساز و به ۵ ستاره برس!<br><br>'+
      '۱. روی «باز کردن کافه» بزن تا مشتری‌ها بیان.<br>'+
      '۲. روی مشتری‌ای که «؟» بالای سرشه بزن تا سفارشش رو بگیر.<br>'+
      '۳. روی دستگاه (اسپرسو/فر/دم‌کن) بزن تا نوبت بعدی رو درست کنی. در لحظه مناسب (نوار سبز) دوباره بزن تا کیفیت «عالی» بشه.<br>'+
      '۴. نوشیدنی آماده روی پیشخوان می‌ره و مشتری خودش برمی‌داره.<br>'+
      '۵. مشتری‌های «داخل‌نشین» روی میز می‌نشینن و انعام بیشتری می‌دن.<br>'+
      '۶. با پولت دستگاه، میز و کارمند بخر. کارمندها سفارش‌گیری و درست‌کردن رو خودکار انجام می‌دن.<br>'+
      '۷. هر روز هدف درآمد داری — برآورده کن تا پاداش بگیری.',
    // summary
    summary_title:'پایان روز', summary_rev:'درآمد', summary_expense:'هزینه‌ها', summary_profit:'سود خالص',
    summary_served:'مشتری سرویس‌شده', summary_perfect:'نوشیدنی عالی', summary_walkout:'خروج ناراضی',
    summary_rep:'اعتبار', summary_goal:'هدف روز', summary_met:'هدف برآورده شد! 🎉', summary_miss:'هدف پوشش داده نشد 😕',
    summary_next:'روز بعد ▶', summary_bonus:'پاداش هدف', summary_rent:'اجاره', summary_wages:'حقوق',
    // events
    event_title:'رخداد ویژه', event_choose:'یکی رو انتخاب کن',
    // achievements
    ach_title:'دستاوردها', ach_unlocked:'دستاورد باز شد!', ach_locked:'قفل',
    // misc
    paused:'مکث', not_enough_cash:'پول کافی نیست!', speed:'سرعت',
    perfect:'عالی!', good:'خوب', ok:'قبول', bad:'ضعیف', ruined:'خراب شد',
    take_order:'سفارش بگیر', preparing:'در حال آماده‌سازی', ready:'آماده', served:'سرو شد', waiting:'در انتظار',
    table_full:'ظرفیت نشستن پر است', no_order:'سفارشی نیست', click_station:'روی دستگاه بزن', new_day:'روز جدید',
    tip:'انعام', rep_up:'اعتبار +', rep_down:'اعتبار -', employee_added:'کارمند اضافه شد', employee_fired:'کارمند اخراج شد',
    upgrade_bought:'ارتقا خریداری شد', recipe_unlocked:'آیتم جدید باز شد', event_count:'رخداد', day_goal:'هدف امروز',
    tutorial_skip:'رد کردن آموزش', tutorial_next:'بعدی ▶', tutorial_title:'آموزش', cnt_customers:'مشتری'
  };

  const EN = {
    game_title:'Café Tycoon', game_subtitle:'Cafe Management Simulator',
    loading:'Loading…', start_game:'Start Game',
    tab_menu:'Menu', tab_staff:'Staff', tab_shop:'Shop', tab_stats:'Stats',
    open_cafe:'Open Cafe', close_cafe:'Close Cafe', today_revenue:'Today:', served:'Served:',
    st_opening:'Opening', st_morning:'Morning Rush', st_afternoon:'Afternoon', st_evening:'Evening', st_closing:'Closing', st_closed:'Closed',
    yes:'Yes', no:'No', close:'Close', ok:'OK', cancel:'Cancel', next:'Next', back:'Back',
    buy:'Buy', hire:'Hire', fire:'Fire', assign:'Assign', confirm:'Confirm', done:'Done', daily:'Daily',
    menu_title:'Cafe Menu', menu_unlocked:'Unlocked', menu_locked:'Locked', menu_price:'Price', menu_cost:'Cost',
    menu_prep:'Time', menu_cat_coffee:'Coffee', menu_cat_tea:'Drinks', menu_cat_food:'Food',
    menu_tip:'Tap an item to see details.', menu_emoji:'Icon',
    staff_title:'Staff', staff_hire:'Hire New Employee', staff_none:'No employees yet.',
    staff_slot:'Slot', staff_free:'Free', staff_cashier:'Counter (Cashier)', staff_bar:'Espresso',
    staff_oven:'Oven', staff_tea:'Brewer', staff_skill:'Skill', staff_wage:'Wage', staff_assign:'Assign',
    staff_fire:'Fire', staff_role:'Role', staff_hire_cost:'Hire cost', staff_noslots:"You have no staff slots — buy one in the Shop.", fire_confirm:'Sure you want to fire them?',
    staff_auto:'Automated by staff', staff_idle:'Idle', staff_working:'Working', staff_break:'Break',
    staff_gender:'Gender', staff_male:'Male', staff_female:'Female', staff_name:'Name',
    hire_title:'Hire Employee', hire_pick_role:'Pick a role:', hire_name_ph:'Employee name',
    shop_title:'Shop & Upgrades', shop_machine:'Machines', shop_expansion:'Expand Space', shop_ambiance:'Ambiance & Customers',
    shop_staff:'Staff', shop_recipe:'New Menu Items', shop_level:'Lv', shop_max:'MAX', shop_owned:'Owned',
    shop_cost:'Cost', shop_cash:'Not enough cash', shop_buy:'Buy', shop_empty:'Everything purchased.',
    shop_effect:'Effect', shop_next:'Next',
    stats_title:'Stats & Performance', stats_cash:'Cash', stats_day:'Day', stats_rep:'Reputation', stats_served:'Customers Served',
    stats_revenue:'Total Revenue', stats_perfect:'Perfect Drinks', stats_walkout:'Walkouts', stats_best_day:'Best Day',
    stats_avg_tip:'Avg Tip', stats_ach:'Achievements', stats_history:'Day History', stats_reset:'Reset Game',
    stats_total_sales:'Total Sales', stats_unlocked:'Unlocked Items', stats_none:'No achievements yet.',
    settings_title:'Settings', settings_volume:'Volume', settings_music:'Music', settings_lang:'Language',
    settings_quality:'Graphics Quality', settings_fa:'Persian', settings_en:'English',
    settings_reset:'Reset Game', settings_reset_confirm:'All progress will be erased. Sure?',
    settings_high:'High', settings_low:'Low', settings_on:'On', settings_off:'Off',
    help_title:'How to Play', help_text:'🎯 Goal: build a thriving cafe and reach 5 stars!<br><br>'+
      '1. Press "Open Cafe" to let customers in.<br>'+
      '2. Click a customer showing "?" to take their order.<br>'+
      '3. Click a station (espresso/oven/brewer) to make the next item. Click again in the green zone for a "Perfect".<br>'+
      '4. Finished drinks go to the counter and the customer grabs them.<br>'+
      '5. "Dine-in" customers sit at tables and tip more.<br>'+
      '6. Spend money on machines, seats and staff. Staff automate ordering & brewing.<br>'+
      '7. Hit each day\'s revenue goal for a bonus.',
    summary_title:'End of Day', summary_rev:'Revenue', summary_expense:'Expenses', summary_profit:'Net Profit',
    summary_served:'Served', summary_perfect:'Perfect', summary_walkout:'Walkouts',
    summary_rep:'Reputation', summary_goal:'Day Goal', summary_met:'Goal met! 🎉', summary_miss:'Goal missed 😕',
    summary_next:'Next Day ▶', summary_bonus:'Goal Bonus', summary_rent:'Rent', summary_wages:'Wages',
    event_title:'Special Event', event_choose:'Choose one',
    ach_title:'Achievements', ach_unlocked:'Achievement unlocked!', ach_locked:'Locked',
    paused:'Paused', not_enough_cash:'Not enough cash!', speed:'Speed',
    perfect:'Perfect!', good:'Good', ok:'OK', bad:'Weak', ruined:'Ruined',
    take_order:'Take Order', preparing:'Preparing', ready:'Ready', served:'Served', waiting:'Waiting',
    table_full:'Seating full', no_order:'No order', click_station:'Click a station', new_day:'New Day',
    tip:'Tip', rep_up:'Rep +', rep_down:'Rep -', employee_added:'Employee added', employee_fired:'Employee fired',
    upgrade_bought:'Upgrade purchased', recipe_unlocked:'New item unlocked', event_count:'Events', day_goal:'Today Goal',
    tutorial_skip:'Skip tutorial', tutorial_next:'Next ▶', tutorial_title:'Tutorial', cnt_customers:'customers'
  };

  const i18n = {
    dict: { fa: FA, en: EN },
    lang: 'fa',
    setLang(l) { if (this.dict[l]) this.lang = l; document.documentElement.lang = l; document.documentElement.dir = (l === 'fa' || l === 'ar') ? 'rtl' : 'ltr'; },
    getLang() { return this.lang; },
    t(key, vars) {
      const cur = this.dict[this.lang] && this.dict[this.lang][key];
      const alt = this.dict[this.lang === 'fa' ? 'en' : 'fa'] && this.dict[this.lang === 'fa' ? 'en' : 'fa'][key];
      let s = (cur != null) ? cur : (alt != null ? alt : key);
      if (vars) for (const k in vars) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
      return s;
    },
    // translate all [data-i18n] elements within root
    translateDom(root) {
      root = root || document;
      CAFE.util.$$('[data-i18n]', root).forEach(el => { el.textContent = this.t(el.getAttribute('data-i18n')); });
      CAFE.util.$$('[data-i18n-ph]', root).forEach(el => { el.setAttribute('placeholder', this.t(el.getAttribute('data-i18n-ph'))); });
    }
  };

  CAFE.i18n = i18n;
})(window.CAFE = window.CAFE || {});
