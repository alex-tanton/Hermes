# Hermes

### The Messenger of the Gods

> **Why it fits:** Hermes is famous for his incredible speed, his winged sandals, and his role as the ultimate courier who delivers messages across vast distances.
>
> **The connection:** Just as Hermes carried messages to every corner of the mortal and immortal worlds, your program swiftly carries your referral codes and delivers them across various online platforms. It’s the perfect namesake for a fast, reliable distribution tool.

<p align="center">
  <strong>Autonomous, configurable, multi-platform referral link courier with emotional personalization and anti-spam safeguards.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-v1.1.0-orange.svg" alt="Version v1.1.0" />
  <img src="https://img.shields.io/badge/Language-TypeScript%205.7-blue.svg" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Runtime-Node.js%2018%2B-green.svg" alt="Node.js" />
  <img src="https://img.shields.io/badge/CI-GitHub%20Actions-blue.svg" alt="CI" />
  <img src="https://img.shields.io/badge/Tests-Vitest%20(122%20passed)-brightgreen.svg" alt="Vitest Tests" />
  <img src="https://img.shields.io/badge/Code%20Style-Prettier-ff69b4.svg" alt="Prettier" />
  <img src="https://img.shields.io/badge/Linter-ESLint-4B32C3.svg" alt="ESLint" />
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT License" />
  <img src="https://img.shields.io/badge/Safety-Safe%20Dry--Run%20Default-purple.svg" alt="Dry Run Safety" />
</p>

---

## Overview

**Hermes** is an automated referral link courier built for software engineers, reward hackers, and everyday cardholders. Instead of manually searching for referral threads and pasting links across online forums, Hermes autonomously schedules, personalizes, formats, and delivers your referral codes across multiple communities.

Designed from the ground up to avoid bot detection and spam penalties, Hermes incorporates:

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
                       |          HermesEngine            |
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
                       |  - logs/hermes.log               |
                       +-----------------+----------------+
```

---

## Directory Structure

```
Hermes/
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
│   │   ├── engine.ts           # Main dispatch & link selection engine (HermesEngine)
│   │   ├── scheduler.ts        # Node-cron scheduler with anti-bot jitter
│   │   ├── history.ts          # Persistent history and deduplication
│   │   └── logger.ts           # Terminal previews and file logger
│   ├── cli/
│   │   ├── index.ts            # Commander CLI entry point (hermes)
│   │   └── commands/
│   │       ├── init.ts         # Interactive setup wizard for friends/family
│   │       ├── post.ts         # Manual cycle execution
│   │       ├── daemon.ts       # Autonomous background runner
│   │       ├── validate.ts     # Configuration & credentials inspector
│   │       └── history.ts      # History and analytics viewer
│   └── index.ts                # Public programmatic API exports
├── tests/                      # Vitest test suite (122 unit & integration tests)
├── Dockerfile                  # Multi-stage production container image definition
├── docker-compose.yml          # Containerized background daemon with persistent volumes
├── ecosystem.config.cjs        # PM2 process manager configuration with memory guard
├── hermes.service              # Hardened Linux systemd background service unit
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
# or: npx hermes init
```

_(Alternatively, copy `config.example.yaml` to `config.yaml` and edit manually)._

### 3. Validate Configuration

Verify configuration syntax, platform credentials, and loaded referral links:

```bash
npm run validate
# or: npx hermes validate
```

### 4. Execute a Simulated Run (Safe Dry-Run)

See formatted post previews in terminal boxes without sending live network requests:

```bash
npm run post
# or: npx hermes post
```

### 5. Launch Autonomous Background Scheduler

Starts the continuous background daemon with anti-bot jitter and cooldown protection:

```bash
npm run daemon
# or: npx hermes daemon
```

### 6. Production Hosting (Docker / PM2 / Systemd)

Run unattended 24/7 in an isolated container or supervised daemon:

```bash
# Launch containerized daemon with persistent volumes
docker compose up -d

# Inspect live daemon logs
docker compose logs -f hermes
```

For PM2 process supervision or systemd service setup, see the complete [Installation & Deployment Guide](INSTALL.md#6-autonomous-background-execution--production-hosting).

---

## CLI Reference

| Command                                    | Description                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| `npm run setup` / `npx hermes init`        | Interactive guided wizard to create/update `config.yaml`                    |
| `npm run post` / `npx hermes post`         | Executes a one-off distribution cycle (safe dry-run by default)             |
| `npm run post -- --platform reddit`        | Dispatches to a specific platform only                                      |
| `npm run post -- --category shopping`      | Dispatches only links in a specific category                                |
| `npm run post -- --tone deal_alert`        | Overrides message tone (`story`, `informative`, `deal_alert`, `comparison`) |
| `npm run post -- --force`                  | Bypasses cooldowns and daily post caps (useful for testing)                 |
| `npm run post -- --live`                   | Executes live network posts using configured platform credentials           |
| `npm run daemon` / `npx hermes daemon`     | Starts autonomous scheduler daemon running on configured cron               |
| `npm run validate` / `npx hermes validate` | Inspects `config.yaml`, checks platform credentials, and lists links        |
| `npm run history` / `npx hermes history`   | Displays recent post history and platform analytics                         |
| `npm run history -- --clear`               | Resets posting history and cooldown cache                                   |

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
  linkCooldownHours: 24 # Global fallback cooldown per link/platform

# Platform toggles, credentials, and optional per-platform rate limits
platforms:
  reddit:
    enabled: true
    dryRun: true
    cooldownHours: 720 # Per-platform override: 30-day cooldown for monthly megathread rules
    maxPostsPerDay: 1 # Per-platform override: limit Reddit to 1 post per day
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
    cooldownHours: 12 # Per-platform override: 12-hour turnaround for active deal channels
    maxPostsPerDay: 6 # Per-platform override: up to 6 posts/day
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
    priority: 85 # Priority (1-100, default 50). High priority links are picked first.
```

---

## Expanding to Other Referral Programs

Hermes is designed to support any referral program category seamlessly.

### Pre-Configured Categories

1. **Credit Cards (`credit_card`)**: Chase, Capital One, American Express, Citi, Discover.
2. **Online Shopping Portals (`shopping`)**: Rakuten, TopCashback, Honey, BeFrugal, Capital One Shopping.
3. **Banking & HYSA (`banking`)**: SoFi, Wealthfront, Marcus, Robinhood.
4. **Dining & Food Delivery (`dining`)**: Uber Eats, DoorDash, Instacart, Grubhub.
5. **Custom Program (`custom`)**: Any app, SaaS, or service referral.

### Programmatic Custom Extension

You can register custom referral program definitions in TypeScript:

```typescript
import { programRegistry, HermesEngine } from 'hermes';

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

## Anti-Spam Cooldowns, Rotation & Compliance

1. **Dry-Run by Default**: Network calls to live social platforms are prevented unless `dryRun: false` and the CLI flag `--live` are explicitly passed.
2. **Granular Per-Platform Cooldowns**: Supports platform-specific `cooldownHours` overrides (e.g., 720h / 30-day cooldown for Reddit monthly megathreads vs. 12h for Discord deal channels), falling back to `schedule.linkCooldownHours`.
3. **Independent Per-Platform Daily Caps**: Platforms can specify `maxPostsPerDay` limits. If Reddit reaches its daily limit, other platforms continue operating seamlessly without halting the entire cycle.
4. **Fair Round-Robin & Priority Rotation**: Referral links support an optional `priority` (1-100, default 50). Links with higher priority are selected first; links with equal priority rotate in a strict least-recently-posted round-robin manner to prevent link starvation.
5. **Twitter/X `t.co` URL Budgeting**: Any URL in a tweet is budgeted at fixed 23 characters (the standard Twitter `t.co` shortener length). Long referral URLs (80-120+ characters) do not prematurely truncate the message title or description.
6. **Automatic Rate-Limit Backoff**: If any platform encounters HTTP 429 rate limits, Hermes automatically pauses posting to that platform while permitting remaining platforms to operate unimpeded.
7. **History Truncation & Mutex Locking**: Persistent records are atomically locked with `proper-lockfile` and bounded by configurable retention caps to preserve disk hygiene.
8. **FTC Referral Disclosure**: In accordance with FTC guidelines (16 CFR Part 255), all generated posts automatically append transparent referral disclosures when `includeFtcDisclosure: true`.

---

## Development & Testing

```bash
# Run unit & integration tests
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
