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
    const creds = this.config.credentials;
    if (
      !credValidation.valid ||
      !creds?.clientId ||
      !creds.clientSecret ||
      !creds.username ||
      !creds.password
    ) {
      return this.createErrorResult(
        payload,
        `Cannot post live to Reddit: ${credValidation.reason || 'Missing credentials'}`,
        destination,
      );
    }

    const userAgent = creds.userAgent || `ReferralRepeater/1.0.0 (by /u/${creds.username})`;

    try {
      // Step A: OAuth2 Password Grant Authentication
      const tokenUrl = 'https://www.reddit.com/api/v1/access_token';
      const basicAuth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');

      const tokenParams = new URLSearchParams();
      tokenParams.append('grant_type', 'password');
      tokenParams.append('username', creds.username);
      tokenParams.append('password', creds.password);

      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': userAgent,
        },
        body: tokenParams.toString(),
        signal: AbortSignal.timeout(10000),
      });

      if (!tokenRes.ok) {
        const errorText = await tokenRes.text().catch(() => `HTTP ${tokenRes.status}`);
        return this.createErrorResult(
          payload,
          `Reddit authentication failed [HTTP ${tokenRes.status}]: ${errorText}`,
          destination,
        );
      }

      const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
      if (tokenData.error || !tokenData.access_token) {
        return this.createErrorResult(
          payload,
          `Reddit authentication rejected: ${tokenData.error || 'No access_token returned'}`,
          destination,
        );
      }

      const accessToken = tokenData.access_token;

      // Step B: Submit Post or Comment
      const isComment = target.type === 'comment';
      const submitUrl = isComment
        ? 'https://oauth.reddit.com/api/comment'
        : 'https://oauth.reddit.com/api/submit';

      const submitParams = new URLSearchParams();
      submitParams.append('api_type', 'json');

      if (isComment) {
        submitParams.append('thing_id', target.name);
        submitParams.append('text', payload.formattedContent);
      } else {
        submitParams.append('sr', target.name);
        submitParams.append('kind', 'self');
        submitParams.append('title', payload.title);
        submitParams.append('text', payload.formattedContent);
        if (target.flair) {
          submitParams.append('flair_id', target.flair);
        }
      }

      const submitRes = await fetch(submitUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': userAgent,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: submitParams.toString(),
        signal: AbortSignal.timeout(10000),
      });

      if (!submitRes.ok) {
        const errorText = await submitRes.text().catch(() => `HTTP ${submitRes.status}`);
        return this.createErrorResult(
          payload,
          `Reddit submission failed [HTTP ${submitRes.status}]: ${errorText}`,
          destination,
        );
      }

      const submitData = (await submitRes.json()) as {
        json?: {
          errors?: Array<string[] | string>;
          data?: {
            name?: string;
            id?: string;
            url?: string;
          };
        };
      };

      const errors = submitData.json?.errors;
      if (errors && errors.length > 0) {
        const formattedErrors = errors
          .map((e) => (Array.isArray(e) ? e.join(': ') : String(e)))
          .join('; ');
        return this.createErrorResult(payload, `Reddit API error: ${formattedErrors}`, destination);
      }

      const postData = submitData.json?.data;
      const postId = postData?.name || postData?.id || `t3_${Date.now()}`;
      const postUrl = postData?.url || `https://www.reddit.com/r/${target.name}/comments/${postId}`;

      return {
        success: true,
        platform: this.name,
        linkId: payload.referralLink.id,
        postId,
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
        ? 'Reddit request timed out after 10000ms'
        : `Reddit API request failed: ${err instanceof Error ? err.message : String(err)}`;

      return this.createErrorResult(payload, errorMsg, destination);
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
