# Phase 03: Advanced Scheduling & Rotation - Research

**Phase:** 03-advanced-scheduling-rotation  
**Domain:** Rate limiting, per-platform scheduling, round-robin & priority-weighted rotation, Twitter character budgeting (`t.co`)  
**Confidence:** HIGH  
**Date:** 2026-10-23  

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **ROT-01** | Support per-platform cooldown and daily cap overrides in `config.yaml` (e.g. Reddit 720h megathread cooldown vs Discord 12h cooldown). | Extend platform schemas in `src/config/schema.ts` and `src/types/index.ts` with optional `cooldownHours` and `maxPostsPerDay`. Update `HistoryTracker.getPostsInLast24Hours(platform?)` and `ReferralRepeaterEngine` to enforce per-platform limits alongside global defaults. |
| **ROT-02** | Replace first-match link selection with fair round-robin or priority-weighted rotation across eligible links. | Add optional `priority` (1-100, default 50) to `ReferralLink`. Extend `HistoryTracker` with `getLastPostTime(linkId, platform?)`. Sort eligible links by priority descending and then by last post time ascending (least recently used / oldest first), ensuring zero starvation and stateless fair rotation across restarts. |
| **ROT-03** | Fix URL length budget on Twitter to treat links as fixed 23 characters (`t.co` standard) to prevent unnecessary body truncation. | Update `TemplateEngine` character budgeting for Twitter: calculate tweet character count treating any URL as 23 characters (Twitter API v2 / RFC standard) rather than raw URL string length, preventing premature truncation when referral links exceed 50-100 characters. |
</phase_requirements>

---

## Executive Summary

In v1.0 and Phase 2, `ReferralRepeaterEngine` relied on global scheduling parameters: `schedule.linkCooldownHours` (default 24h) and `schedule.maxPostsPerDay` (default 10). However, real social platforms have radically different community rules and rate constraints:
- Subreddits with monthly referral threads (e.g., r/churning) require a **720-hour (30-day)** cooldown and a limit of **1 post per day** (or month).
- Discord channels or Bluesky feeds permit frequent updates with a **12-hour** cooldown and **6 posts per day**.
- Twitter v2 applies an automatic URL shortener (`t.co`) that counts any HTTP/HTTPS URL as exactly **23 characters** regardless of whether the raw link is 30 characters or 120 characters long. Treating URLs with raw length causes severe truncation of tweet text.
- Link selection in `ReferralRepeaterEngine.getEligibleLinks` previously picked `eligibleLinks[0]`, which was always the first link in `config.referralLinks`. When multiple links were eligible, links later in the array were starved.

Phase 3 introduces granular per-platform scheduling, fair round-robin rotation powered by historical post timestamps, priority weighting, and accurate Twitter `t.co` length budgeting.

---

## Architecture & Implementation Strategy

### 1. Granular Per-Platform Cooldowns & Daily Caps (ROT-01)

#### Configuration & Schema Extensions
In `src/types/index.ts` and `src/config/schema.ts`:
Every platform configuration (`RedditConfig`, `FacebookConfig`, `BlueskyConfig`, `DiscordConfig`, `TwitterConfig`) gains optional fields:
```typescript
cooldownHours?: number;   // Override schedule.linkCooldownHours for this platform
maxPostsPerDay?: number;  // Override schedule.maxPostsPerDay for this platform
```

#### HistoryTracker Platform Filtering
In `src/core/history.ts`:
Extend `getPostsInLast24Hours(platform?: PlatformType): number`:
```typescript
public getPostsInLast24Hours(platform?: PlatformType): number {
  this.syncFromDiskIfModified();
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return this.entries.filter(
    (e) =>
      (!platform || e.platform === platform) &&
      new Date(e.timestamp).getTime() >= oneDayAgo &&
      e.status !== 'failed',
  ).length;
}
```

#### Engine Enforcement
In `src/core/engine.ts`:
1. In `getEligibleLinks(platform, options)`:
   - Determine `effectiveCooldown = platformConfig?.cooldownHours ?? this.config.schedule.linkCooldownHours`.
   - Pass `effectiveCooldown` to `this.history.isCoolingDown(link.id, platform, effectiveCooldown)`.
2. In `executeCycle(options)`:
   - Check global `maxPostsPerDay` first.
   - For each platform in `activePlatforms`:
     - If `platformConfig.maxPostsPerDay` is defined:
       - Check `this.history.getPostsInLast24Hours(platform)`.
       - If platform posts >= platform max, log info/warn and skip this platform without halting other platforms!

---

### 2. Fair Round-Robin & Priority-Weighted Rotation (ROT-02)

#### ReferralLink Priority
In `ReferralLinkSchema`:
```typescript
priority: z.number().min(1).max(100).default(50).optional(),
```
Higher numbers denote higher priority (e.g., 100 = hero offer, 50 = standard offer, 10 = low priority).

#### HistoryTracker Last Post Timestamp
In `src/core/history.ts`:
```typescript
public getLastPostTime(linkId: string, platform?: PlatformType): number | undefined {
  this.syncFromDiskIfModified();
  const entry = this.entries.find(
    (e) =>
      e.linkId === linkId &&
      (!platform || e.platform === platform) &&
      e.status !== 'failed',
  );
  return entry ? new Date(entry.timestamp).getTime() : undefined;
}
```

#### Sorting in `getEligibleLinks`
```typescript
const eligible = this.config.referralLinks
  .filter((link) => link.enabled)
  .filter(...) // category, platform, and cooldown filters

return eligible.sort((a, b) => {
  const priorityA = a.priority ?? 50;
  const priorityB = b.priority ?? 50;
  if (priorityA !== priorityB) {
    return priorityB - priorityA; // Higher priority first
  }
  const lastA = this.history.getLastPostTime(a.id, platform) ?? 0;
  const lastB = this.history.getLastPostTime(b.id, platform) ?? 0;
  return lastA - lastB; // Least recently posted (or never posted) first -> fair rotation
});
```

Benefits:
- **Stateless across process restarts:** State is derived directly from `.data/history.json`.
- **Zero starvation:** When links share the same priority, they rotate in strict least-recently-posted order.
- **Priority respect:** High-priority cards are always preferred when out of cooldown, but yield cleanly to secondary cards when cooling down.

---

### 3. Twitter URL Budgeting & `t.co` Standard (ROT-03)

#### Twitter Character Counting Standard
Twitter shortens all URLs to `https://t.co/...` which consumes exactly **23 characters** regardless of URL length.
When composing a tweet:
`charCount = (text_without_urls).length + (number_of_urls * 23)`

#### TemplateEngine Adjustments
In `src/templates/engine.ts`:
When formatting for Twitter:
```typescript
case 'twitter': {
  return this.fitToLength({
    primaryText: title,
    url,
    disclosure: disclosure ? ' #ad' : '',
    tags: tags.slice(0, 2).join(' '),
    maxLength: 280,
    urlLengthWeight: 23, // t.co standard
  });
}
```

In `fitToLength`:
```typescript
private fitToLength(params: {
  primaryText: string;
  url: string;
  disclosure: string;
  tags: string;
  maxLength: number;
  urlLengthWeight?: number;
}): string {
  const { primaryText, url, disclosure, tags, maxLength, urlLengthWeight } = params;
  const effectiveUrlLength = urlLengthWeight !== undefined ? urlLengthWeight : url.length;
  const nonUrlSuffix = `${disclosure} ${tags}`.trim();
  // Suffix length budget: newline (1) + effectiveUrlLength + optional space/text
  const suffixBudget = 1 + effectiveUrlLength + (nonUrlSuffix ? 1 + nonUrlSuffix.length : 0);
  const availableForText = maxLength - suffixBudget - 4; // safety margin
  ...
}
```

Also provide utility `calculateTwitterLength(text: string): number` that counts URLs as 23 characters to validate against 280 characters in tests.

---

## Validation Strategy

1. **Unit tests in `tests/engine.test.ts`**:
   - Per-platform cooldown override (e.g. 720h vs 12h)
   - Per-platform daily post limit (blocks single platform when capped while permitting others)
   - Fair round-robin rotation across multiple links
   - Priority-weighted link selection
2. **Unit tests in `tests/template.test.ts`**:
   - Long URL (100+ chars) on Twitter does not truncate title prematurely
   - Twitter weighted length strictly <= 280
3. **Full test suite**:
   - All existing 94 tests continue passing with zero regressions.
