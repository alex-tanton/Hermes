import cron, { ScheduledTask } from 'node-cron';
import { ReferralRepeaterEngine } from './engine.js';
import { logger } from './logger.js';

export class AutonomousScheduler {
  private engine: ReferralRepeaterEngine;
  private task: ScheduledTask | null = null;
  private isRunning = false;

  constructor(engine: ReferralRepeaterEngine) {
    this.engine = engine;
  }

  /**
   * Starts the autonomous scheduling daemon
   */
  public start(): void {
    const config = this.engine.getConfig();
    const cronExpression = config.schedule.cron;

    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression in schedule config: "${cronExpression}"`);
    }

    logger.banner('Referral-Repeater Autonomous Scheduler Daemon');
    logger.info(`Cron schedule configured: "${cronExpression}"`);
    logger.info(`Anti-bot jitter: up to ${config.schedule.jitterMinutes} minute(s)`);
    logger.info(`Max posts per day: ${config.schedule.maxPostsPerDay}`);
    logger.info(`Dry-run mode: ${config.dryRun ? 'ACTIVE (Zero real posts)' : 'LIVE'}`);

    this.isRunning = true;

    this.task = cron.schedule(cronExpression, async () => {
      await this.handleTick();
    });

    logger.success('Scheduler daemon active and waiting for next scheduled tick.');
  }

  /**
   * Handles a scheduled trigger with anti-bot jitter delay
   */
  public async handleTick(): Promise<void> {
    if (!this.isRunning) return;

    const jitterMinutes = this.engine.getConfig().schedule.jitterMinutes;
    const jitterDelayMs = this.calculateJitterMs(jitterMinutes);

    if (jitterDelayMs > 0) {
      const waitSeconds = Math.round(jitterDelayMs / 1000);
      logger.info(
        `Scheduled tick triggered. Applying ${waitSeconds}s jitter delay to prevent bot patterns...`,
      );
      await this.sleep(jitterDelayMs);
    }

    logger.info('Executing scheduled referral distribution cycle...');
    await this.engine.executeCycle();
  }

  /**
   * Calculates random jitter delay between 0 and jitterMinutes in ms
   */
  public calculateJitterMs(maxMinutes: number): number {
    if (maxMinutes <= 0) return 0;
    const randomFraction = Math.random();
    return Math.floor(randomFraction * maxMinutes * 60 * 1000);
  }

  public stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    this.isRunning = false;
    logger.info('Scheduler daemon stopped.');
  }

  public getStatus(): { isRunning: boolean; cron: string } {
    return {
      isRunning: this.isRunning,
      cron: this.engine.getConfig().schedule.cron,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
