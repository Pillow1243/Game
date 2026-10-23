import type { EngineSettings, GraphicsTier } from './types';

const STORAGE_KEY = 'core-nuclear.settings.v1';
const DEFAULT_SETTINGS: EngineSettings = {
  graphicsTier: 'high',
  graphicsMode: 'auto',
  masterVolume: 0.78,
  musicVolume: 0.32,
  sfxVolume: 0.72,
  voiceVolume: 0.9,
  touchControls: true,
  reducedMotion: false,
};

function clamp01(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

export function detectGraphicsTier(): GraphicsTier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency || 4;
  const memory = nav.deviceMemory || 4;
  let renderer = '';
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { powerPreference: 'high-performance' });
  if (gl) {
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    renderer = extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) as string : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
  const gpu = renderer.toLowerCase();
  const integrated = /intel|mali|adreno\s*[34]|powervr|swiftshader|llvmpipe/.test(gpu);
  if (memory >= 8 && cores >= 8 && !integrated && !/mobile|android|iphone|ipad/i.test(navigator.userAgent)) return 'ultra';
  if (memory >= 6 && cores >= 6 && !integrated) return 'high';
  if (memory >= 4 && cores >= 4) return 'med';
  return 'low';
}

function readSettings(): Partial<EngineSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as Partial<EngineSettings>;
  } catch {
    return {};
  }
}

export function loadSettings(): EngineSettings {
  const saved = readSettings();
  const graphicsMode = saved.graphicsMode === 'manual' ? 'manual' : 'auto';
  const detected = detectGraphicsTier();
  const requested = saved.graphicsTier;
  const graphicsTier = graphicsMode === 'auto'
    ? detected
    : requested === 'low' || requested === 'med' || requested === 'high' || requested === 'ultra' ? requested : detected;
  return {
    graphicsTier,
    graphicsMode,
    masterVolume: clamp01(saved.masterVolume, DEFAULT_SETTINGS.masterVolume),
    musicVolume: clamp01(saved.musicVolume, DEFAULT_SETTINGS.musicVolume),
    sfxVolume: clamp01(saved.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
    voiceVolume: clamp01(saved.voiceVolume, DEFAULT_SETTINGS.voiceVolume),
    touchControls: typeof saved.touchControls === 'boolean' ? saved.touchControls : DEFAULT_SETTINGS.touchControls,
    reducedMotion: typeof saved.reducedMotion === 'boolean'
      ? saved.reducedMotion
      : window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
}

export function saveSettings(settings: EngineSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('CORE: settings could not be persisted in this browser.', error);
  }
}

export function tierQuality(tier: GraphicsTier): { shadows: number; antialias: boolean; pixelRatio: number; particles: number } {
  const devicePixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const pixelRatio = Math.min(devicePixelRatio, tier === 'ultra' ? 2 : tier === 'high' ? 1.75 : tier === 'med' ? 1.5 : 1);
  switch (tier) {
    case 'ultra': return { shadows: 4096, antialias: true, pixelRatio, particles: 8 };
    case 'high': return { shadows: 2048, antialias: true, pixelRatio, particles: 4 };
    case 'med': return { shadows: 1024, antialias: true, pixelRatio, particles: 2 };
    case 'low': return { shadows: 512, antialias: false, pixelRatio, particles: 1 };
  }
}
