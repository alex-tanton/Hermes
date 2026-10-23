import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ReferralRepeaterEngine } from '../src/core/engine.js';
import { HistoryTracker } from '../src/core/history.js';
import { AppConfig } from '../src/types/index.js';

describe('ReferralRepeaterEngine', () => {
  const testHistoryPath = path.resolve(process.cwd(), '.data/engine-test-history.json');
  let testHistory: HistoryTracker;

  const mockConfig: AppConfig = {
    dryRun: true,
    personalTouch: {
      authorName: 'Alex',
      philosophy: 'Max points & cash savings.',
      defaultAnecdote: 'Great card value.',
      includeFtcDisclosure: true,
      toneRotation: ['story', 'informative', 'deal_alert'],
    },
    schedule: {
      cron: '15 */6 * * *',
      jitterMinutes: 10,
      maxPostsPerDay: 5,
      linkCooldownHours: 24,
    },
    platforms: {
      reddit: {
        enabled: true,
        dryRun: true,
        targets: [{ name: 'churning', type: 'comment' }],
      },
      discord: {
        enabled: true,
        dryRun: true,
        targets: [{ channelName: 'deals', type: 'webhook' }],
      },
      twitter: {
        enabled: false, // disabled
      },
    },
    referralLinks: [
      {
        id: 'chase-sapphire',
        enabled: true,
        category: 'credit_card',
        provider: 'Chase',
        name: 'Chase Sapphire Preferred®',
        url: 'https://example.com/sapphire',
        bonusSummary: '75,000 bonus points',
        targetPlatforms: ['reddit', 'discord'],
      },
      {
        id: 'rakuten-shopping',
        enabled: true,
        category: 'shopping',
        provider: 'Rakuten',
        name: 'Rakuten Cash Back',
        url: 'https://example.com/rakuten',
        bonusSummary: '$30 bonus',
        targetPlatforms: ['discord'],
      },
      {
        id: 'disabled-card',
        enabled: false,
        category: 'credit_card',
        provider: 'Amex',
        name: 'Amex Gold',
        url: 'https://example.com/amex',
        bonusSummary: '60,000 points',
      },
    ],
  };

  beforeEach(() => {
    if (fs.existsSync(testHistoryPath)) {
      fs.unlinkSync(testHistoryPath);
    }
    testHistory = new HistoryTracker('.data/engine-test-history.json');
  });

  afterEach(() => {
    if (fs.existsSync(testHistoryPath)) {
      fs.unlinkSync(testHistoryPath);
    }
  });

  it('filters eligible links correctly for a given platform', () => {
    const engine = new ReferralRepeaterEngine(mockConfig, testHistory);

    const redditLinks = engine.getEligibleLinks('reddit');
    expect(redditLinks.length).toBe(1);
    expect(redditLinks[0].id).toBe('chase-sapphire');

    const discordLinks = engine.getEligibleLinks('discord');
    expect(discordLinks.length).toBe(2);

    // Disabled card should never be included
    expect(discordLinks.some((l) => l.id === 'disabled-card')).toBe(false);
  });

  it('filters links by category when requested', () => {
    const engine = new ReferralRepeaterEngine(mockConfig, testHistory);

    const shoppingLinks = engine.getEligibleLinks('discord', { filterCategory: 'shopping' });
    expect(shoppingLinks.length).toBe(1);
    expect(shoppingLinks[0].id).toBe('rakuten-shopping');
  });

  it('executes a safe dry-run posting cycle across active platforms', async () => {
    const engine = new ReferralRepeaterEngine(mockConfig, testHistory);

    const results = await engine.executeCycle({ dryRun: true });
    expect(results.length).toBe(2); // reddit and discord active

    for (const res of results) {
      expect(res.success).toBe(true);
      expect(res.simulated).toBe(true);
      expect(res.postId).toBeDefined();
    }

    // Verify results recorded in history
    expect(testHistory.getRecent().length).toBe(2);
  });

  it('respects link cooldowns after posting', async () => {
    const engine = new ReferralRepeaterEngine(mockConfig, testHistory);

    // First cycle posts chase-sapphire to reddit
    await engine.executeCycle({ filterPlatform: 'reddit' });
    expect(testHistory.getRecent().length).toBe(1);

    // Second cycle immediately after: chase-sapphire is cooling down
    const eligibleNow = engine.getEligibleLinks('reddit');
    expect(eligibleNow.length).toBe(0);

    // Second cycle should skip posting
    const resultsSecond = await engine.executeCycle({ filterPlatform: 'reddit' });
    expect(resultsSecond.length).toBe(0);

    // With --force, it should post anyway
    const resultsForced = await engine.executeCycle({ filterPlatform: 'reddit', force: true });
    expect(resultsForced.length).toBe(1);
  });

  it('halts cycles when daily post limit is exceeded', async () => {
    const limitedConfig: AppConfig = {
      ...mockConfig,
      schedule: {
        ...mockConfig.schedule,
        maxPostsPerDay: 1,
      },
    };

    const engine = new ReferralRepeaterEngine(limitedConfig, testHistory);

    // First post
    await engine.executeCycle({ filterPlatform: 'reddit' });
    expect(testHistory.getPostsInLast24Hours()).toBe(1);

    // Next post should be blocked by daily limit
    const secondResults = await engine.executeCycle();
    expect(secondResults.length).toBe(0);
  });
});
