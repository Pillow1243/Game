import {
  BufferGeometry, CanvasTexture, Color, DirectionalLight, EquirectangularReflectionMapping, Float32BufferAttribute,
  Fog, Group, LineBasicMaterial, LineSegments, MathUtils, MeshPhysicalMaterial, Points, PointsMaterial, Scene,
  SpotLight, SRGBColorSpace, Vector3,
} from 'three';
import type { GraphicsTier } from '../engine/types';
import { tierQuality } from '../engine/settings';
import type { SiteWeather } from './plant-world';

interface SteamEmitter {
  points: Points<BufferGeometry, PointsMaterial>;
  positions: Float32Array;
  colors: Float32Array;
  base: Vector3;
}

const WEATHER: readonly SiteWeather[] = ['clear', 'cloudy', 'rain', 'fog'];

function colorMix(a: Color, b: Color, amount: number): Color { return a.clone().lerp(b, MathUtils.clamp(amount, 0, 1)); }

export class SiteAtmosphere {
  private readonly scene: Scene;
  private readonly parent: Group;
  private readonly sun: DirectionalLight;
  private readonly spots: readonly SpotLight[];
  private readonly water: MeshPhysicalMaterial;
  private readonly steam: SteamEmitter[] = [];
  private readonly skyCanvas: HTMLCanvasElement;
  private readonly skyContext: CanvasRenderingContext2D;
  private readonly skyTexture: CanvasTexture;
  private readonly rain: LineSegments<BufferGeometry, LineBasicMaterial>;
  private readonly rainState: Float32Array;
  private readonly rainPositions: Float32Array;
  private readonly rainGeometry: BufferGeometry;
  private worldSeconds = 0;
  private lastSkyUpdate = -1;
  private weather: SiteWeather = 'clear';
  private windDirection = new Vector3(0.55, 0, 0.22).normalize();
  private windSpeed = 2.1;
  private currentTier: GraphicsTier = 'high';
  private csmActive = false;

  constructor(scene: Scene, parent: Group, sun: DirectionalLight, spots: readonly SpotLight[], water: MeshPhysicalMaterial) {
    this.scene = scene;
    this.parent = parent;
    this.sun = sun;
    this.spots = spots;
    this.water = water;
    this.skyCanvas = document.createElement('canvas');
    this.skyCanvas.width = 512;
    this.skyCanvas.height = 256;
    const context = this.skyCanvas.getContext('2d');
    if (!context) throw new Error('CORE: canvas gradient environment is unavailable.');
    this.skyContext = context;
    this.skyTexture = new CanvasTexture(this.skyCanvas);
    this.skyTexture.mapping = EquirectangularReflectionMapping;
    this.skyTexture.colorSpace = SRGBColorSpace;
    this.skyTexture.generateMipmaps = true;
    this.skyTexture.needsUpdate = true;
    this.scene.background = this.skyTexture;
    this.scene.environment = this.skyTexture;
    this.scene.fog = new Fog(0x1a343d, 32, 135);

    this.rainState = new Float32Array(840 * 3);
    this.rainPositions = new Float32Array(840 * 6);
    for (let i = 0; i < 840; i += 1) {
      const i3 = i * 3;
      this.rainState[i3] = (Math.random() - 0.5) * 58;
      this.rainState[i3 + 1] = Math.random() * 28;
      this.rainState[i3 + 2] = (Math.random() - 0.5) * 58;
    }
    this.rainGeometry = new BufferGeometry();
    this.rainGeometry.setAttribute('position', new Float32BufferAttribute(this.rainPositions, 3));
    this.rain = new LineSegments(this.rainGeometry, new LineBasicMaterial({ color: 0x82cde8, transparent: true, opacity: 0.4, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.parent.add(this.rain);
    this.updateEnvironment(6);
  }

  addSteam(points: Points<BufferGeometry, PointsMaterial>, positions: Float32Array, colors: Float32Array, base: Vector3): void {
    this.steam.push({ points, positions, colors, base: base.clone() });
  }

  get timeHours(): number { return (6 + this.worldSeconds / 45) % 24; }
  get weatherState(): SiteWeather { return this.weather; }
  get windMetersPerSecond(): number { return this.windSpeed; }
  get daylightFactor(): number { return Math.max(0, Math.sin((this.timeHours - 6) / 12 * Math.PI)); }

  setCsmActive(active: boolean): void { this.csmActive = active; }

  setQuality(tier: GraphicsTier): void {
    this.currentTier = tier;
    const count = tierQuality(tier).particles;
    for (const emitter of this.steam) emitter.points.geometry.setDrawRange(0, Math.min(180, count * 18));
    this.rainGeometry.setDrawRange(0, count * 48 * 2);
  }

  setWeather(weather: SiteWeather): SiteWeather {
    this.weather = weather;
    this.rain.visible = weather === 'rain';
    this.windSpeed = weather === 'clear' ? 2.1 : weather === 'cloudy' ? 4.2 : weather === 'rain' ? 7.5 : 1.8;
    this.updateEnvironment(this.timeHours);
    return this.weather;
  }

  cycleWeather(): SiteWeather {
    const next = (WEATHER.indexOf(this.weather) + 1) % WEATHER.length;
    return this.setWeather(WEATHER[next]!);
  }

  private getTimeHours(): number { return (6 + this.worldSeconds / 45) % 24; }

  private updateSky(hour: number): void {
    const ctx = this.skyContext;
    const width = this.skyCanvas.width;
    const height = this.skyCanvas.height;
    const day = Math.max(0, Math.sin((hour - 6) / 12 * Math.PI));
    const night = hour < 6 || hour > 18;
    const top = colorMix(new Color(0x07101f), new Color(0x367aa1), day);
    const horizon = colorMix(new Color(0x102234), new Color(0xe5bd8a), day);
    if (this.weather === 'cloudy' || this.weather === 'rain' || this.weather === 'fog') {
      top.lerp(new Color(0x596b70), this.weather === 'fog' ? 0.48 : 0.3);
      horizon.lerp(new Color(0x7f9392), 0.4);
    }
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `#${top.getHexString()}`);
    gradient.addColorStop(0.46, `#${horizon.getHexString()}`);
    gradient.addColorStop(0.58, `#${horizon.clone().multiplyScalar(0.8).getHexString()}`);
    gradient.addColorStop(1, '#17232b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    const cloudCount = this.weather === 'clear' ? 8 : this.weather === 'fog' ? 58 : 34;
    for (let i = 0; i < cloudCount; i += 1) {
      const x = (i * 83 + Math.round(hour * 3)) % width;
      const y = 38 + (i * 41) % 105;
      const alpha = this.weather === 'clear' ? 0.018 : this.weather === 'fog' ? 0.055 : 0.07;
      ctx.fillStyle = `rgba(225,239,235,${alpha})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 26 + (i % 5) * 10, 5 + (i % 4) * 2, (i % 7) * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    if (day > 0.05 && this.weather !== 'fog') {
      const angle = ((hour - 6) / 12) * Math.PI;
      const x = width * MathUtils.clamp(hour / 24, 0.06, 0.94);
      const y = height * (0.35 - Math.sin(angle) * 0.18);
      const glow = ctx.createRadialGradient(x, y, 3, x, y, 34);
      glow.addColorStop(0, 'rgba(255,240,193,.95)');
      glow.addColorStop(0.18, 'rgba(255,207,132,.42)');
      glow.addColorStop(1, 'rgba(255,205,120,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 35, y - 35, 70, 70);
    } else if (night) {
      for (let i = 0; i < 80; i += 1) {
        const x = (i * 67 + 19) % width;
        const y = (i * 31 + 7) % 118;
        ctx.fillStyle = `rgba(221,240,255,${0.25 + (i % 4) * 0.12})`;
        ctx.fillRect(x, y, i % 11 === 0 ? 2 : 1, i % 11 === 0 ? 2 : 1);
      }
    }
    this.skyTexture.needsUpdate = true;
    const fog = this.scene.fog;
    if (fog instanceof Fog) {
      fog.color.copy(horizon);
      fog.near = this.weather === 'fog' ? 8 : this.weather === 'rain' ? 22 : 32;
      fog.far = this.weather === 'fog' ? 55 : this.weather === 'rain' ? 85 : 135;
    }
  }

  private updateLighting(hour: number): void {
    const daylight = Math.max(0, Math.sin((hour - 6) / 12 * Math.PI));
    const cloudFactor = this.weather === 'clear' ? 1 : this.weather === 'fog' ? 0.45 : 0.68;
    const baseSunIntensity = 0.08 + daylight * 2.9 * cloudFactor;
    this.sun.intensity = this.csmActive ? Math.min(0.22, baseSunIntensity) : baseSunIntensity;
    this.sun.color.copy(colorMix(new Color(0x8795d2), new Color(0xffedcf), daylight));
    this.sun.position.set(-42 * Math.cos((hour - 6) / 24 * Math.PI * 2), 12 + 48 * daylight, 32 * Math.sin((hour - 6) / 24 * Math.PI * 2));
    for (const [index, spot] of this.spots.entries()) spot.intensity = (daylight > 0.12 ? 4.5 : 16) * (index === 0 ? 1 : 0.82);
    this.water.emissiveIntensity = 0.38 + daylight * 0.6;
  }

  private updateRain(dt: number, camera: Vector3): void {
    const positionAttribute = this.rain.geometry.attributes.position;
    if (this.weather !== 'rain' || !positionAttribute) return;
    const count = Math.min(840, tierQuality(this.currentTier).particles * 48);
    this.rain.geometry.setDrawRange(0, count * 2);
    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      let y = (this.rainState[i3 + 1] ?? 0) - dt * (22 + this.windSpeed * 1.2);
      if (y < 0) y = 22 + Math.random() * 12;
      this.rainState[i3 + 1] = y;
      const x = camera.x + (this.rainState[i3] ?? 0);
      const z = camera.z + (this.rainState[i3 + 2] ?? 0);
      const offset = i * 6;
      this.rainPositions[offset] = x;
      this.rainPositions[offset + 1] = y;
      this.rainPositions[offset + 2] = z;
      this.rainPositions[offset + 3] = x - this.windDirection.x * 0.28 + 0.1;
      this.rainPositions[offset + 4] = y - 0.85;
      this.rainPositions[offset + 5] = z - this.windDirection.z * 0.28 + 0.03;
    }
    positionAttribute.needsUpdate = true;
    this.rain.visible = true;
  }

  private updateEnvironment(hour: number): void {
    this.updateSky(hour);
    this.updateLighting(hour);
  }

  update(dt: number, elapsed: number, cameraPosition: Vector3): void {
    this.worldSeconds = elapsed;
    const hour = this.getTimeHours();
    if (Math.floor(elapsed / 3) !== this.lastSkyUpdate) {
      this.lastSkyUpdate = Math.floor(elapsed / 3);
      this.updateEnvironment(hour);
    }
    this.updateRain(dt, cameraPosition);
    for (const emitter of this.steam) {
      const positionAttribute = emitter.points.geometry.attributes.position;
      const colorAttribute = emitter.points.geometry.attributes.color;
      if (!positionAttribute || !colorAttribute) continue;
      for (let i = 0; i < 180; i += 1) {
        const i3 = i * 3;
        const height = emitter.positions[i3 + 1] ?? emitter.base.y;
        emitter.positions[i3] = (emitter.positions[i3] ?? emitter.base.x) + this.windDirection.x * dt * this.windSpeed * 0.17;
        emitter.positions[i3 + 2] = (emitter.positions[i3 + 2] ?? emitter.base.z) + this.windDirection.z * dt * this.windSpeed * 0.17;
        emitter.positions[i3 + 1] = height + dt * (1.1 + (i % 5) * 0.08);
        if ((emitter.positions[i3 + 1] ?? 0) > 47 || Math.abs((emitter.positions[i3] ?? 0) - emitter.base.x) > 12) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * 4.1;
          emitter.positions[i3] = emitter.base.x + Math.cos(angle) * radius;
          emitter.positions[i3 + 1] = emitter.base.y + Math.random() * 3;
          emitter.positions[i3 + 2] = emitter.base.z + Math.sin(angle) * radius;
        }
        const alpha = Math.max(0.02, 1 - ((emitter.positions[i3 + 1] ?? 0) - emitter.base.y) / 25);
        emitter.colors[i3] = alpha * 0.8;
        emitter.colors[i3 + 1] = alpha * 0.9;
        emitter.colors[i3 + 2] = alpha;
      }
      positionAttribute.needsUpdate = true;
      colorAttribute.needsUpdate = true;
      emitter.points.material.opacity = this.weather === 'rain' ? 0.36 : 0.25;
    }
  }

  dispose(): void {
    this.parent.remove(this.rain);
    this.rain.geometry.dispose();
    this.rain.material.dispose();
    this.skyTexture.dispose();
    this.scene.background = new Color(0x08121b);
    this.scene.environment = null;
  }
}
