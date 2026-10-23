import type { EngineSettings, SaveSlotId } from './types';
import type { ReactorSnapshot } from '../simulation/reactor-model';
import type { EngineState } from './store';

const SETTINGS_OPTIONS = ['auto', 'low', 'med', 'high', 'ultra'] as const;

export function mountInterface(root: HTMLElement): void {
  root.innerHTML = `
    <canvas id="world-view" tabindex="0" aria-label="Interactive three-dimensional plant systems view"></canvas>
    <div class="world-vignette" aria-hidden="true"></div>
    <div class="game-interface">
      <header class="topbar">
        <div class="brand-lockup"><span class="brand-symbol">☢</span><div><strong>CORE<span>:</span> NUCLEAR</strong><small>POWER SYSTEMS SIMULATOR</small></div></div>
        <div class="live-chip"><i class="live-dot"></i><span>PLANT SYSTEMS LIVE</span></div>
        <div class="world-clock"><b id="world-time">06:00</b><span>PLANT TIME</span></div>
        <button class="weather-button" data-action="weather" aria-label="Cycle site weather" title="Change weather"><span id="weather-label">CLEAR</span><small id="wind-speed">WIND 2.1 M/S</small></button>
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
        <div class="monitor-caption">PLANT SIMULATION</div>
        <div class="monitor-state"><i class="status-pulse"></i><span>THERMAL MODEL ACTIVE</span></div>
        <div class="meter-line"><i id="simulation-meter"></i></div>
        <p class="monitor-note">Simplified training model<br/>No operational plant control.</p>
      </aside>

      <aside class="reactor-panel" aria-label="Reactor and thermal training controls">
        <div class="reactor-panel-head"><span>REACTOR / THERMAL</span><i id="reactor-led"></i></div>
        <div class="reactor-mode" id="reactor-mode">COLD SHUTDOWN</div>
        <div class="reactor-power-readout"><span>THERMAL POWER</span><b id="reactor-power">0.0%</b></div>
        <div class="reactor-power-track"><i id="reactor-power-meter"></i></div>
        <div class="reactor-metrics">
          <div><span>CORE TEMPERATURE</span><b id="core-temperature">25 °C</b></div>
          <div><span>PRIMARY PRESSURE</span><b id="primary-pressure">0.12 MPa</b></div>
          <div><span>STEAM PRESSURE</span><b id="steam-pressure">0.10 MPa</b></div>
          <div><span>DECAY HEAT</span><b id="decay-heat">0.0%</b></div>
          <div><span>CONTAINMENT</span><b id="containment-status">22 °C · 0 kPa</b></div>
        </div>
        <label class="reactor-control" for="rod-control"><span>CONTROL ROD INSERTION</span><b id="rod-value">100%</b><input id="rod-control" type="range" min="0" max="100" value="100" /></label>
        <label class="reactor-control" for="coolant-control"><span>PRIMARY COOLANT FLOW</span><b id="coolant-value">100%</b><input id="coolant-control" type="range" min="0" max="100" value="100" /></label>
        <label class="reactor-control" for="feedwater-control"><span>FEEDWATER FLOW</span><b id="feedwater-value">75%</b><input id="feedwater-control" type="range" min="0" max="100" value="75" /></label>
        <div id="reactor-alarms" class="reactor-alarms" role="status" aria-live="polite">ALL TRAINING PARAMETERS NOMINAL</div>
        <div class="reactor-actions">
          <button class="scram-button" data-action="scram">MANUAL SCRAM</button>
          <button class="reset-trip-button" data-action="reset-trip" disabled>RESET TRIP</button>
        </div>
        <p class="reactor-disclaimer">SIMPLIFIED TRAINING MODEL · NOT AN OPERATING PLANT CONTROL SYSTEM</p>
      </aside>

      <div class="view-reticle" aria-hidden="true"><span></span></div>
      <div class="view-label"><span class="view-label-line"></span><span id="view-area">REACTOR HALL</span><small>SIMULATION VIEW · M4</small></div>

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
      <div class="interaction-hint" id="interaction-hint" hidden><kbd>E</kbd><span id="interaction-label">INTERACT</span></div>
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

export function renderReactor(snapshot: ReactorSnapshot): void {
  const put = (selector: string, text: string): void => {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) element.textContent = text;
  };
  put('#reactor-mode', snapshot.mode);
  put('#reactor-power', `${snapshot.powerPct.toFixed(1)}%`);
  put('#core-temperature', `${Math.round(snapshot.coreTemperatureC)} °C`);
  put('#primary-pressure', `${snapshot.primaryPressureMpa.toFixed(2)} MPa`);
  put('#steam-pressure', `${snapshot.steamPressureMpa.toFixed(2)} MPa`);
  put('#decay-heat', `${snapshot.decayHeatPct.toFixed(1)}%`);
  put('#containment-status', `${Math.round(snapshot.containmentTemperatureC)} °C · ${snapshot.containmentPressureKpa.toFixed(1)} kPa`);
  put('#rod-value', `${Math.round(snapshot.targetRodInsertionPct)}%`);
  put('#coolant-value', `${Math.round(snapshot.targetCoolantFlowPct)}%`);
  put('#feedwater-value', `${Math.round(snapshot.targetFeedwaterFlowPct)}%`);

  const power = document.querySelector<HTMLElement>('#reactor-power-meter');
  if (power) power.style.width = `${Math.max(0, Math.min(100, snapshot.powerPct))}%`;
  const systemMeter = document.querySelector<HTMLElement>('#simulation-meter');
  if (systemMeter) systemMeter.style.width = `${Math.max(0, Math.min(100, snapshot.powerPct))}%`;
  const panel = document.querySelector<HTMLElement>('.reactor-panel');
  panel?.classList.toggle('alarm-caution', snapshot.alarmSeverity === 'caution');
  panel?.classList.toggle('alarm-critical', snapshot.alarmSeverity === 'critical');
  const led = document.querySelector<HTMLElement>('#reactor-led');
  if (led) led.dataset.severity = snapshot.alarmSeverity;
  const alarms = document.querySelector<HTMLElement>('#reactor-alarms');
  if (alarms) alarms.textContent = snapshot.alarms.length > 0
    ? snapshot.alarms.map((alarm) => `${alarm.severity.toUpperCase()} · ${alarm.message}`).join('  /  ')
    : 'ALL TRAINING PARAMETERS NOMINAL';
  const scram = document.querySelector<HTMLButtonElement>('[data-action="scram"]');
  if (scram) scram.disabled = snapshot.scramActive;
  const reset = document.querySelector<HTMLButtonElement>('[data-action="reset-trip"]');
  if (reset) reset.disabled = !snapshot.canResetTrip;
  const rods = document.querySelector<HTMLInputElement>('#rod-control');
  const coolant = document.querySelector<HTMLInputElement>('#coolant-control');
  const feedwater = document.querySelector<HTMLInputElement>('#feedwater-control');
  if (rods) { rods.value = String(Math.round(snapshot.targetRodInsertionPct)); rods.disabled = snapshot.scramActive; }
  if (coolant) coolant.value = String(Math.round(snapshot.targetCoolantFlowPct));
  if (feedwater) feedwater.value = String(Math.round(snapshot.targetFeedwaterFlowPct));
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
