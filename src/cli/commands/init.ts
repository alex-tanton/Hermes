import fs from 'node:fs';
import path from 'node:path';
import { input, confirm, checkbox, select } from '@inquirer/prompts';
import chalk from 'chalk';
import { DEFAULT_CONFIG } from '../../config/defaults.js';
import { saveConfig } from '../../config/loader.js';
import { AppConfig, PlatformType, ReferralLink } from '../../types/index.js';
import { logger } from '../../core/logger.js';
import { getDevvitToken } from '../../platforms/reddit.js';

export async function runInitWizard(): Promise<void> {
  logger.banner('Hermes Setup Wizard');
  console.log(
    chalk.cyan(
      'Welcome! This friendly wizard will help you configure your referral links, personal anecdotes, and target platforms in just 2 minutes.\n',
    ),
  );

  try {
    const existingConfig = fs.existsSync(path.resolve(process.cwd(), 'config.yaml'));
    if (existingConfig) {
      const overwrite = await confirm({
        message: 'A config.yaml file already exists. Do you want to reconfigure and overwrite it?',
        default: false,
      });
      if (!overwrite) {
        console.log(chalk.yellow('\nSetup cancelled. Keeping existing config.yaml.\n'));
        return;
      }
    }

    // 1. Personal Touch
    const authorName = await input({
      message: 'What is your name or preferred posting alias?',
      default: 'Alex',
    });

    const philosophy = await input({
      message: 'What is your emotional hook or reward philosophy (e.g., travel hacking, cashback)?',
      default: 'I love helping friends earn free travel and maximize cashback rewards!',
    });

    const includeDisclosure = await confirm({
      message: 'Include standard FTC referral transparency disclosure in posts?',
      default: true,
    });

    // 2. Platforms
    const selectedPlatforms = await checkbox<PlatformType>({
      message: 'Select the platforms you want to enable:',
      choices: [
        {
          name: 'Reddit (Zero-config Devvit 1-click login or script)',
          value: 'reddit',
          checked: true,
        },
        { name: 'Discord (Deals & referral channels via Webhook)', value: 'discord', checked: true },
        { name: 'Bluesky (AT Protocol microblogging)', value: 'bluesky', checked: true },
        { name: 'Facebook (Groups & travel rewards communities)', value: 'facebook', checked: false },
        { name: 'Twitter / X (API v2 tweets)', value: 'twitter', checked: false },
      ],
    });

    if (selectedPlatforms.includes('reddit')) {
      const devvitToken = getDevvitToken();
      if (devvitToken) {
        console.log(
          chalk.green(
            '  ✔ Reddit: Devvit login detected (~/.devvit/token)! Ready to post without API keys.\n',
          ),
        );
      } else {
        console.log(
          chalk.cyan('  ℹ Reddit Tip: You can connect Reddit with 1 click anytime by running ') +
            chalk.bold.yellow('npx devvit login') +
            chalk.cyan(' (no registration needed).\n'),
        );
      }
    }

    // 3. Referral Links
    const importDefaults = await confirm({
      message:
        'Would you like to start with pre-configured cards (Chase Freedom, Sapphire, Capital One VentureOne)?',
      default: true,
    });

    const referralLinks: ReferralLink[] = [];

    if (importDefaults) {
      referralLinks.push(...DEFAULT_CONFIG.referralLinks);
      console.log(
        chalk.green(`\n✔ Loaded ${referralLinks.length} default referral cards and shopping links.`),
      );
    } else {
      let adding = true;
      while (adding) {
        console.log(chalk.bold.yellow('\n--- Add a Referral Link ---'));
        const name = await input({
          message: 'Card or Program Name (e.g. Chase Sapphire Preferred):',
        });
        const provider = await input({
          message: 'Provider Name (e.g. Chase, Amex, Capital One, Rakuten):',
        });
        const category = await select({
          message: 'Program Category:',
          choices: [
            { name: 'Credit Card', value: 'credit_card' as const },
            { name: 'Online Shopping / Cashback', value: 'shopping' as const },
            { name: 'Banking & High-Yield Savings', value: 'banking' as const },
            { name: 'Dining & Delivery', value: 'dining' as const },
            { name: 'Other / Custom', value: 'custom' as const },
          ],
        });
        const url = await input({ message: 'Your Referral URL:' });
        const bonusSummary = await input({
          message: 'Welcome Bonus Description (e.g. Earn 60,000 points):',
        });
        const personalAnecdote = await input({
          message: 'Personal Anecdote (Why you love it or how you used it):',
          default: 'One of my favorite cards for everyday spending and great rewards.',
        });

        referralLinks.push({
          id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          enabled: true,
          category,
          provider,
          name,
          url,
          bonusSummary,
          personalAnecdote,
          tags: [provider.toLowerCase(), category],
        });

        adding = await confirm({ message: 'Add another referral link?', default: false });
      }
    }

    // 4. Safety Switch
    const dryRun = await confirm({
      message:
        'Enable Safe Dry-Run mode? (Recommended: simulates posts without sending live network requests)',
      default: true,
    });

    // Assemble configuration
    const newConfig: AppConfig = {
      dryRun,
      personalTouch: {
        authorName,
        philosophy,
        defaultAnecdote: philosophy,
        includeFtcDisclosure: includeDisclosure,
        toneRotation: ['story', 'informative', 'deal_alert'],
      },
      schedule: {
        cron: '15 */6 * * *',
        jitterMinutes: 15,
        maxPostsPerDay: 10,
        linkCooldownHours: 24,
      },
      platforms: {
        reddit: {
          enabled: selectedPlatforms.includes('reddit'),
          dryRun: true,
          targets: [
            { name: 'churning', type: 'comment' },
            { name: 'referralcodes', type: 'post', flair: 'Credit Cards' },
          ],
        },
        facebook: {
          enabled: selectedPlatforms.includes('facebook'),
          dryRun: true,
          targets: [{ id: 'group_deals', name: 'Rewards Community', type: 'group' }],
        },
        bluesky: {
          enabled: selectedPlatforms.includes('bluesky'),
          dryRun: true,
          tags: ['#CreditCards', '#TravelHacking', '#Referral'],
        },
        discord: {
          enabled: selectedPlatforms.includes('discord'),
          dryRun: true,
          targets: [{ channelName: 'referrals', type: 'webhook' }],
        },
        twitter: {
          enabled: selectedPlatforms.includes('twitter'),
          dryRun: true,
          tags: ['#CreditCard', '#BonusOffer'],
        },
      },
      referralLinks,
    };

    saveConfig(newConfig, 'config.yaml');
    console.log('\n' + chalk.bold.green('✔ Configuration successfully saved to config.yaml!'));

    const envPath = path.resolve(process.cwd(), '.env');
    const envExamplePath = path.resolve(process.cwd(), '.env.example');
    if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
      console.log(chalk.green('✔ Initialized .env from template (.env.example)'));
    }

    console.log(chalk.cyan('\nNext steps:'));
    console.log(
      chalk.white('  1. Test a simulated run:        ') + chalk.bold.yellow('npm run post'),
    );
    console.log(
      chalk.white('  2. Verify credentials & health: ') + chalk.bold.yellow('npm run validate'),
    );
    if (selectedPlatforms.includes('reddit') && !getDevvitToken()) {
      console.log(
        chalk.white('  3. One-click Reddit login:      ') + chalk.bold.yellow('npx devvit login'),
      );
    }
    console.log(
      chalk.white('  4. Start the background runner: ') + chalk.bold.yellow('npm run daemon\n'),
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      console.log(chalk.yellow('\nSetup cancelled.\n'));
    } else {
      throw error;
    }
  }
}
