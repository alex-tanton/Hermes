import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import lockfile from 'proper-lockfile';
import { HistoryTracker } from '../src/core/history.js';
import { LockTimeoutError } from '../src/types/index.js';

describe('HistoryTracker', () => {
  const testHistoryPath = path.resolve(process.cwd(), '.data/test-history.json');
  const testLockPath = `${testHistoryPath}.lock`;
  const testDir = path.dirname(testHistoryPath);
  let tracker: HistoryTracker;

  const cleanFiles = () => {
    if (fs.existsSync(testHistoryPath)) {
      try {
        fs.unlinkSync(testHistoryPath);
      } catch {
        // Ignore unlink error
      }
    }
    if (fs.existsSync(testLockPath)) {
      try {
        fs.rmSync(testLockPath, { recursive: true, force: true });
      } catch {
        // Ignore lock dir removal error
      }
    }
    if (fs.existsSync(testDir)) {
      try {
        for (const file of fs.readdirSync(testDir)) {
          if (file.startsWith('test-history.json.tmp.')) {
            try {
              fs.unlinkSync(path.join(testDir, file));
            } catch {
              // Ignore tmp cleanup error
            }
          }
        }
      } catch {
        // Ignore readdir error
      }
    }
  };

  beforeEach(() => {
    cleanFiles();
    tracker = new HistoryTracker('.data/test-history.json');
  });

  afterEach(() => {
    cleanFiles();
  });

  describe('Core Functionality & Baseline Invariants', () => {
    it('records a new history entry and persists to file', async () => {
      const entry = await tracker.record({
        timestamp: new Date().toISOString(),
        platform: 'reddit',
        linkId: 'chase-sapphire',
        linkName: 'Chase Sapphire Preferred®',
        category: 'credit_card',
        simulated: true,
        targetDestination: 'r/churning',
        status: 'simulated',
      });

      expect(entry.id).toBeDefined();
      expect(tracker.getRecent().length).toBe(1);
      expect(fs.existsSync(testHistoryPath)).toBe(true);
    });

    it('identifies cooling down links within cooldown window', async () => {
      await tracker.record({
        timestamp: new Date().toISOString(),
        platform: 'reddit',
        linkId: 'chase-sapphire',
        linkName: 'Chase Sapphire Preferred®',
        category: 'credit_card',
        simulated: true,
        status: 'simulated',
      });

      // 24 hour cooldown should trigger true immediately
      expect(tracker.isCoolingDown('chase-sapphire', 'reddit', 24)).toBe(true);

      // Other platforms or links should not be cooling down
      expect(tracker.isCoolingDown('chase-sapphire', 'twitter', 24)).toBe(false);
      expect(tracker.isCoolingDown('capital-one-venture', 'reddit', 24)).toBe(false);
    });

    it('recognizes expired cooldowns for older posts', async () => {
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      await tracker.record({
        timestamp: twoDaysAgo,
        platform: 'reddit',
        linkId: 'chase-sapphire',
        linkName: 'Chase Sapphire Preferred®',
        category: 'credit_card',
        simulated: true,
        status: 'simulated',
      });

      // 24 hour cooldown should be expired
      expect(tracker.isCoolingDown('chase-sapphire', 'reddit', 24)).toBe(false);
    });

    it('counts posts made in the last 24 hours correctly', async () => {
      await tracker.record({
        timestamp: new Date().toISOString(),
        platform: 'reddit',
        linkId: 'link-1',
        linkName: 'Link 1',
        category: 'credit_card',
        simulated: true,
        status: 'simulated',
      });

      await tracker.record({
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        platform: 'discord',
        linkId: 'link-2',
        linkName: 'Link 2',
        category: 'shopping',
        simulated: true,
        status: 'simulated',
      });

      // Post from 3 days ago should not count
      await tracker.record({
        timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
        platform: 'twitter',
        linkId: 'link-3',
        linkName: 'Link 3',
        category: 'credit_card',
        simulated: true,
        status: 'simulated',
      });

      expect(tracker.getPostsInLast24Hours()).toBe(2);
      expect(tracker.getPostsInLast24Hours('reddit')).toBe(1);
      expect(tracker.getPostsInLast24Hours('discord')).toBe(1);
      expect(tracker.getPostsInLast24Hours('twitter')).toBe(0);
    });

    it('returns the most recent post time for a link and platform via getLastPostTime', async () => {
      expect(tracker.getLastPostTime('link-alpha', 'reddit')).toBeUndefined();

      const earlierTime = Date.now() - 3600000;
      await tracker.record({
        timestamp: new Date(earlierTime).toISOString(),
        platform: 'reddit',
        linkId: 'link-alpha',
        linkName: 'Alpha Card',
        category: 'credit_card',
        simulated: true,
        status: 'simulated',
      });

      const recentTime = Date.now() - 60000;
      await tracker.record({
        timestamp: new Date(recentTime).toISOString(),
        platform: 'discord',
        linkId: 'link-alpha',
        linkName: 'Alpha Card',
        category: 'credit_card',
        simulated: true,
        status: 'simulated',
      });

      const lastDiscord = tracker.getLastPostTime('link-alpha', 'discord');
      const lastReddit = tracker.getLastPostTime('link-alpha', 'reddit');
      const lastOverall = tracker.getLastPostTime('link-alpha');

      expect(lastDiscord).toBe(recentTime);
      expect(lastReddit).toBe(earlierTime);
      expect(lastOverall).toBe(recentTime);
    });

    it('generates accurate statistics breakdown', async () => {
      await tracker.record({
        timestamp: new Date().toISOString(),
        platform: 'reddit',
        linkId: 'link-1',
        linkName: 'Link 1',
        category: 'credit_card',
        simulated: true,
        status: 'simulated',
      });

      await tracker.record({
        timestamp: new Date().toISOString(),
        platform: 'reddit',
        linkId: 'link-2',
        linkName: 'Link 2',
        category: 'shopping',
        simulated: false,
        status: 'success',
      });

      await tracker.record({
        timestamp: new Date().toISOString(),
        platform: 'twitter',
        linkId: 'link-3',
        linkName: 'Link 3',
        category: 'credit_card',
        simulated: false,
        status: 'failed',
        error: 'Rate limited',
      });

      const stats = tracker.getStats();
      expect(stats.total).toBe(3);
      expect(stats.simulated).toBe(1);
      expect(stats.live).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.byPlatform.reddit).toBe(2);
      expect(stats.byPlatform.twitter).toBe(1);
    });

    it('clears history when requested', async () => {
      await tracker.record({
        timestamp: new Date().toISOString(),
        platform: 'reddit',
        linkId: 'link-1',
        linkName: 'Link 1',
        category: 'credit_card',
        simulated: true,
        status: 'simulated',
      });

      expect(tracker.getRecent().length).toBe(1);
      await tracker.clear();
      expect(tracker.getRecent().length).toBe(0);
    });
  });

  describe('Concurrency & Parallel Stress (LOCK-02)', () => {
    it('executes 35 concurrent parallel writes with 100% record retention and uncorrupted JSON', async () => {
      const concurrentWrites = 35;
      const platforms = ['reddit', 'discord', 'facebook', 'bluesky', 'twitter'] as const;

      const promises = Array.from({ length: concurrentWrites }).map((_, index) =>
        tracker.record({
          timestamp: new Date().toISOString(),
          platform: platforms[index % platforms.length],
          linkId: `stress-link-${index}`,
          linkName: `Stress Referral Link ${index}`,
          category: 'credit_card',
          simulated: true,
          status: 'simulated',
          targetDestination: `target-${index % 5}`,
        }),
      );

      const results = await Promise.all(promises);
      expect(results.length).toBe(concurrentWrites);

      // Verify total retention via tracker methods
      const recent = tracker.getRecent(100);
      expect(recent.length).toBe(concurrentWrites);
      const stats = tracker.getStats();
      expect(stats.total).toBe(concurrentWrites);

      // Verify on disk that JSON is valid and uncorrupted
      const rawContent = fs.readFileSync(testHistoryPath, 'utf-8');
      const parsed = JSON.parse(rawContent);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(concurrentWrites);

      // Verify 2-space pretty formatting
      expect(rawContent).toContain('  "linkId": "stress-link-');
    }, 15000);

    it('safely interleaves parallel writes and synchronous read queries without observation corruption', async () => {
      const writeCount = 25;
      const readObservations: number[] = [];

      const writePromises = Array.from({ length: writeCount }).map((_, index) =>
        tracker.record({
          timestamp: new Date().toISOString(),
          platform: 'reddit',
          linkId: `interleaved-${index}`,
          linkName: `Interleaved Link ${index}`,
          category: 'banking',
          simulated: true,
          status: 'simulated',
        }),
      );

      // Rapidly query synchronous read methods during parallel writes
      const readInterval = setInterval(() => {
        try {
          const stats = tracker.getStats();
          readObservations.push(stats.total);
          tracker.isCoolingDown('interleaved-0', 'reddit', 1);
          tracker.getRecent(5);
        } catch (err: unknown) {
          expect.unreachable(
            `Read query should never throw during concurrent writes: ${String(err)}`,
          );
        }
      }, 15);

      await Promise.all(writePromises);
      clearInterval(readInterval);

      expect(tracker.getStats().total).toBe(writeCount);
      expect(readObservations.length).toBeGreaterThan(0);
    }, 15000);
  });

  describe('Lock Contention & Starvation Timeouts (LOCK-02)', () => {
    it('throws typed LockTimeoutError with diagnostic troubleshooting guidance under lock contention', async () => {
      // 1. Artificially acquire lock on the test history file using proper-lockfile directly
      const externalRelease = await lockfile.lock(testHistoryPath, { stale: 10000 });

      try {
        let caughtError: unknown;
        try {
          // Attempt record with a fast 300ms timeout threshold
          await tracker.record(
            {
              timestamp: new Date().toISOString(),
              platform: 'reddit',
              linkId: 'starved-link',
              linkName: 'Starved Link',
              category: 'credit_card',
              simulated: true,
              status: 'simulated',
            },
            { timeout: 300 },
          );
        } catch (err: unknown) {
          caughtError = err;
        }

        expect(caughtError).toBeInstanceOf(LockTimeoutError);
        const lockError = caughtError as LockTimeoutError;
        expect(lockError.code).toBe('LOCK_TIMEOUT');
        expect(lockError.filePath).toBe(testHistoryPath);
        expect(lockError.timeoutMs).toBe(300);
        expect(lockError.message).toContain('Failed to acquire file lock');
        expect(lockError.message).toContain('Another process');
        expect(lockError.message).toContain('300ms');
      } finally {
        // Release external lock
        await externalRelease();
      }

      // Proves clean recovery once lock is released
      const recoveryEntry = await tracker.record({
        timestamp: new Date().toISOString(),
        platform: 'reddit',
        linkId: 'recovered-link',
        linkName: 'Recovered Link',
        category: 'credit_card',
        simulated: true,
        status: 'simulated',
      });

      expect(recoveryEntry.id).toBeDefined();
      expect(tracker.getStats().total).toBe(1);
    });
  });

  describe('Fault Tolerance & Self-Healing (LOCK-02)', () => {
    it('recreates history.json safely when deleted externally during runtime', async () => {
      await tracker.record({
        timestamp: new Date().toISOString(),
        platform: 'reddit',
        linkId: 'initial-link',
        linkName: 'Initial Link',
        category: 'credit_card',
        simulated: true,
        status: 'simulated',
      });
      expect(tracker.getStats().total).toBe(1);

      // Externally delete history.json file
      fs.unlinkSync(testHistoryPath);
      expect(fs.existsSync(testHistoryPath)).toBe(false);

      // Calling read query should self-heal without uncaught exceptions and report 0 entries
      const stats = tracker.getStats();
      expect(stats.total).toBe(0);
      expect(tracker.isCoolingDown('initial-link', 'reddit', 24)).toBe(false);
      expect(fs.existsSync(testHistoryPath)).toBe(true);

      // Subsequent mutating operation should succeed cleanly
      const nextEntry = await tracker.record({
        timestamp: new Date().toISOString(),
        platform: 'discord',
        linkId: 'recreated-link',
        linkName: 'Recreated Link',
        category: 'shopping',
        simulated: true,
        status: 'simulated',
      });

      expect(nextEntry.id).toBeDefined();
      expect(tracker.getStats().total).toBe(1);
    });

    it('recreates storage directory safely when deleted externally during runtime', async () => {
      await tracker.record({
        timestamp: new Date().toISOString(),
        platform: 'reddit',
        linkId: 'dir-test-link',
        linkName: 'Dir Test Link',
        category: 'credit_card',
        simulated: true,
        status: 'simulated',
      });

      // Externally delete the entire .data directory
      fs.rmSync(testDir, { recursive: true, force: true });
      expect(fs.existsSync(testDir)).toBe(false);

      // Read query recreates directory and empty history safely
      expect(tracker.getStats().total).toBe(0);
      expect(fs.existsSync(testHistoryPath)).toBe(true);

      // Write continues without exception
      const writeResult = await tracker.record({
        timestamp: new Date().toISOString(),
        platform: 'twitter',
        linkId: 'post-dir-recovery',
        linkName: 'Post Dir Recovery',
        category: 'credit_card',
        simulated: true,
        status: 'simulated',
      });
      expect(writeResult.id).toBeDefined();
      expect(tracker.getStats().total).toBe(1);
    });

    it('automatically removes orphaned temporary files during initialization', async () => {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      // Simulate abandoned .tmp files from crashed worker processes
      const orphan1 = path.join(testDir, 'test-history.json.tmp.1111.1700000000000');
      const orphan2 = path.join(testDir, 'test-history.json.tmp.2222.1700000000001');
      const regularFile = path.join(testDir, 'unrelated.tmp.txt');

      fs.writeFileSync(orphan1, '{"partial": true}', 'utf-8');
      fs.writeFileSync(orphan2, '{"corrupted": true}', 'utf-8');
      fs.writeFileSync(regularFile, 'legitimate file', 'utf-8');

      expect(fs.existsSync(orphan1)).toBe(true);
      expect(fs.existsSync(orphan2)).toBe(true);
      expect(fs.existsSync(regularFile)).toBe(true);

      // Create new tracker instance to trigger initialization sweep
      const sweepTracker = new HistoryTracker('.data/test-history.json');
      expect(sweepTracker).toBeDefined();

      // Orphaned temp files must be removed; unrelated files must be untouched
      expect(fs.existsSync(orphan1)).toBe(false);
      expect(fs.existsSync(orphan2)).toBe(false);
      expect(fs.existsSync(regularFile)).toBe(true);

      fs.unlinkSync(regularFile);
    });
  });

  describe('History Retention & Pruning', () => {
    it('automatically truncates history to maxEntries during record', async () => {
      const limitedTracker = new HistoryTracker('.data/test-history.json', { maxEntries: 3 });

      for (let i = 1; i <= 5; i++) {
        await limitedTracker.record({
          timestamp: new Date().toISOString(),
          platform: 'discord',
          linkId: `card-${i}`,
          linkName: `Card ${i}`,
          category: 'credit_card',
          simulated: true,
          status: 'simulated',
        });
      }

      const recent = limitedTracker.getRecent(10);
      expect(recent.length).toBe(3);
      expect(recent[0].linkId).toBe('card-5');
      expect(recent[2].linkId).toBe('card-3');
    });

    it('manually prunes records beyond specified limit', async () => {
      for (let i = 1; i <= 6; i++) {
        await tracker.record({
          timestamp: new Date().toISOString(),
          platform: 'reddit',
          linkId: `card-${i}`,
          linkName: `Card ${i}`,
          category: 'credit_card',
          simulated: true,
          status: 'simulated',
        });
      }

      expect(tracker.getStats().total).toBe(6);
      const pruned = await tracker.prune(2);
      expect(pruned).toBe(4);
      expect(tracker.getStats().total).toBe(2);
      expect(tracker.getRecent()[0].linkId).toBe('card-6');
    });
  });
});
