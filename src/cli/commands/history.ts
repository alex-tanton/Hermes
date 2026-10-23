import chalk from 'chalk';
import { historyTracker } from '../../core/history.js';
import { logger } from '../../core/logger.js';

export interface HistoryCommandOptions {
  limit?: string;
  clear?: boolean;
}

export function runHistoryCommand(options: HistoryCommandOptions): void {
  logger.banner('Posting History & Audit Trail');

  if (options.clear) {
    historyTracker.clear();
    console.log(chalk.green('✔ Posting history and deduplication cache cleared.\n'));
    return;
  }

  const stats = historyTracker.getStats();
  console.log(chalk.bold.cyan('--- Statistics ---'));
  console.log(`  Total Logged Entries: ${stats.total}`);
  console.log(`  Simulated (Dry-Run):  ${chalk.magenta(stats.simulated)}`);
  console.log(`  Live Dispatched:      ${chalk.green(stats.live)}`);
  console.log(`  Failed Attempts:      ${chalk.red(stats.failed)}`);

  console.log(chalk.bold.cyan('\n--- Activity by Platform ---'));
  if (Object.keys(stats.byPlatform).length === 0) {
    console.log(chalk.gray('  No post activity recorded yet.'));
  } else {
    for (const [platform, count] of Object.entries(stats.byPlatform)) {
      console.log(`  • ${platform.padEnd(12)}: ${count} post(s)`);
    }
  }

  const limit = options.limit ? parseInt(options.limit, 10) : 10;
  const recent = historyTracker.getRecent(limit);

  console.log(chalk.bold.cyan(`\n--- Last ${recent.length} Actions ---`));
  if (recent.length === 0) {
    console.log(chalk.gray('  No recent actions recorded.'));
  } else {
    for (const entry of recent) {
      const badge =
        entry.status === 'simulated'
          ? chalk.magenta('[DRY-RUN]')
          : entry.status === 'success'
            ? chalk.green('[SUCCESS]')
            : chalk.red('[FAILED]');

      console.log(
        `  ${badge} ${chalk.gray(entry.timestamp)} | ${chalk.bold(entry.platform.toUpperCase())} -> ${chalk.white(entry.linkName)}`,
      );
      if (entry.targetDestination) {
        console.log(`     Target: ${chalk.gray(entry.targetDestination)}`);
      }
      if (entry.error) {
        console.log(`     Error:  ${chalk.red(entry.error)}`);
      }
    }
  }
  console.log('');
}
