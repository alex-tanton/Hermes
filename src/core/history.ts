import fs from 'node:fs';
import path from 'node:path';
import { HistoryEntry, PlatformType } from '../types/index.js';

export class HistoryTracker {
  private dataDir: string;
  private filePath: string;
  private entries: HistoryEntry[] = [];

  constructor(customPath?: string) {
    if (customPath) {
      this.filePath = path.resolve(process.cwd(), customPath);
      this.dataDir = path.dirname(this.filePath);
    } else {
      this.dataDir = path.resolve(process.cwd(), '.data');
      this.filePath = path.join(this.dataDir, 'history.json');
    }
    this.ensureLoaded();
  }

  private ensureLoaded(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.entries = JSON.parse(raw);
      } catch {
        this.entries = [];
      }
    } else {
      this.entries = [];
      this.save();
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.entries, null, 2), 'utf-8');
    } catch {
      // ignore in read-only setups
    }
  }

  /**
   * Records a new post or simulated attempt into history
   */
  public record(entry: Omit<HistoryEntry, 'id'>): HistoryEntry {
    const fullEntry: HistoryEntry = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...entry,
    };
    this.entries.unshift(fullEntry);
    this.save();
    return fullEntry;
  }

  /**
   * Checks whether a specific link was posted to a specific platform within cooldown hours
   */
  public isCoolingDown(linkId: string, platform: PlatformType, cooldownHours: number): boolean {
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
   * Returns how many posts have been made in the last 24 hours
   */
  public getPostsInLast24Hours(): number {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return this.entries.filter(
      (e) => new Date(e.timestamp).getTime() >= oneDayAgo && e.status !== 'failed',
    ).length;
  }

  public getRecent(limit = 20): HistoryEntry[] {
    return this.entries.slice(0, limit);
  }

  public clear(): void {
    this.entries = [];
    this.save();
  }

  public getStats(): {
    total: number;
    simulated: number;
    live: number;
    failed: number;
    byPlatform: Record<string, number>;
  } {
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
