---
phase: "03"
slug: "advanced-scheduling-rotation"
status: draft
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-23"
---

# Phase 03 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.0.6 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- tests/engine.test.ts tests/template.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~3.5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/engine.test.ts` or `npm test -- tests/template.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | ROT-01, ROT-02 | Schema validation & HistoryTracker platform queries | unit | `npm test -- tests/engine.test.ts` | Yes | ⏳ pending |
| 03-01-02 | 01 | 1 | ROT-01 | Granular per-platform cooldown & daily cap enforcement | unit | `npm test -- tests/engine.test.ts` | Yes | ⏳ pending |
| 03-01-03 | 01 | 1 | ROT-02 | Fair round-robin & priority-weighted rotation without starvation | unit | `npm test -- tests/engine.test.ts` | Yes | ⏳ pending |
| 03-02-01 | 02 | 2 | ROT-03 | Twitter 23-char fixed URL budgeting (`t.co`) without premature truncation | unit | `npm test -- tests/template.test.ts` | Yes | ⏳ pending |
| 03-02-02 | 02 | 2 | ROT-01, ROT-02, ROT-03 | Configuration examples and documentation synchronization | unit / doc | `npm test` | Yes | ⏳ pending |

*Status: ⏳ pending · 🟢 green · 🔴 red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing test infrastructure in `tests/engine.test.ts` and `tests/template.test.ts` covers the test harness. No new dependencies or test runners needed.

---

## Manual-Only Verifications

None. All scheduling calculations, priority weighting, rate limit throttling, and Twitter character budgeting are verified deterministically in automated unit tests.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending 2026-10-23
