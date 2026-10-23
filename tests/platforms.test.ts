import { describe, it, expect, vi, afterEach } from 'vitest';
import { RedditAdapter } from '../src/platforms/reddit.js';
import { FacebookAdapter } from '../src/platforms/facebook.js';
import { BlueskyAdapter } from '../src/platforms/bluesky.js';
import { DiscordAdapter } from '../src/platforms/discord.js';
import { TwitterAdapter } from '../src/platforms/twitter.js';
import { generateOAuth1Header, rfc3986Encode } from '../src/platforms/oauth1.js';
import { PostPayload } from '../src/types/index.js';

describe('Platform Adapters', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  describe('OAuth1Signer', () => {
    it('correctly encodes characters according to RFC 3986', () => {
      expect(rfc3986Encode('hello world')).toBe('hello%20world');
      expect(rfc3986Encode("foo!*'()bar")).toBe('foo%21%2A%27%28%29bar');
      expect(rfc3986Encode('a~b-c_d.e')).toBe('a~b-c_d.e');
    });

    it('generates a valid OAuth 1.0a header with all required parameters', () => {
      const header = generateOAuth1Header(
        { method: 'POST', url: 'https://api.twitter.com/2/tweets' },
        {
          apiKey: 'test-api-key',
          apiSecret: 'test-api-secret',
          accessToken: 'test-token',
          accessSecret: 'test-secret',
        },
        {
          nonce: 'test-nonce-12345',
          timestamp: '1600000000',
        },
      );

      expect(header).toMatch(/^OAuth /);
      expect(header).toContain('oauth_consumer_key="test-api-key"');
      expect(header).toContain('oauth_nonce="test-nonce-12345"');
      expect(header).toContain('oauth_signature_method="HMAC-SHA1"');
      expect(header).toContain('oauth_timestamp="1600000000"');
      expect(header).toContain('oauth_token="test-token"');
      expect(header).toContain('oauth_version="1.0"');
      expect(header).toContain('oauth_signature=');
    });

    it('produces deterministic signature for fixed inputs', () => {
      const header1 = generateOAuth1Header(
        { method: 'POST', url: 'https://api.twitter.com/2/tweets' },
        {
          apiKey: 'key',
          apiSecret: 'secret',
          accessToken: 'token',
          accessSecret: 'token_secret',
        },
        {
          nonce: 'nonce1',
          timestamp: '1700000000',
        },
      );

      const header2 = generateOAuth1Header(
        { method: 'POST', url: 'https://api.twitter.com/2/tweets' },
        {
          apiKey: 'key',
          apiSecret: 'secret',
          accessToken: 'token',
          accessSecret: 'token_secret',
        },
        {
          nonce: 'nonce1',
          timestamp: '1700000000',
        },
      );

      expect(header1).toBe(header2);
    });
  });

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

    it('dispatches live feed post to Meta Graph API v19.0 endpoint', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'page_post_999' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const adapter = new FacebookAdapter({
        config: {
          enabled: true,
          dryRun: false,
          credentials: { accessToken: 'meta_test_token' },
          targets: [{ id: 'feed', name: 'Profile Feed', type: 'feed' }],
        },
      });

      const result = await adapter.post(
        { ...samplePayload, platform: 'facebook' },
        { dryRun: false },
      );
      expect(result.success).toBe(true);
      expect(result.simulated).toBe(false);
      expect(result.postId).toBe('page_post_999');
      expect(result.postUrl).toBe('https://www.facebook.com/page_post_999');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://graph.facebook.com/v19.0/me/feed');
      expect(init.method).toBe('POST');
      expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      expect(init.body).toContain('access_token=meta_test_token');
    });

    it('handles Graph API error response gracefully into structured PostResult', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          json: async () => ({
            error: { message: 'Invalid OAuth access token.', type: 'OAuthException', code: 190 },
          }),
        }),
      );

      const adapter = new FacebookAdapter({
        config: {
          enabled: true,
          dryRun: false,
          credentials: { accessToken: 'expired_token' },
        },
      });

      const result = await adapter.post(
        { ...samplePayload, platform: 'facebook' },
        { dryRun: false },
      );
      expect(result.success).toBe(false);
      expect(result.simulated).toBe(false);
      expect(result.error).toContain(
        'Facebook Graph API failed [HTTP 400]: Invalid OAuth access token.',
      );
    });

    it('handles network timeout without throwing', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockRejectedValue(
            new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
          ),
      );

      const adapter = new FacebookAdapter({
        config: {
          enabled: true,
          dryRun: false,
          credentials: { accessToken: 'token' },
        },
      });

      const result = await adapter.post(
        { ...samplePayload, platform: 'facebook' },
        { dryRun: false },
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out after 10000ms');
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

    it('authenticates session and creates record in live mode', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            accessJwt: 'valid_jwt_token',
            did: 'did:plc:testuser123',
            handle: 'testuser.bsky.social',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            uri: 'at://did:plc:testuser123/app.bsky.feed.post/3kxyz789abc',
            cid: 'cid_hash_987',
          }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const adapter = new BlueskyAdapter({
        config: {
          enabled: true,
          dryRun: false,
          credentials: {
            identifier: 'testuser.bsky.social',
            password: 'app-password-xyz',
          },
        },
      });

      const result = await adapter.post(
        { ...samplePayload, platform: 'bluesky' },
        { dryRun: false },
      );
      expect(result.success).toBe(true);
      expect(result.simulated).toBe(false);
      expect(result.postId).toBe('3kxyz789abc');
      expect(result.postUrl).toBe('https://bsky.app/profile/testuser.bsky.social/post/3kxyz789abc');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://bsky.social/xrpc/com.atproto.server.createSession',
      );
      expect(fetchMock.mock.calls[1][0]).toBe(
        'https://bsky.social/xrpc/com.atproto.repo.createRecord',
      );
      expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer valid_jwt_token');
    });

    it('handles session auth failure without throwing', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          json: async () => ({ message: 'Invalid identifier or password' }),
        }),
      );

      const adapter = new BlueskyAdapter({
        config: {
          enabled: true,
          dryRun: false,
          credentials: { identifier: 'baduser.bsky.social', password: 'wrong' },
        },
      });

      const result = await adapter.post(
        { ...samplePayload, platform: 'bluesky' },
        { dryRun: false },
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Bluesky authentication failed [HTTP 401]');
    });

    it('handles record creation failure after auth without throwing', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            accessJwt: 'jwt_123',
            did: 'did:plc:user1',
            handle: 'user1.bsky.social',
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ message: 'Post exceeds character limit' }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const adapter = new BlueskyAdapter({
        config: {
          enabled: true,
          dryRun: false,
          credentials: { identifier: 'user1.bsky.social', password: 'pass' },
        },
      });

      const result = await adapter.post(
        { ...samplePayload, platform: 'bluesky' },
        { dryRun: false },
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Bluesky post creation failed [HTTP 400]');
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

    it('dispatches live webhook with wait=true and returns message ID and URL', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: '123456789012345678',
          channel_id: '987654321098765432',
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const adapter = new DiscordAdapter({
        config: {
          enabled: true,
          dryRun: false,
          credentials: { webhookUrl: 'https://discord.com/api/webhooks/111/secret_token' },
          targets: [{ channelName: 'deals', type: 'webhook' }],
        },
      });

      const result = await adapter.post(
        { ...samplePayload, platform: 'discord' },
        { dryRun: false },
      );
      expect(result.success).toBe(true);
      expect(result.simulated).toBe(false);
      expect(result.postId).toBe('123456789012345678');
      expect(result.postUrl).toBe(
        'https://discord.com/channels/@me/987654321098765432/123456789012345678',
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://discord.com/api/webhooks/111/secret_token?wait=true');
      expect(init.method).toBe('POST');
      const body = JSON.parse(init.body);
      expect(body.content).toBe(samplePayload.formattedContent);
    });

    it('handles Discord webhook HTTP error response gracefully', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          json: async () => ({ message: 'Cannot send an empty message', code: 50006 }),
        }),
      );

      const adapter = new DiscordAdapter({
        config: {
          enabled: true,
          dryRun: false,
          credentials: { webhookUrl: 'https://discord.com/api/webhooks/111/token' },
        },
      });

      const result = await adapter.post(
        { ...samplePayload, platform: 'discord' },
        { dryRun: false },
      );
      expect(result.success).toBe(false);
      expect(result.simulated).toBe(false);
      expect(result.error).toContain(
        'Discord webhook failed [HTTP 400]: Cannot send an empty message',
      );
    });

    it('handles Discord webhook network timeout without throwing', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockRejectedValue(
            new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
          ),
      );

      const adapter = new DiscordAdapter({
        config: {
          enabled: true,
          dryRun: false,
          credentials: { webhookUrl: 'https://discord.com/api/webhooks/111/token' },
        },
      });

      const result = await adapter.post(
        { ...samplePayload, platform: 'discord' },
        { dryRun: false },
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out after 10000ms');
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
