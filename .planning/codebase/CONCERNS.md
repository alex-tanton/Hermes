# Technical Concerns, Risks & Gaps

## Overview
This document catalogs architectural bottlenecks, security considerations, technical debt, and implementation gaps discovered during codebase mapping.

---

## High Priority Concerns

### 1. Live Platform API Implementations Are Currently Stubs
- **Location**: `src/platforms/reddit.ts`, `src/platforms/discord.ts`, `src/platforms/bluesky.ts`, `src/platforms/facebook.ts`, `src/platforms/twitter.ts`
- **Issue**: While credential validation and simulation modes are complete, all five adapters currently stub out live API requests:
  ```typescript
  // Example from src/platforms/reddit.ts:
  const livePostId = `t3_${Date.now()}`;
  return {
    success: true,
    platform: this.name,
    linkId: payload.referralLink.id,
    postId: livePostId,
    ...
  };
  ```
- **Impact**: Passing `--live` currently returns mock success IDs rather than dispatching actual network calls to Reddit, Discord, Bluesky, Facebook, or Twitter.
- **Recommended Action**: Implement native HTTP `fetch` or official SDKs:
  - Discord: Simple `fetch(webhookUrl, { method: 'POST', body: JSON.stringify({ content }) })`
  - Bluesky: XRPC call `com.atproto.repo.createRecord` via `@atproto/api` or direct HTTPS
  - Reddit: OAuth2 password/script grant flow followed by `/api/submit` and `/api/comment`
  - Twitter: Twitter API v2 `/2/tweets` with OAuth 1.0a authorization headers
  - Facebook: Meta Graph API `/v18.0/{target_id}/feed`

---

## Medium Priority Concerns

### 2. Concurrency & File Lock Contention on `.data/history.json`
- **Location**: `src/core/history.ts`
- **Issue**: `HistoryTracker` uses synchronous `fs.readFileSync` and `fs.writeFileSync` without file locking.
- **Impact**: If the autonomous scheduler (`npm run daemon`) is active in the background and a user simultaneously triggers a manual cycle (`npm run post`) or inspects history (`npm run history --clear`), history entries could be overwritten or corrupted due to race conditions.
- **Recommended Action**: Introduce atomic file writes or lightweight lockfiles (e.g. `proper-lockfile` or atomic write via temporary file replacement).

### 3. URL Length vs Platform Character Budgeting
- **Location**: `src/templates/engine.ts` (`fitToLength`)
- **Issue**: Twitter and Bluesky character calculators subtract `url.length` from the maximum length. On Twitter/X, all URLs are automatically converted to `t.co` links consuming a fixed 23 characters regardless of input length.
- **Impact**: Referral links with long query tracking parameters (e.g. `https://www.referyourchasecard.com/18s/FIG0CQ5GP4?...`) get over-penalized, prematurely truncating the body text.
- **Recommended Action**: Account for fixed URL length (23 characters for Twitter) in `fitToLength()`.

### 4. Link Selection Starvation
- **Location**: `src/core/engine.ts` (`executeCycle`)
- **Issue**: When multiple referral links are eligible for a platform, `executeCycle` selects `eligibleLinks[0]`.
- **Impact**: While 24-hour cooldown prevents the same link from being selected again immediately, links positioned earlier in `config.yaml` always receive priority over subsequent links. If posts occur infrequently, later links may starve.
- **Recommended Action**: Implement round-robin state tracking or weighted random distribution among eligible links.

---

## Low Priority / Operational Considerations

### 5. Daemon Process Lifecycle & Supervision
- **Location**: `src/cli/commands/daemon.ts`
- **Issue**: The daemon runs directly in the terminal process. It does not provide built-in process daemonization (forking) or automatic restart on unhandled exceptions.
- **Impact**: In server deployments, terminal closure terminates the scheduler unless an external supervisor like PM2 or systemd is used.
- **Recommended Action**: Document systemd and PM2 service definitions in `INSTALL.md`.

### 6. Platform-Specific Rate Limit Granularity
- **Location**: `src/config/schema.ts`, `src/core/engine.ts`
- **Issue**: `maxPostsPerDay` is a global ceiling across all platforms combined, and `linkCooldownHours` is a single shared duration.
- **Impact**: Different platforms have radically different spam tolerance: Discord channels can tolerate daily posts, whereas Reddit subreddits often enforce monthly megathread rules.
- **Recommended Action**: Allow optional per-platform overrides for cooldowns and daily post limits in `config.yaml`.
