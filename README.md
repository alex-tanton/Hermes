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

## Documentation

- [Architecture Guide](docs/ARCHITECTURE.md)
- [Configuration Reference](docs/CONFIGURATION.md)
- [Anti-Spam & Compliance](docs/ANTI_SPAM.md)
- [Extending & Custom Programs](docs/EXTENDING.md)
- [CLI Reference](docs/CLI.md)
- [Platform Credentials Guide](docs/CREDENTIALS.md)
- [Troubleshooting & FAQ](docs/TROUBLESHOOTING.md)
- [State Persistence & Backups](docs/PERSISTENCE.md)
- [Installation Guide](INSTALL.md)

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

## Directory Structure

```
Hermes/
├── .data/                      # Local JSON audit trail and cooldown tracking
├── docs/                       # Detailed documentation files
├── logs/                       # Rotating application logs
├── src/
│   ├── types/                  # Strictly typed interfaces and domain models
│   ├── config/                 # Configuration schemas, defaults, and loaders
│   ├── programs/               # Credit cards, shopping, banking, dining registry
│   ├── templates/              # Personal touch, FTC disclosures, tone engine
│   ├── platforms/              # Platform adapters (Reddit, Facebook, Bluesky, etc.)
│   ├── core/                   # Main engine, scheduler, history tracker, and logger
│   ├── cli/                    # CLI commands and entry point
│   └── index.ts                # Public programmatic API exports
├── tests/                      # Vitest test suite (122 unit & integration tests)
├── Dockerfile                  # Multi-stage production container image definition
├── docker-compose.yml          # Containerized background daemon with persistent volumes
├── ecosystem.config.cjs        # PM2 process manager configuration with memory guard
├── hermes.service              # Hardened Linux systemd background service unit
├── config.example.yaml         # Annotated example configuration
├── REFERRAL_LINKS.md           # Raw input referral links and bonus details
├── INSTALL.md                  # Comprehensive setup and operating system guide
├── tsconfig.json               # TypeScript strict configuration
├── .eslintrc.json              # ESLint configuration
├── .prettierrc                 # Prettier code formatting configuration
└── commitlint.config.js        # Conventional Commits enforcement
```

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
