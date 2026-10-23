# Architecture & System Design

## Overview
**Referral-Repeater** is structured as a decoupled, modular TypeScript engine designed for safe, automated referral link distribution. Its architecture prioritizes safety (dry-run by default), extensibility (adapter and program registries), and human-like natural distribution (anti-bot jitter, tone rotation, emotional anecdotes).

---

## Architectural Diagram

```
                             +------------------------+
                             | CLI Interface (init,   |
                             | post, daemon, history) |
                             +-----------+------------+
                                         |
                                         v
+-------------------------+  +-----------+------------+  +--------------------------+
|      config.yaml        |->|   Config Loader &      |  | ProgramRegistry          |
| (Env Var Interpolation) |  |   Zod Schema Validator |  | (Card, Banking, Shopping)|
+-------------------------+  +-----------+------------+  +------------+-------------+
                                         |                            |
                                         v                            v
                             +-----------+----------------------------+-------------+
                             |              ReferralRepeaterEngine                  |
                             |  - Link Eligibility Filter                           |
                             |  - Cooldown & Daily Cap Checking                     |
                             |  - Tone Rotation State Machine                       |
                             +-----------------------+------------------------------+
                                                     |
                                                     v
                                     +---------------+---------------+
                                     |        TemplateEngine         |
                                     |  - Anecdote & Tone Injection  |
                                     |  - FTC Legal Disclosures      |
                                     |  - Platform Syntax & Clipping |
                                     +---------------+---------------+
                                                     |
                                                     v
                                     +---------------+---------------+
                                     |       PlatformRegistry        |
                                     +---------------+---------------+
                                                     |
                +-----------------+------------------+------------------+-----------------+
                |                 |                  |                  |                 |
                v                 v                  v                  v                 v
        +---------------+ +---------------+  +---------------+  +---------------+ +---------------+
        | RedditAdapter | |DiscordAdapter |  |BlueskyAdapter |  |FacebookAdapter| | TwitterAdapter|
        | (r/churning,  | | (Webhooks,    |  | (AT Protocol, |  | (Groups, feed,| | (API v2,      |
        |  megathreads) | |  2000 chars)  |  |  300 chars)   |  |  plain text)  | |  280 chars)   |
        +-------+-------+ +-------+-------+  +-------+-------+  +-------+-------+ +-------+-------+
                |                 |                  |                  |                 |
                +-----------------+------------------+------------------+-----------------+
                                                     |
                                                     v
                                     +---------------+---------------+
                                     | HistoryTracker & Audit Trail  |
                                     | - .data/history.json          |
                                     | - logs/referral-repeater.log  |
                                     +-------------------------------+
```

---

## Core Subsystems & Responsibilities

### 1. Configuration & Validation Subsystem (`src/config/`)
- **`schema.ts`**: Formal Zod definitions (`AppConfigSchema`, `ReferralLinkSchema`, `ScheduleSchema`, platform schemas) guaranteeing that runtime configurations strictly match type contracts.
- **`loader.ts`**: Locates `config.yaml`, recursively resolves `${VAR_NAME}` environment variables, and parses via Zod. Falls back safely to `DEFAULT_CONFIG` when running unconfigured.
- **`defaults.ts`**: Provides sensible defaults, built-in card links (Freedom, Sapphire, VentureOne), and sample shopping programs.

### 2. Domain & Program Registry Subsystem (`src/programs/`)
- **`types.ts`**: Contract for `ProgramMetadata` defining recommended subreddits, hashtags, default FTC disclosures, and call-to-action formatters.
- **`registry.ts`**: Extensible registry supporting:
  - `credit_card`: Credit card signup bonuses with FTC financial disclosures.
  - `shopping`: Cash back and rebate portals (Rakuten, TopCashback).
  - `banking`: High-yield savings accounts and checking bonuses.
  - `dining`: Restaurant rewards and meal delivery services.
  - `custom`: Generic custom program definitions.

### 3. Template & Personalization Subsystem (`src/templates/`)
- **`engine.ts`**: Transforms structured referral metadata into human, authentic community posts.
  - **Tone Variations**: Rotates across `story`, `informative`, `deal_alert`, and `comparison`.
  - **Anecdote Injection**: Prioritizes per-link custom anecdotes (`personalAnecdote`), then user-level philosophy (`defaultAnecdote`), and finally sensible fallbacks.
  - **Compliance Injection**: Automatically appends FTC referral disclosures when enabled.
  - **Platform-Specific Formatting**:
    - *Twitter*: Strict 280-character budget with `#ad` hashtag preservation.
    - *Bluesky*: 300-character budget.
    - *Discord*: Rich markdown formatting with bolding and dividers.
    - *Reddit*: Markdown headers (`###`), lists, and dividers (`---`).
    - *Facebook*: Plain-text sanitization (strips markdown asterisks, hashes, and promotional emojis).

### 4. Core Execution Engine (`src/core/`)
- **`engine.ts` (`ReferralRepeaterEngine`)**: The central coordinator.
  - Checks 24-hour rate limits (`maxPostsPerDay`) before cycle execution.
  - Evaluates active platforms from `PlatformRegistry`.
  - Filters eligible links against `linkCooldownHours` and platform target allowances.
  - Selects and rotates post tone.
  - Coordinates adapter execution and feeds results into audit logging.
- **`scheduler.ts` (`AutonomousScheduler`)**:
  - Wraps `node-cron` with randomized jitter delay (`calculateJitterMs`) between 0 and `jitterMinutes` to avoid robotic, detectable timing patterns.
- **`history.ts` (`HistoryTracker`)**:
  - Manages `.data/history.json`.
  - Computes post counts within the last 24 hours.
  - Checks if a specific link is cooling down on a specific platform.
- **`logger.ts` (`Logger`)**:
  - Renders ANSI-colored visual preview boxes (`previewBox`) for simulated and live dispatches.
  - Appends plain text to `logs/referral-repeater.log`.

### 5. Platform Adapter Subsystem (`src/platforms/`)
- **`base.ts` (`BasePlatformAdapter`)**: Common base class with abstract methods (`validateCredentials`, `post`) and standard simulator payload generators (`createSimulatedResult`, `createErrorResult`).
- **`registry.ts` (`PlatformRegistry`)**: Manages the lifecycle of active platform adapters, instantiating only enabled adapters according to global and per-platform dry-run configurations.

---

## Architectural Patterns Employed

1. **Adapter Pattern**: Standardizes communication across distinct social network APIs behind `BasePlatformAdapter`.
2. **Registry Pattern**: Centralizes discovery and configuration of platform adapters (`PlatformRegistry`) and referral program categories (`ProgramRegistry`).
3. **Strategy / Template Method Pattern**: `TemplateEngine` uses platform strategies to apply distinct character budgeting and syntax rules.
4. **Fail-Safe Defaults**:
   - `dryRun: true` is hardcoded as default in all schemas and loaders.
   - Live dispatch requires both `dryRun: false` and the explicit `--live` CLI flag.
