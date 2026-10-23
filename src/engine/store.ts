import type { CameraMode, EngineSettings, GraphicsTier, SaveSlotId } from './types';

export interface EngineState {
  ready: boolean;
  paused: boolean;
  audioMuted: boolean;
  fps: number;
  renderer: 'webgpu' | 'webgl2' | 'initializing';
  cameraMode: CameraMode;
  settings: EngineSettings;
  selectedSlot: SaveSlotId;
  slotTimes: Partial<Record<SaveSlotId, number>>;
  toast: string;
  tierLabel: GraphicsTier;
}

type Listener = (state: Readonly<EngineState>) => void;

export class ObservableStore {
  private state: EngineState;
  private readonly listeners = new Set<Listener>();

  constructor(initial: EngineState) {
    this.state = initial;
  }

  get snapshot(): Readonly<EngineState> {
    return this.state;
  }

  update(patch: Partial<EngineState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  subscribe(listener: Listener, emitCurrent = false): () => void {
    this.listeners.add(listener);
    if (emitCurrent) listener(this.state);
    return () => this.listeners.delete(listener);
  }
}
