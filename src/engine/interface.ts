import type { EngineSettings, SaveSlotId } from './types';
import type { EngineState } from './store';

const SETTINGS_OPTIONS = ['auto', 'low', 'med', 'high', 'ultra'] as const;

export function mountInterface(root: HTMLElement): void {
  root.innerHTML = `
    <canvas id="world-view" tabindex="0" aria-label="Interactive three-dimensional plant systems view"></canvas>
    <div class="world-vignette" aria-hidden="true"></div>
    <div class="game-interface">
      <header class="topbar">
        <div class="brand-lockup"><span class="brand-symbol">☢</span><div><strong>CORE<span>:</span> NUCLEAR</strong><small>POWER SYSTEMS SIMULATOR</small></div></div>
        <div class="live-chip"><i class="live-dot"></i><span>ENGINE ONLINE</span></div>
        <div class="top-actions">
          <div class="fps-chip"><span id="render-backend">STARTING</span><b id="fps-value">--</b><small>FPS</small></div>
          <button class="icon-action" data-action="audio" aria-label="Toggle sound" title="Toggle sound">◖))</button>
          <button class="icon-action" data-action="settings" aria-label="Open settings" title="Settings">⚙</button>
          <button class="icon-action" data-action="save" aria-label="Open save slots" title="Save and load">▣</button>
          <button class="icon-action pause-action" data-action="pause" aria-label="Pause simulation" title="Pause">Ⅱ</button>
        </div>
      </header>

      <aside class="readout-panel">
        <div class="panel-kicker">SYSTEM MONITOR <span class="panel-led"></span></div>
        <div class="monitor-row"><span>RENDERER</span><b id="renderer-value">INITIALIZING</b></div>
        <div class="monitor-row"><span>QUALITY</span><b id="quality-value">AUTO</b></div>
        <div class="monitor-row"><span>CAMERA</span><b id="camera-value">ORBIT</b></div>
        <div class="monitor-row"><span>POSITION</span><b id="position-value">0.0 / 1.7 / 9.0</b></div>
        <div class="monitor-divider"></div>
        <div class="monitor-caption">PLANT VISUALIZATION</div>
        <div class="monitor-state"><i class="status-pulse"></i><span>CORE FIELD ACTIVE</span></div>
        <div class="meter-line"><i></i></div>
        <p class="monitor-note">Navigation sandbox<br/>No plant controls are active.</p>
      </aside>

      <div class="view-reticle" aria-hidden="true"><span></span></div>
      <div class="view-label"><span class="view-label-line"></span><span>REACTOR SYSTEMS BAY</span><small>SIMULATION VIEW · M2</small></div>

      <nav class="camera-dock" aria-label="Camera mode">
        <button data-action="camera-fps" title="Walk view (WASD)"><span>01</span> WALK</button>
        <button data-action="camera-orbit" class="selected" title="Orbit view (drag to look)"><span>02</span> ORBIT</button>
        <button data-action="camera-cinematic" title="Cinematic automatic camera"><span>03</span> CINEMATIC</button>
      </nav>

      <footer class="bottom-bar">
        <div class="help-copy"><b>INPUT</b><span>WASD MOVE</span><span>DRAG LOOK</span><span>SHIFT SPRINT</span><span>E INTERACT</span><span>ESC PAUSE</span></div>
        <div class="bottom-mark">CORE / OPS <i></i> BUILD 01.02</div>
      </footer>

      <div id="toast" class="toast" role="status" aria-live="polite"></div>
      <div id="pause-shade" class="pause-shade" hidden><div><span>SIMULATION PAUSED</span><button data-action="resume">RESUME</button><small>Press ESC or P to continue</small></div></div>
      <div id="dialog-backdrop" class="dialog-backdrop" hidden>
        <section class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
          <button class="dialog-close" data-action="close-dialog" aria-label="Close dialog">×</button>
          <p class="dialog-overline">CORE / SYSTEM CONFIGURATION</p><h2 id="dialog-title">SETTINGS</h2>
          <div id="settings-panel" class="dialog-panel">
            <label class="setting-row" for="graphics-tier"><span><b>Graphics quality</b><small>Automatic detection adapts to device hardware</small></span><select id="graphics-tier">${SETTINGS_OPTIONS.map((option) => `<option value="${option}">${option === 'auto' ? 'AUTO DETECT' : option.toUpperCase()}</option>`).join('')}</select></label>
            <label class="setting-row" for="master-volume"><span><b>Master volume</b><small>Procedural audio bus</small></span><input id="master-volume" type="range" min="0" max="1" step="0.01" /></label>
            <label class="setting-row" for="music-volume"><span><b>Music / ambience</b><small>Ambient synth channel</small></span><input id="music-volume" type="range" min="0" max="1" step="0.01" /></label>
            <label class="setting-row" for="sfx-volume"><span><b>Effects</b><small>Interface and event cues</small></span><input id="sfx-volume" type="range" min="0" max="1" step="0.01" /></label>
            <label class="setting-row" for="voice-volume"><span><b>Voice</b><small>Procedural voice channel level</small></span><input id="voice-volume" type="range" min="0" max="1" step="0.01" /></label>
            <label class="setting-row setting-check" for="touch-controls"><span><b>Touch controls</b><small>Virtual sticks and touch actions</small></span><input id="touch-controls" type="checkbox" /></label>
            <label class="setting-row setting-check" for="reduced-motion"><span><b>Reduced motion</b><small>Reduce nonessential screen movement</small></span><input id="reduced-motion" type="checkbox" /></label>
          </div>
          <div id="save-panel" class="dialog-panel" hidden>
            <p class="save-intro">Choose one of three local save slots. Save data stays on this device.</p>
            <div class="slot-list">${([1, 2, 3] as const).map((slot) => `<button class="slot-card" data-slot="${slot}"><span class="slot-number">SLOT 0${slot}</span><b class="slot-state" data-slot-state="${slot}">EMPTY</b><small class="slot-time" data-slot-time="${slot}">No saved session</small></button>`).join('')}</div>
            <div class="save-buttons"><button class="primary-button" data-action="save-slot">SAVE SESSION</button><button class="secondary-button" data-action="load-slot">LOAD SESSION</button></div>
            <p class="save-disclaimer">Saving captures the camera, settings, and current engine session.</p>
          </div>
          <div class="dialog-footer"><span id="dialog-status">LOCAL DEVICE SETTINGS</span><button class="primary-button" data-action="close-dialog">DONE</button></div>
        </section>
      </div>
      <div class="interaction-hint" id="interaction-hint" hidden><kbd>E</kbd><span>INTERACT</span></div>
    </div>`;
}

export function renderSettings(settings: EngineSettings): void {
  const selected = settings.graphicsMode === 'auto' ? 'auto' : settings.graphicsTier;
  const graphics = document.querySelector<HTMLSelectElement>('#graphics-tier');
  if (graphics) graphics.value = selected;
  for (const [id, value] of [['master-volume', settings.masterVolume], ['music-volume', settings.musicVolume], ['sfx-volume', settings.sfxVolume], ['voice-volume', settings.voiceVolume]] as const) {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (input) input.value = String(value);
  }
  const touch = document.querySelector<HTMLInputElement>('#touch-controls');
  const reduced = document.querySelector<HTMLInputElement>('#reduced-motion');
  if (touch) touch.checked = settings.touchControls;
  if (reduced) reduced.checked = settings.reducedMotion;
}

export function renderState(state: Readonly<EngineState>): void {
  const put = (selector: string, text: string): void => {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) element.textContent = text;
  };
  put('#fps-value', state.fps > 0 ? String(Math.round(state.fps)) : '--');
  put('#render-backend', state.renderer === 'initializing' ? 'STARTING' : state.renderer.toUpperCase());
  put('#renderer-value', state.renderer === 'initializing' ? 'INITIALIZING' : state.renderer.toUpperCase());
  put('#quality-value', `${state.settings.graphicsMode === 'auto' ? 'AUTO · ' : ''}${state.tierLabel.toUpperCase()}`);
  put('#camera-value', state.cameraMode.toUpperCase());
  put('#toast', state.toast);
  const pause = document.querySelector<HTMLElement>('#pause-shade');
  if (pause) pause.hidden = !state.paused;
  for (const mode of ['fps', 'orbit', 'cinematic'] as const) {
    const button = document.querySelector<HTMLButtonElement>(`[data-action="camera-${mode}"]`);
    button?.classList.toggle('selected', state.cameraMode === mode);
  }
  const audioButton = document.querySelector<HTMLButtonElement>('[data-action="audio"]');
  audioButton?.classList.toggle('is-muted', state.audioMuted);
  const slotSelect = document.querySelector<HTMLElement>('.slot-card.selected');
  if (slotSelect) slotSelect.setAttribute('aria-pressed', 'true');
  for (const slot of [1, 2, 3] as const satisfies readonly SaveSlotId[]) {
    const timestamp = state.slotTimes[slot];
    const status = document.querySelector<HTMLElement>(`[data-slot-state="${slot}"]`);
    const time = document.querySelector<HTMLElement>(`[data-slot-time="${slot}"]`);
    if (status) status.textContent = timestamp ? 'SAVED' : 'EMPTY';
    if (time) time.textContent = timestamp ? new Date(timestamp).toLocaleString() : 'No saved session';
  }
  const selectedSlot = document.querySelector<HTMLElement>(`[data-slot="${state.selectedSlot}"]`);
  document.querySelectorAll<HTMLButtonElement>('.slot-card').forEach((slot) => {
    const selected = slot === selectedSlot;
    slot.classList.toggle('selected', selected);
    slot.setAttribute('aria-pressed', String(selected));
  });
}

export function showDialog(name: 'settings' | 'save'): void {
  const backdrop = document.querySelector<HTMLElement>('#dialog-backdrop');
  const title = document.querySelector<HTMLElement>('#dialog-title');
  const settings = document.querySelector<HTMLElement>('#settings-panel');
  const saves = document.querySelector<HTMLElement>('#save-panel');
  if (!backdrop || !title || !settings || !saves) return;
  backdrop.hidden = false;
  settings.hidden = name !== 'settings';
  saves.hidden = name !== 'save';
  title.textContent = name === 'settings' ? 'SETTINGS' : 'SAVE / LOAD';
  const close = backdrop.querySelector<HTMLButtonElement>('.dialog-close');
  close?.focus();
}

export function hideDialog(): void {
  const backdrop = document.querySelector<HTMLElement>('#dialog-backdrop');
  if (backdrop) backdrop.hidden = true;
}
