# Phase 01: Concurrency & State Reliability - Research

**Phase:** 01-concurrency-state-reliability  
**Domain:** Cross-process file locking, atomic disk persistence, in-memory cache invalidation, Vitest concurrency testing  
**Confidence:** HIGH  
**Date:** 2026-10-23  

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### File Locking Strategy
- **D-01:** Adopt `proper-lockfile` npm package for battle-tested cross-process file locking with PID checking, stale lock expiration, and directory/symlink locks. - **Reversibility:** costly - introduces package dependency and lockfile protocol.
- **D-02:** Mutation-scoped locking: only acquire lock during mutating operations (`record`, `clear`, `save`) to keep read queries fast and non-blocking. - **Reversibility:** reversible
- **D-03:** Mutating methods transition to asynchronous (`async record`, `async clear`) to allow non-blocking event-loop operation during contention and align with existing async engine/CLI callers. - **Reversibility:** costly - touches callers of mutating methods.
- **D-04:** Register process exit listeners (`SIGINT`, `SIGTERM`) for clean lock release; configure `proper-lockfile` stale duration to 10,000ms (10s) to automatically clean up orphaned locks after hard crashes or `SIGKILL`. - **Reversibility:** reversible

#### Write Atomicity & Durability
- **D-05:** Write serialized JSON to a unique temporary file (`.data/history.json.tmp.{pid}.{timestamp}`) and atomically rename (`fs.promises.rename`) over `history.json` to prevent partial file truncation on crash. - **Reversibility:** reversible
- **D-06:** Clean up orphaned `.tmp.*` files automatically during `HistoryTracker` initialization and in mutation error catch blocks. - **Reversibility:** reversible
- **D-07:** Preserve 2-space pretty-printed JSON (`JSON.stringify(..., null, 2)`) for human readability, auditability, and clean git diffs. - **Reversibility:** reversible
- **D-08:** Throw a typed `HistoryStorageError` on write/rename filesystem failures; never silently swallow storage errors or drop audit records. - **Reversibility:** reversible

#### Read Freshness & In-Memory Sync
- **D-09:** Check disk file modified timestamp (`fs.statSync(filePath).mtimeMs`) before read query methods; only re-read and parse JSON if `mtimeMs` differs from cached timestamp. - **Reversibility:** reversible
- **D-10:** Inside mutating methods (`record`, `clear`), always re-read disk state inside the acquired lock before modifying and saving to prevent lost updates. - **Reversibility:** reversible
- **D-11:** If `.data/history.json` or `.data` is externally deleted while running, automatically recreate the directory/file and reset in-memory state gracefully without throwing unhandled exceptions. - **Reversibility:** reversible
- **D-12:** Keep read query methods (`isCoolingDown`, `getPostsInLast24Hours`, `getStats`, `getRecent`) synchronous for clean, non-Promise evaluation in scheduler loops and CLI status checks. - **Reversibility:** costly - changing to async later would ripple across scheduler and engine.

#### Contention & Timeout Policy
- **D-13:** Exponential backoff with random jitter for lock acquisition retries (base delay ~50ms, factor 1.5, max delay 250ms) to prevent lockstep retry collisions. - **Reversibility:** reversible
- **D-14:** Maximum lock acquisition timeout threshold capped at 5,000ms (5 seconds) default with optional constructor/config override. - **Reversibility:** reversible
- **D-15:** Throw typed `LockTimeoutError` with actionable diagnosis when lock acquisition reaches the 5-second timeout, advising the user on inspecting active processes or running lock cleanup. - **Reversibility:** reversible
- **D-16:** Parallel async stress testing in Vitest with 20–50 concurrent interleaved operations, asserting 100% record retention, zero corruption, and accurate timeout error handling. - **Reversibility:** reversible

### the agent's Discretion
None - all decisions explicitly resolved with user choices.

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **LOCK-01** | Implement atomic file locking (or lockfile mutex) for `.data/history.json` to prevent race conditions during concurrent daemon and CLI runs. | `proper-lockfile` (v4.1.2) + `@types/proper-lockfile` (v4.1.4), temp file atomic rename (`history.json.tmp.{pid}.{timestamp}` -> `history.json`), stale lock recovery (10s), exponential retry backoff (50ms base, 1.5 factor, 250ms max, 5s cap). |
| **LOCK-02** | Add automated unit tests verifying concurrent access resilience and graceful handling of lock timeouts. | Vitest test suite in `tests/history.test.ts` executing 20–50 concurrent `Promise.all` operations, artificial lock-holding timeout simulation, transient file deletion recovery, and orphaned `.tmp` cleanup verification. |
</phase_requirements>

---

## Executive Summary

Phase 1 hardens `HistoryTracker` against race conditions between background daemon processes and manual CLI invocations (`referral-repeater post`, `referral-repeater history --clear`). Currently, `HistoryTracker` uses synchronous in-memory state with blind `fs.writeFileSync(this.filePath, ...)` calls without cross-process locks or atomic renames. In a concurrent environment, two processes reading at the same time and writing back will overwrite each other, causing lost entries or half-written corrupted JSON files.

The solution utilizes `proper-lockfile` (v4.1.2) for cross-platform, PID-aware lock directories, an atomic temp-file write-and-rename pattern, and modified timestamp (`mtimeMs`) cache checks for high-performance synchronous reads.

---

## Standard Stack & Tooling

### Dependencies to Add

| Package | Version | Type | Purpose |
|---------|---------|------|---------|
| `proper-lockfile` | `^4.1.2` | `dependencies` | Cross-process directory/symlink locking with stale detection and PID tracking |
| `@types/proper-lockfile` | `^4.1.4` | `devDependencies` | TypeScript definitions for `proper-lockfile` API |

### Environment Audit

```bash
node: v18+ (project engines >= 18.0.0; currently running Node v22.13.0)
vitest: v3.0.6 (already installed in devDependencies)
tsx: v4.19.3 (already installed in devDependencies)
typescript: v5.7.3 (strict null checking enabled)
```

No external databases or system daemons required; storage remains pure local JSON at `.data/history.json`.

---

## Architecture Patterns & Implementation Strategy

### 1. File Locking with `proper-lockfile`

`proper-lockfile` implements file locking using atomic directory creation (`mkdir` under the hood) which is supported on POSIX and Windows filesystem drivers (NTFS, FAT32, SMB, ext4).

Key API nuances:
- **Target File Existence (`realpath`):** By default, `proper-lockfile` resolves `realpath` on the target file. If `history.json` does not exist on disk, `lockfile.lock` will throw an `ENOENT` error. Therefore, `HistoryTracker.ensureInitialized()` must ensure `.data` directory and `.data/history.json` exist (initialized with `[]` if missing) before any lock attempt.
- **Lock Acquisition:**
  ```typescript
  import lockfile from 'proper-lockfile';

  const release = await lockfile.lock(this.filePath, {
    stale: 10000, // 10s stale detection (D-04)
    retries: {
      retries: 25, // with exponential backoff capped at 5000ms (D-13, D-14)
      factor: 1.5,
      minTimeout: 50,
      maxTimeout: 250,
      randomize: true,
    },
    onCompromised: (err) => {
      logger.warn(`Lock on ${this.filePath} compromised: ${err.message}`);
    },
  });
  ```
- **Lock Timeout Translation:** If lock acquisition fails because it is locked by another process (error code `'ELOCKED'`), translate the error into a typed `LockTimeoutError` (D-15).
- **Process Exit Cleanup:** Register `SIGINT` and `SIGTERM` handlers to release active locks if process is terminated mid-operation (D-04).

### 2. Atomic Temp-File Write and Rename

Direct `fs.writeFileSync` truncates the destination file first before writing new bytes. If a process crashes, loses power, or is killed during this window, the file is left empty (0 bytes) or partially written, corrupting state.

The atomic pattern:
1. Write payload to unique temporary file in the same directory:
   ```typescript
   const tempPath = `${this.filePath}.tmp.${process.pid}.${Date.now()}`;
   await fs.promises.writeFile(tempPath, JSON.stringify(this.entries, null, 2), 'utf-8');
   ```
2. Atomically rename temporary file over target:
   ```typescript
   await fs.promises.rename(tempPath, this.filePath);
   ```
3. Windows NTFS edge cases: On Windows, `fs.promises.rename` can throw `EPERM` or `EBUSY` if another process (e.g., Windows Search indexer, antivirus scanner) briefly inspects the destination file handle. A lightweight retry helper (3 attempts with 20ms delay) guarantees clean atomic replacement on Windows.
4. Error cleanup: If `writeFile` or `rename` throws, clean up `tempPath` immediately in a `try...catch` block (D-06).

### 3. Read Freshness via `mtimeMs` Invalidation (D-09, D-12)

Synchronous read queries (`isCoolingDown`, `getPostsInLast24Hours`, `getStats`, `getRecent`) must stay synchronous to avoid converting schedulers and engines into complex async dependency chains.

To ensure external writes from other processes are detected:
```typescript
private lastMtimeMs = 0;

private syncFromDiskIfModified(): void {
  try {
    if (!fs.existsSync(this.filePath)) {
      this.ensureInitialized();
      this.entries = [];
      this.lastMtimeMs = 0;
      return;
    }

    const stat = fs.statSync(this.filePath);
    if (stat.mtimeMs !== this.lastMtimeMs) {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      this.entries = JSON.parse(raw);
      this.lastMtimeMs = stat.mtimeMs;
    }
  } catch (err) {
    // If parse fails due to external interference, fall back gracefully
  }
}
```

### 4. Inside Mutating Operations (D-10)

Whenever `record` or `clear` acquires the lock, it MUST re-read the disk file before applying changes and saving:
```typescript
public async record(entry: Omit<HistoryEntry, 'id'>): Promise<HistoryEntry> {
  const release = await this.acquireLock();
  let tempPath: string | null = null;
  try {
    // 1. Re-read disk state inside lock
    this.reloadFromDisk();

    // 2. Mutate in-memory
    const fullEntry: HistoryEntry = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...entry,
    };
    this.entries.unshift(fullEntry);

    // 3. Write temp file and rename atomically
    tempPath = `${this.filePath}.tmp.${process.pid}.${Date.now()}`;
    await this.atomicSave(tempPath);

    return fullEntry;
  } finally {
    await release();
  }
}
```

---

## Don't Hand-Roll List

| Feature | Hand-rolled Risk | Standard Solution |
|---------|------------------|-------------------|
| Cross-process mutex | Race conditions in custom `.lock` files, broken stale lock detection, PID reuse bugs | `proper-lockfile` (battle-tested across OS platforms) |
| Atomic writes | Writing in-place causes 0-byte file truncation on sudden kill | Write to unique `.tmp.{pid}.{timestamp}` on same volume + `fs.promises.rename` |
| Exponential backoff | Linear sleep leads to lockstep contention storms | `proper-lockfile` retry config with randomized jitter |

---

## Common Pitfalls & Edge Cases

1. **`proper-lockfile` ENOENT on Missing Target:**
   - *Pitfall:* Calling `lockfile.lock('/path/to/history.json')` when `history.json` does not exist yet throws `ENOENT` because `realpath` defaults to `true`.
   - *Fix:* In `HistoryTracker` constructor/initialization, ensure `history.json` exists with initial empty array `[]` before locking.

2. **Windows EPERM/EBUSY on `fs.rename` Over Existing File:**
   - *Pitfall:* On Windows NTFS, renaming over an existing file when handles are briefly inspected by antivirus or indexers throws `EPERM`.
   - *Fix:* Wrap `fs.promises.rename` in a retry helper (up to 3 retries, 25ms delay) or handle Windows replace semantics cleanly.

3. **Orphaned `.lock` Directories on SIGKILL:**
   - *Pitfall:* Hard `kill -9` or power loss leaves `history.json.lock` directory on disk.
   - *Fix:* Set `stale: 10000` (10 seconds). Any future attempt by CLI or daemon detects the lock directory mtime is older than 10 seconds and automatically claims/clears it.

4. **Caller API Signature Updates (D-03):**
   - *Pitfall:* `historyTracker.record` and `historyTracker.clear` change from synchronous to returning `Promise<HistoryEntry>` and `Promise<void>`. Callers without `await` would fail silently or execute out of order.
   - *Audit of Call Sites:*
     - `src/core/engine.ts`: `ReferralRepeaterEngine.executeCycle` is `async` -> add `await this.history.record(...)`.
     - `src/cli/commands/history.ts`: change `runHistoryCommand` to `async` and add `await historyTracker.clear()`.
     - `src/cli/index.ts`: update commander history action to `await runHistoryCommand(options)`.
     - `tests/history.test.ts`: update test cases to `await tracker.record(...)` and `await tracker.clear()`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v22.13.0 | Node v18+ |
| Vitest | Test Runner | Yes | v3.0.6 | - |
| proper-lockfile | File Locking | npm install | ^4.1.2 | - |
| @types/proper-lockfile | TypeScript Types | npm install | ^4.1.4 | - |

---

## Validation Architecture

### Test Infrastructure Scan
- **Framework:** Vitest 3.0.6
- **Config file:** `vitest.config.ts`
- **Quick run command:** `npm test -- tests/history.test.ts`
- **Full suite command:** `npm test`
- **Estimated runtime:** ~2-4 seconds

### Requirements to Test Mapping

| Requirement | Behavior | Test Type | Automated Command |
|-------------|----------|-----------|-------------------|
| **LOCK-01** | Atomic write, lockfile mutex, stale lock recovery, external deletion recovery | Unit / Integration | `npx vitest run tests/history.test.ts` |
| **LOCK-02** | 20–50 concurrent asynchronous writes without lost records; lock timeout error thrown when locked past 5000ms | Concurrency Stress | `npx vitest run tests/history.test.ts` |

### Wave 0 Gaps
- None. Vitest is configured and operational; `tests/history.test.ts` exists and can be expanded with concurrency stress tests.

---

## Structured Return

```markdown
## RESEARCH COMPLETE

**Phase:** 01 - concurrency-state-reliability
**Confidence:** HIGH

### Key Findings
- `proper-lockfile` (4.1.2) provides proven cross-process directory locking with PID checking and 10s stale expiration.
- Target file `history.json` must exist before calling `lockfile.lock` because `realpath` defaults to `true`.
- Atomic writes require writing to `.data/history.json.tmp.{pid}.{timestamp}` on the same filesystem and renaming over `history.json`.
- Synchronous read queries are preserved by comparing disk `mtimeMs` before parsing JSON.
- Callers in `engine.ts`, `history.ts` CLI, and tests need `await` for `record()` and `clear()`.

### File Created
`.planning/phases/01-concurrency-state-reliability/01-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | `proper-lockfile` and Node.js `fs.promises` APIs are thoroughly verified |
| Architecture | HIGH | Concurrency model and callers mapped across all codebase files |
| Pitfalls | HIGH | Windows rename quirks, stale locks, and realpath prerequisites accounted for |

### Ready for Planning
Research complete. Planner can now create PLAN.md files.
```
