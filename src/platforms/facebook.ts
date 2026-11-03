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
    if (options.dryRun !== undefined) {
      this.dryRun = options.dryRun;
    } else if (this.config.dryRun !== undefined) {
      this.dryRun = this.config.dryRun;
    }
  }

  public getEffectiveAccessToken(): string | null {
    return this.config.credentials?.accessToken || process.env.FACEBOOK_ACCESS_TOKEN || null;
  }

  public validateCredentials(): { valid: boolean; reason?: string } {
    const token = this.getEffectiveAccessToken();
    if (!token) {
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
    const token = this.getEffectiveAccessToken();
    if (!credValidation.valid || !token) {
      return this.createErrorResult(
        payload,
        `Cannot post live to Facebook: ${credValidation.reason || 'Missing access token'}`,
        destination,
      );
    }

    const endpoint =
      target.id === 'feed' || target.type === 'feed' ? 'me/feed' : `${target.id}/feed`;
    const targetUrl = `https://graph.facebook.com/v19.0/${endpoint}`;

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          message: payload.formattedContent,
          link: payload.referralLink.url,
          access_token: token,
        }).toString(),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorDetails = await this.extractErrorMessage(response);
        return this.createErrorResult(
          payload,
          `Facebook Graph API failed [HTTP ${response.status}]: ${errorDetails}`,
          destination,
        );
      }

      const data = (await response.json()) as { id?: string };
      const postId = data.id || `fb_${Date.now()}`;
      const postUrl = `https://www.facebook.com/${postId}`;

      return this.createSuccessResult(payload, {
        postId,
        postUrl,
        targetDestination: destination,
      });
    } catch (err) {
      return this.createErrorResult(payload, this.formatCatchError(err, 'Facebook'), destination);
    }
  }

  private resolveTarget(overrideId?: string): FacebookTarget {
    const targets = this.config.targets || [];
    if (targets.length === 0) {
      return { id: 'feed', name: 'Profile Feed', type: 'feed' };
    }
    if (overrideId) {
      const found = targets.find((t) => t.id === overrideId || t.name === overrideId);
      if (found) return found;
    }
    return targets[0];
  }
}
