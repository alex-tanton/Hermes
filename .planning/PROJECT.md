# Referral-Repeater

## Overview
**Referral-Repeater** is an autonomous, configurable, multi-platform referral link distribution engine designed for reward hackers, credit card enthusiasts, and everyday consumers. Instead of manually searching for referral threads and pasting links across online forums, Referral-Repeater autonomously schedules, personalizes, formats, and shares referral codes across multiple communities with emotional touch and anti-spam safeguards.

---

## Core Value Proposition
- **Authentic Recommendation Storytelling**: Embeds real personal anecdotes and experience into each recommendation so posts read like genuine advice rather than automated spam.
- **Strict Compliance & Safety**: Enforces safe simulation (dry-run) out of the box, automatic FTC referral disclosures (16 CFR Part 255), and anti-bot jitter.
- **Cross-Platform Adaptability**: Formats posts tailored to each platform's character limits and markdown rules (Reddit, Discord, Bluesky, Facebook, Twitter).
- **Zero-Database Lightweight Architecture**: Operates with zero cloud database dependencies, storing audit trails and cooldowns locally in JSON.

---

## Current State: v1.0 (Baseline Architecture)
- **Engine Core**:
  - `ReferralRepeaterEngine` with link rotation and daily rate limit checks.
  - `AutonomousScheduler` with `node-cron` and randomized anti-bot jitter.
  - `HistoryTracker` local JSON audit trail (`.data/history.json`).
  - `Logger` terminal preview boxes and log file writer.
- **Adapters**:
  - Reddit, Discord, Bluesky, Facebook, Twitter adapters with credential validation and simulated dispatches.
- **CLI Commands**:
  - `init` (interactive setup wizard using `@inquirer/prompts`)
  - `post` (immediate cycle with dry-run/live/force/platform flags)
  - `daemon` (background recurring scheduler)
  - `validate` (configuration and credentials health check)
  - `history` (audit logs, stats, and cooldown cache clearing)
- **Quality**:
  - 100% test pass rate across 7 test suites (44 tests in Vitest).
  - ESLint and Prettier clean with conventional commit enforcement.

---

## Active Milestone: v1.1 — Live Distribution & Production Hardening

### Objectives
1. **Live Platform Network Dispatches**: Implement real HTTP and API integrations (Discord Webhook `fetch`, Bluesky XRPC via `@atproto/api` or HTTPS, Reddit OAuth2 script client, Twitter API v2, Facebook Graph API).
2. **Concurrency & Safe File Locking**: Prevent state corruption by implementing atomic file locking or mutex on `.data/history.json`.
3. **Granular Platform Rate Limits & Weighted Rotation**: Allow per-platform cooldown/daily cap overrides in `config.yaml`, and replace first-match link selection with weighted or round-robin rotation.
4. **Daemon Production Packaging**: Supply Docker containerization (`Dockerfile`, `docker-compose.yml`) and PM2 / systemd configuration templates for 24/7 autonomous hosting.

---

## Key Constraints & Guarantees
- **Safety Switch**: Dry-run remains default unless both `dryRun: false` and the CLI flag `--live` are explicitly passed.
- **FTC Transparency**: All generated posts append compliant disclosures when `includeFtcDisclosure: true`.
- **Zero External DB Requirement**: Remain completely self-hosted, lightweight, and operable on any machine running Node.js 18+.
