import {
  BoxGeometry, BufferGeometry, CircleGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group,
  InstancedMesh, LatheGeometry, MathUtils, Matrix4, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Object3D,
  Points, PointsMaterial, Scene, SphereGeometry, TorusGeometry, Vector2, Vector3,
} from 'three';
import type { DirectionalLight, SpotLight } from 'three';
import type { EngineSettings } from '../engine/types';
import { ProceduralMaterials } from './procedural-materials';
import { SiteAtmosphere } from './atmosphere';

export type SiteWeather = 'clear' | 'cloudy' | 'rain' | 'fog';
export interface InteractablePoint {
  id: number;
  name: string;
  area: string;
  detail: string;
  position: Vector3;
}
interface Collider { minX: number; maxX: number; minZ: number; maxZ: number; }
export class PlantWorld {
  readonly root = new Group();
  readonly interactables: InteractablePoint[] = [];
  private readonly materials: ProceduralMaterials;
  private readonly colliders: Collider[] = [];
  private readonly markerMatrices: Matrix4[] = [];
  private readonly markerGeometry = new CylinderGeometry(0.045, 0.06, 0.035, 8);
  private readonly markerMaterial = new MeshStandardMaterial({ color: 0x9fffe6, emissive: 0x1bbf9e, emissiveIntensity: 1.1, metalness: 0.42, roughness: 0.32 });
  private readonly atmosphere: SiteAtmosphere;
  private readonly water: Mesh<CircleGeometry, MeshPhysicalMaterial>;

  constructor(scene: Scene, sun: DirectionalLight, spots: readonly SpotLight[], materials: ProceduralMaterials) {
    this.materials = materials;
    this.water = new Mesh(new CircleGeometry(7.25, 96), new MeshPhysicalMaterial({ color: 0x236781, emissive: 0x062d4b, emissiveIntensity: 0.7, metalness: 0.42, roughness: 0.12, transparent: true, opacity: 0.7, clearcoat: 1, clearcoatRoughness: 0.08, side: DoubleSide, depthWrite: false }));
    this.atmosphere = new SiteAtmosphere(scene, this.root, sun, spots, this.water.material);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 0.56;
    this.root.add(this.water);

    this.buildControlRoom();
    this.buildReactorHall();
    this.buildTurbineHall();
    this.buildCoolingTowers();
    this.buildYardAndRoads();
    this.buildPerimeterFence();
    const markers = new InstancedMesh(this.markerGeometry, this.markerMaterial, this.markerMatrices.length);
    this.markerMatrices.forEach((matrix, index) => markers.setMatrixAt(index, matrix));
    markers.instanceMatrix.needsUpdate = true;
    this.root.add(markers);

    scene.add(this.root);
  }

  private addBox(parent: Group, x: number, y: number, z: number, width: number, height: number, depth: number, material: MeshStandardMaterial | MeshPhysicalMaterial, castShadow = true): Mesh<BoxGeometry> {
    const mesh = new Mesh(new BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y + height / 2, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private addCollider(x: number, z: number, width: number, depth: number): void {
    this.colliders.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 });
  }

  private addWall(parent: Group, x: number, z: number, width: number, depth: number, y = 0, height = 4.6): void {
    this.addBox(parent, x, y, z, width, height, depth, this.materials.material('concrete'));
    this.addCollider(x, z, width, depth);
  }

  private addWindow(parent: Group, x: number, y: number, z: number, width: number, height: number, rotationY = 0): void {
    const glass = new Mesh(new BoxGeometry(width, height, 0.12), new MeshPhysicalMaterial({ color: 0x76cfe0, emissive: 0x082630, emissiveIntensity: 0.25, metalness: 0.34, roughness: 0.08, transparent: true, opacity: 0.3, transmission: 0.42, thickness: 0.18, side: DoubleSide }));
    glass.position.set(x, y, z);
    glass.rotation.y = rotationY;
    glass.castShadow = false;
    parent.add(glass);
    const frame = this.materials.material('steel', 0x71858a);
    const barA = new Mesh(new BoxGeometry(width + 0.16, 0.09, 0.17), frame);
    barA.position.set(x, y + height / 2, z);
    barA.rotation.y = rotationY;
    const barB = new Mesh(new BoxGeometry(width + 0.16, 0.09, 0.17), frame);
    barB.position.set(x, y - height / 2, z);
    barB.rotation.y = rotationY;
    parent.add(barA, barB);
  }

  private addBeam(parent: Group, from: Vector3, to: Vector3, radius: number, material: MeshStandardMaterial): void {
    const delta = to.clone().sub(from);
    const mesh = new Mesh(new CylinderGeometry(radius, radius, delta.length(), 8), material);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize());
    mesh.castShadow = true;
    parent.add(mesh);
  }

  private addInteractable(name: string, area: string, x: number, y: number, z: number, detail: string): void {
    const point: InteractablePoint = { id: this.interactables.length + 1, name, area, detail, position: new Vector3(x, y, z) };
    this.interactables.push(point);
    const markerTransform = new Object3D();
    markerTransform.position.copy(point.position);
    markerTransform.updateMatrix();
    this.markerMatrices.push(markerTransform.matrix.clone());
  }

  private buildControlRoom(): void {
    const room = new Group();
    const centerX = -25;
    this.addBox(room, centerX, -0.25, 0, 22, 0.5, 16, this.materials.material('interior'));
    this.addBox(room, centerX, 6.3, 0, 22, 0.34, 16, this.materials.material('concrete'), false);
    this.addWall(room, centerX, -8.1, 22, 0.45, 0, 5.8);
    this.addWall(room, -36.1, 0, 0.45, 16, 0, 5.8);
    this.addWall(room, -13.9, -4.75, 0.45, 6.5, 0, 5.8);
    this.addWall(room, -13.9, 4.75, 0.45, 6.5, 0, 5.8);
    this.addWall(room, -25, 8.1, 8.5, 0.45, 0, 5.8);
    this.addBox(room, -25, 5.7, 8.1, 5.3, 0.3, 0.45, this.materials.material('steel'));
    this.addWindow(room, -25, 4.0, 8.03, 7.2, 2.35);
    const doorLight = new Mesh(new BoxGeometry(2.3, 0.12, 0.12), new MeshStandardMaterial({ color: 0x87ffdc, emissive: 0x42e7b6, emissiveIntensity: 2.1 }));
    doorLight.position.set(-13.6, 5.4, 0);
    room.add(doorLight);

    const consoleMaterial = this.materials.material('paint', 0x506970, { roughness: 0.42, metalness: 0.56 });
    const screenMaterial = new MeshStandardMaterial({ color: 0x0c2028, emissive: 0x0d7f83, emissiveIntensity: 1.2, metalness: 0.22, roughness: 0.2 });
    let number = 0;
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const x = -31.2 + col * 4.1;
        const z = -4.6 + row * 4.2;
        const consoleMesh = this.addBox(room, x, 0.72, z, 2.6, 1.42, 1.35, consoleMaterial);
        consoleMesh.rotation.y = Math.PI / 2;
        const screen = new Mesh(new BoxGeometry(1.46, 0.65, 0.075), screenMaterial.clone());
        screen.position.set(x + 0.85, 1.62, z);
        screen.rotation.y = Math.PI / 2;
        room.add(screen);
        const lamp = new Mesh(new SphereGeometry(0.055, 8, 6), new MeshStandardMaterial({ color: 0xa6ffdd, emissive: 0x4cffb6, emissiveIntensity: 2.2 }));
        lamp.position.set(x + 0.75, 1.32, z - 0.32);
        room.add(lamp);
        number += 1;
        this.addInteractable(`Control desk ${String(number).padStart(2, '0')}`, 'CONTROL ROOM', x + 1.25, 1.45, z, 'Operator console · monitoring and command interface');
      }
    }
    const boardMaterial = this.materials.material('steel', 0x657c82);
    for (let i = 0; i < 8; i += 1) {
      const z = -6.1 + i * 1.72;
      this.addBox(room, -35.65, 1.8, z, 0.18, 3.6, 1.28, boardMaterial);
      const display = new Mesh(new BoxGeometry(0.06, 0.7, 0.78), new MeshStandardMaterial({ color: 0x16333a, emissive: i % 2 ? 0x0b8195 : 0x0a9c77, emissiveIntensity: 1.05, metalness: 0.18, roughness: 0.25 }));
      display.position.set(-35.51, 2.55, z);
      room.add(display);
      this.addInteractable(`Wall instrument ${String(i + 1).padStart(2, '0')}`, 'CONTROL ROOM', -35.1, 1.8, z, 'Annunciator and plant instrumentation panel');
    }
    const ceilingBeam = this.materials.material('steel', 0x677b80);
    for (let i = 0; i < 6; i += 1) this.addBeam(room, new Vector3(-35 + i * 4, 6.05, -7.5), new Vector3(-35 + i * 4, 6.05, 7.5), 0.09, ceilingBeam);
    this.root.add(room);
  }

  private buildReactorHall(): void {
    const hall = new Group();
    const floor = new Mesh(new BoxGeometry(31, 0.38, 29), this.materials.material('concrete', 0x697a7b));
    floor.position.set(0, -0.12, 0);
    floor.receiveShadow = true;
    hall.add(floor);
    const stripes = new MeshStandardMaterial({ color: 0xe6bd51, emissive: 0x4b3306, emissiveIntensity: 0.25, roughness: 0.58 });
    for (const x of [-14.8, 14.8]) {
      for (const z of [-12.2, 12.2]) {
        this.addBox(hall, x, 0, z, 0.85, 10.5, 0.85, this.materials.material('steel', 0x56696e));
        this.addBox(hall, x, 0, z, 0.91, 0.2, 0.91, stripes);
      }
    }
    const wall = this.materials.material('concrete', 0x879291);
    for (const z of [-14.15, 14.15]) {
      for (const x of [-9, -3, 3, 9]) {
        this.addBox(hall, x, 0, z, 5.5, 7.6, 0.5, wall);
        this.addWindow(hall, x, 4.1, z + (z > 0 ? -0.29 : 0.29), 2.8, 2.4);
      }
    }
    const beamMaterial = this.materials.material('steel', 0x73868a);
    for (let i = 0; i < 7; i += 1) {
      const x = -14 + i * 4.6;
      this.addBeam(hall, new Vector3(x, 10.1, -13.4), new Vector3(x, 10.1, 13.4), 0.12, beamMaterial);
    }
    this.addBeam(hall, new Vector3(-14.5, 9.9, -10), new Vector3(14.5, 9.9, -10), 0.16, beamMaterial);
    this.addBeam(hall, new Vector3(-14.5, 9.9, 10), new Vector3(14.5, 9.9, 10), 0.16, beamMaterial);
    const poolRing = new Mesh(new TorusGeometry(7.65, 0.24, 12, 72), this.materials.material('steel', 0x768b90));
    poolRing.rotation.x = Math.PI / 2;
    poolRing.position.y = 0.62;
    hall.add(poolRing);
    for (let i = 0; i < 8; i += 1) {
      const angle = i * Math.PI / 4;
      const valve = new Mesh(new TorusGeometry(0.34, 0.08, 8, 18), this.materials.material('steel', i % 2 ? 0xd19543 : 0x71cfbd));
      valve.position.set(Math.cos(angle) * 9.4, 1.15, Math.sin(angle) * 9.4);
      valve.rotation.x = Math.PI / 2;
      hall.add(valve);
      this.addInteractable(`Reactor loop valve ${String(i + 1).padStart(2, '0')}`, 'REACTOR HALL', valve.position.x, 1.25, valve.position.z, 'Primary loop valve handwheel and position indicator');
    }
    for (let i = 0; i < 16; i += 1) {
      const angle = i / 16 * Math.PI * 2;
      const x = Math.cos(angle) * 5.6;
      const z = Math.sin(angle) * 5.6;
      const cabinet = this.addBox(hall, x, 0, z, 0.8, 2.25, 0.72, this.materials.material('paint', 0x425d62));
      cabinet.rotation.y = -angle;
      const panel = new Mesh(new BoxGeometry(0.52, 0.78, 0.035), new MeshStandardMaterial({ color: 0x0c2026, emissive: i % 3 === 0 ? 0x0b819a : 0x14745f, emissiveIntensity: 0.95 }));
      panel.position.set(x + Math.cos(angle) * 0.43, 1.45, z + Math.sin(angle) * 0.43);
      panel.rotation.y = -angle;
      hall.add(panel);
      this.addInteractable(`Reactor instrument rack ${String(i + 1).padStart(2, '0')}`, 'REACTOR HALL', x + Math.cos(angle) * 0.95, 1.55, z + Math.sin(angle) * 0.95, 'Core instrumentation and local equipment status');
    }
    this.root.add(hall);
    this.addCollider(0, -14.2, 31, 0.65);
    this.addCollider(0, 14.2, 31, 0.65);
    this.addCollider(-15.15, 0, 0.65, 26.5);
    this.addCollider(15.15, -8.5, 0.65, 10.5);
    this.addCollider(15.15, 8.5, 0.65, 10.5);
  }

  private buildTurbineHall(): void {
    const hall = new Group();
    const centerX = 29;
    const floor = new Mesh(new BoxGeometry(28, 0.38, 27), this.materials.material('concrete', 0x697a7b));
    floor.position.set(centerX, -0.12, 0);
    floor.receiveShadow = true;
    hall.add(floor);
    this.addWall(hall, centerX, -13.2, 27, 0.5, 0, 8.4);
    this.addWall(hall, centerX, 13.2, 27, 0.5, 0, 8.4);
    this.addWall(hall, 42.5, 0, 0.5, 26.4, 0, 8.4);
    this.addWall(hall, 15.5, -10.2, 0.5, 5.8, 0, 8.4);
    this.addWall(hall, 15.5, 10.2, 0.5, 5.8, 0, 8.4);
    this.addWindow(hall, 29, 6.3, -12.91, 15, 2.1);
    this.addWindow(hall, 29, 6.3, 12.91, 15, 2.1);
    const roofBeams = this.materials.material('steel', 0x667a7d);
    for (let i = 0; i < 6; i += 1) {
      const x = 17 + i * 4.8;
      this.addBeam(hall, new Vector3(x, 8.3, -12.7), new Vector3(x, 8.3, 12.7), 0.12, roofBeams);
    }
    const casing = this.materials.material('steel', 0x89979a, { roughness: 0.24, metalness: 0.88 });
    const paint = this.materials.material('paint', 0x536c70, { roughness: 0.38, metalness: 0.66 });
    for (let unit = 0; unit < 3; unit += 1) {
      const x = 21 + unit * 8;
      const turbine = new Mesh(new CylinderGeometry(1.15, 1.25, 4.8, 24, 1), casing);
      turbine.rotation.z = Math.PI / 2;
      turbine.position.set(x, 1.95, -3.6);
      turbine.castShadow = true;
      hall.add(turbine);
      const generator = new Mesh(new CylinderGeometry(1.1, 1.15, 3.2, 24), paint);
      generator.rotation.z = Math.PI / 2;
      generator.position.set(x + 4, 1.9, -3.6);
      generator.castShadow = true;
      hall.add(generator);
      const pipe = new Mesh(new CylinderGeometry(0.33, 0.42, 7.5, 16), this.materials.material('steel', 0x9baeb0));
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(x + 1.8, 3.5, -3.6);
      hall.add(pipe);
      const handwheel = new Mesh(new TorusGeometry(0.48, 0.08, 8, 20), this.materials.material('steel', 0xc3914e));
      handwheel.position.set(x, 1.9, -1.5);
      handwheel.rotation.x = Math.PI / 2;
      hall.add(handwheel);
      this.addInteractable(`Turbine train ${unit + 1}`, 'TURBINE HALL', x, 1.7, -1.3, 'High/low pressure turbine and generator local station');
      this.addInteractable(`Steam isolation valve ${unit + 1}`, 'TURBINE HALL', x + 1.8, 3.55, -3.6, 'Steam admission piping and isolation controls');
      const cabinet = this.addBox(hall, x + 5.3, 0.4, 2.4, 1.45, 2.2, 1.1, paint);
      cabinet.rotation.y = Math.PI / 2;
      const display = new Mesh(new BoxGeometry(0.75, 0.56, 0.05), new MeshStandardMaterial({ color: 0x091a20, emissive: 0x0b88a3, emissiveIntensity: 1.15 }));
      display.position.set(x + 5.88, 1.77, 2.4);
      display.rotation.y = Math.PI / 2;
      hall.add(display);
      this.addInteractable(`Turbine local panel ${unit + 1}`, 'TURBINE HALL', x + 5.9, 1.7, 2.4, 'Local turbine train instrumentation panel');
    }
    for (let i = 0; i < 12; i += 1) {
      const x = 18 + (i % 6) * 4.3;
      const z = i < 6 ? 8.2 : -8.3;
      const sensor = new Mesh(new CylinderGeometry(0.14, 0.18, 1.5, 10), this.materials.material('steel', 0x8c9da0));
      sensor.position.set(x, 0.75, z);
      hall.add(sensor);
      this.addInteractable(`Turbine hall sensor ${String(i + 1).padStart(2, '0')}`, 'TURBINE HALL', x, 1.5, z, 'Vibration, bearing, and lube-oil local sensor');
    }
    this.root.add(hall);
  }

  private buildCoolingTowers(): void {
    const profile = [
      [7.6, 0], [8.1, 0.9], [8.3, 2.2], [7.9, 4.3], [6.8, 7.1], [5.7, 10.2],
      [5.25, 14], [5.45, 17.8], [6.3, 21.4], [7.7, 25.1], [9.1, 29], [9.2, 29.4],
    ].map(([radius, y]) => new Vector2(radius!, y!));
    const towerGeometry = new LatheGeometry(profile, 48);
    const concrete = this.materials.material('concrete', 0x9aa2a0, { roughness: 0.76, metalness: 0.03 });
    const ringMaterial = this.materials.material('steel', 0x727e80);
    for (let index = 0; index < 2; index += 1) {
      const x = 52;
      const z = index === 0 ? -22 : 22;
      const tower = new Mesh(towerGeometry, concrete);
      tower.position.set(x, 0, z);
      tower.castShadow = tower.receiveShadow = true;
      this.root.add(tower);
      const collar = new Mesh(new TorusGeometry(8.2, 0.17, 10, 72), ringMaterial);
      collar.rotation.x = Math.PI / 2;
      collar.position.set(x, 2.3, z);
      this.root.add(collar);
      const steamGeometry = new BufferGeometry();
      const positions = new Float32Array(180 * 3);
      const colors = new Float32Array(180 * 3);
      for (let i = 0; i < 180; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 4.1;
        const i3 = i * 3;
        positions[i3] = x + Math.cos(angle) * radius;
        positions[i3 + 1] = 28 + Math.random() * 14;
        positions[i3 + 2] = z + Math.sin(angle) * radius;
        colors[i3] = colors[i3 + 1] = colors[i3 + 2] = 0.7;
      }
      steamGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      steamGeometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
      const steamMaterial = new PointsMaterial({ color: 0xe6f3ed, size: 0.65, transparent: true, opacity: 0.24, depthWrite: false, vertexColors: true });
      const steam = new Points(steamGeometry, steamMaterial);
      steam.frustumCulled = false;
      this.root.add(steam);
      this.atmosphere.addSteam(steam, positions, colors, new Vector3(x, 28, z));
      for (let i = 0; i < 4; i += 1) {
        const angle = i * Math.PI / 2 + index * 0.4;
        const px = x + Math.cos(angle) * 8.2;
        const pz = z + Math.sin(angle) * 8.2;
        this.addInteractable(`Cooling tower ${index + 1} sensor ${i + 1}`, 'COOLING TOWERS', px, 1.45, pz, 'Cooling tower draft, basin level, and water temperature monitor');
      }
      this.addInteractable(`Tower ${index + 1} basin access`, 'COOLING TOWERS', x + 5.3, 1.2, z + 5.3, 'Cooling tower basin access station and pump service point');
    }
    const pipeMaterial = this.materials.material('steel', 0x77898b, { roughness: 0.3, metalness: 0.8 });
    for (const z of [-22, 22]) {
      const pipe = new Mesh(new CylinderGeometry(0.62, 0.62, 23, 18), pipeMaterial);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(39, 2.6, z);
      pipe.castShadow = true;
      this.root.add(pipe);
      this.addCollider(52, z, 14, 14);
    }
  }

  private buildYardAndRoads(): void {
    const road = this.materials.material('asphalt', 0xa2aaa8, { roughness: 0.9, metalness: 0.02 });
    this.addBox(this.root, -2, 0.005, 44, 10.5, 0.08, 35, road, false);
    this.addBox(this.root, 17, 0.008, 18, 47, 0.08, 8, road, false);
    this.addBox(this.root, 48, 0.01, 1, 9, 0.08, 45, road, false);
    const line = new MeshStandardMaterial({ color: 0xd7c997, emissive: 0x302511, emissiveIntensity: 0.35, transparent: true, opacity: 0.82, roughness: 0.76 });
    for (let i = 0; i < 9; i += 1) this.addBox(this.root, -2, 0.06, 30 + i * 3.7, 0.17, 0.025, 1.8, line, false);
    const railMat = this.materials.material('steel', 0x697a7c);
    for (const z of [-13.6, 13.6]) {
      for (let i = 0; i < 12; i += 1) {
        const x = 18 + i * 2.1;
        const post = new Mesh(new CylinderGeometry(0.045, 0.05, 0.95, 8), railMat);
        post.position.set(x, 0.52, z);
        this.root.add(post);
      }
      this.addBox(this.root, 29.5, 0.95, z, 24, 0.08, 0.08, railMat, false);
      this.addBox(this.root, 29.5, 0.52, z, 24, 0.06, 0.06, railMat, false);
    }
    const lampMaterial = new MeshStandardMaterial({ color: 0xffdca0, emissive: 0xffbd61, emissiveIntensity: 2.5 });
    for (let i = 0; i < 8; i += 1) {
      const x = -58 + i * 16;
      const pole = new Mesh(new CylinderGeometry(0.1, 0.15, 7, 10), railMat);
      pole.position.set(x, 3.5, 42);
      this.root.add(pole);
      const lamp = new Mesh(new SphereGeometry(0.28, 12, 8), lampMaterial);
      lamp.position.set(x, 7.15, 42);
      this.root.add(lamp);
      this.addInteractable(`Yard light ${String(i + 1).padStart(2, '0')}`, 'SITE EXTERIOR', x, 1.1, 42, 'Exterior lighting control and circuit indicator');
    }
    const exhaustMaterial = this.materials.material('steel', 0x77888a);
    const exhaust = new Mesh(new CylinderGeometry(1.15, 1.4, 10, 20), exhaustMaterial);
    exhaust.position.set(-47, 5, -32);
    this.root.add(exhaust);
    const redRing = new Mesh(new TorusGeometry(1.18, 0.12, 8, 32), new MeshStandardMaterial({ color: 0xef7054, emissive: 0x8f1c13, emissiveIntensity: 0.65 }));
    redRing.rotation.x = Math.PI / 2;
    redRing.position.set(-47, 9.5, -32);
    this.root.add(redRing);
  }

  private buildPerimeterFence(): void {
    const steel = this.materials.material('steel', 0x58686b, { roughness: 0.55, metalness: 0.72 });
    const hazard = new MeshStandardMaterial({ color: 0xe8c264, emissive: 0x30210a, emissiveIntensity: 0.2, roughness: 0.62 });
    const radiusX = 86;
    const radiusZ = 58;
    const spacing = 4;
    const posts: Matrix4[] = [];
    const caps: Matrix4[] = [];
    const rails: Matrix4[] = [];
    const gateLeaves: Matrix4[] = [];
    const gateBars: Matrix4[] = [];
    const pose = new Object3D();
    const addFenceRun = (x1: number, z1: number, x2: number, z2: number, gateOpening = false): void => {
      const segments = Math.floor(Math.hypot(x2 - x1, z2 - z1) / spacing);
      const angle = Math.atan2(z2 - z1, x2 - x1);
      for (let i = 0; i <= segments; i += 1) {
        const t = i / segments;
        const x = x1 + (x2 - x1) * t;
        const z = z1 + (z2 - z1) * t;
        if (gateOpening && Math.abs(x) < 6) continue;
        pose.position.set(x, 1.3, z); pose.rotation.set(0, 0, 0); pose.scale.set(1, 1, 1); pose.updateMatrix(); posts.push(pose.matrix.clone());
        pose.position.set(x, 2.68, z); pose.updateMatrix(); caps.push(pose.matrix.clone());
        if (i < segments) {
          const nx = x1 + (x2 - x1) * ((i + 1) / segments);
          const nz = z1 + (z2 - z1) * ((i + 1) / segments);
          const span = Math.hypot(nx - x, nz - z);
          const middleX = (x + nx) / 2;
          const middleZ = (z + nz) / 2;
          if (!(gateOpening && Math.abs(middleX) < 6)) {
            for (const y of [0.45, 1.1, 1.75, 2.35, 2.95]) {
              pose.position.set(middleX, y, middleZ);
              pose.rotation.set(y === 2.95 ? -Math.PI / 4 : 0, -angle, 0);
              pose.scale.set(span, 1, 1); pose.updateMatrix(); rails.push(pose.matrix.clone());
            }
          }
        }
      }
    };
    addFenceRun(-radiusX, -radiusZ, radiusX, -radiusZ);
    addFenceRun(-radiusX, radiusZ, -6, radiusZ, true);
    addFenceRun(6, radiusZ, radiusX, radiusZ, true);
    addFenceRun(-radiusX, -radiusZ, -radiusX, radiusZ);
    addFenceRun(radiusX, -radiusZ, radiusX, radiusZ);
    const addBatch = (geometry: BoxGeometry | SphereGeometry, material: MeshStandardMaterial, matrices: Matrix4[]): void => {
      const batch = new InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((matrix, index) => batch.setMatrixAt(index, matrix));
      batch.instanceMatrix.needsUpdate = true;
      batch.castShadow = true;
      batch.receiveShadow = true;
      this.root.add(batch);
    };
    addBatch(new BoxGeometry(0.16, 2.6, 0.16), steel, posts);
    addBatch(new SphereGeometry(0.115, 8, 6), hazard, caps);
    addBatch(new BoxGeometry(1, 0.035, 0.035), steel, rails);

    for (const direction of [-1, 1]) {
      pose.position.set(direction * 3.1, 1.15, radiusZ); pose.rotation.set(0, direction * -0.03, 0); pose.scale.set(1, 1, 1); pose.updateMatrix(); gateLeaves.push(pose.matrix.clone());
      for (let i = 0; i < 8; i += 1) {
        pose.position.set(direction * (0.6 + i * 0.71), 1.15, radiusZ); pose.rotation.set(0, 0, 0); pose.updateMatrix(); gateBars.push(pose.matrix.clone());
      }
    }
    const gateMaterial = this.materials.material('paint', 0x53696d, { metalness: 0.78 });
    addBatch(new BoxGeometry(5.8, 2.25, 0.16), gateMaterial, gateLeaves);
    addBatch(new BoxGeometry(0.08, 2.25, 0.2), steel, gateBars);
    this.addInteractable('Security checkpoint', 'SITE GATE', 0, 1.2, 54, 'Main access checkpoint and perimeter gate station');
    this.addInteractable('Perimeter camera 01', 'SITE GATE', -9, 2.2, 57, 'CCTV camera and security sector status');
    this.addInteractable('Perimeter camera 02', 'SITE GATE', 9, 2.2, 57, 'CCTV camera and security sector status');
    this.addInteractable('Gate motor panel', 'SITE GATE', -6.5, 1.2, 55, 'Vehicle barrier and gate motor service panel');
    this.addInteractable('Emergency muster sign', 'SITE GATE', 12, 1.4, 53, 'Personnel muster point and site access information');
  }

  setQuality(settings: EngineSettings): void { this.atmosphere.setQuality(settings.graphicsTier); }

  setWeather(weather: SiteWeather): SiteWeather { return this.atmosphere.setWeather(weather); }

  cycleWeather(): SiteWeather { return this.atmosphere.cycleWeather(); }

  get weatherState(): SiteWeather { return this.atmosphere.weatherState; }
  get timeHours(): number { return this.atmosphere.timeHours; }
  get windMetersPerSecond(): number { return this.atmosphere.windMetersPerSecond; }
  get daylightFactor(): number { return this.atmosphere.daylightFactor; }
  get interactableCount(): number { return this.interactables.length; }

  setCsmActive(active: boolean): void { this.atmosphere.setCsmActive(active); }

  currentArea(position: Vector3): string {
    if (position.x < -14 && position.x > -37 && Math.abs(position.z) < 9) return 'CONTROL ROOM';
    if (position.x > 15 && position.x < 43 && Math.abs(position.z) < 14) return 'TURBINE HALL';
    if (Math.abs(position.x) < 16 && Math.abs(position.z) < 15) return 'REACTOR HALL';
    if (position.x > 43 && position.x < 65 && Math.abs(position.z) < 34) return 'COOLING TOWERS';
    if (Math.abs(position.x) > 78 || Math.abs(position.z) > 52) return 'PERIMETER';
    return 'SITE EXTERIOR';
  }

  nearestInteractable(position: Vector3, maxDistance = 2.7): InteractablePoint | null {
    let nearest: InteractablePoint | null = null;
    let best = maxDistance * maxDistance;
    for (const point of this.interactables) {
      const distance = position.distanceToSquared(point.position);
      if (distance < best) { nearest = point; best = distance; }
    }
    return nearest;
  }

  resolveMovement(current: Vector3, candidate: Vector3, radius = 0.34): void {
    candidate.x = MathUtils.clamp(candidate.x, -82, 82);
    candidate.z = MathUtils.clamp(candidate.z, -54, 54);
    const tryX = candidate.x;
    candidate.x = this.isBlocked(tryX, current.z, radius) ? current.x : tryX;
    const tryZ = candidate.z;
    candidate.z = this.isBlocked(candidate.x, tryZ, radius) ? current.z : tryZ;
    candidate.y = 1.7;
  }

  private isBlocked(x: number, z: number, radius: number): boolean {
    return this.colliders.some((collider) => x + radius > collider.minX && x - radius < collider.maxX && z + radius > collider.minZ && z - radius < collider.maxZ);
  }

  update(dt: number, elapsed: number, cameraPosition: Vector3): void {
    this.atmosphere.update(dt, elapsed, cameraPosition);
  }

  dispose(): void {
    this.atmosphere.dispose();
    this.root.removeFromParent();
    this.root.traverse((object) => {
      if (object instanceof Mesh || object instanceof Points) {
        object.geometry.dispose();
        const material = object.material;
        const materials = Array.isArray(material) ? material : [material];
        for (const entry of materials) entry.dispose();
      }
    });
  }

}
