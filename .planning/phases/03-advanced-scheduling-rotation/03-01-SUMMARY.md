---
phase: 03-advanced-scheduling-rotation
plan: 01
status: complete
completed_at: "2026-10-23T17:05:00.000Z"
requirements:
  - ROT-01
  - ROT-02
files_modified:
  - src/types/index.ts
  - src/config/schema.ts
  - src/core/history.ts
  - src/core/engine.ts
  - tests/engine.test.ts
---

# Plan 03-01 Summary: Per-Platform Limits and Fair Priority Rotation

## Accomplishments

1. **Per-Platform Rate Limiting Schemas & Types (ROT-01)**:
   - Added `priority?: number` (min 1, max 100, default 50) to `ReferralLink` and `ReferralLinkSchema`.
   - Added optional `cooldownHours?: number` and `maxPostsPerDay?: number` to `RedditConfig`, `FacebookConfig`, `BlueskyConfig`, `DiscordConfig`, and `TwitterConfig` and their Zod schemas.

2. **HistoryTracker Query Enhancements**:
   - Updated `getPostsInLast24Hours(platform?: PlatformType)` to filter by platform.
   - Added `getLastPostTime(linkId: string, platform?: PlatformType)` returning Unix timestamp of most recent successful post.

3. **Engine Per-Platform Throttling & Fair Link Rotation (ROT-01, ROT-02)**:
   - Updated `ReferralRepeaterEngine.getEligibleLinks` to use platform-specific `cooldownHours` fallback to `schedule.linkCooldownHours`.
   - Updated `ReferralRepeaterEngine.executeCycle` to check per-platform `maxPostsPerDay`, skipping throttled platforms without interrupting cycle for others.
   - Implemented deterministic sorting in `getEligibleLinks`: highest priority first (descending), followed by least-recently-posted first (ascending lastPostTime / round-robin) to eliminate link starvation.

4. **Verification**:
   - Comprehensive unit tests in `tests/engine.test.ts` verifying independent platform limits and fair link selection.
   - All tests pass cleanly.
