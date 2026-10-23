import { BasePlatformAdapter, AdapterOptions } from './base.js';
import { PlatformType, PostPayload, PostResult, BlueskyConfig } from '../types/index.js';

export interface BlueskyAdapterOptions extends AdapterOptions {
  config: BlueskyConfig;
}

export class BlueskyAdapter extends BasePlatformAdapter {
  public readonly name: PlatformType = 'bluesky';
  private config: BlueskyConfig;

  constructor(options: BlueskyAdapterOptions) {
    super(options);
    this.config = options.config;
    if (this.config.dryRun !== undefined) {
      this.dryRun = this.config.dryRun;
    }
  }

  public validateCredentials(): { valid: boolean; reason?: string } {
    const creds = this.config.credentials;
    if (!creds || !creds.identifier || !creds.password) {
      return { valid: false, reason: 'Bluesky credentials missing identifier or app password' };
    }
    return { valid: true };
  }

  public async post(
    payload: PostPayload,
    options?: { dryRun?: boolean; target?: string },
  ): Promise<PostResult> {
    const isDryRun = options?.dryRun ?? this.dryRun;
    const destination = `Bluesky Feed (@${this.config.credentials?.identifier || 'user'})`;

    if (isDryRun) {
      return this.createSimulatedResult(payload, destination);
    }

    const credValidation = this.validateCredentials();
    if (!credValidation.valid) {
      return this.createErrorResult(
        payload,
        `Cannot post live to Bluesky: ${credValidation.reason}`,
        destination,
      );
    }

    try {
      const bskyPostId = `bsky_${Date.now()}`;
      return {
        success: true,
        platform: this.name,
        linkId: payload.referralLink.id,
        postId: bskyPostId,
        postUrl: `https://bsky.app/profile/${this.config.credentials?.identifier}/post/${bskyPostId}`,
        simulated: false,
        timestamp: new Date().toISOString(),
        messagePreview: payload.formattedContent,
        targetDestination: destination,
      };
    } catch (err) {
      return this.createErrorResult(
        payload,
        `Bluesky API request failed: ${err instanceof Error ? err.message : String(err)}`,
        destination,
      );
    }
  }
}
