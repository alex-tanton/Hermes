import { Scraper } from 'agent-twitter-client';
import { BasePlatformAdapter, AdapterOptions } from './base.js';
import { PlatformType, PostPayload, PostResult, TwitterConfig } from '../types/index.js';
import { generateOAuth1Header } from './oauth1.js';

export interface TwitterAdapterOptions extends AdapterOptions {
  config: TwitterConfig;
  scraper?: Scraper;
}

export class TwitterAdapter extends BasePlatformAdapter {
  public readonly name: PlatformType = 'twitter';
  private config: TwitterConfig;
  private scraperInstance?: Scraper;

  constructor(options: TwitterAdapterOptions) {
    super(options);
    this.config = options.config;
    this.scraperInstance = options.scraper;
    if (options.dryRun !== undefined) {
      this.dryRun = options.dryRun;
    } else if (this.config.dryRun !== undefined) {
      this.dryRun = this.config.dryRun;
    }
  }

  public getEffectiveAuthToken(): string | null {
    return this.config.credentials?.authToken || process.env.TWITTER_AUTH_TOKEN || null;
  }

  public getEffectiveCt0(): string | null {
    return this.config.credentials?.ct0 || process.env.TWITTER_CT0 || null;
  }

  public getEffectiveCookies(): string | null {
    return this.config.credentials?.cookies || process.env.TWITTER_COOKIES || null;
  }

  public getEffectiveUsername(): string | null {
    return this.config.credentials?.username || process.env.TWITTER_USERNAME || null;
  }

  public getEffectivePassword(): string | null {
    return this.config.credentials?.password || process.env.TWITTER_PASSWORD || null;
  }

  public getEffectiveEmail(): string | undefined {
    return this.config.credentials?.email || process.env.TWITTER_EMAIL || undefined;
  }

  public getEffectiveTwoFactorSecret(): string | undefined {
    return this.config.credentials?.twoFactorSecret || process.env.TWITTER_2FA_SECRET || undefined;
  }

  public validateCredentials(): { valid: boolean; reason?: string } {
    const creds = this.config.credentials;
    const authToken = this.getEffectiveAuthToken();
    const rawCookies = this.getEffectiveCookies();
    const username = this.getEffectiveUsername();
    const password = this.getEffectivePassword();

    // Workaround 1: Session cookies (zero API keys required)
    if (authToken || rawCookies) {
      return {
        valid: true,
        reason: 'Twitter session cookies configured (no API fees)',
      };
    }

    // Workaround 2: Account login (username + password)
    if (username && password) {
      return {
        valid: true,
        reason: 'Twitter account credentials configured (no API fees)',
      };
    }

    // Path 3: Official API v2 (OAuth 1.0a)
    if (creds?.apiKey && creds?.apiSecret && creds?.accessToken && creds?.accessSecret) {
      return {
        valid: true,
        reason: 'Twitter API v2 credentials configured',
      };
    }

    return {
      valid: false,
      reason:
        'Twitter credentials require session cookies (TWITTER_AUTH_TOKEN), account login (TWITTER_USERNAME & TWITTER_PASSWORD), or API v2 keys',
    };
  }

  public async post(
    payload: PostPayload,
    options?: { dryRun?: boolean; target?: string },
  ): Promise<PostResult> {
    const isDryRun = options?.dryRun ?? this.dryRun;
    const destination = 'Twitter / X Timeline';

    if (isDryRun) {
      return this.createSimulatedResult(payload, destination);
    }

    const credValidation = this.validateCredentials();
    if (!credValidation.valid) {
      return this.createErrorResult(
        payload,
        `Cannot post live to Twitter: ${credValidation.reason || 'Missing credentials'}`,
        destination,
      );
    }

    const authToken = this.getEffectiveAuthToken();
    const ct0 = this.getEffectiveCt0();
    const rawCookies = this.getEffectiveCookies();
    const username = this.getEffectiveUsername();
    const password = this.getEffectivePassword();

    const useScraper = Boolean(authToken || rawCookies || (username && password));

    if (useScraper) {
      return this.postViaScraper(payload, destination, {
        authToken,
        ct0,
        rawCookies,
        username,
        password,
        email: this.getEffectiveEmail(),
        twoFactorSecret: this.getEffectiveTwoFactorSecret(),
      });
    }

    return this.postViaApiV2(payload, destination);
  }

  private async postViaScraper(
    payload: PostPayload,
    destination: string,
    authOptions: {
      authToken: string | null;
      ct0: string | null;
      rawCookies: string | null;
      username: string | null;
      password: string | null;
      email?: string;
      twoFactorSecret?: string;
    },
  ): Promise<PostResult> {
    try {
      const scraper = this.scraperInstance || new Scraper();

      if (authOptions.authToken || authOptions.rawCookies) {
        const cookieStrings: string[] = [];

        if (authOptions.authToken) {
          cookieStrings.push(
            `auth_token=${authOptions.authToken}; Domain=.twitter.com; Path=/; Secure; HttpOnly`,
          );
        }
        if (authOptions.ct0) {
          cookieStrings.push(`ct0=${authOptions.ct0}; Domain=.twitter.com; Path=/; Secure`);
        }
        if (authOptions.rawCookies) {
          try {
            const parsed = JSON.parse(authOptions.rawCookies);
            if (Array.isArray(parsed)) {
              for (const c of parsed) {
                if (typeof c === 'string') {
                  cookieStrings.push(c);
                } else if (c && typeof c === 'object' && 'key' in c && 'value' in c) {
                  cookieStrings.push(`${c.key}=${c.value}; Domain=.twitter.com; Path=/; Secure`);
                }
              }
            }
          } catch {
            const parts = authOptions.rawCookies
              .split(';')
              .map((s) => s.trim())
              .filter(Boolean);
            cookieStrings.push(...parts);
          }
        }

        await scraper.setCookies(cookieStrings);
      } else if (authOptions.username && authOptions.password) {
        await scraper.login(
          authOptions.username,
          authOptions.password,
          authOptions.email,
          authOptions.twoFactorSecret,
        );
      }

      const response = await scraper.sendTweet(payload.formattedContent);

      let tweetId = `tweet_${Date.now()}`;
      try {
        if (typeof response?.json === 'function') {
          const data = (await response.json()) as {
            data?: {
              create_tweet?: { tweet_results?: { result?: { rest_id?: string } } };
              notetweet_create?: { tweet_results?: { result?: { rest_id?: string } } };
            };
          };
          tweetId =
            data?.data?.create_tweet?.tweet_results?.result?.rest_id ||
            data?.data?.notetweet_create?.tweet_results?.result?.rest_id ||
            tweetId;
        }
      } catch {
        // Fallback to default tweet ID if response body format differs
      }

      const postUrl = `https://x.com/i/web/status/${tweetId}`;
      return this.createSuccessResult(payload, {
        postId: tweetId,
        postUrl,
        targetDestination: destination,
      });
    } catch (err) {
      return this.createErrorResult(payload, this.formatCatchError(err, 'Twitter'), destination);
    }
  }

  private async postViaApiV2(payload: PostPayload, destination: string): Promise<PostResult> {
    const creds = this.config.credentials;
    if (!creds?.apiKey || !creds?.apiSecret || !creds?.accessToken || !creds?.accessSecret) {
      return this.createErrorResult(
        payload,
        'Cannot post live to Twitter: Missing API v2 credentials',
        destination,
      );
    }

    try {
      const endpoint = 'https://api.twitter.com/2/tweets';
      const authHeader = generateOAuth1Header(
        { method: 'POST', url: endpoint },
        {
          apiKey: creds.apiKey,
          apiSecret: creds.apiSecret,
          accessToken: creds.accessToken,
          accessSecret: creds.accessSecret,
        },
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: payload.formattedContent,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorDetails = await this.extractErrorMessage(response);
        return this.createErrorResult(
          payload,
          `Twitter API v2 failed [HTTP ${response.status}]: ${errorDetails}`,
          destination,
        );
      }

      const data = (await response.json()) as { data?: { id?: string } };
      const tweetId = data.data?.id || `tweet_${Date.now()}`;
      const postUrl = `https://x.com/i/web/status/${tweetId}`;

      return this.createSuccessResult(payload, {
        postId: tweetId,
        postUrl,
        targetDestination: destination,
      });
    } catch (err) {
      return this.createErrorResult(payload, this.formatCatchError(err, 'Twitter'), destination);
    }
  }
}
