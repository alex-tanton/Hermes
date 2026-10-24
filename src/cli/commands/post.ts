import { loadConfig } from '../../config/loader.js';
import { HermesEngine } from '../../core/engine.js';
import {
  HistoryStorageError,
  LockTimeoutError,
  PlatformType,
  ToneType,
} from '../../types/index.js';
import { logger } from '../../core/logger.js';
import chalk from 'chalk';

export interface PostCommandOptions {
  config?: string;
  dryRun?: boolean;
  live?: boolean;
  force?: boolean;
  platform?: string;
  category?: string;
  tone?: string;
}

export async function runPostCommand(options: PostCommandOptions): Promise<void> {
  try {
    const config = loadConfig(options.config);

    // Determine dryRun: --live explicitly disables dryRun, --dry-run forces dryRun, else config default
    let dryRun = config.dryRun;
    if (options.live) {
      dryRun = false;
    } else if (options.dryRun) {
      dryRun = true;
    }

    const engine = new HermesEngine(config);

    logger.banner('Hermes Distribution Cycle');
    if (dryRun) {
      logger.dryRun('Safe simulation mode active. NO live posts will be sent.');
    } else {
      logger.warn('LIVE MODE ACTIVATED. Real posts will be sent to enabled platform APIs.');
    }

    const results = await engine.executeCycle({
      dryRun,
      force: options.force,
      filterPlatform: options.platform as PlatformType,
      filterCategory: options.category,
      tone: options.tone as ToneType,
    });

    console.log(chalk.bold.cyan('\n--- Execution Summary ---'));
    console.log(`Total actions processed: ${results.length}`);
    const successful = results.filter((r) => r.success).length;
    const simulated = results.filter((r) => r.simulated).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`  ✔ Successful / Dispatched: ${chalk.green(successful)}`);
    console.log(`  🔍 Simulated (Dry-run):   ${chalk.magenta(simulated)}`);
    if (failed > 0) {
      console.log(`  ✖ Failed:                 ${chalk.red(failed)}`);
    }
    console.log('');
  } catch (err: unknown) {
    if (err instanceof LockTimeoutError) {
      logger.error(`Lock timeout: ${err.message}`);
    } else if (err instanceof HistoryStorageError) {
      logger.error(`Storage error: ${err.message}`);
    } else {
      logger.error('Error executing post command:', err);
    }
    process.exit(1);
  }
}
