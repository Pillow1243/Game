import { AudioBus } from './audio';
import { CameraRig, type CameraSnapshot } from './camera';
import { InputManager } from './input';
import { hideDialog, mountInterface, renderSettings, renderState, showDialog } from './interface';
import { EngineLoop, type FrameTiming } from './loop';
import { SaveRepository } from './saves';
import { RenderEngine } from './scene';
import { detectGraphicsTier, loadSettings, saveSettings } from './settings';
import { ObservableStore, type EngineState } from './store';
import type { EngineSettings, GraphicsTier, PersistedGameState } from './types';

function initialState(settings: EngineSettings): EngineState {
  return {
    ready: false,
    paused: false,
    audioMuted: false,
    fps: 0,
    renderer: 'initializing',
    cameraMode: 'orbit',
    settings,
    selectedSlot: 1,
    slotTimes: {},
    toast: '',
    tierLabel: settings.graphicsTier,
  };
}

export class CoreApp {
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly settings: EngineSettings;
  private readonly store: ObservableStore;
  private readonly camera = new CameraRig();
  private readonly audio: AudioBus;
  private readonly saves = new SaveRepository();
  private readonly input: InputManager;
  private readonly renderer: RenderEngine;
  private readonly loop: EngineLoop;
  private frameCounter = 0;
  private toastTimer = 0;
  private disposed = false;
  private readonly stateUnsubscribe: () => void;

  constructor(root: HTMLElement) {
    this.root = root;
    mountInterface(root);
    const canvas = root.querySelector<HTMLCanvasElement>('#world-view');
    if (!canvas) throw new Error('CORE: unable to mount the graphics canvas.');
    this.canvas = canvas;
    this.settings = loadSettings();
    this.camera.setReducedMotion(this.settings.reducedMotion);
    document.documentElement.classList.toggle('reduce-motion', this.settings.reducedMotion);
    saveSettings(this.settings);
    this.store = new ObservableStore(initialState(this.settings));
    this.audio = new AudioBus(this.settings);
    this.input = new InputManager(root, canvas);
    this.input.setTouchEnabled(this.settings.touchControls);
    this.renderer = new RenderEngine(canvas, this.settings);
    this.loop = new EngineLoop((timing) => this.onFrame(timing));
    this.stateUnsubscribe = this.store.subscribe(renderState, true);
    renderSettings(this.settings);
    this.attachUI();
  }

  async start(): Promise<void> {
    const backend = await this.renderer.initialize(this.camera.camera);
    if (this.disposed) return;
    this.store.update({ ready: true, renderer: backend, toast: 'ENGINE READY · Explore the systems bay.' });
    this.loop.start();
    this.showToast('ENGINE READY · Explore the systems bay.');
    this.refreshSlots();
  }

  private attachUI(): void {
    this.root.addEventListener('click', this.onClick);
    this.root.addEventListener('input', this.onInput);
    this.root.addEventListener('change', this.onChange);
    this.root.addEventListener('keydown', this.onDialogKeyDown);
    this.root.addEventListener('pointerdown', this.onUserGesture, { passive: true });
    this.root.addEventListener('focusin', this.onUserGesture);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pagehide', this.onPageHide, { once: true });
  }

  private onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const slot = target.closest<HTMLElement>('[data-slot]');
    if (slot && slot.classList.contains('slot-card')) {
      const id = Number(slot.dataset.slot);
      if (id === 1 || id === 2 || id === 3) this.store.update({ selectedSlot: id });
      return;
    }
    const button = target.closest<HTMLButtonElement>('[data-action]');
    const action = button?.dataset.action;
    if (action) void this.handleAction(action);
  };

  private onInput = (event: Event): void => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.type === 'range') this.readSettingsForm();
  };

  private onChange = (event: Event): void => {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.id === 'graphics-tier') this.readSettingsForm();
    if (target instanceof HTMLInputElement && target.type === 'checkbox') this.readSettingsForm();
  };

  private onDialogKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && !document.querySelector<HTMLElement>('#dialog-backdrop')?.hidden) {
      event.stopPropagation();
      this.closeDialog();
    }
  };

  private onUserGesture = (): void => { void this.activateAudio(); };

  private onVisibilityChange = (): void => {
    if (document.hidden) void this.audio.suspend();
  };

  private onPageHide = (): void => { void this.dispose(); };

  private async activateAudio(): Promise<void> {
    try {
      await this.audio.unlock();
      this.audio.startAmbient();
    } catch (error) {
      console.warn('CORE: audio output could not be started.', error);
    }
  }

  private async handleAction(action: string): Promise<void> {
    if (action === 'camera-fps' || action === 'camera-orbit' || action === 'camera-cinematic') {
      const mode = action.slice('camera-'.length) as 'fps' | 'orbit' | 'cinematic';
      this.camera.setMode(mode);
      this.store.update({ cameraMode: mode });
      return;
    }
    switch (action) {
      case 'settings':
        renderSettings(this.settings);
        showDialog('settings');
        break;
      case 'save':
        showDialog('save');
        await this.refreshSlots();
        break;
      case 'save-slot':
        await this.saveSelectedSlot();
        break;
      case 'load-slot':
        await this.loadSelectedSlot();
        break;
      case 'close-dialog':
        this.closeDialog();
        break;
      case 'audio':
        this.store.update({ audioMuted: !this.store.snapshot.audioMuted });
        this.audio.setMuted(this.store.snapshot.audioMuted);
        break;
      case 'pause':
      case 'resume':
        this.setPaused(action === 'pause' && !this.store.snapshot.paused);
        break;
    }
  }

  private closeDialog(): void {
    hideDialog();
    this.audio.playTone('sfx', 480, 0.055, 'sine', 0.09);
    this.canvas.focus({ preventScroll: true });
  }

  private readSettingsForm(): void {
    const selected = document.querySelector<HTMLSelectElement>('#graphics-tier')?.value ?? 'auto';
    const graphicsMode = selected === 'auto' ? 'auto' : 'manual';
    const graphicsTier: GraphicsTier = selected === 'low' || selected === 'med' || selected === 'high' || selected === 'ultra'
      ? selected
      : this.settings.graphicsMode === 'auto' ? this.settings.graphicsTier : detectGraphicsTier();
    const previous = { ...this.settings };
    const next: EngineSettings = {
      ...this.settings,
      graphicsMode,
      graphicsTier,
      masterVolume: this.inputNumber('#master-volume', this.settings.masterVolume),
      musicVolume: this.inputNumber('#music-volume', this.settings.musicVolume),
      sfxVolume: this.inputNumber('#sfx-volume', this.settings.sfxVolume),
      voiceVolume: this.inputNumber('#voice-volume', this.settings.voiceVolume),
      touchControls: document.querySelector<HTMLInputElement>('#touch-controls')?.checked ?? this.settings.touchControls,
      reducedMotion: document.querySelector<HTMLInputElement>('#reduced-motion')?.checked ?? this.settings.reducedMotion,
    };
    Object.assign(this.settings, next);
    saveSettings(this.settings);
    this.audio.updateSettings(this.settings);
    if (previous.touchControls !== this.settings.touchControls) this.input.setTouchEnabled(this.settings.touchControls);
    if (previous.graphicsTier !== this.settings.graphicsTier) {
      this.renderer.setSettings(this.settings);
      this.renderer.stage.setQuality(this.settings);
    }
    if (previous.reducedMotion !== this.settings.reducedMotion) {
      this.camera.setReducedMotion(this.settings.reducedMotion);
      document.documentElement.classList.toggle('reduce-motion', this.settings.reducedMotion);
    }
    this.store.update({ settings: this.settings, tierLabel: graphicsTier });
  }

  private inputNumber(selector: string, fallback: number): number {
    const value = Number(document.querySelector<HTMLInputElement>(selector)?.value);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
  }

  private setPaused(paused: boolean): void {
    this.loop.setPaused(paused);
    this.store.update({ paused });
    if (paused) {
      this.audio.setVoiceDucking(true);
      this.audio.playTone('sfx', 330, 0.09, 'triangle', 0.16);
    } else {
      void this.audio.resume();
      this.audio.setVoiceDucking(false);
      this.audio.playTone('sfx', 580, 0.09, 'triangle', 0.14);
    }
  }

  private onFrame(timing: FrameTiming): void {
    const input = this.input.sample();
    const modalOpen = !document.querySelector<HTMLElement>('#dialog-backdrop')?.hidden;
    this.frameCounter += 1;
    if (!modalOpen && input.pressed.has('pause')) this.setPaused(!this.store.snapshot.paused);
    if (!modalOpen && !this.store.snapshot.paused && input.pressed.has('interact')) {
      this.audio.playTone('sfx', 740, 0.07, 'sine', 0.14);
      this.showToast('SYSTEMS BAY · Interface interaction ready.');
    }
    if (!this.store.snapshot.paused && !modalOpen) {
      this.camera.update(input, timing.dt);
      this.renderer.render(timing.dt, timing.elapsed);
      const position = this.camera.camera.position;
      const positionElement = document.querySelector<HTMLElement>('#position-value');
      if (positionElement && this.frameCounter % 8 === 0) {
        positionElement.textContent = `${position.x.toFixed(1)} / ${position.y.toFixed(1)} / ${position.z.toFixed(1)}`;
      }
    }
    this.input.consumeFrame();
    if (this.frameCounter % 8 === 0) this.store.update({ fps: timing.fps });
  }

  private async saveSelectedSlot(): Promise<void> {
    const slot = this.store.snapshot.selectedSlot;
    const camera: CameraSnapshot = this.camera.snapshot();
    const payload: PersistedGameState = {
      version: 1,
      savedAt: Date.now(),
      cameraMode: camera.mode,
      position: camera.position,
      target: camera.target,
      orbitDistance: camera.orbitDistance,
      yaw: camera.yaw,
      pitch: camera.pitch,
      settings: { ...this.settings },
      simulation: { session: 'engine-foundation' },
    };
    try {
      await this.saves.save(slot, payload);
      await this.refreshSlots();
      this.showToast(`SESSION SAVED · SLOT 0${slot}`);
      this.audio.playTone('sfx', 880, 0.11, 'sine', 0.2);
    } catch (error) {
      this.showToast(this.errorText(error, 'Unable to save this session.'));
    }
  }

  private async loadSelectedSlot(): Promise<void> {
    const slot = this.store.snapshot.selectedSlot;
    try {
      const record = await this.saves.load(slot);
      if (!record) {
        this.showToast(`SLOT 0${slot} IS EMPTY`);
        return;
      }
      const payload = record.payload;
      this.camera.restore({
        mode: payload.cameraMode,
        position: payload.position,
        target: payload.target,
        orbitDistance: payload.orbitDistance,
        yaw: payload.yaw,
        pitch: payload.pitch,
      });
      Object.assign(this.settings, payload.settings);
      this.camera.setReducedMotion(this.settings.reducedMotion);
      document.documentElement.classList.toggle('reduce-motion', this.settings.reducedMotion);
      saveSettings(this.settings);
      this.audio.updateSettings(this.settings);
      this.input.setTouchEnabled(this.settings.touchControls);
      this.renderer.setSettings(this.settings);
      this.renderer.stage.setQuality(this.settings);
      renderSettings(this.settings);
      this.store.update({ cameraMode: payload.cameraMode, settings: this.settings, tierLabel: this.settings.graphicsTier });
      this.closeDialog();
      this.showToast(`SESSION RESTORED · SLOT 0${slot}`);
    } catch (error) {
      this.showToast(this.errorText(error, 'Unable to load this session.'));
    }
  }

  private async refreshSlots(): Promise<void> {
    try {
      this.store.update({ slotTimes: await this.saves.list() });
    } catch (error) {
      const status = document.querySelector<HTMLElement>('#dialog-status');
      if (status) status.textContent = this.errorText(error, 'LOCAL SAVE DATABASE UNAVAILABLE');
    }
  }

  private errorText(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }

  private showToast(message: string): void {
    this.store.update({ toast: message });
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.store.update({ toast: '' }), 2800);
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.loop.stop();
    this.input.dispose();
    this.stateUnsubscribe();
    this.root.removeEventListener('click', this.onClick);
    this.root.removeEventListener('input', this.onInput);
    this.root.removeEventListener('change', this.onChange);
    this.root.removeEventListener('keydown', this.onDialogKeyDown);
    this.root.removeEventListener('pointerdown', this.onUserGesture);
    this.root.removeEventListener('focusin', this.onUserGesture);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    await Promise.all([this.renderer.dispose(), this.audio.dispose()]);
  }
}
