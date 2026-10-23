import type { EngineSettings } from './types';

export type AudioChannel = 'music' | 'sfx' | 'voice';
type GainKey = 'master' | AudioChannel;

export class AudioBus {
  private context: AudioContext | null = null;
  private readonly gains = new Map<GainKey, GainNode>();
  private settings: EngineSettings;
  private ducked = false;
  private duckRequest = false;
  private activeVoiceTones = 0;
  private muted = false;
  private ambience: OscillatorNode[] = [];

  constructor(settings: EngineSettings) { this.settings = settings; }

  async unlock(): Promise<void> {
    if (!this.context) {
      const Context = window.AudioContext;
      this.context = new Context({ latencyHint: 'interactive' });
      const master = this.context.createGain();
      master.gain.value = this.settings.masterVolume;
      master.connect(this.context.destination);
      this.gains.set('master', master);
      for (const channel of ['music', 'sfx', 'voice'] as const) {
        const gain = this.context.createGain();
        gain.gain.value = this.channelVolume(channel);
        gain.connect(master);
        this.gains.set(channel, gain);
      }
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }

  updateSettings(settings: EngineSettings): void {
    this.settings = settings;
    const now = this.context?.currentTime ?? 0;
    this.ramp('master', this.muted ? 0 : settings.masterVolume, now, 0.08);
    for (const channel of ['music', 'sfx', 'voice'] as const) {
      this.ramp(channel, this.channelVolume(channel), now, 0.08);
    }
  }

  private channelVolume(channel: AudioChannel): number {
    const volume = channel === 'music' ? this.settings.musicVolume : channel === 'sfx' ? this.settings.sfxVolume : this.settings.voiceVolume;
    return channel === 'music' && this.ducked ? volume * 0.22 : volume;
  }

  private ramp(key: GainKey, value: number, start: number, duration: number): void {
    const param = this.gains.get(key)?.gain;
    if (!param) return;
    param.cancelScheduledValues(start);
    param.setTargetAtTime(Math.max(0, Math.min(1, value)), start, Math.max(0.005, duration / 3));
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.context) this.ramp('master', muted ? 0 : this.settings.masterVolume, this.context.currentTime, 0.05);
  }

  setVoiceDucking(active: boolean): void {
    this.duckRequest = active;
    this.syncDucking();
  }

  private syncDucking(): void {
    const shouldDuck = this.duckRequest || this.activeVoiceTones > 0;
    if (this.ducked === shouldDuck) return;
    this.ducked = shouldDuck;
    if (this.context) this.ramp('music', this.channelVolume('music'), this.context.currentTime, shouldDuck ? 0.12 : 0.65);
  }

  playTone(channel: AudioChannel, frequency: number, duration = 0.12, waveform: OscillatorType = 'sine', volume = 0.32): void {
    if (!this.context || this.context.state !== 'running') return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    if (channel === 'voice') {
      this.activeVoiceTones += 1;
      this.syncDucking();
    }
    const start = this.context.currentTime + 0.008;
    const end = start + Math.max(0.025, duration);
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(Math.max(30, Math.min(12000, frequency)), start);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, Math.min(0.7, volume)), start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(envelope);
    envelope.connect(this.gains.get(channel)!);
    oscillator.start(start);
    oscillator.stop(end + 0.015);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
      if (channel === 'voice') {
        this.activeVoiceTones = Math.max(0, this.activeVoiceTones - 1);
        this.syncDucking();
      }
    };
  }

  startAmbient(): void {
    if (!this.context || this.ambience.length > 0) return;
    const tones = [55, 82.41, 110];
    for (const [index, frequency] of tones.entries()) {
      const oscillator = this.context.createOscillator();
      const envelope = this.context.createGain();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      envelope.gain.value = index === 0 ? 0.024 : 0.008;
      oscillator.connect(envelope);
      envelope.connect(this.gains.get('music')!);
      oscillator.start();
      this.ambience.push(oscillator);
    }
  }

  stopAmbient(): void {
    for (const oscillator of this.ambience) {
      try { oscillator.stop(); } catch { /* Already stopped by context shutdown. */ }
      oscillator.disconnect();
    }
    this.ambience = [];
  }

  async suspend(): Promise<void> {
    if (this.context?.state === 'running') await this.context.suspend();
  }

  async resume(): Promise<void> {
    if (this.context?.state === 'suspended') await this.context.resume();
  }

  async dispose(): Promise<void> {
    this.stopAmbient();
    if (this.context && this.context.state !== 'closed') await this.context.close();
    this.context = null;
    this.gains.clear();
  }
}
