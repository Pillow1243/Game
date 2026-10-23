import {
  ACESFilmicToneMapping, AmbientLight, BufferGeometry, CircleGeometry, Color, CylinderGeometry, DirectionalLight,
  Float32BufferAttribute, Fog, Group, InstancedMesh, LineBasicMaterial, LineSegments, Matrix4, Mesh,
  MeshPhysicalMaterial, MeshStandardMaterial, PCFSoftShadowMap, PlaneGeometry, Points, PointsMaterial,
  Scene, SphereGeometry, SpotLight, TorusGeometry, Vector3, WebGLRenderer, SRGBColorSpace,
  BoxGeometry, type Camera, type ColorRepresentation, type PerspectiveCamera,
} from 'three';
import type { CSM } from 'three/addons/csm/CSM.js';
import type { EngineSettings } from './types';
import { tierQuality } from './settings';
import { ProceduralMaterials } from '../world/procedural-materials';
import { PlantWorld } from '../world/plant-world';
import { WebGLPostProcessing } from './post-processing';

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
  readonly world: PlantWorld;
  private readonly materials = new ProceduralMaterials(23017);
  private readonly spots: SpotLight[] = [];
  private cascadedShadows: CSM | null = null;
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
    fill.position.set(4, 17, 9);
    fill.target.position.set(0, 1, 0);
    this.scene.add(fill, fill.target);
    const cool = new SpotLight(0x4d7fa5, 23, 38, Math.PI / 3, 0.6, 1.4);
    cool.position.set(-26, 10, 2);
    cool.target.position.set(-25, 1, 0);
    this.scene.add(cool, cool.target);
    const warm = new SpotLight(0xf1bd79, 13, 28, Math.PI / 3.5, 0.6, 1.6);
    warm.position.set(29, 15, 4);
    warm.target.position.set(29, 1, 0);
    this.scene.add(warm, warm.target);
    const rim = new SpotLight(0x9a6fff, 9, 32, Math.PI / 2.8, 0.7, 1.8);
    rim.position.set(50, 20, -22);
    rim.target.position.set(52, 0, -22);
    this.scene.add(rim, rim.target);
    this.spots.push(fill, cool, warm, rim);

    const groundMaterial = this.materials.material('asphalt', 0x53686d, { roughness: 0.91, metalness: 0.04 });
    const floor = new Mesh(new CircleGeometry(120, 128), groundMaterial);
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
    const platform = new Mesh(new CylinderGeometry(8, 8.5, 0.55, 12), this.materials.material('steel', 0x35484d, { roughness: 0.46, metalness: 0.72 }));
    platform.position.y = 0.24;
    platform.castShadow = platform.receiveShadow = true;
    this.scene.add(platform);

    const vesselPbr = this.materials.material('steel', 0x83949a, { metalness: 0.62, roughness: 0.26 });
    const vesselMaterial = new MeshPhysicalMaterial({ color: 0x83949a, map: vesselPbr.map, roughness: 0.26, roughnessMap: vesselPbr.roughnessMap, metalness: 0.62, metalnessMap: vesselPbr.metalnessMap, normalMap: vesselPbr.normalMap, normalScale: vesselPbr.normalScale, clearcoat: 0.75, clearcoatRoughness: 0.18, transparent: true, opacity: 0.32, depthWrite: false });
    vesselPbr.dispose();
    const vessel = new Mesh(new CylinderGeometry(2.85, 3.1, 4.9, 32, 1, false), vesselMaterial);
    vessel.position.set(0, 2.95, 0);
    vessel.castShadow = vessel.receiveShadow = true;
    this.scene.add(vessel);
    const crown = new Mesh(new CylinderGeometry(2.92, 2.92, 0.42, 32), this.materials.material('steel', 0x31434a, { metalness: 0.88, roughness: 0.24 }));
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

    const ribs = new InstancedMesh(new BoxGeometry(0.19, 4.25, 0.24), this.materials.material('steel', 0x596d73, { metalness: 0.72, roughness: 0.38 }), 12);
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
      const consoleMesh = new Mesh(new BoxGeometry(2.05, 1.25, 1.2), this.materials.material('paint', 0x29383c, { metalness: 0.56, roughness: 0.42 }));
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

    const pipeMaterial = this.materials.material('steel', 0x9badae, { metalness: 0.79, roughness: 0.3 });
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
    this.world = new PlantWorld(this.scene, sun, this.spots, this.materials);
  }

  private gridPoints(extent: number, step: number): Vector3[] {
    const points: Vector3[] = [];
    for (let n = -extent; n <= extent; n += step) {
      points.push(new Vector3(n, 0, -extent), new Vector3(n, 0, extent));
      points.push(new Vector3(-extent, 0, n), new Vector3(extent, 0, n));
    }
    return points;
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
    this.world.setQuality(settings);
    if (this.cascadedShadows) {
      this.cascadedShadows.shadowMapSize = quality.shadows;
      for (const light of this.cascadedShadows.lights) {
        light.shadow.mapSize.set(quality.shadows, quality.shadows);
        light.shadow.map?.dispose();
        light.shadow.map = null;
      }
      this.cascadedShadows.updateFrustums();
    }
  }

  async enableCascadedShadows(camera: PerspectiveCamera, settings: EngineSettings): Promise<void> {
    if (this.cascadedShadows) return;
    const { CSM } = await import('three/addons/csm/CSM.js');
    const quality = tierQuality(settings.graphicsTier);
    const csm = new CSM({
      camera,
      parent: this.scene,
      cascades: 3,
      maxFar: 125,
      mode: 'practical',
      shadowMapSize: quality.shadows,
      lightDirection: new Vector3(-0.5, -1, -0.35).normalize(),
      lightIntensity: 2.15,
      lightMargin: 35,
    });
    this.scene.traverse((object) => {
      if (!(object instanceof Mesh || object instanceof InstancedMesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) csm.setupMaterial(material);
    });
    this.keyLight.castShadow = false;
    this.world.setCsmActive(true);
    this.cascadedShadows = csm;
    csm.update();
    csm.updateUniforms();
  }

  updateShadowFrustums(): void { this.cascadedShadows?.updateFrustums(); }

  update(dt: number, elapsed: number, cameraPosition: Vector3): void {
    this.world.update(dt, elapsed, cameraPosition);
    if (this.cascadedShadows) {
      this.cascadedShadows.lights.forEach((light) => {
        light.color.copy(this.keyLight.color);
        light.intensity = this.world.daylightFactor * 2.15;
      });
      this.cascadedShadows.camera.updateMatrixWorld();
      this.cascadedShadows.update();
      this.cascadedShadows.updateUniforms();
    }
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
    this.cascadedShadows?.remove();
    this.cascadedShadows?.dispose();
    this.cascadedShadows = null;
    this.world.dispose();
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
    this.materials.dispose();
  }
}

export class RenderEngine {
  readonly stage: PlantStage;
  private settings: EngineSettings;
  private readonly rendererSetup: Promise<RendererSetup>;
  private renderer: RendererDriver | null = null;
  private backend: 'webgpu' | 'webgl2' = 'webgl2';
  private readonly canvas: HTMLCanvasElement;
  private readonly resizeObserver: ResizeObserver;
  private camera: PerspectiveCamera | null = null;
  private postProcessing: WebGLPostProcessing | null = null;

  constructor(canvas: HTMLCanvasElement, settings: EngineSettings) {
    this.canvas = canvas;
    this.settings = settings;
    this.stage = new PlantStage();
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

  async initialize(camera: PerspectiveCamera): Promise<'webgpu' | 'webgl2'> {
    this.camera = camera;
    const setup = await this.rendererSetup;
    if (setup.backend === 'webgl2') {
      try {
        await this.stage.enableCascadedShadows(camera, this.settings);
      } catch (error) {
        console.warn('CORE: cascaded shadows unavailable; retaining the directional shadow.', error);
      }
      const width = Math.max(1, this.canvas.parentElement?.clientWidth ?? window.innerWidth);
      const height = Math.max(1, this.canvas.parentElement?.clientHeight ?? window.innerHeight);
      this.postProcessing = new WebGLPostProcessing(setup.renderer as unknown as WebGLRenderer, this.stage.scene, camera, this.settings.graphicsTier, width, height);
    }
    this.resize();
    return setup.backend;
  }

  setSettings(settings: EngineSettings): void {
    this.settings = settings;
    this.stage.setQuality(settings);
    if (!this.renderer) return;
    const quality = tierQuality(settings.graphicsTier);
    this.renderer.setPixelRatio(quality.pixelRatio);
    if (this.renderer.shadowMap) this.renderer.shadowMap.enabled = true;
    const size = this.getViewportSize();
    this.postProcessing?.setQuality(settings.graphicsTier, size.width, size.height);
    this.resize();
  }

  render(dt: number, elapsed: number): void {
    if (!this.camera) return;
    this.stage.update(dt, elapsed, this.camera.position);
    if (this.postProcessing) this.postProcessing.render(dt);
    else if (this.renderer) this.renderer.render(this.stage.scene, this.camera);
  }

  setEmergencyEffect(level: number): void { this.postProcessing?.setEmergencyLevel(level); }

  get rendererName(): 'webgpu' | 'webgl2' { return this.backend; }

  private getViewportSize(): { width: number; height: number } {
    const parent = this.canvas.parentElement;
    return { width: Math.max(1, parent?.clientWidth ?? window.innerWidth), height: Math.max(1, parent?.clientHeight ?? window.innerHeight) };
  }

  private resize = (): void => {
    if (!this.renderer) return;
    const { width, height } = this.getViewportSize();
    if (this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.stage.updateShadowFrustums();
    }
    this.renderer.setSize(width, height, false);
    this.postProcessing?.setSize(width, height);
  };

  async dispose(): Promise<void> {
    this.resizeObserver.disconnect();
    window.removeEventListener('resize', this.resize);
    this.postProcessing?.dispose();
    this.postProcessing = null;
    this.stage.dispose();
    await this.rendererSetup.catch(() => undefined);
    this.renderer?.dispose();
  }
}
