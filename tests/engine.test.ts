import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { HermesEngine } from '../src/core/engine.js';
import { HistoryTracker } from '../src/core/history.js';
import { AppConfig } from '../src/types/index.js';

describe('HermesEngine', () => {
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
    const engine = new HermesEngine(mockConfig, testHistory);

    const redditLinks = engine.getEligibleLinks('reddit');
    expect(redditLinks.length).toBe(1);
    expect(redditLinks[0].id).toBe('chase-sapphire');

    const discordLinks = engine.getEligibleLinks('discord');
    expect(discordLinks.length).toBe(2);

    // Disabled card should never be included
    expect(discordLinks.some((l) => l.id === 'disabled-card')).toBe(false);
  });

  it('filters links by category when requested', () => {
    const engine = new HermesEngine(mockConfig, testHistory);

    const shoppingLinks = engine.getEligibleLinks('discord', { filterCategory: 'shopping' });
    expect(shoppingLinks.length).toBe(1);
    expect(shoppingLinks[0].id).toBe('rakuten-shopping');
  });

  it('executes a safe dry-run posting cycle across active platforms', async () => {
    const engine = new HermesEngine(mockConfig, testHistory);

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
    const engine = new HermesEngine(mockConfig, testHistory);

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

    const engine = new HermesEngine(limitedConfig, testHistory);

    // First post
    await engine.executeCycle({ filterPlatform: 'reddit' });
    expect(testHistory.getPostsInLast24Hours()).toBe(1);

    // Next post should be blocked by daily limit
    const secondResults = await engine.executeCycle();
    expect(secondResults.length).toBe(0);
  });

  it('respects per-platform cooldown override', async () => {
    const platformCooldownConfig: AppConfig = {
      ...mockConfig,
      schedule: {
        ...mockConfig.schedule,
        linkCooldownHours: 24, // Global default 24h
      },
      platforms: {
        reddit: {
          enabled: true,
          dryRun: true,
          cooldownHours: 720, // 30-day megathread rule
          targets: [{ name: 'churning', type: 'comment' }],
        },
        discord: {
          enabled: true,
          dryRun: true,
          cooldownHours: 12, // 12-hour fast rotation
          targets: [{ channelName: 'deals', type: 'webhook' }],
        },
      },
    };

    const engine = new HermesEngine(platformCooldownConfig, testHistory);

    // Record posts made 13 hours ago for both platforms
    const thirteenHoursAgo = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();
    await testHistory.record({
      timestamp: thirteenHoursAgo,
      platform: 'reddit',
      linkId: 'chase-sapphire',
      linkName: 'Chase Sapphire Preferred®',
      category: 'credit_card',
      simulated: true,
      status: 'simulated',
    });
    await testHistory.record({
      timestamp: thirteenHoursAgo,
      platform: 'discord',
      linkId: 'chase-sapphire',
      linkName: 'Chase Sapphire Preferred®',
      category: 'credit_card',
      simulated: true,
      status: 'simulated',
    });

    // Reddit requires 720h cooldown -> 13 hours is NOT enough -> ineligible
    const redditLinks = engine.getEligibleLinks('reddit');
    expect(redditLinks.map((l) => l.id)).not.toContain('chase-sapphire');

    // Discord requires only 12h cooldown -> 13 hours IS enough -> eligible
    const discordLinks = engine.getEligibleLinks('discord');
    expect(discordLinks.map((l) => l.id)).toContain('chase-sapphire');
  });

  it('enforces per-platform daily post limits independently without aborting other platforms', async () => {
    const platformCapConfig: AppConfig = {
      ...mockConfig,
      schedule: {
        ...mockConfig.schedule,
        maxPostsPerDay: 10, // Global limit 10
      },
      platforms: {
        reddit: {
          enabled: true,
          dryRun: true,
          maxPostsPerDay: 1, // Reddit capped at 1
          targets: [{ name: 'churning', type: 'comment' }],
        },
        discord: {
          enabled: true,
          dryRun: true,
          maxPostsPerDay: 5, // Discord capped at 5
          targets: [{ channelName: 'deals', type: 'webhook' }],
        },
      },
    };

    const engine = new HermesEngine(platformCapConfig, testHistory);

    // Seed 1 post on reddit within the last 24h
    await testHistory.record({
      timestamp: new Date().toISOString(),
      platform: 'reddit',
      linkId: 'chase-sapphire',
      linkName: 'Chase Sapphire Preferred®',
      category: 'credit_card',
      simulated: true,
      status: 'simulated',
    });

    expect(testHistory.getPostsInLast24Hours('reddit')).toBe(1);
    expect(testHistory.getPostsInLast24Hours('discord')).toBe(0);

    // Execute cycle with force: false
    // Reddit should be skipped because 1 >= maxPostsPerDay (1)
    // Discord should post rakuten-shopping (or chase-sapphire if force/cooldown allows)
    const results = await engine.executeCycle();

    expect(results.length).toBe(1);
    expect(results[0].platform).toBe('discord');
  });

  it('rotates links fairly in round-robin fashion when priority is equal', async () => {
    const rotationConfig: AppConfig = {
      ...mockConfig,
      schedule: {
        ...mockConfig.schedule,
        linkCooldownHours: 1,
      },
      platforms: {
        discord: {
          enabled: true,
          dryRun: true,
          targets: [{ channelName: 'deals', type: 'webhook' }],
        },
      },
      referralLinks: [
        {
          id: 'card-a',
          enabled: true,
          category: 'credit_card',
          provider: 'Bank A',
          name: 'Card A',
          url: 'https://example.com/a',
          bonusSummary: 'Bonus A',
          priority: 50,
        },
        {
          id: 'card-b',
          enabled: true,
          category: 'credit_card',
          provider: 'Bank B',
          name: 'Card B',
          url: 'https://example.com/b',
          bonusSummary: 'Bonus B',
          priority: 50,
        },
        {
          id: 'card-c',
          enabled: true,
          category: 'credit_card',
          provider: 'Bank C',
          name: 'Card C',
          url: 'https://example.com/c',
          bonusSummary: 'Bonus C',
          priority: 50,
        },
      ],
    };

    const engine = new HermesEngine(rotationConfig, testHistory);

    // Initial cycle: none have been posted, picks Card A
    const res1 = await engine.executeCycle({ filterPlatform: 'discord' });
    expect(res1[0].linkId).toBe('card-a');

    // Second cycle: Card A is in cooldown; Card B and C are unposted -> picks Card B
    const res2 = await engine.executeCycle({ filterPlatform: 'discord' });
    expect(res2[0].linkId).toBe('card-b');

    // Third cycle: Card A and B in cooldown; Card C is unposted -> picks Card C
    const res3 = await engine.executeCycle({ filterPlatform: 'discord' });
    expect(res3[0].linkId).toBe('card-c');

    // Now advance time so all 3 cooldowns expire: Card A was posted first (least recent)
    // Manually backdate history records to simulate 2+ hours elapsed
    const now = Date.now();
    await testHistory.clear();
    await testHistory.record({
      timestamp: new Date(now - 3 * 3600000).toISOString(),
      platform: 'discord',
      linkId: 'card-a',
      linkName: 'Card A',
      category: 'credit_card',
      simulated: true,
      status: 'simulated',
    });
    await testHistory.record({
      timestamp: new Date(now - 2 * 3600000).toISOString(),
      platform: 'discord',
      linkId: 'card-b',
      linkName: 'Card B',
      category: 'credit_card',
      simulated: true,
      status: 'simulated',
    });
    await testHistory.record({
      timestamp: new Date(now - 1 * 3600000).toISOString(),
      platform: 'discord',
      linkId: 'card-c',
      linkName: 'Card C',
      category: 'credit_card',
      simulated: true,
      status: 'simulated',
    });

    // All are eligible; Card A is the least recently posted -> fair round robin selects Card A!
    const eligible = engine.getEligibleLinks('discord');
    expect(eligible.map((l) => l.id)).toEqual(['card-a', 'card-b', 'card-c']);
  });

  it('respects link priority weighting over lower priority links', async () => {
    const priorityConfig: AppConfig = {
      ...mockConfig,
      schedule: {
        ...mockConfig.schedule,
        linkCooldownHours: 24,
      },
      platforms: {
        discord: {
          enabled: true,
          dryRun: true,
          targets: [{ channelName: 'deals', type: 'webhook' }],
        },
      },
      referralLinks: [
        {
          id: 'card-low',
          enabled: true,
          category: 'credit_card',
          provider: 'Bank Low',
          name: 'Low Priority Card',
          url: 'https://example.com/low',
          bonusSummary: 'Low bonus',
          priority: 20,
        },
        {
          id: 'card-high',
          enabled: true,
          category: 'credit_card',
          provider: 'Bank High',
          name: 'High Priority Card',
          url: 'https://example.com/high',
          bonusSummary: 'Huge bonus',
          priority: 95,
        },
      ],
    };

    const engine = new HermesEngine(priorityConfig, testHistory);

    // Both eligible: high priority selected first
    const eligible1 = engine.getEligibleLinks('discord');
    expect(eligible1[0].id).toBe('card-high');

    // Post high priority card
    await engine.executeCycle({ filterPlatform: 'discord' });

    // Now high priority is in cooldown; low priority is selected
    const eligible2 = engine.getEligibleLinks('discord');
    expect(eligible2.length).toBe(1);
    expect(eligible2[0].id).toBe('card-low');
  });

  it('backs off platforms encountering rate limits (429)', async () => {
    const engine = new HermesEngine(mockConfig, testHistory);
    expect(engine.isPlatformBackingOff('discord')).toBe(false);

    engine.setPlatformBackoff('discord', 5000);
    expect(engine.isPlatformBackingOff('discord')).toBe(true);

    // executeCycle should skip discord while backing off
    const results = await engine.executeCycle({ filterPlatform: 'discord' });
    expect(results.length).toBe(0);

    // Clearing backoff allows execution again
    engine.clearPlatformBackoffs();
    expect(engine.isPlatformBackingOff('discord')).toBe(false);
    const resultsAfter = await engine.executeCycle({ filterPlatform: 'discord' });
    expect(resultsAfter.length).toBe(1);
  });
});
