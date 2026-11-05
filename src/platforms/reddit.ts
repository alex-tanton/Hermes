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
  ReferralLink,
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
      const raw = fs.readFileSync(tokenPath, 'utf-8').trim();
      if (!raw) return null;
      if (raw.startsWith('{')) {
        const outer = JSON.parse(raw);
        if (outer.token) {
          try {
            const inner = JSON.parse(Buffer.from(outer.token, 'base64').toString('utf-8'));
            return inner.accessToken || inner.refreshToken || outer.token;
          } catch {
            return outer.token;
          }
        }
      }
      return raw;
    }
  } catch {
    // Ignore filesystem read error in sandbox/restricted environments
  }
  return null;
}

/**
 * Resolves a live, unexpired Devvit access token, refreshing if necessary.
 */
export async function resolveDevvitAccessToken(
  userAgent = 'Hermes/1.1.0 (Devvit integration)',
): Promise<string | null> {
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    return process.env.TEST_DEVVIT_TOKEN || null;
  }
  try {
    const tokenPath = path.join(os.homedir(), '.devvit', 'token');
    if (!fs.existsSync(tokenPath)) return null;
    const raw = fs.readFileSync(tokenPath, 'utf-8').trim();
    if (!raw) return null;
    if (!raw.startsWith('{')) {
      return raw;
    }
    const outer = JSON.parse(raw);
    if (!outer.token) return null;
    let inner: { accessToken?: string; refreshToken?: string; expiresAt?: number };
    try {
      inner = JSON.parse(Buffer.from(outer.token, 'base64').toString('utf-8'));
    } catch {
      return outer.token;
    }

    if (inner.accessToken && inner.expiresAt && inner.expiresAt > Date.now() + 60000) {
      return inner.accessToken;
    }

    if (inner.refreshToken) {
      const basicAuth = Buffer.from('Bep8X2RRjuoyuxkKsKxFuQ:').toString('base64');
      const params = new URLSearchParams();
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', inner.refreshToken);

      const res = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': userAgent,
        },
        body: params.toString(),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          access_token?: string;
          expires_in?: number;
          refresh_token?: string;
        };
        if (data.access_token) {
          inner.accessToken = data.access_token;
          inner.expiresAt = Date.now() + (data.expires_in ?? 86400) * 1000 - 60000;
          if (data.refresh_token) {
            inner.refreshToken = data.refresh_token;
          }
          try {
            outer.token = Buffer.from(JSON.stringify(inner)).toString('base64');
            fs.writeFileSync(tokenPath, JSON.stringify(outer, null, 2), 'utf-8');
          } catch {
            // Ignore write errors to ~/.devvit/token
          }
          return inner.accessToken;
        }
      }
    }

    return inner.accessToken || null;
  } catch {
    return null;
  }
}

/**
 * Extracts a Reddit API fullname (e.g. t3_1xntgp4) from target threadId, threadUrl, or name
 */
export function extractThreadId(target: RedditTarget): string | undefined {
  if (target.threadId) {
    return target.threadId.startsWith('t3_') || target.threadId.startsWith('t1_')
      ? target.threadId
      : `t3_${target.threadId}`;
  }
  if (target.threadUrl) {
    const match = target.threadUrl.match(/comments\/([a-z0-9]+)/i);
    if (match) {
      return `t3_${match[1]}`;
    }
  }
  if (target.name.startsWith('t3_') || target.name.startsWith('t1_')) {
    return target.name;
  }
  const match = target.name.match(/comments\/([a-z0-9]+)/i);
  if (match) {
    return `t3_${match[1]}`;
  }
  return undefined;
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

  public async getBearerToken(userAgent: string): Promise<{ token?: string; error?: string }> {
    const creds = this.config.credentials;
    if (creds?.accessToken) {
      return { token: creds.accessToken };
    }
    if (process.env.REDDIT_ACCESS_TOKEN) {
      return { token: process.env.REDDIT_ACCESS_TOKEN };
    }

    // Devvit zero-config token
    if (!creds?.clientId) {
      const devvitToken = await resolveDevvitAccessToken(userAgent);
      if (devvitToken) {
        return { token: devvitToken };
      }
    }

    // Legacy script password grant
    if (creds?.clientId && creds?.clientSecret && creds?.username && creds?.password) {
      try {
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
          return {
            error: `Reddit authentication failed [HTTP ${tokenRes.status}]: ${errorText}`,
          };
        }

        const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
        if (tokenData.error || !tokenData.access_token) {
          return {
            error: `Reddit authentication rejected: ${tokenData.error || 'No access_token returned'}`,
          };
        }

        return { token: tokenData.access_token };
      } catch (err) {
        return {
          error: `Reddit authentication failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    return {};
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

  /**
   * Resolves a comment target's megathread on Reddit via OAuth search API.
   * Performs read-only GET requests (safe in dry-run mode).
   */
  public async resolveSearchTarget(
    subreddit: string,
    rawQuery: string,
    userAgent: string,
  ): Promise<{ thingId: string; title: string; postUrl: string } | null> {
    try {
      const auth = await this.getBearerToken(userAgent);
      if (!auth.token) {
        return null;
      }
      const bearerToken = auth.token;

      const cleanTerm = rawQuery.replace(/^\[?referrals?\]?\s*[:\-\s]*/i, '').trim();
      const queriesToTry = [`title:"${cleanTerm}"`, rawQuery];

      for (const q of queriesToTry) {
        const searchUrl = `https://oauth.reddit.com/r/${subreddit}/search?q=${encodeURIComponent(q)}&restrict_sr=1&sort=new&limit=10`;
        const res = await fetch(searchUrl, {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            'User-Agent': userAgent,
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) continue;

        const data = (await res.json()) as {
          data?: {
            children?: Array<{
              data: {
                name: string;
                title: string;
                permalink: string;
              };
            }>;
          };
        };

        const children = data.data?.children || [];
        if (children.length === 0) continue;

        const cleanQueryLower = cleanTerm.toLowerCase();

        // 1. Exact match ignoring prefixes like [referrals]
        for (const child of children) {
          const cleanTitle = child.data.title
            .replace(/^\[.*?\]\s*/, '')
            .trim()
            .toLowerCase();
          if (cleanTitle === cleanQueryLower) {
            return {
              thingId: child.data.name,
              title: child.data.title,
              postUrl: `https://www.reddit.com${child.data.permalink}`,
            };
          }
        }

        // 2. Candidate containing all query words
        const words = cleanQueryLower.split(/\s+/).filter(Boolean);
        const wordMatches = children.filter((child) => {
          const tLower = child.data.title.toLowerCase();
          return words.every((w) => tLower.includes(w));
        });

        if (wordMatches.length > 0) {
          wordMatches.sort((a, b) => {
            const diffA = Math.abs(a.data.title.length - cleanTerm.length);
            const diffB = Math.abs(b.data.title.length - cleanTerm.length);
            return diffA - diffB;
          });
          const match = wordMatches[0];
          return {
            thingId: match.data.name,
            title: match.data.title,
            postUrl: `https://www.reddit.com${match.data.permalink}`,
          };
        }

        // 3. Fall back to first result
        const first = children[0];
        return {
          thingId: first.data.name,
          title: first.data.title,
          postUrl: `https://www.reddit.com${first.data.permalink}`,
        };
      }
    } catch {
      // Offline/API failure fallback
    }

    return null;
  }

  public async post(
    payload: PostPayload,
    options?: { dryRun?: boolean; target?: string | RedditTarget },
  ): Promise<PostResult> {
    const isDryRun = options?.dryRun ?? this.dryRun;
    const target = this.resolveTarget(options?.target, payload.referralLink);
    const isComment = target.type === 'comment';

    let resolvedThingId = extractThreadId(target);
    const rawQuery = target.searchQuery || target.searchQueries || target.megathreadSearchQuery;
    const searchQuery: string | undefined = Array.isArray(rawQuery)
      ? rawQuery[0]
      : typeof rawQuery === 'string'
        ? rawQuery
        : undefined;

    let destination = `r/${target.name} (${target.type}${target.flair ? ` [${target.flair}]` : ''})`;
    let targetPostUrl: string | undefined = target.threadUrl;

    if (isComment) {
      if (resolvedThingId) {
        destination = `r/${target.name} (comment on thread ${resolvedThingId.replace(/^t3_/, '')})`;
        if (!targetPostUrl) {
          targetPostUrl = `https://www.reddit.com/r/${target.name}/comments/${resolvedThingId.replace(/^t3_/, '')}/`;
        }
      } else if (searchQuery) {
        destination = `r/${target.name} (comment on "${searchQuery}")`;
      } else {
        destination = `r/${target.name} (comment)`;
      }
    }

    const isLinkOnly =
      target.linkOnly ?? (isComment && (!!target.threadUrl || !!target.threadId || !!searchQuery));
    const contentToPost =
      isComment && isLinkOnly ? payload.referralLink.url : payload.formattedContent;

    const creds = this.config.credentials;
    const userAgent =
      creds?.userAgent ||
      (creds?.username
        ? `Hermes/1.1.0 (by /u/${creds.username})`
        : 'Hermes/1.1.0 (Devvit integration)');

    // Attempt to resolve dynamic search query megathreads via GET requests (in both dry-run and live modes)
    if (isComment && !resolvedThingId && searchQuery) {
      const resolved = await this.resolveSearchTarget(target.name, searchQuery, userAgent);
      if (resolved) {
        resolvedThingId = resolved.thingId;
        destination = `r/${target.name} (comment on "${resolved.title}")`;
        targetPostUrl = resolved.postUrl;
      }
    }

    if (isDryRun) {
      return this.createSimulatedResult(payload, destination, contentToPost, {
        postId: resolvedThingId,
        postUrl: targetPostUrl,
      });
    }

    const credValidation = this.validateCredentials();
    if (!credValidation.valid) {
      return this.createErrorResult(
        payload,
        `Cannot post live to Reddit: ${credValidation.reason || 'Missing credentials'}`,
        destination,
      );
    }

    try {
      const auth = await this.getBearerToken(userAgent);
      if (!auth.token) {
        return this.createErrorResult(
          payload,
          auth.error ||
            "Cannot post live to Reddit: No credentials. Run 'npx devvit login' to authenticate.",
          destination,
        );
      }
      const bearerToken = auth.token;

      if (isComment && !resolvedThingId) {
        return this.createErrorResult(
          payload,
          `Cannot comment on r/${target.name}: Target thread could not be identified. Specify threadUrl, threadId, or a matching searchQuery.`,
          destination,
        );
      }

      const submitUrl = isComment
        ? 'https://oauth.reddit.com/api/comment'
        : 'https://oauth.reddit.com/api/submit';

      const submitParams = new URLSearchParams();
      submitParams.append('api_type', 'json');

      if (isComment) {
        submitParams.append('thing_id', resolvedThingId!);
        submitParams.append('text', contentToPost);
      } else {
        submitParams.append('sr', target.name);
        submitParams.append('kind', 'self');
        submitParams.append('title', payload.title);
        submitParams.append('text', contentToPost);
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
      const postUrl =
        postData?.url ||
        targetPostUrl ||
        `https://www.reddit.com/r/${target.name}/comments/${postId}`;

      return this.createSuccessResult(payload, {
        postId,
        postUrl,
        targetDestination: destination,
        messagePreview: contentToPost,
      });
    } catch (err) {
      return this.createErrorResult(payload, this.formatCatchError(err, 'Reddit'), destination);
    }
  }

  public resolveTarget(targetName?: string | RedditTarget, link?: ReferralLink): RedditTarget {
    const targets = this.config.targets || [];
    if (targetName) {
      if (typeof targetName === 'object') {
        return targetName;
      }
      const match = targets.find((t) => t.name.toLowerCase() === targetName.toLowerCase());
      if (match) return match;
      return { name: targetName.replace(/^r\//i, '').trim(), type: 'post' };
    }

    const linkTargets = this.getLinkTargets(link);
    if (linkTargets.length > 0) {
      return linkTargets[Math.floor(Math.random() * linkTargets.length)];
    }

    if (targets.length > 0) {
      return targets[Math.floor(Math.random() * targets.length)];
    }
    return { name: 'referralcodes', type: 'post' };
  }

  public getLinkTargets(link?: ReferralLink): RedditTarget[] {
    if (!link) return [];
    const rawList: Array<string | RedditTarget> = [];
    if (link.targetSubreddit) {
      rawList.push(link.targetSubreddit);
    }
    if (link.targetSubreddits && Array.isArray(link.targetSubreddits)) {
      rawList.push(...link.targetSubreddits);
    }
    if (rawList.length === 0) return [];

    const normalized: RedditTarget[] = rawList.map((item) => {
      if (typeof item === 'string') {
        const trimmed = item.trim();
        const urlMatch = trimmed.match(
          /(?:reddit\.com)?\/r\/([a-zA-Z0-9_]+)\/comments\/([a-z0-9]+)/i,
        );
        if (urlMatch) {
          const subName = urlMatch[1];
          const threadId = urlMatch[2];
          return {
            name: subName,
            type: 'comment',
            threadUrl: trimmed.startsWith('http') ? trimmed : `https://www.reddit.com${trimmed}`,
            threadId,
            linkOnly: true,
          };
        }

        const cleanName = trimmed.replace(/^r\//i, '').trim();
        const globalMatch = this.config.targets?.find(
          (t) => t.name.toLowerCase() === cleanName.toLowerCase(),
        );
        if (globalMatch) {
          return globalMatch;
        }
        return { name: cleanName, type: 'post' };
      }

      const subName = item.name.replace(/^r\//i, '').trim();
      const isComment = item.type === 'comment' || !!item.threadUrl || !!item.threadId;
      return {
        ...item,
        name: subName,
        type: isComment ? 'comment' : item.type || 'post',
        linkOnly:
          item.linkOnly ??
          (isComment &&
            (!!item.threadUrl ||
              !!item.threadId ||
              !!item.searchQuery ||
              !!item.megathreadSearchQuery ||
              !!item.searchQueries)),
      };
    });

    // Expand any targets that have multiple searchQueries (or an array of searchQuery)
    const expanded: RedditTarget[] = [];
    for (const target of normalized) {
      const queries =
        target.searchQueries || (Array.isArray(target.searchQuery) ? target.searchQuery : null);
      if (queries && queries.length > 0) {
        for (const q of queries) {
          expanded.push({
            ...target,
            searchQuery: q,
            searchQueries: undefined,
          });
        }
      } else {
        expanded.push({
          ...target,
          searchQuery: typeof target.searchQuery === 'string' ? target.searchQuery : undefined,
        });
      }
    }

    return expanded;
  }
}
