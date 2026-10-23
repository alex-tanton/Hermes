# Project Roadmap

## Active Milestone: v1.1 — Live Distribution & Hardening

```
+-----------------------------------------------------------------------------------+
| Phase 1: Concurrency & State Reliability (Atomic file locking, lockfile mutex)    |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| Phase 2: Live Platform Dispatches (Discord, Bluesky, Reddit, Twitter, Facebook)   |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| Phase 3: Advanced Scheduling & Rotation (Granular cooldowns, fair rotation, t.co) |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| Phase 4: Production Daemon Packaging (Docker, docker-compose, PM2, systemd)       |
+-----------------------------------------------------------------------------------+
```

---

## Phase Breakdown

### Phase 1: Concurrency & State Reliability
- **Goal**: Protect `.data/history.json` against race conditions and state corruption when daemon and CLI commands run in parallel.
- **Scope**:
  - Implement atomic file writing and cross-process file locking for `HistoryTracker`.
  - Add lock retry and configurable timeout handling.
  - Unit tests simulating concurrent file operations.
- **Dependencies**: None.
- **Requirements Satisfied**: `LOCK-01`, `LOCK-02`

### Phase 2: Live Platform Network Dispatches
- **Goal**: Replace mock/stub live dispatch logic with real network API requests across all enabled platforms.
- **Scope**:
  - Discord Webhook: HTTP POST dispatch with markdown payload.
  - Bluesky: AT Protocol session creation and post record commit.
  - Reddit: OAuth2 password flow and submission/comment endpoints.
  - Twitter / X: OAuth 1.0a signed request to v2 tweets endpoint.
  - Facebook: Meta Graph API feed post.
  - Defensive error handling to ensure network timeouts or API rejections return structured `PostResult` failures without crashing.
- **Dependencies**: Phase 1
- **Requirements Satisfied**: `LIVE-01`, `LIVE-02`, `LIVE-03`, `LIVE-04`, `LIVE-05`, `LIVE-06`

### Phase 3: Advanced Scheduling & Rotation
- **Goal**: Enable fine-grained rate limits tailored to individual platform community guidelines and ensure fair link rotation.
- **Scope**:
  - Update `schema.ts` to allow optional per-platform `cooldownHours` and `maxPostsPerDay`.
  - Implement round-robin or priority-weighted rotation in `ReferralRepeaterEngine.getEligibleLinks`.
  - Refine Twitter character length budgeting to treat URLs as fixed 23 characters (`t.co` standard).
  - Update unit tests in `engine.test.ts` and `template.test.ts`.
- **Dependencies**: Phase 2
- **Requirements Satisfied**: `ROT-01`, `ROT-02`, `ROT-03`

### Phase 4: Production Daemon Packaging
- **Goal**: Provide out-of-the-box infrastructure assets for continuous, unattended 24/7 background operation.
- **Scope**:
  - Multi-stage `Dockerfile` and `docker-compose.yml` mounting `./config.yaml` and `./.data`.
  - PM2 configuration (`ecosystem.config.cjs`) with auto-restart on memory limits.
  - Linux `systemd` service unit file template.
  - Expanded deployment and production monitoring guide in `INSTALL.md`.
- **Dependencies**: Phase 3
- **Requirements Satisfied**: `PROD-01`, `PROD-02`, `PROD-03`

---

## Milestone History

- **v1.0 (Baseline Complete)**: Architecture, core engine, AST validation, interactive wizard, dry-run simulation, FTC disclosures, tone engine, and 44 unit tests.
