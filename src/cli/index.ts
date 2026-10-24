#!/usr/bin/env node
import { Command } from 'commander';
import { runInitWizard } from './commands/init.js';
import { runPostCommand } from './commands/post.js';
import { runDaemonCommand } from './commands/daemon.js';
import { runValidateCommand } from './commands/validate.js';
import { runHistoryCommand } from './commands/history.js';

const program = new Command();

program
  .name('hermes')
  .description(
    'Hermes (The Messenger of the Gods) - Autonomous, multi-platform referral link courier',
  )
  .version('1.1.0');

// init / setup wizard
program
  .command('init')
  .alias('setup')
  .description('Run interactive setup wizard to configure links, personal anecdotes, and platforms')
  .action(async () => {
    await runInitWizard();
  });

// post
program
  .command('post')
  .description('Execute an immediate distribution cycle across enabled platforms')
  .option('-c, --config <path>', 'Path to custom configuration file')
  .option('--dry-run', 'Force simulation mode (no real posts sent)')
  .option('--live', 'Force live mode (send real posts via platform APIs)')
  .option('-f, --force', 'Bypass link cooldowns and daily post limits')
  .option(
    '-p, --platform <platform>',
    'Filter to a single platform (reddit, facebook, bluesky, discord, twitter)',
  )
  .option(
    '--category <category>',
    'Filter to a single referral category (credit_card, shopping, etc.)',
  )
  .option('-t, --tone <tone>', 'Specify tone (story, informative, deal_alert, comparison)')
  .action(async (options) => {
    await runPostCommand(options);
  });

// daemon
program
  .command('daemon')
  .description('Start autonomous background scheduler daemon')
  .option('-c, --config <path>', 'Path to custom configuration file')
  .action((options) => {
    runDaemonCommand(options);
  });

// validate
program
  .command('validate')
  .description('Verify configuration syntax, credentials, and referral link health')
  .option('-c, --config <path>', 'Path to custom configuration file')
  .action((options) => {
    runValidateCommand(options);
  });

// history
program
  .command('history')
  .description('View recent posting activity and audit statistics')
  .option('-n, --limit <count>', 'Number of recent entries to show', '10')
  .option('--clear', 'Clear post history and cooldown tracking cache')
  .action(async (options) => {
    await runHistoryCommand(options);
  });

program.parse(process.argv);
