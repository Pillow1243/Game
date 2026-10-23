import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import type { InputFrame, CameraMode } from './types';

export interface CameraSnapshot {
  mode: CameraMode;
  position: [number, number, number];
  target: [number, number, number];
  orbitDistance: number;
  yaw: number;
  pitch: number;
}

export class CameraRig {
  readonly camera = new PerspectiveCamera(62, 1, 0.08, 700);
  private readonly position = new Vector3(0, 1.7, 9);
  private readonly target = new Vector3(0, 1.4, 0);
  private yaw = 0;
  private pitch = 0.32;
  private orbitDistance = 12.5;
  private mode: CameraMode = 'orbit';
  private cinematicTime = 0;
  private reducedMotion = false;
  private movementResolver: ((current: Vector3, candidate: Vector3) => void) | null = null;

  constructor() { this.applyPose(); }

  get cameraMode(): CameraMode { return this.mode; }

  setReducedMotion(enabled: boolean): void { this.reducedMotion = enabled; }

  setMovementResolver(resolver: (current: Vector3, candidate: Vector3) => void): void { this.movementResolver = resolver; }

  setMode(mode: CameraMode): void {
    if (this.mode === mode) return;
    if (mode === 'fps') {
      this.position.copy(this.camera.position);
      this.position.y = 1.7;
      const direction = this.camera.getWorldDirection(new Vector3());
      this.yaw = Math.atan2(-direction.x, -direction.z);
      this.pitch = Math.asin(MathUtils.clamp(direction.y, -0.98, 0.98));
    } else if (this.mode === 'fps') {
      this.target.copy(this.position).add(this.forwardVector().multiplyScalar(this.orbitDistance));
    }
    this.mode = mode;
    this.cinematicTime = 0;
    this.applyPose();
  }

  update(input: InputFrame, dt: number): void {
    const frameScale = Math.min(dt, 0.05);
    if (this.mode === 'fps') this.updateFps(input, frameScale);
    else this.updateOrbit(input, frameScale);
    this.applyPose();
  }

  private updateFps(input: InputFrame, dt: number): void {
    this.yaw -= input.lookX * 0.0022;
    this.pitch = MathUtils.clamp(this.pitch - input.lookY * 0.0022, -1.45, 1.45);
    const speed = (input.sprint ? 7.2 : 3.65) * dt;
    const previous = this.position.clone();
    const forward = this.forwardVector();
    const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.position.addScaledVector(forward, input.moveY * speed);
    this.position.addScaledVector(right, input.moveX * speed);
    this.position.y = 1.7;
    if (this.movementResolver) this.movementResolver(previous, this.position);
    else {
      this.position.x = MathUtils.clamp(this.position.x, -44, 44);
      this.position.z = MathUtils.clamp(this.position.z, -44, 44);
    }
  }

  private updateOrbit(input: InputFrame, dt: number): void {
    if (input.lookX !== 0 || input.lookY !== 0) this.mode = this.mode === 'cinematic' ? 'orbit' : this.mode;
    this.yaw -= input.lookX * 0.003;
    this.pitch = MathUtils.clamp(this.pitch - input.lookY * 0.003, -1.15, 1.25);
    this.orbitDistance = MathUtils.clamp(this.orbitDistance * (1 + input.zoom * 0.09), 4, 42);
    const strafe = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const forward = new Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.target.addScaledVector(strafe, input.moveX * dt * 5.2);
    this.target.addScaledVector(forward, input.moveY * dt * 5.2);
    this.target.x = MathUtils.clamp(this.target.x, -30, 30);
    this.target.z = MathUtils.clamp(this.target.z, -30, 30);
    if (this.mode === 'cinematic') {
      this.cinematicTime += dt;
      if (!this.reducedMotion && input.lookX === 0 && input.lookY === 0 && input.moveX === 0 && input.moveY === 0) {
        this.yaw += dt * 0.075;
        this.pitch = -0.08 + Math.sin(this.cinematicTime * 0.18) * 0.06;
      }
    }
  }

  private forwardVector(): Vector3 {
    const cosPitch = Math.cos(this.pitch);
    return new Vector3(-Math.sin(this.yaw) * cosPitch, Math.sin(this.pitch), -Math.cos(this.yaw) * cosPitch).normalize();
  }

  private applyPose(): void {
    if (this.mode === 'fps') {
      this.camera.position.copy(this.position);
      this.camera.lookAt(this.position.clone().add(this.forwardVector()));
      return;
    }
    const horizontal = Math.cos(this.pitch) * this.orbitDistance;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * horizontal,
      this.target.y + Math.sin(this.pitch) * this.orbitDistance,
      this.target.z + Math.cos(this.yaw) * horizontal,
    );
    this.camera.lookAt(this.target);
  }

  setAspect(width: number, height: number): void {
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }

  snapshot(): CameraSnapshot {
    return {
      mode: this.mode,
      position: [this.position.x, this.position.y, this.position.z],
      target: [this.target.x, this.target.y, this.target.z],
      orbitDistance: this.orbitDistance,
      yaw: this.yaw,
      pitch: this.pitch,
    };
  }

  restore(snapshot: CameraSnapshot): void {
    this.position.set(...snapshot.position);
    this.target.set(...snapshot.target);
    this.orbitDistance = MathUtils.clamp(snapshot.orbitDistance, 4, 42);
    this.yaw = snapshot.yaw;
    this.pitch = MathUtils.clamp(snapshot.pitch, -1.45, 1.45);
    this.mode = snapshot.mode;
    this.applyPose();
  }
}
