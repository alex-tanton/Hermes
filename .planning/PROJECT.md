# Referral-Repeater

## Overview
**Referral-Repeater** is an autonomous, configurable, multi-platform referral link distribution engine designed for reward hackers, credit card enthusiasts, and everyday consumers. Instead of manually searching for referral threads and pasting links across online forums, Referral-Repeater autonomously schedules, personalizes, formats, and shares referral codes across multiple communities with emotional touch and anti-spam safeguards.

---

## Core Value Proposition
- **Authentic Recommendation Storytelling**: Embeds real personal anecdotes and experience into each recommendation so posts read like genuine advice rather than automated spam.
- **Strict Compliance & Safety**: Enforces safe simulation (dry-run) out of the box, automatic FTC referral disclosures (16 CFR Part 255), and anti-bot jitter.
- **Cross-Platform Adaptability**: Formats posts tailored to each platform's character limits and markdown rules (Reddit, Discord, Bluesky, Facebook, Twitter).
- **Zero-Database Lightweight Architecture**: Operates with zero cloud database dependencies, storing audit trails and cooldowns locally in JSON with atomic cross-process file locks.

---

## Current State: v1.1 (Live Distribution & Hardening Complete)
- **Engine Core & Scheduling**:
  - `ReferralRepeaterEngine` with priority-weighted and fair round-robin rotation.
  - Per-platform `cooldownHours` and `maxPostsPerDay` rate limiting.
  - `AutonomousScheduler` with `node-cron` and randomized anti-bot jitter.
  - `HistoryTracker` with `proper-lockfile` cross-process locking and atomic `.tmp` rename protecting `.data/history.json`.
- **Live Dispatches**:
  - Real API dispatches for Discord (webhook with `?wait=true`), Bluesky (AT Protocol XRPC), Reddit (OAuth2 password flow), Twitter/X (pure Node crypto OAuth 1.0a), and Facebook (Graph API v19.0).
  - Multi-platform resilience matrix handling offline failures, timeouts, 401s, 429s, and 500s.
- **Production Packaging**:
  - Multi-stage Docker container (`node:20-alpine`) running unprivileged `node` user with volume mounts.
  - Ready-to-run `docker-compose.yml`, PM2 `ecosystem.config.cjs`, and Linux `referral-repeater.service` systemd unit template.
  - Comprehensive deployment documentation in `INSTALL.md` and `README.md`.
- **Quality**:
  - 106 unit, stress, integration, and packaging tests passing across 8 test suites.
  - 100% clean TypeScript build, ESLint, and Prettier checks.

<details>
<summary>Archived Milestone v1.0 Details</summary>

### v1.0 Baseline Architecture
- Architecture, AST validation, interactive wizard, dry-run simulation, FTC disclosures, tone engine, and 44 unit tests.
</details>

---

## Next Milestone Goals
- Plan the next milestone cycle using `/gsd-new-milestone`. Potential areas:
  - Web dashboard or UI status viewer
  - Dynamic template expansions and AI-assisted tone variation
  - Additional platform adapters (Telegram, LinkedIn, Mastodon, WhatsApp Channels)
  - Post engagement / click tracking analytics

---

## Key Constraints & Guarantees
- **Safety Switch**: Dry-run remains default unless both `dryRun: false` and the CLI flag `--live` are explicitly passed.
- **FTC Transparency**: All generated posts append compliant disclosures when `includeFtcDisclosure: true`.
- **Zero External DB Requirement**: Remain completely self-hosted, lightweight, and operable on any machine running Node.js 18+.
