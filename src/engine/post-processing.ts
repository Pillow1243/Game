import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Vector2, type Scene, type WebGLRenderer, type PerspectiveCamera } from 'three';
import type { GraphicsTier } from './types';

const FilmicEffects = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new Vector2(1, 1) },
    elapsed: { value: 0 },
    chromatic: { value: 0 },
    vignette: { value: 0.24 },
    emergency: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float elapsed;
    uniform float chromatic;
    uniform float vignette;
    uniform float emergency;
    varying vec2 vUv;
    void main() {
      vec2 centered = vUv - 0.5;
      float radial = dot(centered, centered);
      float aberration = chromatic * (1.0 + emergency * 4.0) * (0.25 + radial * 1.7);
      vec2 offset = normalize(centered + vec2(0.00001)) * aberration / max(resolution.x, resolution.y);
      vec4 color;
      color.r = texture2D(tDiffuse, vUv + offset).r;
      color.g = texture2D(tDiffuse, vUv).g;
      color.b = texture2D(tDiffuse, vUv - offset).b;
      color.a = texture2D(tDiffuse, vUv).a;
      float edge = smoothstep(0.18, 0.72, radial);
      float pulse = 1.0 + emergency * (0.045 + 0.035 * sin(elapsed * 8.0));
      color.rgb *= (1.0 - edge * vignette) * pulse;
      color.rgb = mix(color.rgb, vec3(color.r * 1.04, color.g * 0.82, color.b * 0.86), emergency * 0.2);
      gl_FragColor = color;
    }
  `,
};

export class WebGLPostProcessing {
  private readonly renderer: WebGLRenderer;
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private filmPass!: ShaderPass;
  private tier: GraphicsTier;
  private emergencyLevel = 0;

  constructor(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, tier: GraphicsTier, width: number, height: number) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.tier = tier;
    this.rebuild(width, height);
  }

  private rebuild(width: number, height: number): void {
    this.disposeComposer();
    const composer = new EffectComposer(this.renderer);
    this.filmPass = new ShaderPass(FilmicEffects);
    composer.addPass(new RenderPass(this.scene, this.camera));
    if (this.tier === 'ultra' || this.tier === 'high') {
      const ssao = new SSAOPass(this.scene, this.camera, width, height);
      ssao.kernelRadius = this.tier === 'ultra' ? 18 : 13;
      ssao.minDistance = 0.001;
      ssao.maxDistance = this.tier === 'ultra' ? 0.19 : 0.14;
      composer.addPass(ssao);
    }
    if (this.tier !== 'low') composer.addPass(new UnrealBloomPass(new Vector2(width, height), 0.6, 0.38, 0.85));
    composer.addPass(this.filmPass);
    composer.addPass(new OutputPass());
    composer.setPixelRatio(this.renderer.getPixelRatio());
    composer.setSize(width, height);
    this.filmPass.uniforms.resolution!.value.set(width * this.renderer.getPixelRatio(), height * this.renderer.getPixelRatio());
    this.filmPass.uniforms.emergency!.value = this.emergencyLevel;
    this.composer = composer;
  }

  setSize(width: number, height: number): void {
    if (!this.composer) return;
    this.composer.setSize(width, height);
    this.filmPass.uniforms.resolution!.value.set(width * this.renderer.getPixelRatio(), height * this.renderer.getPixelRatio());
  }

  setQuality(tier: GraphicsTier, width: number, height: number): void {
    if (tier === this.tier) return;
    this.tier = tier;
    this.rebuild(width, height);
    this.setEmergencyLevel(this.emergencyLevel);
  }

  setEmergencyLevel(level: number): void {
    this.emergencyLevel = Math.max(0, Math.min(1, level));
    this.filmPass.uniforms.emergency!.value = this.emergencyLevel;
    this.filmPass.uniforms.chromatic!.value = this.emergencyLevel * 8;
    this.filmPass.uniforms.vignette!.value = 0.24 + this.emergencyLevel * 0.24;
  }

  render(dt: number): void {
    if (!this.composer) return;
    this.filmPass.uniforms.elapsed!.value += dt;
    this.composer.render(dt);
  }

  private disposeComposer(): void {
    if (!this.composer) return;
    for (const pass of this.composer.passes) pass.dispose();
    this.composer.dispose();
    this.composer = null;
  }

  dispose(): void { this.disposeComposer(); }
}
