import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
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

/**
 * Attempts to retrieve an existing Devvit CLI OAuth token from ~/.devvit/token
 */
export function getDevvitToken(): string | null {
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    return process.env.TEST_DEVVIT_TOKEN || null;
  }
  try {
    const tokenPath = path.join(os.homedir(), '.devvit', 'token');
    if (fs.existsSync(tokenPath)) {
      const token = fs.readFileSync(tokenPath, 'utf-8').trim();
      if (token) return token;
    }
  } catch {
    // Ignore filesystem read error in sandbox/restricted environments
  }
  return null;
}

export class RedditAdapter extends BasePlatformAdapter {
  public readonly name: PlatformType = 'reddit';
  private config: RedditConfig;

  constructor(options: RedditAdapterOptions) {
    super(options);
    this.config = options.config;
    if (options.dryRun !== undefined) {
      this.dryRun = options.dryRun;
    } else if (this.config.dryRun !== undefined) {
      this.dryRun = this.config.dryRun;
    }
  }

  public getEffectiveAccessToken(): string | null {
    if (this.config.credentials?.accessToken) {
      return this.config.credentials.accessToken;
    }
    if (process.env.REDDIT_ACCESS_TOKEN) {
      return process.env.REDDIT_ACCESS_TOKEN;
    }
    if (this.config.credentials?.clientId) {
      return null;
    }
    return getDevvitToken();
  }

  public validateCredentials(): { valid: boolean; reason?: string } {
    const creds = this.config.credentials;

    // Path 1: Devvit or explicit accessToken (modern, zero-config default)
    const token = this.getEffectiveAccessToken();
    if (token) {
      const isDevvit = !creds?.accessToken && !process.env.REDDIT_ACCESS_TOKEN;
      return {
        valid: true,
        reason: isDevvit
          ? 'Devvit token detected (~/.devvit/token)'
          : 'OAuth access token configured',
      };
    }

    // Path 2: Legacy script password grant
    if (creds?.clientId && creds?.clientSecret && creds?.username && creds?.password) {
      return { valid: true, reason: 'Legacy script credentials configured' };
    }

    return {
      valid: false,
      reason:
        "Not authenticated. Run 'npx devvit login' to authenticate in 1 click (no keys required)",
    };
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
    const effectiveToken = this.getEffectiveAccessToken();
    const creds = this.config.credentials;

    if (!credValidation.valid) {
      return this.createErrorResult(
        payload,
        `Cannot post live to Reddit: ${credValidation.reason || 'Missing credentials'}`,
        destination,
      );
    }

    const userAgent =
      creds?.userAgent ||
      (creds?.username
        ? `Hermes/1.1.0 (by /u/${creds.username})`
        : 'Hermes/1.1.0 (Devvit integration)');

    try {
      let bearerToken = effectiveToken;

      // If no pre-authenticated token, execute legacy password grant
      if (!bearerToken) {
        if (!creds?.clientId || !creds?.clientSecret || !creds?.username || !creds?.password) {
          return this.createErrorResult(
            payload,
            "Cannot post live to Reddit: No credentials. Run 'npx devvit login' to authenticate.",
            destination,
          );
        }

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

        bearerToken = tokenData.access_token;
      }

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
          Authorization: `Bearer ${bearerToken}`,
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

      return this.createSuccessResult(payload, {
        postId,
        postUrl,
        targetDestination: destination,
      });
    } catch (err) {
      return this.createErrorResult(payload, this.formatCatchError(err, 'Reddit'), destination);
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
