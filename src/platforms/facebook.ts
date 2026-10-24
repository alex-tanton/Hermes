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
    if (!credValidation.valid || !this.config.credentials?.accessToken) {
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
      const params = new URLSearchParams();
      params.append('message', payload.formattedContent);
      if (payload.referralLink?.url) {
        params.append('link', payload.referralLink.url);
      }
      params.append('access_token', this.config.credentials.accessToken);

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorMessage = await this.extractErrorMessage(response);
        return this.createErrorResult(
          payload,
          `Facebook Graph API failed [HTTP ${response.status}]: ${errorMessage}`,
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
      return this.createErrorResult(
        payload,
        this.formatCatchError(err, 'Facebook Graph API'),
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
