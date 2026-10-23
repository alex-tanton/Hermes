---
phase: "04"
slug: "production-daemon-packaging"
status: complete
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-23"
---

# Phase 04 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.0.6 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- tests/packaging.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~3.5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/packaging.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | PROD-01 | Multi-stage Dockerfile and .dockerignore configuration | unit / spec | `npm test -- tests/packaging.test.ts` | Yes | 🟢 green |
| 04-01-02 | 01 | 1 | PROD-01 | docker-compose.yml configuration with volume mounts & restart | unit / spec | `npm test -- tests/packaging.test.ts` | Yes | 🟢 green |
| 04-01-03 | 01 | 1 | PROD-02 | PM2 ecosystem.config.cjs & systemd service unit template | unit / spec | `npm test -- tests/packaging.test.ts` | Yes | 🟢 green |
| 04-02-01 | 02 | 2 | PROD-03 | INSTALL.md container & process manager deployment documentation | unit / doc | `npm run lint` & `npm run format:check` | Yes | 🟢 green |
| 04-02-02 | 02 | 2 | PROD-01, PROD-02, PROD-03 | End-to-end milestone regression & packaging integration verification | integration | `npm test` | Yes | 🟢 green |

*Status: ⏳ pending · 🟢 green · 🔴 red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing test infrastructure in Vitest with `yaml` parser handles YAML validation. No new third-party test runners or dependencies needed.

---

## Manual-Only Verifications

Optional local Docker build testing if Docker daemon is available (`docker compose config`). Deterministic CI validation is handled via automated tests in `tests/packaging.test.ts`.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 🟢 verified 2026-10-23
