import chalk from 'chalk';
import { loadConfig } from '../../config/loader.js';
import { platformRegistry } from '../../platforms/registry.js';
import { logger } from '../../core/logger.js';

export interface ValidateCommandOptions {
  config?: string;
}

export function runValidateCommand(options: ValidateCommandOptions): void {
  try {
    logger.banner('Configuration Validation');
    const config = loadConfig(options.config);

    console.log(chalk.bold.green('✔ Configuration syntax and schema are valid.\n'));

    console.log(chalk.bold.cyan('--- General Settings ---'));
    console.log(
      `  Dry Run (Safety mode):    ${config.dryRun ? chalk.magenta('ENABLED (Safe)') : chalk.red('LIVE')}`,
    );
    console.log(`  Author Name:              ${chalk.white(config.personalTouch.authorName)}`);
    console.log(
      `  FTC Referral Disclosure:  ${config.personalTouch.includeFtcDisclosure ? chalk.green('Enabled') : chalk.yellow('Disabled')}`,
    );
    console.log(`  Posting Schedule (Cron):  ${chalk.yellow(config.schedule.cron)}`);
    console.log(
      `  Anti-bot Jitter:          ${chalk.white(config.schedule.jitterMinutes)} minutes`,
    );
    console.log(`  Max Posts Per Day:        ${chalk.white(config.schedule.maxPostsPerDay)}`);
    console.log(
      `  Per-link Cooldown:        ${chalk.white(config.schedule.linkCooldownHours)} hours\n`,
    );

    console.log(chalk.bold.cyan('--- Platform Adapters ---'));
    platformRegistry.initialize(config.platforms, config.dryRun);
    const adapters = platformRegistry.getAllAdapters();

    if (adapters.length === 0) {
      console.log(chalk.yellow('  ⚠ No platforms are currently enabled.'));
    } else {
      for (const adapter of adapters) {
        const credCheck = adapter.validateCredentials();
        const credBadge = credCheck.valid
          ? chalk.green('✔ Credentials present')
          : chalk.yellow(`⚠ ${credCheck.reason || 'Missing credentials'}`);
        console.log(`  • ${chalk.bold(adapter.name.padEnd(10))}: [Active] ${credBadge}`);
      }
    }

    console.log(chalk.bold.cyan('\n--- Configured Referral Links ---'));
    console.log(`  Total Links: ${config.referralLinks.length}`);
    for (const link of config.referralLinks) {
      const statusBadge = link.enabled ? chalk.green('[Enabled]') : chalk.gray('[Disabled]');
      console.log(
        `  • ${statusBadge} ${chalk.bold(link.name)} (${link.category} by ${link.provider})`,
      );
      console.log(`    URL:   ${chalk.gray(link.url)}`);
      console.log(`    Bonus: ${link.bonusSummary}`);
      if (link.personalAnecdote) {
        console.log(`    Story: "${chalk.italic(link.personalAnecdote.substring(0, 80))}..."`);
      }
    }
    console.log('');
  } catch (err) {
    logger.error('Configuration validation failed:', err);
    process.exit(1);
  }
}
