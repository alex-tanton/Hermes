# Phase 01: Concurrency & State Reliability - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Cross-process safety, atomic storage operations, and memory synchronization for `.data/history.json` between concurrent daemons and CLI invocations. Eliminates race conditions, lost updates, and file corruption when background schedulers and CLI commands run in parallel.
</domain>

<decisions>
## Implementation Decisions

### File Locking Strategy
- **D-01:** Adopt `proper-lockfile` npm package for battle-tested cross-process file locking with PID checking, stale lock expiration, and directory/symlink locks. - **Reversibility:** costly - introduces package dependency and lockfile protocol.
- **D-02:** Mutation-scoped locking: only acquire lock during mutating operations (`record`, `clear`, `save`) to keep read queries fast and non-blocking. - **Reversibility:** reversible
- **D-03:** Mutating methods transition to asynchronous (`async record`, `async clear`) to allow non-blocking event-loop operation during contention and align with existing async engine/CLI callers. - **Reversibility:** costly - touches callers of mutating methods.
- **D-04:** Register process exit listeners (`SIGINT`, `SIGTERM`) for clean lock release; configure `proper-lockfile` stale duration to 10,000ms (10s) to automatically clean up orphaned locks after hard crashes or `SIGKILL`. - **Reversibility:** reversible

### Write Atomicity & Durability
- **D-05:** Write serialized JSON to a unique temporary file (`.data/history.json.tmp.{pid}.{timestamp}`) and atomically rename (`fs.promises.rename`) over `history.json` to prevent partial file truncation on crash. - **Reversibility:** reversible
- **D-06:** Clean up orphaned `.tmp.*` files automatically during `HistoryTracker` initialization and in mutation error catch blocks. - **Reversibility:** reversible
- **D-07:** Preserve 2-space pretty-printed JSON (`JSON.stringify(..., null, 2)`) for human readability, auditability, and clean git diffs. - **Reversibility:** reversible
- **D-08:** Throw a typed `HistoryStorageError` on write/rename filesystem failures; never silently swallow storage errors or drop audit records. - **Reversibility:** reversible

### Read Freshness & In-Memory Sync
- **D-09:** Check disk file modified timestamp (`fs.statSync(filePath).mtimeMs`) before read query methods; only re-read and parse JSON if `mtimeMs` differs from cached timestamp. - **Reversibility:** reversible
- **D-10:** Inside mutating methods (`record`, `clear`), always re-read disk state inside the acquired lock before modifying and saving to prevent lost updates. - **Reversibility:** reversible
- **D-11:** If `.data/history.json` or `.data` is externally deleted while running, automatically recreate the directory/file and reset in-memory state gracefully without throwing unhandled exceptions. - **Reversibility:** reversible
- **D-12:** Keep read query methods (`isCoolingDown`, `getPostsInLast24Hours`, `getStats`, `getRecent`) synchronous for clean, non-Promise evaluation in scheduler loops and CLI status checks. - **Reversibility:** costly - changing to async later would ripple across scheduler and engine.

### Contention & Timeout Policy
- **D-13:** Exponential backoff with random jitter for lock acquisition retries (base delay ~50ms, factor 1.5, max delay 250ms) to prevent lockstep retry collisions. - **Reversibility:** reversible
- **D-14:** Maximum lock acquisition timeout threshold capped at 5,000ms (5 seconds) default with optional constructor/config override. - **Reversibility:** reversible
- **D-15:** Throw typed `LockTimeoutError` with actionable diagnosis when lock acquisition reaches the 5-second timeout, advising the user on inspecting active processes or running lock cleanup. - **Reversibility:** reversible
- **D-16:** Parallel async stress testing in Vitest with 20–50 concurrent interleaved operations, asserting 100% record retention, zero corruption, and accurate timeout error handling. - **Reversibility:** reversible

### the agent's Discretion
None - all decisions explicitly resolved with user choices.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Implementation & Types
- `src/core/history.ts` - Existing HistoryTracker implementation to be refactored with lockfile and atomic writes.
- `src/types/index.ts` - Core type definitions including HistoryEntry, HistoryStats, and error types.
- `src/core/engine.ts` - ReferralRepeaterEngine consuming HistoryTracker during execution cycles.
- `src/cli/commands/post.ts` - CLI post runner calling HistoryTracker.record.
- `src/cli/commands/daemon.ts` - Background recurring daemon scheduler evaluating cooldowns and recording cycles.
- `src/cli/commands/history.ts` - CLI history command for viewing entries, statistics, and clearing history.

### Testing & Requirements
- `tests/history.test.ts` - HistoryTracker test suite requiring concurrency stress tests and timeout verification.
- `.planning/REQUIREMENTS.md` - Requirements LOCK-01 (atomic file locking) and LOCK-02 (concurrency unit tests).
- `.planning/ROADMAP.md` - Phase 1 milestone definition and deliverables.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/core/history.ts`: Existing `HistoryTracker` class and singleton export `historyTracker`.
- `src/core/logger.ts`: Colored terminal preview boxes and file logger for logging lock warnings and recovery actions.
- `tests/history.test.ts`: Established Vitest testing harness with temporary test directories and cleanups.

### Established Patterns
- TypeScript ESM with `.js` import specifiers and strict null checking.
- Vitest with `describe`, `it`, `expect`, `beforeEach`, `afterEach`.
- Zero external DB requirement; self-hosted JSON storage in `.data/history.json`.

### Integration Points
- `ReferralRepeaterEngine.executeCycle` in `src/core/engine.ts` (`await historyTracker.record(...)`).
- `src/cli/commands/history.ts` (`await historyTracker.clear()`).
- `src/cli/commands/post.ts` (`await historyTracker.record(...)`).
</code_context>

<specifics>
## Specific Ideas
- Adopt `proper-lockfile` npm package for battle-tested file locking semantics across Windows and Linux.
- Mutation-scoped locking only (no locking overhead on read queries).
- Atomic temp-file write (`.tmp.{pid}.{timestamp}`) and atomic rename (`fs.promises.rename`).
- Rapid disk stat checks (`mtimeMs`) for read freshness without parsing JSON unless modified.
- Parallel async stress tests (20–50 concurrent calls) in Vitest to guarantee zero data loss.
</specifics>

<deferred>
## Deferred Ideas
None - discussion stayed within phase scope.
</deferred>

---

*Phase: 01-concurrency-state-reliability*
*Context gathered: 2026-10-23*
