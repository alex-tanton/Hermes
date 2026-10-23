---
phase: "02"
slug: "live-platform-network-dispatches"
status: draft
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-23"
---

# Phase 02 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.0.6 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- tests/platforms.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~3.5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/platforms.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | LIVE-01, LIVE-06 | T-02-01 | Discord webhook live HTTP dispatch with timeout & error trapping | unit | `npm test -- tests/platforms.test.ts` | Yes | ⏳ pending |
| 02-01-02 | 01 | 1 | LIVE-02, LIVE-06 | T-02-02 | Bluesky XRPC session auth and post record creation | unit | `npm test -- tests/platforms.test.ts` | Yes | ⏳ pending |
| 02-01-03 | 01 | 1 | LIVE-05, LIVE-06 | T-02-03 | Facebook Graph API feed dispatch with error recovery | unit | `npm test -- tests/platforms.test.ts` | Yes | ⏳ pending |
| 02-01-04 | 01 | 1 | LIVE-04 | T-02-04 | Node crypto OAuth 1.0a HMAC-SHA1 signature generator | unit | `npm test -- tests/platforms.test.ts` | Yes | ⏳ pending |
| 02-02-01 | 02 | 2 | LIVE-03, LIVE-06 | T-02-05 | Reddit OAuth2 token exchange and submission/comment endpoints | unit | `npm test -- tests/platforms.test.ts` | Yes | ⏳ pending |
| 02-02-02 | 02 | 2 | LIVE-04, LIVE-06 | T-02-06 | Twitter/X API v2 tweet creation with OAuth 1.0a headers | unit | `npm test -- tests/platforms.test.ts` | Yes | ⏳ pending |
| 02-02-03 | 02 | 2 | LIVE-06 | T-02-07 | Resilience suite: timeout, offline DNS failure, 401, 429 rate limit across all adapters | unit / resilience | `npm test` | Yes | ⏳ pending |

*Status: ⏳ pending · 🟢 green · 🔴 red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing test infrastructure in `tests/platforms.test.ts` covers the test harness. No new dependencies or test runners needed.

---

## Manual-Only Verifications

All live network interactions are mocked deterministically via `vi.spyOn(globalThis, 'fetch')` in automated unit tests. Real live API dispatches against personal platform accounts are gated behind `--live` and user credentials.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending 2026-10-23
