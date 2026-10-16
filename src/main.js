/* =========================================================================
   main.js — bootstrap: boot screen, audio unlock on gesture, start game
   ========================================================================= */
(function (CAFE) {
  "use strict";
  const Boot = {
    start() {
      const fill = document.getElementById('boot-fill');
      const status = document.getElementById('boot-status');
      const startBtn = document.getElementById('boot-start');
      const steps = ['در حال بارگذاری منو…', 'آماده‌سازی مشتری‌ها…', 'راه‌اندازی آشپزخانه…', 'تنظیم صدا و گرافیک…'];
      let p = 0, i = 0;
      const tick = () => {
        p = Math.min(100, p + Math.random() * 18 + 10);
        fill.style.width = p + '%';
        if (i < steps.length && p >= (i + 1) * 20) { status.textContent = steps[i]; i++; }
        if (p < 100) setTimeout(tick, 110);
        else { status.textContent = (CAFE.i18n ? CAFE.i18n.t('start_game') : 'شروع') + '! ✨'; startBtn.style.display = 'inline-block'; startBtn.onclick = () => this.launch(); }
      };
      tick();
    },
    launch() {
      CAFE.audio.init();
      CAFE.audio.resume();
      document.getElementById('boot').style.display = 'none';
      const root = document.getElementById('game-root');
      root.style.display = 'block';
      const game = new CAFE.Game();
      CAFE.game = game;
      game.init(document.getElementById('game'));
      if (!game.state.tutorialDone) setTimeout(() => CAFE.UI.showTutorial(), 500);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Boot.start());
  else Boot.start();

  CAFE.Boot = Boot;
})(window.CAFE = window.CAFE || {});
