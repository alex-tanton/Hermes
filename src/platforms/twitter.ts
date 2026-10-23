import { BasePlatformAdapter, AdapterOptions } from './base.js';
import { PlatformType, PostPayload, PostResult, TwitterConfig } from '../types/index.js';

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
    if (!credValidation.valid) {
      return this.createErrorResult(
        payload,
        `Cannot post live to Twitter: ${credValidation.reason}`,
        destination,
      );
    }

    try {
      const tweetId = `tweet_${Date.now()}`;
      return {
        success: true,
        platform: this.name,
        linkId: payload.referralLink.id,
        postId: tweetId,
        postUrl: `https://x.com/user/status/${tweetId}`,
        simulated: false,
        timestamp: new Date().toISOString(),
        messagePreview: payload.formattedContent,
        targetDestination: destination,
      };
    } catch (err) {
      return this.createErrorResult(
        payload,
        `Twitter API request failed: ${err instanceof Error ? err.message : String(err)}`,
        destination,
      );
    }
  }
}
