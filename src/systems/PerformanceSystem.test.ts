import { describe, expect, it } from 'vitest';

import {
  PERFORMANCE_BUDGETS,
  PerformanceMonitor,
  evaluatePerformance,
  percentile,
} from '@/systems/PerformanceSystem';

describe('PerformanceSystem', () => {
  it('berechnet ein stabiles Perzentil', () => {
    expect(percentile([16, 18, 21, 45], 0.95)).toBe(45);
    expect(percentile([], 0.95)).toBe(0);
    expect(percentile([Number.NaN, 10], 0.95)).toBe(10);
  });

  it('besteht bei einem Lauf innerhalb der mobilen Budgets', () => {
    const report = evaluatePerformance({
      startupMs: 1200,
      frameDurationsMs: [16, 17, 18, 20, 24],
      peakDynamicObjects: 14,
      peakParticleGroups: 8,
    });

    expect(report).toMatchObject({
      frameCount: 5,
      peakDynamicObjects: 14,
      peakParticleGroups: 8,
      passed: true,
    });
  });

  it('failt bei wiederholtem Ruckeln oder zu vielen Objekten', () => {
    const report = evaluatePerformance({
      startupMs: PERFORMANCE_BUDGETS.startupMs + 1,
      frameDurationsMs: [16, 40, 45, 50],
      peakDynamicObjects: PERFORMANCE_BUDGETS.dynamicObjects + 1,
      peakParticleGroups: PERFORMANCE_BUDGETS.particleGroups + 1,
    });

    expect(report.passed).toBe(false);
    expect(report.frameOverBudgetRatio).toBeGreaterThan(PERFORMANCE_BUDGETS.frameOverBudgetRatio);
  });

  it('sammelt nur zwischen Run-Start und Run-Ende', () => {
    const monitor = new PerformanceMonitor();
    monitor.recordFrame(100, 100, 100);
    expect(monitor.getReport()).toBeNull();

    monitor.markRunStarted();
    monitor.recordFrame(16, 3, 2);
    const report = monitor.finishRun();

    expect(report).not.toBeNull();
    expect(report?.frameCount).toBe(1);
    expect(report?.peakDynamicObjects).toBe(3);
    expect(report?.peakParticleGroups).toBe(2);
  });
});
