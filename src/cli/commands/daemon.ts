import { loadConfig } from '../../config/loader.js';
import { HermesEngine } from '../../core/engine.js';
import { AutonomousScheduler } from '../../core/scheduler.js';
import { logger } from '../../core/logger.js';
import chalk from 'chalk';

export interface DaemonCommandOptions {
  config?: string;
}

export function runDaemonCommand(options: DaemonCommandOptions): void {
  try {
    const config = loadConfig(options.config);
    const engine = new HermesEngine(config);
    const scheduler = new AutonomousScheduler(engine);

    scheduler.start();

    console.log(chalk.gray('\nPress Ctrl+C to terminate the scheduler daemon safely.\n'));

    const handleExit = () => {
      logger.info('\nReceived termination signal. Shutting down daemon...');
      scheduler.stop();
      process.exit(0);
    };

    process.on('SIGINT', handleExit);
    process.on('SIGTERM', handleExit);
  } catch (err) {
    logger.error('Failed to initialize scheduler daemon:', err);
    process.exit(1);
  }
}
