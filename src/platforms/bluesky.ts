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
    if (options.dryRun !== undefined) {
      this.dryRun = options.dryRun;
    } else if (this.config.dryRun !== undefined) {
      this.dryRun = this.config.dryRun;
    }
  }

  public getEffectiveIdentifier(): string | null {
    return this.config.credentials?.identifier || process.env.BLUESKY_HANDLE || null;
  }

  public getEffectivePassword(): string | null {
    return this.config.credentials?.password || process.env.BLUESKY_APP_PASSWORD || null;
  }

  public getEffectiveService(): string {
    return (
      this.config.credentials?.service ||
      process.env.BLUESKY_SERVICE ||
      'https://bsky.social'
    ).replace(/\/+$/, '');
  }

  public validateCredentials(): { valid: boolean; reason?: string } {
    const identifier = this.getEffectiveIdentifier();
    const password = this.getEffectivePassword();
    if (!identifier || !password) {
      return { valid: false, reason: 'Bluesky credentials missing identifier or app password' };
    }
    return { valid: true };
  }

  public async post(
    payload: PostPayload,
    options?: { dryRun?: boolean; target?: string },
  ): Promise<PostResult> {
    const isDryRun = options?.dryRun ?? this.dryRun;
    const identifier = this.getEffectiveIdentifier();
    const password = this.getEffectivePassword();
    const service = this.getEffectiveService();
    const destination = `Bluesky Feed (@${identifier || 'user'})`;

    if (isDryRun) {
      return this.createSimulatedResult(payload, destination);
    }

    const credValidation = this.validateCredentials();
    if (!credValidation.valid || !identifier || !password) {
      return this.createErrorResult(
        payload,
        `Cannot post live to Bluesky: ${credValidation.reason || 'Missing credentials'}`,
        destination,
      );
    }

    try {
      // Step A: Session Creation
      const sessionUrl = `${service}/xrpc/com.atproto.server.createSession`;
      const sessionRes = await fetch(sessionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier,
          password,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!sessionRes.ok) {
        const errDetail = await this.extractErrorMessage(sessionRes);
        return this.createErrorResult(
          payload,
          `Bluesky authentication failed [HTTP ${sessionRes.status}]: ${errDetail}`,
          destination,
        );
      }

      const session = (await sessionRes.json()) as {
        accessJwt: string;
        did: string;
        handle?: string;
      };

      // Step B: Record Creation (Post)
      const postUrl = `${service}/xrpc/com.atproto.repo.createRecord`;
      const createdAt = new Date().toISOString();

      const recordRes = await fetch(postUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessJwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repo: session.did,
          collection: 'app.bsky.feed.post',
          record: {
            $type: 'app.bsky.feed.post',
            text: payload.formattedContent,
            createdAt,
          },
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!recordRes.ok) {
        const errDetail = await this.extractErrorMessage(recordRes);
        return this.createErrorResult(
          payload,
          `Bluesky post creation failed [HTTP ${recordRes.status}]: ${errDetail}`,
          destination,
        );
      }

      const record = (await recordRes.json()) as { uri?: string; cid?: string };
      const rkey = record.uri ? record.uri.split('/').pop() : `post_${Date.now()}`;
      const handle = session.handle || identifier;
      const webUrl = `https://bsky.app/profile/${handle}/post/${rkey}`;

      return this.createSuccessResult(payload, {
        postId: rkey,
        postUrl: webUrl,
        targetDestination: destination,
      });
    } catch (err) {
      return this.createErrorResult(payload, this.formatCatchError(err, 'Bluesky'), destination);
    }
  }
}
