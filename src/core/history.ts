import fs from 'node:fs';
import path from 'node:path';
import lockfile from 'proper-lockfile';
import {
  HistoryEntry,
  HistoryStorageError,
  LockTimeoutError,
  PlatformType,
} from '../types/index.js';
import { logger } from './logger.js';

export interface HistoryTrackerOptions {
  lockTimeoutMs?: number;
  staleMs?: number;
  maxEntries?: number;
}

export interface MutationOptions {
  timeout?: number;
}

export class HistoryTracker {
  private dataDir: string;
  private filePath: string;
  private lockTimeoutMs: number;
  private staleMs: number;
  private maxEntries: number;
  private entries: HistoryEntry[] = [];
  private lastMtimeMs = 0;
  private static activeReleases = new Set<() => Promise<void>>();
  private static cleanupRegistered = false;

  constructor(customPath?: string, options?: HistoryTrackerOptions) {
    if (customPath) {
      this.filePath = path.resolve(process.cwd(), customPath);
      this.dataDir = path.dirname(this.filePath);
    } else {
      this.dataDir = path.resolve(process.cwd(), '.data');
      this.filePath = path.join(this.dataDir, 'history.json');
    }

    this.lockTimeoutMs = options?.lockTimeoutMs ?? 5000;
    this.staleMs = options?.staleMs ?? 10000;
    this.maxEntries = options?.maxEntries ?? 2500;

    this.ensureInitialized();
    this.registerExitHandlers();
    this.reloadFromDisk();
  }

  /**
   * Ensures the storage directory and JSON file exist on disk,
   * and sweeps any orphaned temporary files from interrupted writes.
   */
  private ensureInitialized(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    if (!fs.existsSync(this.filePath)) {
      try {
        fs.writeFileSync(this.filePath, '[]\n', 'utf-8');
      } catch {
        // Handled on subsequent read/write attempts
      }
    }

    this.cleanupOrphanedTempFiles();
  }

  /**
   * Cleans up orphaned .tmp.* files left behind by killed processes
   */
  private cleanupOrphanedTempFiles(): void {
    try {
      if (!fs.existsSync(this.dataDir)) return;
      const targetPrefix = `${path.basename(this.filePath)}.tmp.`;
      const files = fs.readdirSync(this.dataDir);
      for (const file of files) {
        if (file.startsWith(targetPrefix)) {
          const tempFullPath = path.join(this.dataDir, file);
          try {
            fs.unlinkSync(tempFullPath);
          } catch {
            // Ignore transient removal failure
          }
        }
      }
    } catch {
      // Ignore directory read failure during cleanup
    }
  }

  /**
   * Registers process signal listeners to cleanly unlock on termination
   */
  private registerExitHandlers(): void {
    if (HistoryTracker.cleanupRegistered) return;
    HistoryTracker.cleanupRegistered = true;

    const cleanup = () => {
      for (const release of HistoryTracker.activeReleases) {
        try {
          void release();
        } catch {
          // Ignore release errors during process exit
        }
      }
      HistoryTracker.activeReleases.clear();
    };

    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
  }

  /**
   * Acquires cross-process lock on the history file with exponential backoff and timeout
   */
  private async acquireLock(options?: MutationOptions): Promise<() => Promise<void>> {
    this.ensureInitialized();
    const timeoutMs = options?.timeout ?? this.lockTimeoutMs;
    const retriesCount = Math.max(1, Math.ceil(timeoutMs / 50));

    try {
      const releaseFn = await lockfile.lock(this.filePath, {
        stale: this.staleMs,
        retries: {
          retries: retriesCount,
          factor: 1.5,
          minTimeout: Math.min(50, timeoutMs),
          maxTimeout: Math.min(250, timeoutMs),
          randomize: true,
          maxRetryTime: timeoutMs,
        },
        onCompromised: (err) => {
          logger.warn(`Lock on ${this.filePath} compromised: ${err.message}`);
        },
      });

      const wrappedRelease = async () => {
        HistoryTracker.activeReleases.delete(wrappedRelease);
        try {
          await releaseFn();
        } catch {
          // Ignore error if already released or deleted
        }
      };

      HistoryTracker.activeReleases.add(wrappedRelease);
      return wrappedRelease;
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string };
      if (
        errorObj &&
        (errorObj.code === 'ELOCKED' ||
          errorObj.message?.includes('timeout') ||
          errorObj.message?.includes('Lock file is already being held'))
      ) {
        throw new LockTimeoutError(this.filePath, timeoutMs, err);
      }
      throw err;
    }
  }

  /**
   * Re-reads latest state from disk into memory
   */
  private reloadFromDisk(): void {
    try {
      if (!fs.existsSync(this.filePath)) {
        this.ensureInitialized();
        this.entries = [];
        this.lastMtimeMs = 0;
        return;
      }

      const stat = fs.statSync(this.filePath);
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      this.entries = JSON.parse(raw);
      this.lastMtimeMs = stat.mtimeMs;
    } catch {
      this.entries = [];
    }
  }

  /**
   * Checks mtimeMs against cached value and reloads if modified externally
   */
  private syncFromDiskIfModified(): void {
    try {
      if (!fs.existsSync(this.filePath) || !fs.existsSync(this.dataDir)) {
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
    } catch {
      // Retain existing entries if reading or parsing fails during active external write
    }
  }

  /**
   * Atomically saves in-memory entries to disk via unique temp file and rename
   */
  private async atomicSave(): Promise<void> {
    const tempPath = path.join(
      this.dataDir,
      `${path.basename(this.filePath)}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`,
    );

    try {
      const payload = JSON.stringify(this.entries, null, 2) + '\n';
      await fs.promises.writeFile(tempPath, payload, 'utf-8');

      // Windows NTFS atomic rename retry loop for transient EPERM / EBUSY / EACCES
      let renamed = false;
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await fs.promises.rename(tempPath, this.filePath);
          renamed = true;
          break;
        } catch (err: unknown) {
          lastError = err;
          const code = (err as { code?: string })?.code;
          if (attempt < 2 && (code === 'EPERM' || code === 'EBUSY' || code === 'EACCES')) {
            await new Promise((resolve) => setTimeout(resolve, 25));
          } else {
            break;
          }
        }
      }

      if (!renamed) {
        throw lastError;
      }

      try {
        this.lastMtimeMs = fs.statSync(this.filePath).mtimeMs;
      } catch {
        // Ignore stat error
      }
    } catch (err: unknown) {
      if (fs.existsSync(tempPath)) {
        try {
          await fs.promises.unlink(tempPath);
        } catch {
          // Ignore temp cleanup error
        }
      }
      const message = (err as { message?: string })?.message || String(err);
      throw new HistoryStorageError(
        `Failed to persist history file to "${this.filePath}": ${message}`,
        this.filePath,
        err,
      );
    }
  }

  /**
   * Records a new post or simulated attempt into history with cross-process locking
   */
  public async record(
    entry: Omit<HistoryEntry, 'id'>,
    options?: MutationOptions,
  ): Promise<HistoryEntry> {
    const release = await this.acquireLock(options);
    try {
      this.reloadFromDisk();

      const fullEntry: HistoryEntry = {
        id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ...entry,
      };
      this.entries.unshift(fullEntry);
      if (this.entries.length > this.maxEntries) {
        this.entries = this.entries.slice(0, this.maxEntries);
      }
      await this.atomicSave();
      return fullEntry;
    } finally {
      await release();
    }
  }

  /**
   * Prunes history entries to a specified count under lock
   */
  public async prune(limit?: number, options?: MutationOptions): Promise<number> {
    const release = await this.acquireLock(options);
    try {
      this.reloadFromDisk();
      const targetCount = limit ?? this.maxEntries;
      if (this.entries.length <= targetCount) {
        return 0;
      }
      const prunedCount = this.entries.length - targetCount;
      this.entries = this.entries.slice(0, targetCount);
      await this.atomicSave();
      return prunedCount;
    } finally {
      await release();
    }
  }

  /**
   * Clears posting history under lock
   */
  public async clear(options?: MutationOptions): Promise<void> {
    const release = await this.acquireLock(options);
    try {
      this.entries = [];
      await this.atomicSave();
    } finally {
      await release();
    }
  }

  /**
   * Checks whether a specific link was posted to a specific platform within cooldown hours
   */
  public isCoolingDown(linkId: string, platform: PlatformType, cooldownHours: number): boolean {
    this.syncFromDiskIfModified();
    const cooldownMs = cooldownHours * 60 * 60 * 1000;
    const now = Date.now();

    const lastEntry = this.entries.find(
      (e) => e.linkId === linkId && e.platform === platform && e.status !== 'failed',
    );

    if (!lastEntry) return false;

    const elapsed = now - new Date(lastEntry.timestamp).getTime();
    return elapsed < cooldownMs;
  }

  /**
   * Returns how many posts have been made in the last 24 hours, optionally filtered by platform
   */
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

  /**
   * Returns the epoch millisecond timestamp of the most recent post for a link,
   * optionally filtered by platform, or undefined if never posted.
   */
  public getLastPostTime(linkId: string, platform?: PlatformType): number | undefined {
    this.syncFromDiskIfModified();
    const entry = this.entries.find(
      (e) => e.linkId === linkId && (!platform || e.platform === platform) && e.status !== 'failed',
    );
    return entry ? new Date(entry.timestamp).getTime() : undefined;
  }

  public getRecent(limit = 20): HistoryEntry[] {
    this.syncFromDiskIfModified();
    return this.entries.slice(0, limit);
  }

  public getStats(): {
    total: number;
    simulated: number;
    live: number;
    failed: number;
    byPlatform: Record<string, number>;
  } {
    this.syncFromDiskIfModified();
    const byPlatform: Record<string, number> = {};
    let simulated = 0;
    let live = 0;
    let failed = 0;

    for (const e of this.entries) {
      byPlatform[e.platform] = (byPlatform[e.platform] || 0) + 1;
      if (e.status === 'failed') {
        failed++;
      } else if (e.simulated) {
        simulated++;
      } else {
        live++;
      }
    }

    return {
      total: this.entries.length,
      simulated,
      live,
      failed,
      byPlatform,
    };
  }
}

export const historyTracker = new HistoryTracker();
