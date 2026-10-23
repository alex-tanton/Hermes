import { describe, it, expect } from 'vitest';
import { RedditAdapter } from '../src/platforms/reddit.js';
import { FacebookAdapter } from '../src/platforms/facebook.js';
import { BlueskyAdapter } from '../src/platforms/bluesky.js';
import { DiscordAdapter } from '../src/platforms/discord.js';
import { TwitterAdapter } from '../src/platforms/twitter.js';
import { PostPayload } from '../src/types/index.js';

describe('Platform Adapters', () => {
  const samplePayload: PostPayload = {
    platform: 'reddit',
    referralLink: {
      id: 'test-card',
      enabled: true,
      category: 'credit_card',
      provider: 'Chase',
      name: 'Chase Freedom Unlimited',
      url: 'https://example.com/ref',
      bonusSummary: '$200 bonus',
    },
    title: 'Check out Freedom Unlimited',
    body: 'Great card for cashback',
    formattedContent:
      '### Check out Freedom Unlimited\n\nGreat card for cashback\n\nhttps://example.com/ref',
    tags: ['chase', 'creditcards'],
    tone: 'story',
  };

  describe('RedditAdapter', () => {
    it('validates credentials correctly', () => {
      const invalidAdapter = new RedditAdapter({
        config: { enabled: true, credentials: {} },
      });
      expect(invalidAdapter.validateCredentials().valid).toBe(false);

      const validAdapter = new RedditAdapter({
        config: {
          enabled: true,
          credentials: {
            clientId: 'cid',
            clientSecret: 'csec',
            username: 'usr',
            password: 'pwd',
          },
        },
      });
      expect(validAdapter.validateCredentials().valid).toBe(true);
    });

    it('simulates posts safely in dryRun mode', async () => {
      const adapter = new RedditAdapter({
        config: {
          enabled: true,
          dryRun: true,
          targets: [{ name: 'churning', type: 'comment' }],
        },
      });

      const result = await adapter.post(samplePayload);
      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
      expect(result.targetDestination).toContain('r/churning');
      expect(result.messagePreview).toBe(samplePayload.formattedContent);
    });

    it('fails safely when live mode attempted without credentials', async () => {
      const adapter = new RedditAdapter({
        config: { enabled: true, dryRun: false },
      });

      const result = await adapter.post(samplePayload, { dryRun: false });
      expect(result.success).toBe(false);
      expect(result.simulated).toBe(false);
      expect(result.error).toContain('Cannot post live to Reddit');
    });
  });

  describe('FacebookAdapter', () => {
    it('validates access token credential', () => {
      const adapter = new FacebookAdapter({
        config: { enabled: true, credentials: {} },
      });
      expect(adapter.validateCredentials().valid).toBe(false);

      const validAdapter = new FacebookAdapter({
        config: { enabled: true, credentials: { accessToken: 'valid_token' } },
      });
      expect(validAdapter.validateCredentials().valid).toBe(true);
    });

    it('simulates posts in dryRun mode', async () => {
      const adapter = new FacebookAdapter({
        config: {
          enabled: true,
          dryRun: true,
          targets: [{ id: 'group_123', name: 'Credit Cards', type: 'group' }],
        },
      });

      const result = await adapter.post({ ...samplePayload, platform: 'facebook' });
      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
      expect(result.targetDestination).toContain('Credit Cards');
    });
  });

  describe('BlueskyAdapter', () => {
    it('validates identifier and password', () => {
      const adapter = new BlueskyAdapter({
        config: { enabled: true, credentials: { identifier: 'handle.bsky.social' } },
      });
      expect(adapter.validateCredentials().valid).toBe(false);

      const validAdapter = new BlueskyAdapter({
        config: {
          enabled: true,
          credentials: { identifier: 'handle.bsky.social', password: 'app-password' },
        },
      });
      expect(validAdapter.validateCredentials().valid).toBe(true);
    });

    it('simulates posts in dryRun mode', async () => {
      const adapter = new BlueskyAdapter({
        config: { enabled: true, dryRun: true },
      });

      const result = await adapter.post({ ...samplePayload, platform: 'bluesky' });
      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
      expect(result.postUrl).toContain('mock.bluesky.com');
    });
  });

  describe('DiscordAdapter', () => {
    it('validates webhookUrl or botToken', () => {
      const adapter = new DiscordAdapter({
        config: { enabled: true, credentials: {} },
      });
      expect(adapter.validateCredentials().valid).toBe(false);

      const validAdapter = new DiscordAdapter({
        config: {
          enabled: true,
          credentials: { webhookUrl: 'https://discord.com/api/webhooks/123/abc' },
        },
      });
      expect(validAdapter.validateCredentials().valid).toBe(true);
    });

    it('simulates posts in dryRun mode', async () => {
      const adapter = new DiscordAdapter({
        config: {
          enabled: true,
          dryRun: true,
          targets: [{ channelName: 'referrals', type: 'webhook' }],
        },
      });

      const result = await adapter.post({ ...samplePayload, platform: 'discord' });
      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
      expect(result.targetDestination).toContain('#referrals');
    });
  });

  describe('TwitterAdapter', () => {
    it('validates complete API v2 credentials', () => {
      const adapter = new TwitterAdapter({
        config: { enabled: true, credentials: { apiKey: 'key' } },
      });
      expect(adapter.validateCredentials().valid).toBe(false);

      const validAdapter = new TwitterAdapter({
        config: {
          enabled: true,
          credentials: {
            apiKey: 'key',
            apiSecret: 'secret',
            accessToken: 'token',
            accessSecret: 'access_secret',
          },
        },
      });
      expect(validAdapter.validateCredentials().valid).toBe(true);
    });

    it('simulates posts in dryRun mode', async () => {
      const adapter = new TwitterAdapter({
        config: { enabled: true, dryRun: true },
      });

      const result = await adapter.post({ ...samplePayload, platform: 'twitter' });
      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
      expect(result.targetDestination).toContain('Timeline');
    });
  });
});
