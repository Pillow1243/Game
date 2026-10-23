import {
  ACESFilmicToneMapping, AmbientLight, BufferGeometry, CircleGeometry, Color, CylinderGeometry, DirectionalLight,
  Float32BufferAttribute, Fog, Group, InstancedMesh, LineBasicMaterial, LineSegments, Matrix4, Mesh,
  MeshPhysicalMaterial, MeshStandardMaterial, PCFSoftShadowMap, PlaneGeometry, Points, PointsMaterial,
  Scene, SphereGeometry, SpotLight, TorusGeometry, Vector3, WebGLRenderer, SRGBColorSpace,
  BoxGeometry, type Camera, type ColorRepresentation,
} from 'three';
import type { EngineSettings } from './types';
import { tierQuality } from './settings';

interface RendererDriver {
  domElement: HTMLCanvasElement;
  setPixelRatio(value: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  render(scene: Scene, camera: Camera): void;
  dispose(): void;
  setClearColor(color: ColorRepresentation, alpha?: number): void;
  shadowMap?: { enabled: boolean; type: number | null };
  outputColorSpace?: string;
  toneMapping?: number;
  toneMappingExposure?: number;
}

export interface RendererSetup {
  renderer: RendererDriver;
  backend: 'webgpu' | 'webgl2';
}

export async function createRenderer(canvas: HTMLCanvasElement, settings: EngineSettings): Promise<RendererSetup> {
  const quality = tierQuality(settings.graphicsTier);
  if ('gpu' in navigator && settings.graphicsTier !== 'low') {
    try {
      const module = await import('three/addons/renderers/webgpu/WebGPURenderer.js');
      const renderer = new module.default({ canvas, antialias: quality.antialias });
      await renderer.init();
      renderer.setPixelRatio(quality.pixelRatio);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = PCFSoftShadowMap;
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      return { renderer, backend: 'webgpu' };
    } catch (error) {
      console.info('CORE: WebGPU setup failed; using the WebGL2 renderer.', error);
    }
  }
  const renderer = new WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x08121b, 1);
  return { renderer, backend: 'webgl2' };
}

export class PlantStage {
  readonly scene = new Scene();
  private readonly core: Mesh<CylinderGeometry, MeshPhysicalMaterial>;
  private readonly glow: Mesh<SphereGeometry, MeshPhysicalMaterial>;
  private readonly ring: Mesh<TorusGeometry, MeshStandardMaterial>;
  private readonly rotorGroup: Group;
  private readonly sparks: Points<BufferGeometry, PointsMaterial>;
  private readonly sparkPositions: Float32Array;
  private readonly keyLight: DirectionalLight;

  constructor() {
    this.scene.background = new Color(0x08121b);
    this.scene.fog = new Fog(0x08121b, 28, 92);
    this.scene.add(new AmbientLight(0x89a9ba, 1.15));
    const sun = new DirectionalLight(0xc1e3ed, 2.4);
    this.keyLight = sun;
    sun.position.set(-12, 24, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32;
    sun.shadow.camera.bottom = -32;
    this.scene.add(sun);
    const fill = new SpotLight(0x68ddcf, 36, 45, Math.PI / 4, 0.55, 1.5);
    fill.position.set(6, 13, 7);
    fill.target.position.set(0, 1, 0);
    this.scene.add(fill, fill.target);
    const cool = new SpotLight(0x4d7fa5, 23, 38, Math.PI / 3, 0.6, 1.4);
    cool.position.set(-9, 9, -7);
    cool.target.position.set(0, 2, 0);
    this.scene.add(cool, cool.target);
    const warm = new SpotLight(0xf1bd79, 13, 28, Math.PI / 3.5, 0.6, 1.6);
    warm.position.set(10, 7, -4);
    warm.target.position.set(0, 0, 0);
    this.scene.add(warm, warm.target);
    const rim = new SpotLight(0x9a6fff, 9, 32, Math.PI / 2.8, 0.7, 1.8);
    rim.position.set(0, 18, -10);
    rim.target.position.set(0, 0, 0);
    this.scene.add(rim, rim.target);

    const groundMaterial = new MeshStandardMaterial({ color: 0x17252c, roughness: 0.86, metalness: 0.12 });
    const floor = new Mesh(new CircleGeometry(45, 96), groundMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.08;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const grid = new LineSegments(
      new BufferGeometry().setFromPoints(this.gridPoints(70, 5)),
      new LineBasicMaterial({ color: 0x41636b, transparent: true, opacity: 0.19 }),
    );
    grid.position.y = -0.06;
    this.scene.add(grid);
    const platform = new Mesh(new CylinderGeometry(8, 8.5, 0.55, 12), new MeshStandardMaterial({ color: 0x263940, roughness: 0.48, metalness: 0.72 }));
    platform.position.y = 0.24;
    platform.castShadow = platform.receiveShadow = true;
    this.scene.add(platform);

    const vesselMaterial = new MeshPhysicalMaterial({ color: 0x83949a, metalness: 0.62, roughness: 0.26, clearcoat: 0.75, clearcoatRoughness: 0.18, transparent: true, opacity: 0.32, depthWrite: false });
    const vessel = new Mesh(new CylinderGeometry(2.85, 3.1, 4.9, 32, 1, false), vesselMaterial);
    vessel.position.set(0, 2.95, 0);
    vessel.castShadow = vessel.receiveShadow = true;
    this.scene.add(vessel);
    const crown = new Mesh(new CylinderGeometry(2.92, 2.92, 0.42, 32), new MeshStandardMaterial({ color: 0x31434a, metalness: 0.88, roughness: 0.24 }));
    crown.position.set(0, 5.55, 0);
    crown.castShadow = true;
    this.scene.add(crown);
    this.glow = new Mesh(new SphereGeometry(1.2, 28, 20), new MeshPhysicalMaterial({ color: 0x67e3ff, emissive: 0x059be4, emissiveIntensity: 2.2, transparent: true, opacity: 0.82, roughness: 0.14, metalness: 0.05 }));
    this.glow.position.set(0, 2.8, 0);
    this.scene.add(this.glow);
    this.core = new Mesh(new CylinderGeometry(0.72, 0.84, 2.45, 20, 1), new MeshPhysicalMaterial({ color: 0x92edff, emissive: 0x16baff, emissiveIntensity: 1.8, transparent: true, opacity: 0.9, roughness: 0.18, metalness: 0.12 }));
    this.core.position.set(0, 2.9, 0);
    this.scene.add(this.core);
    this.ring = new Mesh(new TorusGeometry(3.55, 0.075, 12, 80), new MeshStandardMaterial({ color: 0x86f2e2, emissive: 0x0e9a9d, emissiveIntensity: 1.5, metalness: 0.48, roughness: 0.25 }));
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 1.2;
    this.scene.add(this.ring);

    const ribs = new InstancedMesh(new BoxGeometry(0.19, 4.25, 0.24), new MeshStandardMaterial({ color: 0x596d73, metalness: 0.72, roughness: 0.38 }), 12);
    const matrix = new Matrix4();
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      matrix.makeTranslation(Math.cos(angle) * 3.02, 2.95, Math.sin(angle) * 3.02);
      matrix.multiply(new Matrix4().makeRotationY(-angle));
      ribs.setMatrixAt(i, matrix);
    }
    ribs.castShadow = true;
    this.scene.add(ribs);

    this.rotorGroup = new Group();
    for (let i = 0; i < 4; i += 1) {
      const consoleMesh = new Mesh(new BoxGeometry(2.05, 1.25, 1.2), new MeshStandardMaterial({ color: 0x29383c, metalness: 0.56, roughness: 0.42 }));
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      consoleMesh.position.set(Math.sin(angle) * 7, 0.9, Math.cos(angle) * 7);
      consoleMesh.lookAt(0, 0.85, 0);
      consoleMesh.castShadow = true;
      consoleMesh.receiveShadow = true;
      this.rotorGroup.add(consoleMesh);
      const display = new Mesh(new PlaneGeometry(1.55, 0.74), new MeshStandardMaterial({ color: 0x07141a, emissive: i % 2 ? 0x087d70 : 0x0c87bb, emissiveIntensity: 1.1, roughness: 0.23, metalness: 0.28 }));
      display.position.set(0, 0.11, 0.615);
      consoleMesh.add(display);
      const indicator = new Mesh(new SphereGeometry(0.065, 10, 8), new MeshStandardMaterial({ color: 0x9dfed9, emissive: 0x4effbd, emissiveIntensity: 1.7 }));
      indicator.position.set(-0.72, -0.37, 0.63);
      consoleMesh.add(indicator);
    }
    this.scene.add(this.rotorGroup);

    const pipeMaterial = new MeshStandardMaterial({ color: 0x9badae, metalness: 0.79, roughness: 0.3 });
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2;
      const pipe = new Mesh(new CylinderGeometry(0.17, 0.17, 4.2, 12), pipeMaterial);
      pipe.position.set(Math.cos(angle) * 4.7, 2.75, Math.sin(angle) * 4.7);
      pipe.rotation.z = Math.PI / 2;
      pipe.rotation.y = -angle;
      pipe.castShadow = true;
      this.scene.add(pipe);
    }

    this.sparkPositions = new Float32Array(120 * 3);
    for (let i = 0; i < 120; i += 1) {
      const i3 = i * 3;
      this.sparkPositions[i3] = (Math.random() - 0.5) * 7;
      this.sparkPositions[i3 + 1] = Math.random() * 5.5;
      this.sparkPositions[i3 + 2] = (Math.random() - 0.5) * 7;
    }
    const sparkGeometry = new BufferGeometry();
    sparkGeometry.setAttribute('position', new Float32BufferAttribute(this.sparkPositions, 3));
    this.sparks = new Points(sparkGeometry, new PointsMaterial({ color: 0x66ddff, size: 0.045, transparent: true, opacity: 0.58, depthWrite: false }));
    this.scene.add(this.sparks);
    this.addPerimeterPylons();
  }

  private gridPoints(extent: number, step: number): Vector3[] {
    const points: Vector3[] = [];
    for (let n = -extent; n <= extent; n += step) {
      points.push(new Vector3(n, 0, -extent), new Vector3(n, 0, extent));
      points.push(new Vector3(-extent, 0, n), new Vector3(extent, 0, n));
    }
    return points;
  }

  private addPerimeterPylons(): void {
    const pylonMaterial = new MeshStandardMaterial({ color: 0x3c5157, roughness: 0.68, metalness: 0.5 });
    const markerMaterial = new MeshStandardMaterial({ color: 0xff805e, emissive: 0xb62917, emissiveIntensity: 0.75 });
    const count = 24;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const pole = new Mesh(new CylinderGeometry(0.12, 0.15, 2.5, 8), pylonMaterial);
      pole.position.set(Math.sin(angle) * 18, 1.18, Math.cos(angle) * 18);
      pole.castShadow = true;
      this.scene.add(pole);
      const marker = new Mesh(new SphereGeometry(0.12, 8, 6), markerMaterial);
      marker.position.set(pole.position.x, 2.48, pole.position.z);
      this.scene.add(marker);
    }
  }

  setQuality(settings: EngineSettings): void {
    const quality = tierQuality(settings.graphicsTier);
    this.sparks.visible = quality.particles > 0;
    this.sparks.geometry.setDrawRange(0, Math.min(120, quality.particles));
    this.sparks.material.size = settings.graphicsTier === 'low' ? 0.025 : settings.graphicsTier === 'ultra' ? 0.065 : 0.045;
    this.keyLight.shadow.mapSize.set(quality.shadows, quality.shadows);
    this.keyLight.shadow.map?.dispose();
    this.keyLight.shadow.map = null;
    this.keyLight.shadow.needsUpdate = true;
  }

  update(dt: number, elapsed: number): void {
    this.core.rotation.y += dt * 0.08;
    const pulse = 0.9 + Math.sin(elapsed * 1.7) * 0.09;
    this.glow.scale.setScalar(pulse);
    this.glow.material.emissiveIntensity = 1.9 + Math.sin(elapsed * 1.4) * 0.36;
    this.ring.rotation.z = elapsed * 0.12;
    const positions = this.sparks.geometry.attributes.position;
    if (!positions) return;
    for (let i = 0; i < 120; i += 1) {
      const index = i * 3 + 1;
      this.sparkPositions[index] = (this.sparkPositions[index] ?? 0) + dt * (0.13 + (i % 5) * 0.035);
      if ((this.sparkPositions[index] ?? 0) > 6) this.sparkPositions[index] = 0.3;
    }
    positions.needsUpdate = true;
  }

  dispose(): void {
    this.scene.traverse((object) => {
      if (object instanceof Mesh || object instanceof InstancedMesh) {
        object.geometry.dispose();
        const mats = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of mats) material.dispose();
      } else if (object instanceof Points) {
        object.geometry.dispose();
        object.material.dispose();
      } else if (object instanceof LineSegments) {
        object.geometry.dispose();
        const mats = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of mats) material.dispose();
      }
    });
  }
}

export class RenderEngine {
  readonly stage = new PlantStage();
  private readonly rendererSetup: Promise<RendererSetup>;
  private renderer: RendererDriver | null = null;
  private backend: 'webgpu' | 'webgl2' = 'webgl2';
  private readonly canvas: HTMLCanvasElement;
  private readonly resizeObserver: ResizeObserver;
  private camera: Camera | null = null;

  constructor(canvas: HTMLCanvasElement, settings: EngineSettings) {
    this.canvas = canvas;
    this.stage.setQuality(settings);
    this.rendererSetup = createRenderer(canvas, settings).then((setup) => {
      this.renderer = setup.renderer;
      this.backend = setup.backend;
      this.resize();
      return setup;
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    window.addEventListener('resize', this.resize);
  }

  async initialize(camera: Camera): Promise<'webgpu' | 'webgl2'> {
    this.camera = camera;
    const setup = await this.rendererSetup;
    this.resize();
    return setup.backend;
  }

  setSettings(settings: EngineSettings): void {
    if (!this.renderer) return;
    const quality = tierQuality(settings.graphicsTier);
    this.renderer.setPixelRatio(quality.pixelRatio);
    if (this.renderer.shadowMap) this.renderer.shadowMap.enabled = settings.graphicsTier !== 'low';
    this.resize();
  }

  render(dt: number, elapsed: number): void {
    this.stage.update(dt, elapsed);
    if (this.renderer && this.camera) this.renderer.render(this.stage.scene, this.camera);
  }

  get rendererName(): 'webgpu' | 'webgl2' { return this.backend; }

  private resize = (): void => {
    if (!this.renderer) return;
    const parent = this.canvas.parentElement;
    const width = Math.max(1, parent?.clientWidth ?? window.innerWidth);
    const height = Math.max(1, parent?.clientHeight ?? window.innerHeight);
    this.renderer.setSize(width, height, false);
  };

  async dispose(): Promise<void> {
    this.resizeObserver.disconnect();
    window.removeEventListener('resize', this.resize);
    this.stage.dispose();
    await this.rendererSetup.catch(() => undefined);
    this.renderer?.dispose();
  }
}
