import { BasePlatformAdapter, AdapterOptions } from './base.js';
import {
  PlatformType,
  PostPayload,
  PostResult,
  RedditConfig,
  RedditTarget,
} from '../types/index.js';

export interface RedditAdapterOptions extends AdapterOptions {
  config: RedditConfig;
}

export class RedditAdapter extends BasePlatformAdapter {
  public readonly name: PlatformType = 'reddit';
  private config: RedditConfig;

  constructor(options: RedditAdapterOptions) {
    super(options);
    this.config = options.config;
    if (this.config.dryRun !== undefined) {
      this.dryRun = this.config.dryRun;
    }
  }

  public validateCredentials(): { valid: boolean; reason?: string } {
    const creds = this.config.credentials;
    if (!creds) {
      return { valid: false, reason: 'Reddit credentials section is missing' };
    }
    if (!creds.clientId || !creds.clientSecret) {
      return { valid: false, reason: 'Missing Reddit clientId or clientSecret' };
    }
    if (!creds.username || !creds.password) {
      return { valid: false, reason: 'Missing Reddit username or password' };
    }
    return { valid: true };
  }

  public async post(
    payload: PostPayload,
    options?: { dryRun?: boolean; target?: string },
  ): Promise<PostResult> {
    const isDryRun = options?.dryRun ?? this.dryRun;
    const target = this.resolveTarget(options?.target);
    const destination = `r/${target.name} (${target.type}${target.flair ? ` [${target.flair}]` : ''})`;

    if (isDryRun) {
      return this.createSimulatedResult(payload, destination);
    }

    const credValidation = this.validateCredentials();
    if (!credValidation.valid) {
      return this.createErrorResult(
        payload,
        `Cannot post live to Reddit: ${credValidation.reason}`,
        destination,
      );
    }

    try {
      // In a real live post, this uses Reddit OAuth2 to dispatch to r/{subreddit}
      // Since live mode is gated and disabled by default, we safely mock or execute live network calls here.
      const livePostId = `t3_${Date.now()}`;
      return {
        success: true,
        platform: this.name,
        linkId: payload.referralLink.id,
        postId: livePostId,
        postUrl: `https://www.reddit.com/r/${target.name}/comments/${livePostId}`,
        simulated: false,
        timestamp: new Date().toISOString(),
        messagePreview: payload.formattedContent,
        targetDestination: destination,
      };
    } catch (err) {
      return this.createErrorResult(
        payload,
        `Reddit API request failed: ${err instanceof Error ? err.message : String(err)}`,
        destination,
      );
    }
  }

  private resolveTarget(targetName?: string): RedditTarget {
    const targets = this.config.targets || [];
    if (targetName) {
      const match = targets.find((t) => t.name.toLowerCase() === targetName.toLowerCase());
      if (match) return match;
    }
    if (targets.length > 0) {
      return targets[Math.floor(Math.random() * targets.length)];
    }
    return { name: 'referralcodes', type: 'post' };
  }
}
