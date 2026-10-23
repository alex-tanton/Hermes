import { BasePlatformAdapter, AdapterOptions } from './base.js';
import { PlatformType, PostPayload, PostResult, TwitterConfig } from '../types/index.js';
import { generateOAuth1Header } from './oauth1.js';

export interface TwitterAdapterOptions extends AdapterOptions {
  config: TwitterConfig;
}

export class TwitterAdapter extends BasePlatformAdapter {
  public readonly name: PlatformType = 'twitter';
  private config: TwitterConfig;

  constructor(options: TwitterAdapterOptions) {
    super(options);
    this.config = options.config;
    if (this.config.dryRun !== undefined) {
      this.dryRun = this.config.dryRun;
    }
  }

  public validateCredentials(): { valid: boolean; reason?: string } {
    const creds = this.config.credentials;
    if (!creds || !creds.apiKey || !creds.apiSecret || !creds.accessToken || !creds.accessSecret) {
      return {
        valid: false,
        reason: 'Twitter credentials require apiKey, apiSecret, accessToken, and accessSecret',
      };
    }
    return { valid: true };
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
    const creds = this.config.credentials;
    if (
      !credValidation.valid ||
      !creds?.apiKey ||
      !creds?.apiSecret ||
      !creds?.accessToken ||
      !creds?.accessSecret
    ) {
      return this.createErrorResult(
        payload,
        `Cannot post live to Twitter: ${credValidation.reason || 'Missing credentials'}`,
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
        let errorDetails = '';
        try {
          const errJson = (await response.json()) as {
            detail?: string;
            errors?: Array<{ message?: string; detail?: string }>;
            title?: string;
          };
          errorDetails =
            errJson.detail ||
            errJson.errors?.map((e) => e.message || e.detail).join('; ') ||
            errJson.title ||
            `HTTP ${response.status}`;
        } catch {
          errorDetails = await response.text().catch(() => `HTTP ${response.status}`);
        }

        return this.createErrorResult(
          payload,
          `Twitter API v2 failed [HTTP ${response.status}]: ${errorDetails}`,
          destination,
        );
      }

      const data = (await response.json()) as { data?: { id?: string } };
      const tweetId = data.data?.id || `tweet_${Date.now()}`;
      const postUrl = `https://x.com/i/web/status/${tweetId}`;

      return {
        success: true,
        platform: this.name,
        linkId: payload.referralLink.id,
        postId: tweetId,
        postUrl,
        simulated: false,
        timestamp: new Date().toISOString(),
        messagePreview: payload.formattedContent,
        targetDestination: destination,
      };
    } catch (err) {
      const isTimeout =
        err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
      const errorMsg = isTimeout
        ? 'Twitter request timed out after 10000ms'
        : `Twitter API request failed: ${err instanceof Error ? err.message : String(err)}`;

      return this.createErrorResult(payload, errorMsg, destination);
    }
  }
}
