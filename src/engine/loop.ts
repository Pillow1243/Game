export interface FrameTiming {
  dt: number;
  elapsed: number;
  fps: number;
  paused: boolean;
}

export class EngineLoop {
  private animationId = 0;
  private lastTime = 0;
  private elapsed = 0;
  private fps = 0;
  private fpsFrames = 0;
  private fpsElapsed = 0;
  private running = false;
  private paused = false;
  private readonly frame: (timing: FrameTiming) => void;

  constructor(frame: (timing: FrameTiming) => void) { this.frame = frame; }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.animationId = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    const raw = Math.max(0, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const dt = Math.min(raw, 0.05);
    this.elapsed += dt;
    this.fpsFrames += 1;
    this.fpsElapsed += raw;
    if (this.fpsElapsed >= 0.45) {
      this.fps = this.fpsFrames / Math.max(this.fpsElapsed, 0.001);
      this.fpsFrames = 0;
      this.fpsElapsed = 0;
    }
    this.frame({ dt, elapsed: this.elapsed, fps: this.fps, paused: this.paused });
    this.animationId = requestAnimationFrame(this.tick);
  };

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.lastTime = performance.now();
  }

  get isPaused(): boolean { return this.paused; }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.animationId);
  }
}
