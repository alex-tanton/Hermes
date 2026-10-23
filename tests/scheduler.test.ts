import { describe, it, expect } from 'vitest';
import { AutonomousScheduler } from '../src/core/scheduler.js';
import { ReferralRepeaterEngine } from '../src/core/engine.js';
import { DEFAULT_CONFIG } from '../src/config/defaults.js';

describe('AutonomousScheduler', () => {
  const engine = new ReferralRepeaterEngine(DEFAULT_CONFIG);
  const scheduler = new AutonomousScheduler(engine);

  it('calculates anti-bot jitter delay within specified bounds', () => {
    const jitterMs = scheduler.calculateJitterMs(15);
    const maxMs = 15 * 60 * 1000;
    expect(jitterMs).toBeGreaterThanOrEqual(0);
    expect(jitterMs).toBeLessThanOrEqual(maxMs);
  });

  it('returns 0 jitter when maxMinutes is 0 or negative', () => {
    expect(scheduler.calculateJitterMs(0)).toBe(0);
    expect(scheduler.calculateJitterMs(-5)).toBe(0);
  });

  it('starts and stops cleanly', () => {
    expect(scheduler.getStatus().isRunning).toBe(false);

    scheduler.start();
    expect(scheduler.getStatus().isRunning).toBe(true);

    scheduler.stop();
    expect(scheduler.getStatus().isRunning).toBe(false);
  });

  it('rejects invalid cron expressions', () => {
    const invalidConfig = {
      ...DEFAULT_CONFIG,
      schedule: {
        ...DEFAULT_CONFIG.schedule,
        cron: 'invalid-cron-pattern',
      },
    };
    const invalidEngine = new ReferralRepeaterEngine(invalidConfig);
    const invalidScheduler = new AutonomousScheduler(invalidEngine);

    expect(() => invalidScheduler.start()).toThrow('Invalid cron expression');
  });
});
