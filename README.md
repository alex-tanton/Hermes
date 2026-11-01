# Hermes

> Autonomous, configurable, multi-platform referral link courier with emotional personalization and anti-spam safeguards.

---

## Overview

**Hermes** is an automated referral link courier built for software engineers, reward hackers, and everyday cardholders. Instead of manually searching for referral threads and pasting links across online forums, Hermes autonomously schedules, personalizes, formats, and delivers your referral codes across multiple communities.

Key features:

- **Personal Touch & Emotional Storytelling**: Personal anecdotes, travel experiences, and custom hooks are seamlessly woven into each post so recommendations feel genuine.
- **Multi-Platform Support**: Tailored adapters for Reddit, Facebook Groups, Bluesky, Discord Webhooks, and Twitter/X.
- **Autonomous Scheduler with Anti-Bot Jitter**: Runs on configurable cron intervals with randomized delays and per-link cooldowns.
- **Safe Dry-Run by Default**: Safe simulation mode enabled out of the box—no real network posts are sent unless explicitly instructed with `--live`.
- **Extensible Program Architecture**: Pre-configured with major credit cards (Chase Freedom, Chase Sapphire, Capital One VentureOne) and expandable to online shopping portals, banking, dining, or custom programs.
- **Interactive Setup Wizard**: Built with an interactive CLI setup tool to configure cards, credentials, and platforms step-by-step.

---

## Quick Start

### 1. Install Dependencies & Build

```bash
npm install
npm run build
```

### 2. Configure Hermes

Run the interactive guided wizard:

```bash
npm run setup
# or: npx hermes init
```

Alternatively, copy `config.example.yaml` to `config.yaml` and `.env.example` to `.env` to configure manually. See `config.example.yaml` for comprehensive inline documentation of all available settings.

### 3. Validate Configuration

Verify configuration syntax, platform credentials, and loaded referral links:

```bash
npm run validate
# or: npx hermes validate
```

### 4. Execute a Simulated Run (Safe Dry-Run)

Preview formatted posts in terminal boxes without sending network requests:

```bash
npm run post
# or: npx hermes post
```

### 5. Launch Background Daemon

Start the autonomous scheduler daemon with anti-bot jitter and cooldown protection:

```bash
npm run daemon
# or: npx hermes daemon
```

### 6. Containerized Deployment (Docker)

Run unattended 24/7 in an isolated container with persistent volumes:

```bash
# Start containerized daemon
docker compose up -d

# Inspect live logs
docker compose logs -f hermes
```

---

## CLI Reference

| Command                                    | Description                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| `npm run setup` / `npx hermes init`        | Interactive guided wizard to create or update `config.yaml`                    |
| `npm run post` / `npx hermes post`         | Executes a one-off distribution cycle (safe dry-run by default)                |
| `npm run post -- --platform <name>`        | Dispatches to a specific platform only (`reddit`, `discord`, `bluesky`, etc.)  |
| `npm run post -- --category <cat>`         | Dispatches only links in a specific category (`credit_card`, `shopping`, etc.) |
| `npm run post -- --tone <tone>`            | Overrides message tone (`story`, `informative`, `deal_alert`, `comparison`)    |
| `npm run post -- --force`                  | Bypasses cooldowns and daily post caps (useful for manual testing)             |
| `npm run post -- --live`                   | Executes live network posts using configured platform credentials              |
| `npm run daemon` / `npx hermes daemon`     | Starts autonomous scheduler daemon running on configured cron                  |
| `npm run validate` / `npx hermes validate` | Inspects `config.yaml`, checks platform credentials, and lists links           |
| `npm run history` / `npx hermes history`   | Displays recent post history and platform analytics                            |
| `npm run history -- --clear`               | Resets posting history and cooldown cache                                      |

---

## Directory Structure

```
Hermes/
├── src/
│   ├── types/                  # Strictly typed interfaces and domain models
│   ├── config/                 # Configuration schemas, defaults, and loaders
│   ├── programs/               # Referral program category registry
│   ├── templates/              # Personal touch, FTC disclosures, and tone engine
│   ├── platforms/              # Platform adapters (Reddit, Facebook, Bluesky, Discord, Twitter)
│   ├── core/                   # Engine, scheduler, history tracker, and logger
│   ├── cli/                    # CLI commands and entry point
│   └── index.ts                # Public programmatic API exports
├── tests/                      # Vitest test suite
├── Dockerfile                  # Production container image definition
├── docker-compose.yml          # Containerized background daemon
├── config.example.yaml         # Annotated configuration reference & template
├── .env.example                # Direct environment variables template
├── tsconfig.json               # TypeScript configuration
├── eslint.config.mjs           # ESLint configuration
├── .prettierrc                 # Prettier code formatting configuration
└── commitlint.config.js        # Conventional Commits enforcement
```

---

## Platform Credentials Guide

Set credentials in `.env` or reference them directly in `config.yaml`:

### Reddit

- **Recommended (Zero Config):** Run `npx devvit login` in your terminal. Authenticate in the browser window; your token will be saved to `~/.devvit/token` and detected automatically.
- **Manual Token:** Set `REDDIT_ACCESS_TOKEN` in `.env`.
- **Legacy Script App:** Set `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USERNAME`, and `REDDIT_PASSWORD` in `.env`.

### Discord

1. In your Discord server, open **Channel Settings** -> **Integrations** -> **Webhooks**.
2. Click **New Webhook**, name it, and click **Copy Webhook URL**.
3. Set `DISCORD_WEBHOOK_URL` in `.env`.

### Bluesky

1. Log in to [bsky.app](https://bsky.app).
2. Go to **Settings** -> **Privacy & Security** -> **App Passwords**.
3. Click **Add App Password**, name it `hermes`, and set `BLUESKY_HANDLE` and `BLUESKY_APP_PASSWORD` in `.env`.

### Twitter / X

1. Open the [Twitter Developer Portal](https://developer.x.com/).
2. Create a project and app with **Read and Write** permissions.
3. Generate and set `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, and `TWITTER_ACCESS_SECRET` in `.env`.

### Facebook

1. Open the [Meta for Developers Portal](https://developers.facebook.com/).
2. Create an app and generate a **Page Access Token** with `pages_manage_posts` and `pages_read_engagement` permissions.
3. Set `FACEBOOK_ACCESS_TOKEN` in `.env`.

---

## Troubleshooting & FAQ

### Why are no posts showing up on forums or feeds?

- By default, Hermes runs in **Safe Dry-Run** mode to protect your accounts. Set `dryRun: false` in `config.yaml` or pass the `--live` flag on the CLI:
  ```bash
  npm run post -- --live
  ```

### Why did the engine skip posting a specific card?

- **Cooldown active:** Each card respects `linkCooldownHours` (default: 24h) or platform-specific overrides. Use `--force` to bypass cooldowns during manual testing.
- **Daily cap reached:** The daily post limit across platforms or for that specific platform was reached.
- View recent post timestamps and status:
  ```bash
  npm run history
  ```

### How do I reset the posting cooldowns and history?

- Clear the persistent history ledger:
  ```bash
  npm run history -- --clear
  ```

### How do I add or update referral links?

- Add a new entry under `referralLinks:` in `config.yaml` (see `config.example.yaml` for all fields), or rerun the setup wizard:
  ```bash
  npm run setup
  ```

---

## Development & Testing

```bash
# Run unit & integration tests
npm test

# Run tests in watch mode
npm run test:watch

# Code style checking & formatting
npm run format:check
npm run format

# Linting
npm run lint

# Build TypeScript distribution
npm run build
```

---

## Commit Guidelines

This project enforces [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
Commit messages and linting are validated locally via Commitlint and Husky git hooks.

---

## License

MIT License. Designed and maintained by Alex Tanton.
