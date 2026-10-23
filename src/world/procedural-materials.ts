import {
  DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, UnsignedByteType, Vector2,
  RGBAFormat, MeshStandardMaterial, type ColorRepresentation,
} from 'three';

export type SurfaceKind = 'concrete' | 'steel' | 'paint' | 'asphalt' | 'interior';

interface SurfaceStyle {
  base: [number, number, number];
  roughness: number;
  metalness: number;
  repeat: number;
  bump: number;
}

const STYLES: Record<SurfaceKind, SurfaceStyle> = {
  concrete: { base: [102, 116, 117], roughness: 0.84, metalness: 0.08, repeat: 6, bump: 0.42 },
  steel: { base: [139, 157, 159], roughness: 0.31, metalness: 0.82, repeat: 5, bump: 0.18 },
  paint: { base: [48, 100, 104], roughness: 0.48, metalness: 0.52, repeat: 4, bump: 0.24 },
  asphalt: { base: [41, 52, 55], roughness: 0.95, metalness: 0.02, repeat: 12, bump: 0.32 },
  interior: { base: [72, 91, 92], roughness: 0.69, metalness: 0.15, repeat: 5, bump: 0.2 },
};

interface TextureSet {
  albedo: DataTexture;
  roughness: DataTexture;
  metalness: DataTexture;
  normal: DataTexture;
}

function hash(x: number, y: number, seed: number): number {
  const raw = Math.sin((x + seed * 17.13) * 127.1 + (y - seed * 9.31) * 311.7) * 43758.5453123;
  return raw - Math.floor(raw);
}

function buildTextureSet(style: SurfaceStyle, seed: number): TextureSet {
  const size = 128;
  const albedo = new Uint8Array(size * size * 4);
  const rough = new Uint8Array(size * size * 4);
  const metal = new Uint8Array(size * size * 4);
  const normals = new Uint8Array(size * size * 4);
  const heightField = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x;
      const low = hash(Math.floor(x / 8), Math.floor(y / 8), seed);
      const mid = hash(Math.floor(x / 3), Math.floor(y / 3), seed + 7);
      const fine = hash(x, y, seed + 19);
      const wave = (Math.sin((x / size) * Math.PI * 8) + Math.cos((y / size) * Math.PI * 6)) * 0.08;
      const noise = (low - 0.5) * 0.28 + (mid - 0.5) * 0.19 + (fine - 0.5) * 0.12 + wave;
      heightField[i] = noise;
      const base = Math.max(0.5, 1 + noise * 0.42);
      const offset = i * 4;
      for (let channel = 0; channel < 3; channel += 1) albedo[offset + channel] = Math.min(255, Math.max(0, style.base[channel]! * base));
      albedo[offset + 3] = 255;
      const roughValue = Math.round(Math.min(1, Math.max(0, style.roughness + noise * 0.22)) * 255);
      const metalValue = Math.round(Math.min(1, Math.max(0, style.metalness + (fine - 0.5) * (style.metalness > 0.5 ? 0.15 : 0.04))) * 255);
      rough[offset] = rough[offset + 1] = rough[offset + 2] = roughValue;
      rough[offset + 3] = 255;
      metal[offset] = metal[offset + 1] = metal[offset + 2] = metalValue;
      metal[offset + 3] = 255;
    }
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x;
      const left = heightField[y * size + (x + size - 1) % size] ?? 0;
      const right = heightField[y * size + (x + 1) % size] ?? 0;
      const up = heightField[((y + size - 1) % size) * size + x] ?? 0;
      const down = heightField[((y + 1) % size) * size + x] ?? 0;
      const nx = Math.round(Math.max(0, Math.min(255, (128 - (right - left) * 255 * style.bump))));
      const ny = Math.round(Math.max(0, Math.min(255, (128 - (down - up) * 255 * style.bump))));
      const offset = i * 4;
      normals[offset] = nx;
      normals[offset + 1] = ny;
      normals[offset + 2] = 248;
      normals[offset + 3] = 255;
    }
  }
  const create = (data: Uint8Array, srgb: boolean): DataTexture => {
    const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = true;
    texture.colorSpace = srgb ? SRGBColorSpace : '';
    texture.needsUpdate = true;
    texture.anisotropy = 8;
    return texture;
  };
  return { albedo: create(albedo, true), roughness: create(rough, false), metalness: create(metal, false), normal: create(normals, false) };
}

export class ProceduralMaterials {
  private readonly textures = new Map<SurfaceKind, TextureSet>();
  private readonly seed: number;

  constructor(seed = 23017) { this.seed = seed; }

  material(kind: SurfaceKind, tint?: ColorRepresentation, overrides: Partial<Pick<SurfaceStyle, 'roughness' | 'metalness'>> = {}): MeshStandardMaterial {
    const style = STYLES[kind];
    let maps = this.textures.get(kind);
    if (!maps) {
      maps = buildTextureSet(style, this.seed + Object.keys(STYLES).indexOf(kind) * 31);
      this.textures.set(kind, maps);
    }
    const mapsToRepeat = [maps.albedo, maps.roughness, maps.metalness, maps.normal];
    for (const texture of mapsToRepeat) texture.repeat.set(style.repeat, style.repeat);
    const material = new MeshStandardMaterial({
      color: tint ?? 0xffffff,
      map: maps.albedo,
      roughness: overrides.roughness ?? style.roughness,
      roughnessMap: maps.roughness,
      metalness: overrides.metalness ?? style.metalness,
      metalnessMap: maps.metalness,
      normalMap: maps.normal,
      normalScale: new Vector2(style.bump, style.bump),
      envMapIntensity: kind === 'steel' ? 1.1 : 0.45,
    });
    return material;
  }

  dispose(): void {
    for (const maps of this.textures.values()) {
      maps.albedo.dispose();
      maps.roughness.dispose();
      maps.metalness.dispose();
      maps.normal.dispose();
    }
    this.textures.clear();
  }
}
