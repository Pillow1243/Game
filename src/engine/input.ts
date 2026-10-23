import type { InputAction, InputFrame } from './types';

const KEY_ACTIONS: Readonly<Record<string, InputAction>> = {
  KeyE: 'interact', Enter: 'interact', Escape: 'pause', KeyP: 'pause', ShiftLeft: 'sprint', ShiftRight: 'sprint',
};
const DEADZONE = 0.16;

export class InputManager {
  private readonly keys = new Set<string>();
  private readonly pending = new Set<InputAction>();
  private readonly previousPadButtons = new Set<number>();
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly touchLayer: HTMLDivElement;
  private readonly stickZone: HTMLDivElement;
  private readonly stickKnob: HTMLDivElement;
  private readonly lookZone: HTMLDivElement;
  private readonly removers: Array<() => void> = [];
  private stickId: number | null = null;
  private lookId: number | null = null;
  private stickX = 0;
  private stickY = 0;
  private pointerLookX = 0;
  private pointerLookY = 0;
  private mouseDown = false;

  constructor(root: HTMLElement, canvas: HTMLCanvasElement) {
    this.root = root;
    this.canvas = canvas;
    this.touchLayer = document.createElement('div');
    this.touchLayer.className = 'touch-controls';
    this.touchLayer.setAttribute('aria-label', 'Touch movement and look controls');
    this.touchLayer.innerHTML = '<div class="touch-stick-zone" aria-label="Move stick"><div class="touch-stick-base"><div class="touch-stick-knob"></div></div><span class="touch-caption">MOVE</span></div><div class="touch-look-zone" aria-label="Drag to look"></div><span class="touch-caption touch-look-caption">DRAG TO LOOK</span><button class="touch-action touch-use" type="button" aria-label="Interact">USE</button><button class="touch-action touch-pause" type="button" aria-label="Pause">Ⅱ</button>';
    root.append(this.touchLayer);
    this.stickZone = this.touchLayer.querySelector<HTMLDivElement>('.touch-stick-zone')!;
    this.stickKnob = this.touchLayer.querySelector<HTMLDivElement>('.touch-stick-knob')!;
    this.lookZone = this.touchLayer.querySelector<HTMLDivElement>('.touch-look-zone')!;
    this.attach(window, 'keydown', this.onKeyDown as EventListener);
    this.attach(window, 'keyup', this.onKeyUp as EventListener);
    this.attach(window, 'blur', this.clearKeys as EventListener);
    this.attach(document, 'pointerlockchange', this.onPointerLockChange as EventListener);
    this.attach(document, 'mousemove', this.onMouseMove as EventListener);
    this.attach(this.canvas, 'pointerdown', this.onCanvasPointerDown as EventListener);
    this.attach(window, 'pointerup', this.onMousePointerUp as EventListener);
    this.attach(this.stickZone, 'pointerdown', this.onStickDown as EventListener);
    this.attach(this.stickZone, 'pointermove', this.onStickMove as EventListener);
    this.attach(this.stickZone, 'pointerup', this.onStickUp as EventListener);
    this.attach(this.stickZone, 'pointercancel', this.onStickUp as EventListener);
    this.attach(this.lookZone, 'pointerdown', this.onLookDown as EventListener);
    this.attach(this.lookZone, 'pointermove', this.onLookMove as EventListener);
    this.attach(this.lookZone, 'pointerup', this.onLookUp as EventListener);
    this.attach(this.lookZone, 'pointercancel', this.onLookUp as EventListener);
    this.attach(this.root, 'wheel', this.onWheel as EventListener, { passive: true });
    const useButton = this.touchLayer.querySelector<HTMLButtonElement>('.touch-use');
    const pauseButton = this.touchLayer.querySelector<HTMLButtonElement>('.touch-pause');
    if (useButton) this.attach(useButton, 'click', () => this.pending.add('interact'));
    if (pauseButton) this.attach(pauseButton, 'click', () => this.pending.add('pause'));
    this.setTouchEnabled(true);
  }

  private attach(target: EventTarget, type: string, callback: EventListener, options?: AddEventListenerOptions): void {
    target.addEventListener(type, callback, options);
    this.removers.push(() => target.removeEventListener(type, callback, options));
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    if (!this.keys.has(event.code) && KEY_ACTIONS[event.code] && KEY_ACTIONS[event.code] !== 'sprint') this.pending.add(KEY_ACTIONS[event.code]!);
    this.keys.add(event.code);
  };

  private onKeyUp = (event: KeyboardEvent): void => { this.keys.delete(event.code); };
  private clearKeys = (): void => { this.keys.clear(); this.mouseDown = false; };
  private onPointerLockChange = (): void => { this.mouseDown = document.pointerLockElement === this.canvas; };

  private onCanvasPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && event.button === 0) {
      this.mouseDown = true;
      if (this.canvas.requestPointerLock && document.pointerLockElement !== this.canvas) void this.canvas.requestPointerLock();
    }
  };

  private onMousePointerUp = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && event.button === 0 && document.pointerLockElement !== this.canvas) this.mouseDown = false;
  };

  private onMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement === this.canvas) {
      this.pointerLookX += event.movementX;
      this.pointerLookY += event.movementY;
    } else if (this.mouseDown) {
      this.pointerLookX += event.movementX;
      this.pointerLookY += event.movementY;
    }
  };

  private onWheel = (event: WheelEvent): void => { this.pendingZoom += Math.sign(event.deltaY); };
  private pendingZoom = 0;

  private onStickDown = (event: PointerEvent): void => {
    if (this.stickId !== null) return;
    this.stickId = event.pointerId;
    this.stickZone.setPointerCapture(event.pointerId);
    this.updateStick(event);
  };

  private onStickMove = (event: PointerEvent): void => { if (event.pointerId === this.stickId) this.updateStick(event); };
  private onStickUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.stickId) return;
    this.stickId = null;
    this.stickX = 0;
    this.stickY = 0;
    this.stickKnob.style.transform = 'translate(0, 0)';
  };

  private updateStick(event: PointerEvent): void {
    const rect = this.stickZone.getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) * 0.29;
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);
    const scale = length > radius ? radius / length : 1;
    this.stickX = (dx * scale) / radius;
    this.stickY = -(dy * scale) / radius;
    this.stickKnob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
  }

  private onLookDown = (event: PointerEvent): void => {
    if (this.lookId !== null) return;
    this.lookId = event.pointerId;
    this.lookZone.setPointerCapture(event.pointerId);
    this.lastLookX = event.clientX;
    this.lastLookY = event.clientY;
  };

  private onLookMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.lookId) return;
    this.pointerLookX += event.clientX - this.lastLookX;
    this.pointerLookY += event.clientY - this.lastLookY;
    this.lastLookX = event.clientX;
    this.lastLookY = event.clientY;
  };

  private lastLookX = 0;
  private lastLookY = 0;
  private onLookUp = (event: PointerEvent): void => { if (event.pointerId === this.lookId) this.lookId = null; };

  private setStickButtonState(buttons: readonly GamepadButton[], index: number, action: InputAction, active: Set<InputAction>): void {
    if (buttons[index]?.pressed) {
      active.add(action);
      if (!this.previousPadButtons.has(index) && action !== 'sprint') this.pending.add(action);
      this.previousPadButtons.add(index);
    } else this.previousPadButtons.delete(index);
  }

  sample(): InputFrame {
    const moveX = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    const moveY = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    let x = moveX + this.stickX;
    let y = moveY + this.stickY;
    let gamepadLookX = 0;
    let gamepadLookY = 0;
    let padSprint = false;
    const active = new Set<InputAction>();
    const pad = navigator.getGamepads?.().find((candidate): candidate is Gamepad => candidate !== null && candidate.connected);
    if (pad) {
      const axisX = pad.axes[0] ?? 0;
      const axisY = pad.axes[1] ?? 0;
      if (Math.abs(axisX) > DEADZONE) x += axisX;
      if (Math.abs(axisY) > DEADZONE) y -= axisY;
      gamepadLookX = Math.abs(pad.axes[2] ?? 0) > DEADZONE ? pad.axes[2] ?? 0 : 0;
      gamepadLookY = Math.abs(pad.axes[3] ?? 0) > DEADZONE ? pad.axes[3] ?? 0 : 0;
      const buttons = pad.buttons;
      this.setStickButtonState(buttons, 0, 'interact', active);
      this.setStickButtonState(buttons, 9, 'pause', active);
      padSprint = Boolean(buttons[4]?.pressed || buttons[5]?.pressed);
      if (padSprint) active.add('sprint');
    }
    const magnitude = Math.hypot(x, y);
    if (magnitude > 1) { x /= magnitude; y /= magnitude; }
    const pressed = new Set(this.pending);
    this.pending.clear();
    return {
      moveX: x,
      moveY: y,
      lookX: this.pointerLookX + gamepadLookX * 8,
      lookY: this.pointerLookY + gamepadLookY * 8,
      zoom: this.pendingZoom,
      sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || padSprint || active.has('sprint'),
      pressed,
    };
  }

  setTouchEnabled(enabled: boolean): void {
    this.touchLayer.hidden = !enabled;
    this.touchLayer.dataset.enabled = String(enabled);
    if (!enabled) {
      this.stickId = null;
      this.lookId = null;
      this.stickX = 0;
      this.stickY = 0;
      this.stickKnob.style.transform = 'translate(0, 0)';
      this.resetLook();
    }
  }

  resetLook(): void { this.pointerLookX = 0; this.pointerLookY = 0; this.pendingZoom = 0; }

  consumeFrame(): void { this.resetLook(); }

  dispose(): void {
    for (const remove of this.removers) remove();
    this.touchLayer.remove();
    this.keys.clear();
    this.pending.clear();
  }
}
