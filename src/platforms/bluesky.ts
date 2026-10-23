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
    const creds = this.config.credentials;
    const destination = `Bluesky Feed (@${creds?.identifier || 'user'})`;

    if (isDryRun) {
      return this.createSimulatedResult(payload, destination);
    }

    const credValidation = this.validateCredentials();
    if (!credValidation.valid || !creds?.identifier || !creds.password) {
      return this.createErrorResult(
        payload,
        `Cannot post live to Bluesky: ${credValidation.reason || 'Missing credentials'}`,
        destination,
      );
    }

    const service = (creds.service || 'https://bsky.social').replace(/\/+$/, '');

    try {
      // Step A: Session Creation
      const sessionUrl = `${service}/xrpc/com.atproto.server.createSession`;
      const sessionRes = await fetch(sessionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: creds.identifier,
          password: creds.password,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!sessionRes.ok) {
        let errorText = '';
        try {
          const errJson = (await sessionRes.json()) as { message?: string; error?: string };
          errorText = errJson.message || errJson.error || `HTTP ${sessionRes.status}`;
        } catch {
          errorText = await sessionRes.text().catch(() => `HTTP ${sessionRes.status}`);
        }
        return this.createErrorResult(
          payload,
          `Bluesky authentication failed [HTTP ${sessionRes.status}]: ${errorText}`,
          destination,
        );
      }

      const session = (await sessionRes.json()) as {
        accessJwt: string;
        did: string;
        handle?: string;
      };

      // Step B: Record Creation
      const recordUrl = `${service}/xrpc/com.atproto.repo.createRecord`;
      const recordRes = await fetch(recordUrl, {
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
            createdAt: new Date().toISOString(),
          },
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!recordRes.ok) {
        let errorText = '';
        try {
          const errJson = (await recordRes.json()) as { message?: string; error?: string };
          errorText = errJson.message || errJson.error || `HTTP ${recordRes.status}`;
        } catch {
          errorText = await recordRes.text().catch(() => `HTTP ${recordRes.status}`);
        }
        return this.createErrorResult(
          payload,
          `Bluesky post creation failed [HTTP ${recordRes.status}]: ${errorText}`,
          destination,
        );
      }

      const recordData = (await recordRes.json()) as { uri?: string; cid?: string };
      const rkey = recordData.uri
        ? recordData.uri.split('/').pop() || `bsky_${Date.now()}`
        : `bsky_${Date.now()}`;
      const handle = session.handle || creds.identifier;
      const postUrl = `https://bsky.app/profile/${handle}/post/${rkey}`;

      return {
        success: true,
        platform: this.name,
        linkId: payload.referralLink.id,
        postId: rkey,
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
        ? 'Bluesky request timed out after 10000ms'
        : `Bluesky API request failed: ${err instanceof Error ? err.message : String(err)}`;

      return this.createErrorResult(payload, errorMsg, destination);
    }
  }
}
