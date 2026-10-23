---
phase: "01"
slug: "concurrency-state-reliability"
status: draft
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-23"
---

# Phase 01 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.0.6 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- tests/history.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/history.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | LOCK-01 | T-01-01 | Proper-lockfile dependency installation and error type scaffolding | unit | `npm test -- tests/history.test.ts` | Yes | ⏳ pending |
| 01-01-02 | 01 | 1 | LOCK-01 | T-01-02 | Atomic temp-file write, atomic rename, and orphaned temp cleanup | unit | `npm test -- tests/history.test.ts` | Yes | ⏳ pending |
| 01-01-03 | 01 | 1 | LOCK-01 | T-01-03 | Lock acquisition with backoff retry, stale handling, and mtime cache freshness | unit | `npm test -- tests/history.test.ts` | Yes | ⏳ pending |
| 01-01-04 | 01 | 1 | LOCK-01 | T-01-04 | Mutating async transition across engine and CLI callers | integration | `npm test` | Yes | ⏳ pending |
| 01-02-01 | 02 | 2 | LOCK-02 | T-01-05 | 20-50 concurrent parallel writes stress test in Vitest | stress | `npm test -- tests/history.test.ts` | Yes | ⏳ pending |
| 01-02-02 | 02 | 2 | LOCK-02 | T-01-06 | Lock timeout error verification and artificial starvation testing | unit | `npm test -- tests/history.test.ts` | Yes | ⏳ pending |
| 01-02-03 | 02 | 2 | LOCK-02 | T-01-07 | External file deletion recovery and disk sync resilience | unit | `npm test -- tests/history.test.ts` | Yes | ⏳ pending |

*Status: ⏳ pending · 🟢 green · 🔴 red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements (`tests/history.test.ts` and `vitest.config.ts` are already active).

---

## Manual-Only Verifications

All phase behaviors have automated verification via Vitest.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending 2026-10-23
