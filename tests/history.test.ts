import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { HistoryTracker } from '../src/core/history.js';

describe('HistoryTracker', () => {
  const testHistoryPath = path.resolve(process.cwd(), '.data/test-history.json');
  const testLockPath = `${testHistoryPath}.lock`;
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
  };

  beforeEach(() => {
    cleanFiles();
    tracker = new HistoryTracker('.data/test-history.json');
  });

  afterEach(() => {
    cleanFiles();
  });

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
