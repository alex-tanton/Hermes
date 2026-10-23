# Project Requirements

## Status Legend
- `[x]` Completed & Verified
- `[ ]` Planned for Active Milestone (v1.1)

---

## Baseline Requirements (v1.0 — Completed)

### Core & Orchestration
- [x] **CORE-01**: Define strict Zod schema for `config.yaml` (`AppConfigSchema`) validating general settings, schedule, platforms, and referral links.
- [x] **CORE-02**: Implement environment variable substitution `${ENV_VAR}` and `${ENV_VAR:-default}` in YAML loader.
- [x] **CORE-03**: Create `ReferralRepeaterEngine` orchestrating distribution cycles with 24-hour daily post limits.
- [x] **CORE-04**: Build `AutonomousScheduler` supporting standard 5-field cron syntax and randomized anti-bot jitter.
- [x] **CORE-05**: Implement `HistoryTracker` local JSON audit store at `.data/history.json` tracking timestamps, cooldowns, and platform stats.
- [x] **CORE-06**: Provide `Logger` with colored preview boxes and file output at `logs/referral-repeater.log`.

### Content & Personalization
- [x] **TEMP-01**: Provide multi-tone message generation (`story`, `informative`, `deal_alert`, `comparison`).
- [x] **TEMP-02**: Inject personal anecdotes from links or user philosophy defaults.
- [x] **TEMP-03**: Enforce FTC referral disclosure compliance (16 CFR Part 255) with opt-out toggle.
- [x] **TEMP-04**: Platform formatting engine supporting Twitter 280-char limit, Bluesky 300-char limit, Discord markdown, Reddit markdown, and Facebook plain text.
- [x] **PROG-01**: Support built-in categories: `credit_card`, `shopping`, `banking`, `dining`, and `custom`.

### CLI & Usability
- [x] **CLI-01**: Interactive setup wizard (`npm run setup` / `referral-repeater init`) powered by `@inquirer/prompts`.
- [x] **CLI-02**: Immediate manual cycle runner (`referral-repeater post`) with `--dry-run`, `--live`, `--force`, `--platform`, `--category`, and `--tone` flags.
- [x] **CLI-03**: Background daemon runner (`referral-repeater daemon`) with graceful signal handling.
- [x] **CLI-04**: Health and configuration validator (`referral-repeater validate`).
- [x] **CLI-05**: Audit history viewer and cache clearing (`referral-repeater history`).

---

## Active Milestone Requirements (v1.1 — Live Distribution & Hardening)

### Phase 1: Concurrency & State Reliability
- [ ] **LOCK-01**: Implement atomic file locking (or lockfile mutex) for `.data/history.json` to prevent race conditions during concurrent daemon and CLI runs.
- [ ] **LOCK-02**: Add automated unit tests verifying concurrent access resilience and graceful handling of lock timeouts.

### Phase 2: Live Platform Network Dispatches
- [ ] **LIVE-01**: Implement real HTTP `fetch` dispatch for `DiscordAdapter` using incoming webhook URLs.
- [ ] **LIVE-02**: Implement live XRPC / AT Protocol dispatch for `BlueskyAdapter` using handle authentication and app passwords.
- [ ] **LIVE-03**: Implement live Reddit API dispatch for `RedditAdapter` with OAuth2 authentication for posts and comments.
- [ ] **LIVE-04**: Implement live Twitter/X API v2 dispatch for `TwitterAdapter` with OAuth signatures.
- [ ] **LIVE-05**: Implement live Graph API dispatch for `FacebookAdapter`.
- [ ] **LIVE-06**: Verify that all live network calls fail safely back to structured error results when offline or given invalid tokens, without uncaught exceptions.

### Phase 3: Advanced Scheduling & Rotation
- [ ] **ROT-01**: Support per-platform cooldown and daily cap overrides in `config.yaml` (e.g. Reddit 720h megathread cooldown vs Discord 12h cooldown).
- [ ] **ROT-02**: Replace first-match link selection with fair round-robin or priority-weighted rotation across eligible links.
- [ ] **ROT-03**: Fix URL length budget on Twitter to treat links as fixed 23 characters (`t.co` standard) to prevent unnecessary body truncation.

### Phase 4: Production Daemon Packaging
- [ ] **PROD-01**: Create lightweight multi-stage `Dockerfile` and `docker-compose.yml` for containerized background execution.
- [ ] **PROD-02**: Provide ready-to-use PM2 `ecosystem.config.cjs` and Linux `systemd` unit files for unattended 24/7 server hosting.
- [ ] **PROD-03**: Update `INSTALL.md` with containerized and process-managed deployment instructions.
