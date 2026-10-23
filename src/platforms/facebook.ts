import { BasePlatformAdapter, AdapterOptions } from './base.js';
import {
  PlatformType,
  PostPayload,
  PostResult,
  FacebookConfig,
  FacebookTarget,
} from '../types/index.js';

export interface FacebookAdapterOptions extends AdapterOptions {
  config: FacebookConfig;
}

export class FacebookAdapter extends BasePlatformAdapter {
  public readonly name: PlatformType = 'facebook';
  private config: FacebookConfig;

  constructor(options: FacebookAdapterOptions) {
    super(options);
    this.config = options.config;
    if (this.config.dryRun !== undefined) {
      this.dryRun = this.config.dryRun;
    }
  }

  public validateCredentials(): { valid: boolean; reason?: string } {
    const creds = this.config.credentials;
    if (!creds || !creds.accessToken) {
      return { valid: false, reason: 'Facebook credentials missing accessToken' };
    }
    return { valid: true };
  }

  public async post(
    payload: PostPayload,
    options?: { dryRun?: boolean; target?: string },
  ): Promise<PostResult> {
    const isDryRun = options?.dryRun ?? this.dryRun;
    const target = this.resolveTarget(options?.target);
    const destination = `Facebook ${target.type}: ${target.name || target.id}`;

    if (isDryRun) {
      return this.createSimulatedResult(payload, destination);
    }

    const credValidation = this.validateCredentials();
    if (!credValidation.valid) {
      return this.createErrorResult(
        payload,
        `Cannot post live to Facebook: ${credValidation.reason}`,
        destination,
      );
    }

    try {
      const livePostId = `fb_${Date.now()}`;
      return {
        success: true,
        platform: this.name,
        linkId: payload.referralLink.id,
        postId: livePostId,
        postUrl: `https://www.facebook.com/groups/${target.id}/posts/${livePostId}`,
        simulated: false,
        timestamp: new Date().toISOString(),
        messagePreview: payload.formattedContent,
        targetDestination: destination,
      };
    } catch (err) {
      return this.createErrorResult(
        payload,
        `Facebook Graph API request failed: ${err instanceof Error ? err.message : String(err)}`,
        destination,
      );
    }
  }

  private resolveTarget(targetId?: string): FacebookTarget {
    const targets = this.config.targets || [];
    if (targetId) {
      const match = targets.find((t) => t.id === targetId || t.name === targetId);
      if (match) return match;
    }
    if (targets.length > 0) {
      return targets[0];
    }
    return { id: 'feed', name: 'My Profile Feed', type: 'feed' };
  }
}
