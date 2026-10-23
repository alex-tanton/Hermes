# Phase 01: Concurrency & State Reliability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-10-23
**Phase:** 01-concurrency-state-reliability
**Areas discussed:** File Locking Strategy, Write Atomicity & Durability, Read Freshness & In-Memory Sync, Contention & Timeout Policy

---

## File Locking Strategy

| Option | Description | Selected |
|--------|-------------|:--------:|
| Use 'proper-lockfile' npm package | Battle-tested cross-platform solution with robust PID checking, stale lock expiration, and symlink/directory locks. | X |
| Custom zero-dependency lockfile | Lightweight native implementation using node:fs open with 'wx' flag and PID tracking to keep zero external dependencies. | |
| You decide | Pick whichever provides the highest reliability with minimal maintenance footprint. | |

**User's choice:** Use 'proper-lockfile' npm package
**Notes:** Battle-tested cross-platform solution with robust PID checking, stale lock expiration, and symlink/directory locks.

| Option | Description | Selected |
|--------|-------------|:--------:|
| Mutation-scoped locking | Acquire lock only during mutating operations (record, clear, save) to keep read queries fast and non-blocking. | X |
| Full lock acquisition on every operation | Lock during both reads (isCoolingDown, stats) and writes to enforce strict sequential consistency. | |
| You decide | Choose the model that balances strict data integrity with daemon loop performance. | |

**User's choice:** Mutation-scoped locking
**Notes:** Non-mutating read queries (isCoolingDown, getPostsInLast24Hours) remain fast and lock-free.

| Option | Description | Selected |
|--------|-------------|:--------:|
| Make mutating methods async (async record, async clear) | Non-blocking event loop during lock contention; fits existing async engine and CLI runners. | X |
| Keep synchronous signatures using lockSync | Preserves current sync API, but blocks the Node.js event loop thread during retries. | |
| You decide | Choose the approach that best fits TypeScript ESM and Node.js best practices. | |

**User's choice:** Make mutating methods async (async record, async clear)
**Notes:** Non-blocking event loop during lock contention; fits existing async engine and CLI runners.

| Option | Description | Selected |
|--------|-------------|:--------:|
| Exit handlers + stale timeout (10s) | Release locks on SIGINT/SIGTERM while using proper-lockfile stale duration to automatically recover from hard crashes/SIGKILL. | X |
| Stale timeout detection only | Rely purely on lockfile age without registering global process signal handlers. | |
| You decide | Balance clean shutdown hygiene with minimal global side effects. | |

**User's choice:** Exit handlers + stale timeout (10s)
**Notes:** Graceful cleanups on shutdown signals, with automatic 10s fallback for abrupt terminations.

---

## Write Atomicity & Durability

| Option | Description | Selected |
|--------|-------------|:--------:|
| Temp file + atomic rename | Write to .data/history.json.tmp.{pid}.{timestamp} and atomically rename over history.json to prevent partial JSON truncation. | X |
| Direct write while holding lock | Trust lock exclusivity and write directly to history.json without temp files. | |
| Temp file + backup copy (.bak) | Create a backup copy before atomic replacement for maximum rollback safety. | |

**User's choice:** Temp file + atomic rename
**Notes:** Write to temporary unique file then atomic rename to prevent half-written/truncated JSON.

| Option | Description | Selected |
|--------|-------------|:--------:|
| Auto-cleanup on init & error | Clean up orphaned .tmp.* files on HistoryTracker initialization and in catch blocks. | X |
| Ignore temp files until manual history clear | Leave orphan temp files alone to avoid file system scanning overhead. | |
| You decide | Implement a tidy cleanup routine that doesn't impact startup latency. | |

**User's choice:** Auto-cleanup on init & error
**Notes:** Clean up orphaned temp files during initialization and in catch blocks.

| Option | Description | Selected |
|--------|-------------|:--------:|
| Keep 2-space pretty-printed JSON | Preserves human readability, easy debugging, and clean git diffs when inspected. | X |
| Compact unindented JSON | Saves disk bytes and serialization overhead at the cost of manual readability. | |
| You decide | Choose the standard that matches existing project conventions. | |

**User's choice:** Keep 2-space pretty-printed JSON
**Notes:** Preserves human readability, easy debugging, and clean git diffs.

| Option | Description | Selected |
|--------|-------------|:--------:|
| Throw custom HistoryStorageError | Propagate clear failure to caller and logger; never silently drop failed audit records. | X |
| Silently catch and log warning | Log warning to logger but allow post cycle to succeed without saving history. | |
| You decide | Choose the approach that best protects audit trail integrity. | |

**User's choice:** Throw custom HistoryStorageError
**Notes:** Typed error propagation to caller and logger; never silently drop failed audit records.

---

## Read Freshness & In-Memory Sync

| Option | Description | Selected |
|--------|-------------|:--------:|
| Check file mtime before reads | Check disk modified timestamp (fs.stat mtimeMs) before query methods; only re-parse JSON if another process modified the file. | X |
| Always re-read from disk on every query | Unconditionally read and parse history.json on every isCoolingDown/stats check. | |
| Reload only inside lock before writes | Keep in-memory cache for reads, but always re-read disk state inside lock before mutating. | |

**User's choice:** Check file mtime before reads
**Notes:** Stat mtime check (<0.1ms) ensures daemon always sees external CLI changes without redundant JSON parsing.

| Option | Description | Selected |
|--------|-------------|:--------:|
| Always re-read from disk inside the lock | Guarantees the process has the absolute latest entries before unshifting and saving, eliminating lost updates. | X |
| Use mtime check inside the lock | Only re-read inside the lock if disk mtime differs from cached mtime. | |
| You decide | Pick the safest merge pattern. | |

**User's choice:** Always re-read from disk inside the lock
**Notes:** Guarantees absolute latest entries before unshifting and saving, eliminating lost updates.

| Option | Description | Selected |
|--------|-------------|:--------:|
| Auto-recreate empty state | If history.json or .data is deleted, gracefully recreate the directory/file and reset in-memory entries to empty array. | X |
| Halt and throw error | Treat missing file during active runtime as an error requiring manual intervention. | |
| You decide | Choose the approach that minimizes unhandled crashes during server hosting. | |

**User's choice:** Auto-recreate empty state
**Notes:** Graceful recreation of missing storage files prevents unhandled crashes.

| Option | Description | Selected |
|--------|-------------|:--------:|
| Keep read methods synchronous | Use fast statSync (<0.1ms) for mtime check; keeps evaluation loops and template checks simple and non-Promise. | X |
| Convert all read methods to async | Uniform async API across entire HistoryTracker class; requires await on isCoolingDown and stats. | |
| You decide | Balance ergonomics with architectural consistency. | |

**User's choice:** Keep read methods synchronous
**Notes:** Preserves simple synchronous evaluation in engine loops and CLI displays.

---

## Contention & Timeout Policy

| Option | Description | Selected |
|--------|-------------|:--------:|
| Exponential backoff with random jitter | Base delay ~50ms, multiplier 1.5, max 250ms with jitter to prevent lockstep retry collisions. | X |
| Fixed polling interval | Simple constant interval (e.g. check every 100ms) until lock is acquired or timeout expires. | |
| You decide | Choose the retry schedule that best avoids CPU spin while acquiring quickly. | |

**User's choice:** Exponential backoff with random jitter
**Notes:** Base delay ~50ms, multiplier 1.5, max 250ms with randomized jitter.

| Option | Description | Selected |
|--------|-------------|:--------:|
| 5,000ms (5s) timeout | Generous buffer for filesystem operations and Docker mounts without hanging CLI users indefinitely. | X |
| 10,000ms (10s) timeout | Extended tolerance for resource-constrained or heavily loaded environments. | |
| 2,000ms (2s) timeout | Fast fail if lock cannot be acquired quickly. | |

**User's choice:** 5,000ms (5s) timeout
**Notes:** Generous buffer for disk operations without hanging CLI processes.

| Option | Description | Selected |
|--------|-------------|:--------:|
| Throw LockTimeoutError with diagnostic hint | Explain that another process holds the lock and advise inspecting active processes or running lock cleanup. | X |
| Force-break lock after timeout | Delete lockfile and proceed with write (risks race if holding process is genuinely slow). | |
| You decide | Choose the safest failure posture. | |

**User's choice:** Throw LockTimeoutError with diagnostic hint
**Notes:** Explains that another process holds the lock and provides diagnostic remediation guidance.

| Option | Description | Selected |
|--------|-------------|:--------:|
| Parallel async stress test (20-50 concurrent calls) | Run interleaved concurrent writes, verifying 100% entry retention, zero corrupted files, and correct timeout errors. | X |
| Mocked unit test only | Mock lock acquisition and verify error branches without simulating heavy concurrent contention. | |
| You decide | Implement comprehensive unit and concurrency integration tests. | |

**User's choice:** Parallel async stress test (20-50 concurrent calls)
**Notes:** Run interleaved concurrent writes, verifying 100% entry retention, zero corrupted files, and accurate lock timeout errors.

---

## the agent's Discretion
None - all decisions explicitly resolved by the user.

## Deferred Ideas
None - discussion remained focused on Phase 1 domain.
