export type GraphicsTier = 'low' | 'med' | 'high' | 'ultra';
export type CameraMode = 'fps' | 'orbit' | 'cinematic';
export type InputAction = 'interact' | 'pause' | 'sprint' | 'look';
export type SaveSlotId = 1 | 2 | 3;

export interface EngineSettings {
  graphicsTier: GraphicsTier;
  graphicsMode: 'auto' | 'manual';
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  touchControls: boolean;
  reducedMotion: boolean;
}

export interface InputFrame {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  zoom: number;
  sprint: boolean;
  pressed: ReadonlySet<InputAction>;
}

export interface PersistedGameState {
  version: 1;
  savedAt: number;
  cameraMode: CameraMode;
  position: [number, number, number];
  target: [number, number, number];
  orbitDistance: number;
  yaw: number;
  pitch: number;
  settings: EngineSettings;
  simulation: Record<string, number | string | boolean | number[] | null>;
}

export interface SaveSlotRecord {
  slot: SaveSlotId;
  savedAt: number;
  payload: PersistedGameState;
}
