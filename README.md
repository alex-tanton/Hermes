# Referral-Repeater

<p align="center">
  <strong>Autonomous, configurable, multi-platform referral link distribution engine with emotional personalization and anti-spam safeguards.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Language-TypeScript%205.7-blue.svg" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Runtime-Node.js%2018%2B-green.svg" alt="Node.js" />
  <img src="https://img.shields.io/badge/Tests-Vitest%20(43%20passed)-brightgreen.svg" alt="Vitest Tests" />
  <img src="https://img.shields.io/badge/Code%20Style-Prettier-ff69b4.svg" alt="Prettier" />
  <img src="https://img.shields.io/badge/Linter-ESLint-4B32C3.svg" alt="ESLint" />
  <img src="https://img.shields.io/badge/Commits-Conventional%20Commits-FE5196.svg" alt="Commitlint" />
  <img src="https://img.shields.io/badge/Safety-Safe%20Dry--Run%20Default-purple.svg" alt="Dry Run Safety" />
</p>

---

## Overview

**Referral-Repeater** is an automated referral link distribution engine built for software engineers, reward hackers, and everyday cardholders. Instead of manually searching for referral threads and pasting links across online forums, Referral-Repeater autonomously schedules, personalizes, formats, and shares your referral codes across multiple communities.

Designed from the ground up to avoid bot detection and spam penalties, Referral-Repeater incorporates:

- **Personal Touch & Emotional Storytelling**: Personal anecdotes, travel experiences, and custom hooks are seamlessly woven into each post so your recommendations feel genuine and helpful.
- **Multi-Platform Support**: Tailored adapters for Reddit, Facebook Groups, Bluesky, Discord Webhooks, and Twitter/X.
- **Autonomous Scheduler with Anti-Bot Jitter**: Runs on configurable cron intervals with randomized delays and per-link cooldowns.
- **Safe Dry-Run by Default**: Safe simulation mode enabled out of the box—no real network posts are sent unless explicitly instructed with `--live`.
- **Extensible Program Architecture**: Pre-configured with major credit cards (Chase Freedom, Chase Sapphire, Capital One VentureOne) and expandable to online shopping portals (Rakuten, TopCashback), banking, dining, or custom programs.
- **User-Friendly Setup Wizard**: Built with an interactive CLI setup tool so you can share it with friends and family without needing them to edit raw config files.

---

## Architecture

```
                       +----------------------------------+
                       |           config.yaml            |
                       | (YAML Schema & Env Substitution) |
                       +-----------------+----------------+
                                         |
                                         v
+-----------------------+     +-------------------+     +-------------------------+
|  User-Friendly CLI    |     |  Program Registry |     | Autonomous Scheduler    |
| (Setup Wizard/Manual) | --> | (Cards, Shopping) | --> | (Cron + Anti-Bot Jitter)|
+-----------------------+     +---------+---------+     +------------+------------+
                                        |                            |
                                        v                            v
                       +----------------------------------+
                       |    ReferralRepeaterEngine        |
                       |  - Link Rotation & Eligibility   |
                       |  - Cooldown & Daily Cap Checking |
                       +-----------------+----------------+
                                         |
                                         v
                       +----------------------------------+
                       |        TemplateEngine            |
                       |  - Personal Anecdote Injection   |
                       |  - FTC Referral Disclosure       |
                       |  - Platform Formatting/Clipping  |
                       +-----------------+----------------+
                                         |
        +--------------------------------+--------------------------------+
        |                |               |                |               |
        v                v               v                v               v
+---------------+ +---------------+ +----------+ +-----------------+ +----------+
| RedditAdapter | |FacebookAdapter| | Bluesky  | | Discord Webhook | | Twitter  |
| (Subreddits / | |(Groups / Feed | | (AT Proto| | (Channels /     | | (API v2  |
| Megathreads)  | |  Graph API)   | | 300 char)| | Rich Markdown)  | | 280 char)|
+-------+-------+ +-------+-------+ +----+-----+ +--------+--------+ +----+-----+
        |                 |              |                |               |
        +--------------------------------+--------------------------------+
                                         |
                                         v
                       +----------------------------------+
                       |    HistoryTracker & Audit Logger |
                       |  - .data/history.json (Audit)    |
                       |  - logs/referral-repeater.log    |
                       +----------------------------------+
```

---

## Directory Structure

```
Referral-Repeater/
├── .data/                      # Local JSON audit trail and cooldown tracking
├── logs/                       # Rotating application logs
├── src/
│   ├── types/                  # Strictly typed interfaces and domain models
│   ├── config/
│   │   ├── schema.ts           # Zod schema validation
│   │   ├── defaults.ts         # Default cards & configuration
│   │   └── loader.ts           # YAML/JSON loader with env substitution
│   ├── programs/
│   │   ├── types.ts            # Program metadata definitions
│   │   └── registry.ts         # Credit cards, shopping, banking, dining registry
│   ├── templates/
│   │   └── engine.ts           # Personal touch, FTC disclosures, tone engine
│   ├── platforms/
│   │   ├── base.ts             # Abstract PlatformAdapter base class
│   │   ├── reddit.ts           # Reddit API / megathread adapter
│   │   ├── facebook.ts         # Facebook Graph API / group adapter
│   │   ├── bluesky.ts          # Bluesky / AT Protocol adapter
│   │   ├── discord.ts          # Discord Webhook & forum adapter
│   │   ├── twitter.ts          # Twitter / X API v2 adapter
│   │   └── registry.ts         # Adapter lifecycle & resolver registry
│   ├── core/
│   │   ├── engine.ts           # Main dispatch & link selection engine
│   │   ├── scheduler.ts        # Node-cron scheduler with anti-bot jitter
│   │   ├── history.ts          # Persistent history and deduplication
│   │   └── logger.ts           # Terminal previews and file logger
│   ├── cli/
│   │   ├── index.ts            # Commander CLI entry point
│   │   └── commands/
│   │       ├── init.ts         # Interactive setup wizard for friends/family
│   │       ├── post.ts         # Manual cycle execution
│   │       ├── daemon.ts       # Autonomous background runner
│   │       ├── validate.ts     # Configuration & credentials inspector
│   │       └── history.ts      # History and analytics viewer
│   └── index.ts                # Public programmatic API exports
├── tests/                      # Vitest test suite (43 unit tests)
├── config.example.yaml         # Fully documented example configuration
├── REFERRAL_LINKS.md           # Raw input referral links and bonus details
├── INSTALL.md                  # Comprehensive setup and operating system guide
├── tsconfig.json               # TypeScript strict configuration
├── .eslintrc.json              # ESLint configuration
├── .prettierrc                 # Prettier code formatting configuration
└── commitlint.config.js        # Conventional Commits enforcement
```

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
npm run build
```

### 2. Run the Interactive Setup Wizard

Ideal for friends and family—configures cards, personal stories, and platforms step-by-step:

```bash
npm run setup
```

_(Alternatively, copy `config.example.yaml` to `config.yaml` and edit manually)._

### 3. Validate Configuration

Verify configuration syntax, platform credentials, and loaded referral links:

```bash
npm run validate
```

### 4. Execute a Simulated Run (Safe Dry-Run)

See formatted post previews in terminal boxes without sending live network requests:

```bash
npm run post
```

### 5. Launch Autonomous Background Scheduler

Starts the continuous background daemon with anti-bot jitter and cooldown protection:

```bash
npm run daemon
```

---

## CLI Reference

| Command                                        | Description                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| `npm run setup` / `npx referral-repeater init` | Interactive guided wizard to create/update `config.yaml`                    |
| `npm run post`                                 | Executes a one-off distribution cycle (safe dry-run by default)             |
| `npm run post -- --platform reddit`            | Dispatches to a specific platform only                                      |
| `npm run post -- --category shopping`          | Dispatches only links in a specific category                                |
| `npm run post -- --tone deal_alert`            | Overrides message tone (`story`, `informative`, `deal_alert`, `comparison`) |
| `npm run post -- --force`                      | Bypasses cooldowns and daily post caps (useful for testing)                 |
| `npm run post -- --live`                       | Executes live network posts using configured platform credentials           |
| `npm run daemon`                               | Starts autonomous scheduler daemon running on configured cron               |
| `npm run validate`                             | Inspects `config.yaml`, checks platform credentials, and lists links        |
| `npm run history`                              | Displays recent post history and platform analytics                         |
| `npm run history -- --clear`                   | Resets posting history and cooldown cache                                   |

---

## Configuration Reference (`config.yaml`)

```yaml
# Global safety switch. Set to false ONLY when ready to post live.
dryRun: true

# Personal touch and story injection
personalTouch:
  authorName: 'Alex'
  philosophy: 'Smart reward strategies turn everyday spending into free vacations.'
  defaultAnecdote: 'I have used these cards for years to maximize travel points.'
  includeFtcDisclosure: true # Appends FTC compliance disclosure
  toneRotation:
    - 'story'
    - 'informative'
    - 'deal_alert'

# Autonomous scheduler settings
schedule:
  cron: '15 */6 * * *' # Standard 5-field cron expression
  jitterMinutes: 20 # Random delay up to 20 minutes to avoid robotic timing
  maxPostsPerDay: 12 # Daily cap across all platforms
  linkCooldownHours: 24 # Do not repost same card to same platform within 24h

# Platform toggles and credentials
platforms:
  reddit:
    enabled: true
    dryRun: true
    credentials:
      clientId: '${REDDIT_CLIENT_ID}'
      clientSecret: '${REDDIT_CLIENT_SECRET}'
      username: '${REDDIT_USERNAME}'
      password: '${REDDIT_PASSWORD}'
    targets:
      - name: 'churning'
        type: 'comment'
      - name: 'referralcodes'
        type: 'post'
        flair: 'Credit Cards'

  discord:
    enabled: true
    dryRun: true
    credentials:
      webhookUrl: '${DISCORD_WEBHOOK_URL}'
    targets:
      - channelName: 'deals-and-referrals'

  bluesky:
    enabled: true
    dryRun: true
    credentials:
      identifier: '${BLUESKY_HANDLE}'
      password: '${BLUESKY_APP_PASSWORD}'

  facebook:
    enabled: false
    dryRun: true

  twitter:
    enabled: false
    dryRun: true

# Configured referral links (Credit cards, shopping, banking, etc.)
referralLinks:
  - id: 'chase-freedom'
    enabled: true
    category: 'credit_card'
    provider: 'Chase'
    name: 'Chase Freedom Unlimited or Flex'
    url: 'https://www.referyourchasecard.com/18s/FIG0CQ5GP4'
    bonusSummary: 'Earn cash back welcome bonus after qualifying purchases.'
    personalAnecdote: 'My go-to daily driver card! 1.5% base plus 3% on dining adds up fast.'
    tags: ['chase', 'cashback', 'no-annual-fee']
```

---

## Expanding to Other Referral Programs

Referral-Repeater is designed to support any referral program category seamlessly.

### Pre-Configured Categories

1. **Credit Cards (`credit_card`)**: Chase, Capital One, American Express, Citi, Discover.
2. **Online Shopping Portals (`shopping`)**: Rakuten, TopCashback, Honey, BeFrugal, Capital One Shopping.
3. **Banking & HYSA (`banking`)**: SoFi, Wealthfront, Marcus, Robinhood.
4. **Dining & Food Delivery (`dining`)**: Uber Eats, DoorDash, Instacart, Grubhub.
5. **Custom Program (`custom`)**: Any app, SaaS, or service referral.

### Programmatic Custom Extension

You can register custom referral program definitions in TypeScript:

```typescript
import { programRegistry } from 'referral-repeater';

programRegistry.register({
  category: 'custom',
  title: 'Cloud & SaaS Referrals',
  description: 'Hosting credits and SaaS software discounts.',
  recommendedSubreddits: ['webhosting', 'promocodes'],
  recommendedHashtags: ['#CloudHosting', '#SaaSDeals'],
  defaultDisclosure: '(Referral Disclosure: Author receives cloud credits upon signup.)',
  exampleCallToAction: 'Deploy your instance with free credits here:',
  formatBonusSummary: (s) => `☁️ Hosting Offer: ${s}`,
});
```

---

## Safety & Compliance

1. **Dry-Run by Default**: Network calls to live social platforms are prevented unless `dryRun: false` and the CLI flag `--live` are explicitly passed.
2. **Anti-Spam Cooldowns**: Enforces `linkCooldownHours` per platform and a hard ceiling of `maxPostsPerDay` to protect user accounts from automated bot bans.
3. **FTC Referral Disclosure**: In accordance with FTC guidelines (16 CFR Part 255), all generated posts automatically append transparent referral disclosures when `includeFtcDisclosure: true`.

---

## Development & Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Code style checking with Prettier
npm run format:check

# Format codebase with Prettier
npm run format

# Linting with ESLint
npm run lint

# Build production TypeScript distribution
npm run build
```

---

## Commit Guidelines

This project strictly adheres to [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
Commit messages are validated locally via Commitlint and Husky git hooks.

---

## License

MIT License. Designed and maintained by Alex Tanton.
