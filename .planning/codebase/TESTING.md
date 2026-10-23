# Testing Strategy & Test Suite Map

## Overview
Referral-Repeater utilizes **Vitest 3.0.6** for high-performance unit and integration testing. All 7 test suites (44 total unit tests) execute with 100% pass rates in `< 100ms` of test runtime.

---

## Test Configuration (`vitest.config.ts`)
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

---

## Test Suites Breakdown

| Test File | Test Count | Domain Covered | Key Test Cases |
| :--- | :--- | :--- | :--- |
| `tests/config.test.ts` | 8 | Configuration & Env | Schema validation, default fallbacks, URL validation, `${ENV_VAR}` and `${ENV_VAR:-default}` recursive string/array/object resolution |
| `tests/engine.test.ts` | 5 | Distribution Engine | Safe dry-run execution, per-link cooldown enforcement, daily post limit ceiling, force bypass, tone rotation |
| `tests/history.test.ts` | 7 | Audit & Persistence | Isolated test JSON store, 24-hour window post counts, cooldown calculations, stats aggregation, cache clearing |
| `tests/platforms.test.ts` | 7 | Platform Adapters | Credential validation (Reddit, Discord, Bluesky, Facebook, Twitter), simulator output, registry lifecycle |
| `tests/programs.test.ts` | 4 | Program Registry | Default category retrieval, fallback to `custom`, programmatic runtime registration, category emoji formatting |
| `tests/scheduler.test.ts` | 4 | Autonomous Scheduler | Cron validation, daemon start/stop lifecycle, malformed cron rejection, anti-bot jitter calculation within `jitterMinutes` |
| `tests/template.test.ts` | 9 | Content Generation | Personal anecdote precedence, FTC disclosure insertion/suppression, tone variations, Twitter 280-char clipping, Bluesky 300-char clipping, Reddit markdown, Facebook plain-text stripping |

---

## Running Tests

### Standard Test Execution
```bash
npm test
```

### Watch Mode (Development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

---

## Mocking & Isolation Strategy

1. **History Isolation**:
   - Tests instantiate `new HistoryTracker(testPath)` pointing to `.data/engine-test-history.json` or similar test files, ensuring tests never pollute production or user `.data/history.json`.
   - Cleanup handlers (`afterEach`) remove temporary files automatically.
2. **Network Isolation**:
   - All tests run strictly with `dryRun: true`.
   - No real network requests are issued during testing.
3. **Timer & Delay Mocking**:
   - Jitter calculations test math bounds directly without blocking test execution on `sleep()`.
