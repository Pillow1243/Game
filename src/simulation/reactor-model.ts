export type AlarmSeverity = 'caution' | 'critical';
export type ReactorMode = 'COLD SHUTDOWN' | 'STARTUP' | 'POWER OPERATION' | 'FULL POWER' | 'SCRAM / DECAY HEAT';

export interface ReactorAlarm {
  id: string;
  severity: AlarmSeverity;
  message: string;
}

export interface ReactorSnapshot {
  mode: ReactorMode;
  powerPct: number;
  rodInsertionPct: number;
  targetRodInsertionPct: number;
  coolantFlowPct: number;
  targetCoolantFlowPct: number;
  feedwaterFlowPct: number;
  targetFeedwaterFlowPct: number;
  decayHeatPct: number;
  coreTemperatureC: number;
  primaryPressureMpa: number;
  steamPressureMpa: number;
  containmentTemperatureC: number;
  containmentPressureKpa: number;
  scramActive: boolean;
  scramCause: string | null;
  tripCount: number;
  canResetTrip: boolean;
  alarms: ReactorAlarm[];
  alarmSeverity: 'normal' | AlarmSeverity;
  emergencyEffect: number;
}

export type ReactorSaveData = Record<string, number | string | boolean | number[] | null>;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const finite = (value: unknown, fallback: number): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** A deterministic, deliberately simplified training model; it is not an operating-plant model. */
export class ReactorSimulation {
  private powerPct = 0;
  private rodInsertionPct = 100;
  private targetRodInsertionPct = 100;
  private coolantFlowPct = 100;
  private targetCoolantFlowPct = 100;
  private feedwaterFlowPct = 75;
  private targetFeedwaterFlowPct = 75;
  private coreTemperatureC = 25;
  private primaryPressureMpa = 0.12;
  private steamPressureMpa = 0.1;
  private containmentTemperatureC = 22;
  private containmentPressureKpa = 0;
  private scramActive = false;
  private scramCause: string | null = null;
  private tripPowerPct = 0;
  private tripElapsedSeconds = 0;
  private tripCount = 0;

  setRodTarget(insertionPct: number): void {
    if (this.scramActive) return;
    this.targetRodInsertionPct = clamp(insertionPct, 0, 100);
  }

  setCoolantFlowTarget(flowPct: number): void {
    this.targetCoolantFlowPct = clamp(flowPct, 0, 100);
  }

  setFeedwaterFlowTarget(flowPct: number): void {
    this.targetFeedwaterFlowPct = clamp(flowPct, 0, 100);
  }

  scram(cause = 'MANUAL SCRAM'): void {
    if (this.scramActive) return;
    this.tripPowerPct = this.powerPct;
    this.tripElapsedSeconds = 0;
    this.tripCount += 1;
    this.scramActive = true;
    this.scramCause = cause;
    this.targetRodInsertionPct = 100;
  }

  resetTrip(): boolean {
    if (!this.scramActive || !this.canResetTrip) return false;
    this.scramActive = false;
    this.scramCause = null;
    this.tripPowerPct = 0;
    this.tripElapsedSeconds = 0;
    this.targetRodInsertionPct = 100;
    return true;
  }

  private get decayHeatPct(): number {
    if (!this.scramActive) return 0;
    return this.tripPowerPct * 0.06 * Math.exp(-this.tripElapsedSeconds / 240);
  }

  private get canResetTrip(): boolean {
    return this.scramActive && this.powerPct < 1.5 && this.rodInsertionPct >= 95 && this.coreTemperatureC < 180;
  }

  update(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    let remaining = Math.min(deltaSeconds, 1);
    while (remaining > 0) {
      const dt = Math.min(remaining, 0.025);
      this.step(dt);
      remaining -= dt;
    }
  }

  private step(dt: number): void {
    this.rodInsertionPct = this.approach(this.rodInsertionPct, this.targetRodInsertionPct, 22 * dt);
    this.coolantFlowPct = this.approach(this.coolantFlowPct, this.targetCoolantFlowPct, 36 * dt);
    this.feedwaterFlowPct = this.approach(this.feedwaterFlowPct, this.targetFeedwaterFlowPct, 28 * dt);

    const rodWorth = Math.pow(1 - this.rodInsertionPct / 100, 1.65);
    const requestedPower = this.scramActive ? 0 : rodWorth * 100;
    const powerResponse = this.scramActive ? 1.8 : 0.42;
    this.powerPct = clamp(this.powerPct + (requestedPower - this.powerPct) * Math.min(1, powerResponse * dt), 0, 100);
    if (this.scramActive) this.tripElapsedSeconds += dt;

    const thermalPower = this.powerPct + this.decayHeatPct;
    const flowDeficit = 1 - this.coolantFlowPct / 100;
    const equilibriumCoreTemperature = 25 + thermalPower * 2.65 + Math.sqrt(Math.max(0, thermalPower)) * flowDeficit * 12;
    const coreTimeConstant = 20 + this.coolantFlowPct * 0.16;
    this.coreTemperatureC += (equilibriumCoreTemperature - this.coreTemperatureC) * Math.min(1, dt / coreTimeConstant);

    const primaryPressureTarget = 0.12 + Math.max(0, this.coreTemperatureC - 60) * 0.052 + this.powerPct * 0.02;
    this.primaryPressureMpa += (primaryPressureTarget - this.primaryPressureMpa) * Math.min(1, dt / 8);
    const feedwaterDeficit = 1 - this.feedwaterFlowPct / 100;
    const steamPressureTarget = 0.1 + this.powerPct * 0.082 + feedwaterDeficit * (this.powerPct / 100) * 2.8;
    this.steamPressureMpa += (steamPressureTarget - this.steamPressureMpa) * Math.min(1, dt / 10);

    const containmentTarget = 22 + Math.max(0, this.coreTemperatureC - 100) * 0.08 + flowDeficit * thermalPower * 0.09;
    this.containmentTemperatureC += (containmentTarget - this.containmentTemperatureC) * Math.min(1, dt / 45);
    const containmentPressureTarget = Math.max(0, (this.containmentTemperatureC - 35) * 0.035 + Math.max(0, this.steamPressureMpa - 7) * 1.6);
    this.containmentPressureKpa += (containmentPressureTarget - this.containmentPressureKpa) * Math.min(1, dt / 18);

    if (!this.scramActive) {
      const tripCause = this.findTripCause();
      if (tripCause) this.scram(tripCause);
    }
  }

  private approach(value: number, target: number, amount: number): number {
    return value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);
  }

  private findTripCause(): string | null {
    if (this.coreTemperatureC >= 620) return 'HIGH CORE TEMPERATURE';
    if (this.primaryPressureMpa >= 17) return 'HIGH PRIMARY PRESSURE';
    if (this.steamPressureMpa >= 8.8) return 'HIGH STEAM PRESSURE';
    if (this.coolantFlowPct < 12 && this.powerPct > 20) return 'LOSS OF PRIMARY COOLANT FLOW';
    return null;
  }

  get snapshot(): ReactorSnapshot {
    const alarms: ReactorAlarm[] = [];
    if (this.scramActive) alarms.push({ id: 'scram', severity: 'critical', message: `REACTOR TRIP · ${this.scramCause ?? 'SCRAM ACTIVE'}` });
    if (this.coreTemperatureC >= 450) alarms.push({ id: 'core-temp', severity: this.coreTemperatureC >= 620 ? 'critical' : 'caution', message: 'CORE TEMPERATURE HIGH' });
    if (this.primaryPressureMpa >= 15.5) alarms.push({ id: 'primary-pressure', severity: this.primaryPressureMpa >= 17 ? 'critical' : 'caution', message: 'PRIMARY PRESSURE HIGH' });
    if (this.steamPressureMpa >= 7.4) alarms.push({ id: 'steam-pressure', severity: this.steamPressureMpa >= 8.8 ? 'critical' : 'caution', message: 'STEAM PRESSURE HIGH' });
    if (this.coolantFlowPct < 40 && this.powerPct > 20) alarms.push({ id: 'coolant-flow', severity: 'caution', message: 'PRIMARY COOLANT FLOW LOW' });
    if (this.feedwaterFlowPct < 20 && this.powerPct > 25) alarms.push({ id: 'feedwater', severity: 'caution', message: 'FEEDWATER FLOW LOW' });

    const critical = alarms.some((alarm) => alarm.severity === 'critical');
    const mode = this.scramActive ? 'SCRAM / DECAY HEAT'
      : this.powerPct < 1 && this.rodInsertionPct > 95 ? 'COLD SHUTDOWN'
        : this.powerPct < 15 ? 'STARTUP' : this.powerPct >= 85 ? 'FULL POWER' : 'POWER OPERATION';
    return {
      mode,
      powerPct: this.powerPct,
      rodInsertionPct: this.rodInsertionPct,
      targetRodInsertionPct: this.targetRodInsertionPct,
      coolantFlowPct: this.coolantFlowPct,
      targetCoolantFlowPct: this.targetCoolantFlowPct,
      feedwaterFlowPct: this.feedwaterFlowPct,
      targetFeedwaterFlowPct: this.targetFeedwaterFlowPct,
      decayHeatPct: this.decayHeatPct,
      coreTemperatureC: this.coreTemperatureC,
      primaryPressureMpa: this.primaryPressureMpa,
      steamPressureMpa: this.steamPressureMpa,
      containmentTemperatureC: this.containmentTemperatureC,
      containmentPressureKpa: this.containmentPressureKpa,
      scramActive: this.scramActive,
      scramCause: this.scramCause,
      tripCount: this.tripCount,
      canResetTrip: this.canResetTrip,
      alarms,
      alarmSeverity: critical ? 'critical' : alarms.length > 0 ? 'caution' : 'normal',
      emergencyEffect: this.scramActive ? 0.72 : critical ? 0.4 : 0,
    };
  }

  serialize(): ReactorSaveData {
    return {
      powerPct: this.powerPct,
      rodInsertionPct: this.rodInsertionPct,
      targetRodInsertionPct: this.targetRodInsertionPct,
      coolantFlowPct: this.coolantFlowPct,
      targetCoolantFlowPct: this.targetCoolantFlowPct,
      feedwaterFlowPct: this.feedwaterFlowPct,
      targetFeedwaterFlowPct: this.targetFeedwaterFlowPct,
      coreTemperatureC: this.coreTemperatureC,
      primaryPressureMpa: this.primaryPressureMpa,
      steamPressureMpa: this.steamPressureMpa,
      containmentTemperatureC: this.containmentTemperatureC,
      containmentPressureKpa: this.containmentPressureKpa,
      scramActive: this.scramActive,
      scramCause: this.scramCause,
      tripPowerPct: this.tripPowerPct,
      tripElapsedSeconds: this.tripElapsedSeconds,
      tripCount: this.tripCount,
    };
  }

  restore(data: ReactorSaveData): void {
    this.powerPct = clamp(finite(data.powerPct, 0), 0, 100);
    this.rodInsertionPct = clamp(finite(data.rodInsertionPct, 100), 0, 100);
    this.targetRodInsertionPct = clamp(finite(data.targetRodInsertionPct, 100), 0, 100);
    this.coolantFlowPct = clamp(finite(data.coolantFlowPct, 100), 0, 100);
    this.targetCoolantFlowPct = clamp(finite(data.targetCoolantFlowPct, 100), 0, 100);
    this.feedwaterFlowPct = clamp(finite(data.feedwaterFlowPct, 75), 0, 100);
    this.targetFeedwaterFlowPct = clamp(finite(data.targetFeedwaterFlowPct, 75), 0, 100);
    this.coreTemperatureC = clamp(finite(data.coreTemperatureC, 25), 0, 1200);
    this.primaryPressureMpa = clamp(finite(data.primaryPressureMpa, 0.12), 0, 30);
    this.steamPressureMpa = clamp(finite(data.steamPressureMpa, 0.1), 0, 20);
    this.containmentTemperatureC = clamp(finite(data.containmentTemperatureC, 22), 0, 1200);
    this.containmentPressureKpa = clamp(finite(data.containmentPressureKpa, 0), 0, 500);
    this.scramActive = data.scramActive === true;
    this.scramCause = this.scramActive && typeof data.scramCause === 'string' ? data.scramCause : null;
    this.tripPowerPct = clamp(finite(data.tripPowerPct, this.powerPct), 0, 100);
    this.tripElapsedSeconds = clamp(finite(data.tripElapsedSeconds, 0), 0, 1_000_000);
    this.tripCount = Math.max(0, Math.floor(finite(data.tripCount, 0)));
    if (this.scramActive) this.targetRodInsertionPct = 100;
  }
}
