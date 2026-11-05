import { describe, it, expect, vi, afterEach } from 'vitest';
import { RedditAdapter } from '../src/platforms/reddit.js';
import { FacebookAdapter } from '../src/platforms/facebook.js';
import { BlueskyAdapter } from '../src/platforms/bluesky.js';
import { DiscordAdapter } from '../src/platforms/discord.js';
import { TwitterAdapter } from '../src/platforms/twitter.js';
import { Scraper } from 'agent-twitter-client';
import { BasePlatformAdapter } from '../src/platforms/base.js';
import { PlatformRegistry } from '../src/platforms/registry.js';
import { generateOAuth1Header, rfc3986Encode } from '../src/platforms/oauth1.js';
import { PostPayload, PostResult } from '../src/types/index.js';

class MockBaseAdapter extends BasePlatformAdapter {
  public readonly name = 'twitter'; // Use valid platform type
  public validateCredentials() {
    return { valid: true };
  }
  public async post() {
    return { success: true } as unknown as PostResult;
  }
  public async testExtractErrorMessage(res: Response) {
    return this.extractErrorMessage(res);
  }
}

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

      const tokenAdapter = new RedditAdapter({
        config: {
          enabled: true,
          credentials: { accessToken: 'devvit_token_xyz' },
        },
      });
      const tokenValidation = tokenAdapter.validateCredentials();
      expect(tokenValidation.valid).toBe(true);
      expect(tokenValidation.reason).toContain('access token');
    });

    it('posts successfully using Devvit accessToken without password grant call', async () => {
      let oauthFetchCalled = false;
      let submitFetchCalled = false;

      const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes('/api/v1/access_token')) {
          oauthFetchCalled = true;
          return Promise.resolve(new Response(JSON.stringify({ access_token: 'old_token' })));
        }
        if (url.includes('/api/submit')) {
          submitFetchCalled = true;
          expect(init?.headers).toBeDefined();
          const authHeader = (init?.headers as Record<string, string>)['Authorization'];
          expect(authHeader).toBe('Bearer devvit_token_xyz');
          return Promise.resolve(
            new Response(
              JSON.stringify({
                json: {
                  data: {
                    name: 't3_devvit_test',
                    url: 'https://reddit.com/r/test/comments/t3_devvit_test',
                  },
                },
              }),
            ),
          );
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      vi.stubGlobal('fetch', fetchMock);

      const adapter = new RedditAdapter({
        config: {
          enabled: true,
          dryRun: false,
          credentials: { accessToken: 'devvit_token_xyz' },
          targets: [{ name: 'test', type: 'post' }],
        },
      });

      const result = await adapter.post(samplePayload, { dryRun: false });
      expect(result.success).toBe(true);
      expect(oauthFetchCalled).toBe(false);
      expect(submitFetchCalled).toBe(true);
      expect(result.postId).toBe('t3_devvit_test');

      vi.unstubAllGlobals();
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

    it('respects link-level targetSubreddit override', async () => {
      const adapter = new RedditAdapter({
        config: {
          enabled: true,
          dryRun: true,
          targets: [{ name: 'churning', type: 'comment' }],
        },
      });

      const payloadWithSubreddit: PostPayload = {
        ...samplePayload,
        referralLink: {
          ...samplePayload.referralLink,
          targetSubreddit: 'coupons',
        },
      };

      const result = await adapter.post(payloadWithSubreddit);
      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
      expect(result.targetDestination).toContain('r/coupons (post)');
    });

    it('respects link-level targetSubreddits and inherits global target flair', async () => {
      const adapter = new RedditAdapter({
        config: {
          enabled: true,
          dryRun: true,
          targets: [
            { name: 'referralcodes', type: 'post', flair: 'Credit Cards' },
            { name: 'deals', type: 'post', flair: 'Shopping' },
          ],
        },
      });

      const payloadWithLinkTargets: PostPayload = {
        ...samplePayload,
        referralLink: {
          ...samplePayload.referralLink,
          targetSubreddits: ['deals'],
        },
      };

      const result = await adapter.post(payloadWithLinkTargets);
      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
      expect(result.targetDestination).toContain('r/deals (post [Shopping])');
    });

    it('extracts thread ID and posts bare link when targetSubreddit is a thread URL', async () => {
      const adapter = new RedditAdapter({
        config: {
          enabled: true,
          dryRun: true,
          targets: [],
        },
      });

      const threadUrlPayload: PostPayload = {
        ...samplePayload,
        referralLink: {
          ...samplePayload.referralLink,
          url: 'https://www.americanexpress.com/ref/example',
          targetSubreddit:
            'https://www.reddit.com/r/churningreferrals/comments/1xntgp4/referrals_american_express_platinum/',
        },
      };

      const result = await adapter.post(threadUrlPayload);
      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
      expect(result.targetDestination).toBe('r/churningreferrals (comment on thread 1xntgp4)');
      // For referral thread comments, it should ONLY post the bare link
      expect(result.messagePreview).toBe('https://www.americanexpress.com/ref/example');
    });

    it('resolves target megathread via GET search in dry-run mode without submitting write requests', async () => {
      let getSearchCalled = false;
      let postCommentCalled = false;

      const fetchMock = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
        if (url.includes('/search') && (!opts?.method || opts.method === 'GET')) {
          getSearchCalled = true;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                children: [
                  {
                    data: {
                      name: 't3_1slcw85',
                      title: '[referrals] Chase Freedom Unlimited',
                      permalink:
                        '/r/churningreferrals/comments/1slcw85/referrals_chase_freedom_unlimited/',
                    },
                  },
                ],
              },
            }),
          };
        }
        if (url.includes('/api/comment') || url.includes('/api/submit')) {
          postCommentCalled = true;
          return { ok: true, status: 200, json: async () => ({}) };
        }
        return { ok: false, status: 404 };
      });

      vi.stubGlobal('fetch', fetchMock);

      const adapter = new RedditAdapter({
        config: {
          enabled: true,
          dryRun: true,
          credentials: { accessToken: 'test_devvit_token' },
          targets: [],
        },
      });

      const searchPayload: PostPayload = {
        ...samplePayload,
        referralLink: {
          ...samplePayload.referralLink,
          url: 'https://www.referyourchasecard.com/18s/FIG0CQ5GP4',
          targetSubreddit: {
            name: 'churningreferrals',
            type: 'comment',
            searchQuery: 'Referrals Chase Freedom Unlimited',
            linkOnly: true,
          },
        },
      };

      const result = await adapter.post(searchPayload, { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
      expect(getSearchCalled).toBe(true);
      expect(postCommentCalled).toBe(false);
      expect(result.targetDestination).toBe(
        'r/churningreferrals (comment on "[referrals] Chase Freedom Unlimited")',
      );
      expect(result.postUrl).toBe(
        'https://www.reddit.com/r/churningreferrals/comments/1slcw85/referrals_chase_freedom_unlimited/',
      );
      expect(result.messagePreview).toBe('https://www.referyourchasecard.com/18s/FIG0CQ5GP4');

      vi.unstubAllGlobals();
    });

    it('submits live comment with thing_id and bare link to Reddit API', async () => {
      let commentApiCalled = false;
      let capturedBody: string | null = null;

      const fetchMock = vi.fn().mockImplementation(async (url: string, opts: RequestInit) => {
        if (url.includes('/api/comment')) {
          commentApiCalled = true;
          capturedBody = opts.body as string;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              json: {
                data: {
                  things: [{ data: { id: 't1_comment123', name: 't1_comment123' } }],
                },
              },
            }),
          };
        }
        return { ok: false, status: 404, text: async () => 'Not found' };
      });

      vi.stubGlobal('fetch', fetchMock);

      const adapter = new RedditAdapter({
        config: {
          enabled: true,
          dryRun: false,
          credentials: { accessToken: 'test_token' },
        },
      });

      const liveCommentPayload: PostPayload = {
        ...samplePayload,
        referralLink: {
          ...samplePayload.referralLink,
          url: 'https://www.americanexpress.com/ref/live_example',
          targetSubreddit: {
            name: 'churningreferrals',
            type: 'comment',
            threadId: '1xntgp4',
            linkOnly: true,
          },
        },
      };

      const result = await adapter.post(liveCommentPayload, { dryRun: false });
      expect(result.success).toBe(true);
      expect(result.simulated).toBe(false);
      expect(commentApiCalled).toBe(true);
      expect(capturedBody).toContain('thing_id=t3_1xntgp4');
      expect(capturedBody).toContain(
        'text=https%3A%2F%2Fwww.americanexpress.com%2Fref%2Flive_example',
      );
      expect(result.messagePreview).toBe('https://www.americanexpress.com/ref/live_example');

      vi.unstubAllGlobals();
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

    it('authenticates via OAuth2 and submits live self-post', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'reddit_access_token_123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            json: {
              errors: [],
              data: {
                id: 't3_sub123',
                name: 't3_sub123',
                url: 'https://www.reddit.com/r/churning/comments/t3_sub123',
              },
            },
          }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const adapter = new RedditAdapter({
        config: {
          enabled: true,
          dryRun: false,
          credentials: {
            clientId: 'r_cid',
            clientSecret: 'r_csec',
            username: 'test_churner',
            password: 'secret_password',
          },
          targets: [{ name: 'churning', type: 'post' }],
        },
      });

      const result = await adapter.post(samplePayload, { dryRun: false });
      expect(result.success).toBe(true);
      expect(result.simulated).toBe(false);
      expect(result.postId).toBe('t3_sub123');
      expect(result.postUrl).toBe('https://www.reddit.com/r/churning/comments/t3_sub123');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      // Check auth call
      expect(fetchMock.mock.calls[0][0]).toBe('https://www.reddit.com/api/v1/access_token');
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toContain('Basic ');
      // Check submit call
      expect(fetchMock.mock.calls[1][0]).toBe('https://oauth.reddit.com/api/submit');
      expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(
        'Bearer reddit_access_token_123',
      );
    });

    it('submits live comment when target type is comment', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'reddit_comment_token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            json: {
              errors: [],
              data: {
                id: 't1_comment456',
                name: 't1_comment456',
              },
            },
          }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const adapter = new RedditAdapter({
        config: {
          enabled: true,
          dryRun: false,
          credentials: {
            clientId: 'r_cid',
            clientSecret: 'r_csec',
            username: 'commenter',
            password: 'pwd',
          },
          targets: [{ name: 't3_parent_thread', type: 'comment' }],
        },
      });

      const result = await adapter.post(samplePayload, { dryRun: false });
      expect(result.success).toBe(true);
      expect(result.simulated).toBe(false);
      expect(result.postId).toBe('t1_comment456');

      expect(fetchMock.mock.calls[1][0]).toBe('https://oauth.reddit.com/api/comment');
    });

    it('handles Reddit in-body errors (json.errors) gracefully', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ access_token: 'valid_token' }),
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
              json: {
                errors: [['RATELIMIT', 'You are doing that too much', 'ratelimit']],
              },
            }),
          }),
      );

      const adapter = new RedditAdapter({
        config: {
          enabled: true,
          dryRun: false,
          credentials: {
            clientId: 'cid',
            clientSecret: 'csec',
            username: 'usr',
            password: 'pwd',
          },
        },
      });

      const result = await adapter.post(samplePayload, { dryRun: false });
      expect(result.success).toBe(false);
      expect(result.simulated).toBe(false);
      expect(result.error).toContain(
        'Reddit API error: RATELIMIT: You are doing that too much: ratelimit',
      );
    });

    it('handles Reddit OAuth2 authentication rejection', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          text: async () => '{"error": "invalid_grant"}',
        }),
      );

      const adapter = new RedditAdapter({
        config: {
          enabled: true,
          dryRun: false,
          credentials: {
            clientId: 'cid',
            clientSecret: 'csec',
            username: 'usr',
            password: 'bad_password',
          },
        },
      });

      const result = await adapter.post(samplePayload, { dryRun: false });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Reddit authentication failed [HTTP 401]');
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

    it('validates session cookie credentials (authToken and ct0)', () => {
      const adapter = new TwitterAdapter({
        config: {
          enabled: true,
          credentials: { authToken: 'test-auth-token', ct0: 'test-ct0' },
        },
      });
      const validation = adapter.validateCredentials();
      expect(validation.valid).toBe(true);
      expect(validation.reason).toContain('cookies');
    });

    it('validates account login credentials (username and password)', () => {
      const adapter = new TwitterAdapter({
        config: {
          enabled: true,
          credentials: { username: 'testuser', password: 'testpassword' },
        },
      });
      const validation = adapter.validateCredentials();
      expect(validation.valid).toBe(true);
      expect(validation.reason).toContain('account');
    });

    it('dispatches live tweet via Scraper using session cookies (no API v2 keys required)', async () => {
      const mockSetCookies = vi.fn().mockResolvedValue(undefined);
      const mockSendTweet = vi.fn().mockResolvedValue({
        json: async () => ({
          data: {
            create_tweet: {
              tweet_results: {
                result: {
                  rest_id: '1850000000000000001',
                },
              },
            },
          },
        }),
      });

      const mockScraper = {
        setCookies: mockSetCookies,
        sendTweet: mockSendTweet,
      };

      const adapter = new TwitterAdapter({
        config: {
          enabled: true,
          dryRun: false,
          credentials: {
            authToken: 'cookie_auth_token_123',
            ct0: 'cookie_ct0_456',
          },
        },
        scraper: mockScraper as unknown as Scraper,
      });

      const result = await adapter.post(
        { ...samplePayload, platform: 'twitter' },
        { dryRun: false },
      );

      expect(result.success).toBe(true);
      expect(result.simulated).toBe(false);
      expect(result.postId).toBe('1850000000000000001');
      expect(result.postUrl).toBe('https://x.com/i/web/status/1850000000000000001');

      expect(mockSetCookies).toHaveBeenCalledTimes(1);
      const cookiesPassed = mockSetCookies.mock.calls[0][0];
      expect(cookiesPassed).toEqual(
        expect.arrayContaining([
          expect.stringContaining('auth_token=cookie_auth_token_123'),
          expect.stringContaining('ct0=cookie_ct0_456'),
        ]),
      );
      expect(mockSendTweet).toHaveBeenCalledWith(samplePayload.formattedContent);
    });

    it('dispatches live tweet via Scraper using account login credentials', async () => {
      const mockLogin = vi.fn().mockResolvedValue(undefined);
      const mockSendTweet = vi.fn().mockResolvedValue({
        json: async () => ({
          data: {
            create_tweet: {
              tweet_results: {
                result: {
                  rest_id: '1850000000000000002',
                },
              },
            },
          },
        }),
      });

      const mockScraper = {
        login: mockLogin,
        sendTweet: mockSendTweet,
      };

      const adapter = new TwitterAdapter({
        config: {
          enabled: true,
          dryRun: false,
          credentials: {
            username: 'my_twitter_handle',
            password: 'my_secure_password',
            email: 'user@example.com',
          },
        },
        scraper: mockScraper as unknown as Scraper,
      });

      const result = await adapter.post(
        { ...samplePayload, platform: 'twitter' },
        { dryRun: false },
      );

      expect(result.success).toBe(true);
      expect(result.simulated).toBe(false);
      expect(result.postId).toBe('1850000000000000002');
      expect(mockLogin).toHaveBeenCalledWith(
        'my_twitter_handle',
        'my_secure_password',
        'user@example.com',
        undefined,
      );
      expect(mockSendTweet).toHaveBeenCalledWith(samplePayload.formattedContent);
    });

    it('handles Scraper post failure or session expiration gracefully', async () => {
      const mockScraper = {
        setCookies: vi.fn().mockResolvedValue(undefined),
        sendTweet: vi.fn().mockRejectedValue(new Error('Session cookie expired (401)')),
      };

      const adapter = new TwitterAdapter({
        config: {
          enabled: true,
          dryRun: false,
          credentials: {
            authToken: 'expired_token',
          },
        },
        scraper: mockScraper as unknown as Scraper,
      });

      const result = await adapter.post(
        { ...samplePayload, platform: 'twitter' },
        { dryRun: false },
      );

      expect(result.success).toBe(false);
      expect(result.simulated).toBe(false);
      expect(result.error).toContain('Session cookie expired (401)');
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

    it('dispatches live tweet with OAuth 1.0a header to Twitter API v2', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          data: {
            id: '1460323737035677698',
            text: samplePayload.formattedContent,
          },
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const adapter = new TwitterAdapter({
        config: {
          enabled: true,
          dryRun: false,
          credentials: {
            apiKey: 'consumer_key_123',
            apiSecret: 'consumer_secret_456',
            accessToken: 'oauth_token_789',
            accessSecret: 'oauth_token_secret_012',
          },
        },
      });

      const result = await adapter.post(
        { ...samplePayload, platform: 'twitter' },
        { dryRun: false },
      );
      expect(result.success).toBe(true);
      expect(result.simulated).toBe(false);
      expect(result.postId).toBe('1460323737035677698');
      expect(result.postUrl).toBe('https://x.com/i/web/status/1460323737035677698');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.twitter.com/2/tweets');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toMatch(/^OAuth /);
      expect(init.headers.Authorization).toContain('oauth_consumer_key="consumer_key_123"');
      expect(init.headers.Authorization).toContain('oauth_token="oauth_token_789"');
      const body = JSON.parse(init.body);
      expect(body.text).toBe(samplePayload.formattedContent);
    });

    it('handles Twitter API error (e.g. 401 Unauthorized or 429 Rate Limit) gracefully', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 429,
          json: async () => ({
            title: 'Too Many Requests',
            detail: 'Too Many Requests',
            type: 'about:blank',
            status: 429,
          }),
        }),
      );

      const adapter = new TwitterAdapter({
        config: {
          enabled: true,
          dryRun: false,
          credentials: {
            apiKey: 'k',
            apiSecret: 's',
            accessToken: 't',
            accessSecret: 'as',
          },
        },
      });

      const result = await adapter.post(
        { ...samplePayload, platform: 'twitter' },
        { dryRun: false },
      );
      expect(result.success).toBe(false);
      expect(result.simulated).toBe(false);
      expect(result.error).toContain('Twitter API v2 failed [HTTP 429]: Too Many Requests');
    });

    it('handles Twitter API network timeout without throwing', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockRejectedValue(
            new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
          ),
      );

      const adapter = new TwitterAdapter({
        config: {
          enabled: true,
          dryRun: false,
          credentials: {
            apiKey: 'k',
            apiSecret: 's',
            accessToken: 't',
            accessSecret: 'as',
          },
        },
      });

      const result = await adapter.post(
        { ...samplePayload, platform: 'twitter' },
        { dryRun: false },
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out after 10000ms');
    });
  });

  describe('PlatformRegistry', () => {
    it('should initialize enabled platform adapters', () => {
      const registry = new PlatformRegistry();
      registry.initialize(
        {
          reddit: { enabled: true, dryRun: false },
          facebook: { enabled: false, dryRun: false },
          bluesky: { enabled: true, dryRun: false },
        },
        false,
      );

      const active = registry.getActivePlatforms();
      expect(active).toContain('reddit');
      expect(active).toContain('bluesky');
      expect(active).not.toContain('facebook');

      const redditAdapter = registry.getAdapter('reddit') as RedditAdapter;
      expect(redditAdapter).toBeDefined();
      expect(redditAdapter).toBeInstanceOf(RedditAdapter);

      const blueskyAdapter = registry.getAdapter('bluesky') as BlueskyAdapter;
      expect(blueskyAdapter).toBeDefined();
      expect(blueskyAdapter).toBeInstanceOf(BlueskyAdapter);

      expect(registry.getAdapter('facebook')).toBeUndefined();
    });

    it('should enforce global dry run if true', () => {
      const registry = new PlatformRegistry();
      registry.initialize(
        {
          reddit: { enabled: true, dryRun: false }, // explicitly false
          facebook: { enabled: true, dryRun: false }, // explicitly false
        },
        true, // global dry run is true
      );

      const redditAdapter = registry.getAdapter('reddit') as RedditAdapter;
      expect(redditAdapter).toBeDefined();
      expect(redditAdapter.isDryRun()).toBe(true);

      const facebookAdapter = registry.getAdapter('facebook') as FacebookAdapter;
      expect(facebookAdapter).toBeDefined();
      expect(facebookAdapter.isDryRun()).toBe(true);
    });

    it('should use platform dry run if global dry run is false', () => {
      const registry = new PlatformRegistry();
      registry.initialize(
        {
          reddit: { enabled: true, dryRun: false },
          facebook: { enabled: true, dryRun: true },
        },
        false,
      );

      const redditAdapter = registry.getAdapter('reddit') as RedditAdapter;
      expect(redditAdapter).toBeDefined();
      expect(redditAdapter.isDryRun()).toBe(false);

      const facebookAdapter = registry.getAdapter('facebook') as FacebookAdapter;
      expect(facebookAdapter).toBeDefined();
      expect(facebookAdapter.isDryRun()).toBe(true);
    });

    it('should default platform dry run to true if not specified and global is false', () => {
      const registry = new PlatformRegistry();
      registry.initialize(
        {
          reddit: { enabled: true },
        },
        false,
      );

      const redditAdapter = registry.getAdapter('reddit') as RedditAdapter;
      expect(redditAdapter).toBeDefined();
      expect(redditAdapter.isDryRun()).toBe(true);
    });

    it('should clear existing adapters on initialize', () => {
      const registry = new PlatformRegistry();
      registry.initialize({ reddit: { enabled: true } }, false);
      expect(registry.getActivePlatforms()).toContain('reddit');

      registry.initialize({ facebook: { enabled: true } }, false);
      expect(registry.getActivePlatforms()).not.toContain('reddit');
      expect(registry.getActivePlatforms()).toContain('facebook');
    });

    it('should return adapter by name, all adapters, and active platforms', () => {
      const registry = new PlatformRegistry();
      registry.initialize(
        {
          reddit: { enabled: true },
          discord: { enabled: true },
        },
        false,
      );

      expect(registry.getAdapter('reddit')).toBeInstanceOf(RedditAdapter);
      expect(registry.getAdapter('discord')).toBeInstanceOf(DiscordAdapter);
      expect(registry.getAdapter('facebook')).toBeUndefined();

      const all = registry.getAllAdapters();
      expect(all.length).toBe(2);
      expect(all.some((a) => a instanceof RedditAdapter)).toBe(true);
      expect(all.some((a) => a instanceof DiscordAdapter)).toBe(true);

      const active = registry.getActivePlatforms();
      expect(active).toEqual(['reddit', 'discord']);
    });
  });

  describe('BasePlatformAdapter - extractErrorMessage', () => {
    let adapter: MockBaseAdapter;

    beforeEach(() => {
      adapter = new MockBaseAdapter();
    });

    it('extracts from data.message', async () => {
      const res = {
        json: async () => ({ message: 'Standard message error' }),
        status: 400,
      } as unknown as Response;
      const msg = await adapter.testExtractErrorMessage(res);
      expect(msg).toBe('Standard message error');
    });

    it('extracts from errObj.message', async () => {
      const res = {
        json: async () => ({ error: { message: 'Nested message error' } }),
        status: 400,
      } as unknown as Response;
      const msg = await adapter.testExtractErrorMessage(res);
      expect(msg).toBe('Nested message error');
    });

    it('extracts from data.detail', async () => {
      const res = {
        json: async () => ({ detail: 'Detail error' }),
        status: 400,
      } as unknown as Response;
      const msg = await adapter.testExtractErrorMessage(res);
      expect(msg).toBe('Detail error');
    });

    it('extracts from errObj.detail', async () => {
      const res = {
        json: async () => ({ error: { detail: 'Nested detail error' } }),
        status: 400,
      } as unknown as Response;
      const msg = await adapter.testExtractErrorMessage(res);
      expect(msg).toBe('Nested detail error');
    });

    it('extracts from data.error (string)', async () => {
      const res = {
        json: async () => ({ error: 'String error' }),
        status: 400,
      } as unknown as Response;
      const msg = await adapter.testExtractErrorMessage(res);
      expect(msg).toBe('String error');
    });

    it('extracts from data.errors (array)', async () => {
      const res = {
        json: async () => ({
          errors: [{ message: 'Error 1' }, { detail: 'Error 2' }, 'Error 3', { other: 'Error 4' }],
        }),
        status: 400,
      } as unknown as Response;
      const msg = await adapter.testExtractErrorMessage(res);
      expect(msg).toBe('Error 1; Error 2; Error 3; {"other":"Error 4"}');
    });

    it('handles non-string returned message (stringifies object)', async () => {
      const res = {
        json: async () => ({ message: { code: 123, text: 'complex error' } }),
        status: 400,
      } as unknown as Response;
      const msg = await adapter.testExtractErrorMessage(res);
      expect(msg).toBe('{"code":123,"text":"complex error"}');
    });

    it('falls back to text() if json() throws', async () => {
      const res = {
        json: async () => {
          throw new Error('Invalid JSON');
        },
        text: async () => 'Plain text error response',
        status: 500,
      } as unknown as Response;
      const msg = await adapter.testExtractErrorMessage(res);
      expect(msg).toBe('Plain text error response');
    });

    it('falls back to HTTP status if both json() and text() fail/empty', async () => {
      const res = {
        json: async () => {
          throw new Error('Invalid JSON');
        },
        text: async () => '',
        status: 503,
      } as unknown as Response;
      const msg = await adapter.testExtractErrorMessage(res);
      expect(msg).toBe('HTTP 503');
    });
  });
});
