/** Messbare Laufzeitbudgets fuer einen mobilen 90-Sekunden-Run. */

export const PERFORMANCE_BUDGETS = {
  /** Zeit von Scene-Erzeugung bis zum tatsaechlichen Run-Start. */
  // Beinhaltet Scene-Aufbau, HUD und den Drei-Schritt-Countdown. Der Wert ist
  // bewusst ein hartes mobiles Gate, nicht die Zeit bis zum ersten HTML-Pixel.
  // 30 Sekunden lassen den kalten Chromium-/CI-Start zu, ohne einen haengenden
  // Phaser-Start bis zum 25-Sekunden-Timeout des Browser-Gates zu verstecken.
  startupMs: 30_000,
  /** 95 % der Frames sollen sich wie 60 FPS anfuehlen. */
  frameP95Ms: 25,
  /** Einzelne langsamere Frames sind erlaubt, aber kein regelmaessiges Ruckeln. */
  frameOverBudgetRatio: 0.02,
  /** Nur laufzeitrelevante Objekte, nicht der statische Hintergrund. */
  dynamicObjects: 24,
  /** Aktive Partikel-Emitter/Partikelgruppen im sichtbaren Lauf. */
  particleGroups: 18,
} as const;

export interface PerformanceReport {
  startupMs: number;
  frameCount: number;
  frameP95Ms: number;
  frameOverBudgetRatio: number;
  peakDynamicObjects: number;
  peakParticleGroups: number;
  passed: boolean;
}

export interface PerformanceMeasurements {
  startupMs: number;
  frameDurationsMs: readonly number[];
  peakDynamicObjects: number;
  peakParticleGroups: number;
}

export interface RuntimeResourceSnapshot {
  /** Chromium/Chrome only; Safari gibt diese Heap-Zahl bewusst nicht frei. */
  memoryUsedMb: number | null;
  /** Battery Status API ist optional und auf vielen mobilen Browsern entfernt. */
  batteryLevel: number | null;
  batteryCharging: boolean | null;
  heatTelemetryAvailable: false;
}

/** Liest optionale Browser-Telemetrie, ohne den Run von ihr abhaengig zu machen. */
export async function readRuntimeResources(): Promise<RuntimeResourceSnapshot> {
  const memory = (
    performance as Performance & {
      memory?: { usedJSHeapSize?: number };
    }
  ).memory;
  let batteryLevel: number | null = null;
  let batteryCharging: boolean | null = null;

  const batteryGetter = (
    navigator as Navigator & {
      getBattery?: () => Promise<{ level: number; charging: boolean }>;
    }
  ).getBattery;
  if (typeof batteryGetter === 'function') {
    try {
      const battery = await batteryGetter.call(navigator);
      batteryLevel = Number.isFinite(battery.level) ? battery.level : null;
      batteryCharging = battery.charging;
    } catch {
      // Permission/Browser-Policy: Telemetrie bleibt optional.
    }
  }

  return {
    memoryUsedMb:
      memory && Number.isFinite(memory.usedJSHeapSize)
        ? (memory.usedJSHeapSize ?? 0) / (1024 * 1024)
        : null,
    batteryLevel,
    batteryCharging,
    heatTelemetryAvailable: false,
  };
}

function safeNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** Deterministische Perzentil-Berechnung fuer Tests und Diagnoseberichte. */
export function percentile(values: readonly number[], ratio: number): number {
  const sorted = values
    .filter(Number.isFinite)
    .map(safeNonNegative)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(ratio * sorted.length) - 1));
  return sorted[index] ?? 0;
}

export function evaluatePerformance(
  measurements: PerformanceMeasurements,
  budgets: typeof PERFORMANCE_BUDGETS = PERFORMANCE_BUDGETS,
): PerformanceReport {
  const frameDurationsMs = measurements.frameDurationsMs
    .filter(Number.isFinite)
    .map(safeNonNegative);
  const frameP95Ms = percentile(frameDurationsMs, 0.95);
  const overBudgetFrames = frameDurationsMs.filter(
    (duration) => duration > budgets.frameP95Ms,
  ).length;
  const frameOverBudgetRatio =
    frameDurationsMs.length === 0 ? 0 : overBudgetFrames / frameDurationsMs.length;
  const startupMs = safeNonNegative(measurements.startupMs);
  const peakDynamicObjects = Math.floor(safeNonNegative(measurements.peakDynamicObjects));
  const peakParticleGroups = Math.floor(safeNonNegative(measurements.peakParticleGroups));

  return {
    startupMs,
    frameCount: frameDurationsMs.length,
    frameP95Ms,
    frameOverBudgetRatio,
    peakDynamicObjects,
    peakParticleGroups,
    passed:
      startupMs <= budgets.startupMs &&
      frameP95Ms <= budgets.frameP95Ms &&
      frameOverBudgetRatio <= budgets.frameOverBudgetRatio &&
      peakDynamicObjects <= budgets.dynamicObjects &&
      peakParticleGroups <= budgets.particleGroups,
  };
}

/** Sammelt nur in DEV Messwerte; im Release entsteht kein Mess-Overhead. */
export class PerformanceMonitor {
  private createdAt = performance.now();
  private runStartedAt: number | null = null;
  private readonly frameDurationsMs: number[] = [];
  private peakDynamicObjects = 0;
  private peakParticleGroups = 0;
  private report: PerformanceReport | null = null;

  reset(): void {
    this.createdAt = performance.now();
    this.runStartedAt = null;
    this.frameDurationsMs.length = 0;
    this.peakDynamicObjects = 0;
    this.peakParticleGroups = 0;
    this.report = null;
  }

  markRunStarted(): void {
    this.runStartedAt = performance.now();
  }

  recordFrame(deltaMs: number, dynamicObjects: number, particleGroups: number): void {
    if (this.runStartedAt === null) return;
    this.frameDurationsMs.push(safeNonNegative(deltaMs));
    this.peakDynamicObjects = Math.max(this.peakDynamicObjects, safeNonNegative(dynamicObjects));
    this.peakParticleGroups = Math.max(this.peakParticleGroups, safeNonNegative(particleGroups));
  }

  finishRun(): PerformanceReport | null {
    if (this.runStartedAt === null) return this.report;
    this.report = evaluatePerformance({
      startupMs: this.runStartedAt - this.createdAt,
      frameDurationsMs: this.frameDurationsMs,
      peakDynamicObjects: this.peakDynamicObjects,
      peakParticleGroups: this.peakParticleGroups,
    });
    return this.report;
  }

  getReport(): PerformanceReport | null {
    return this.report ?? (this.runStartedAt === null ? null : this.finishRun());
  }
}
