import { BasePlatformAdapter, AdapterOptions } from './base.js';
import {
  PlatformType,
  PostPayload,
  PostResult,
  DiscordConfig,
  DiscordTarget,
} from '../types/index.js';

export interface DiscordAdapterOptions extends AdapterOptions {
  config: DiscordConfig;
}

export class DiscordAdapter extends BasePlatformAdapter {
  public readonly name: PlatformType = 'discord';
  private config: DiscordConfig;

  constructor(options: DiscordAdapterOptions) {
    super(options);
    this.config = options.config;
    if (this.config.dryRun !== undefined) {
      this.dryRun = this.config.dryRun;
    }
  }

  public validateCredentials(): { valid: boolean; reason?: string } {
    const creds = this.config.credentials;
    if (!creds || (!creds.webhookUrl && !creds.botToken)) {
      return {
        valid: false,
        reason: 'Discord credentials must have either webhookUrl or botToken',
      };
    }
    return { valid: true };
  }

  public async post(
    payload: PostPayload,
    options?: { dryRun?: boolean; target?: string },
  ): Promise<PostResult> {
    const isDryRun = options?.dryRun ?? this.dryRun;
    const target = this.resolveTarget(options?.target);
    const destination = `Discord #${target.channelName} (${target.type})`;

    if (isDryRun) {
      return this.createSimulatedResult(payload, destination);
    }

    const credValidation = this.validateCredentials();
    if (!credValidation.valid) {
      return this.createErrorResult(
        payload,
        `Cannot post live to Discord: ${credValidation.reason}`,
        destination,
      );
    }

    const webhookUrl = this.config.credentials?.webhookUrl;
    if (!webhookUrl) {
      return this.createErrorResult(
        payload,
        'Cannot post live to Discord: webhookUrl is required for webhook dispatch',
        destination,
      );
    }

    try {
      const url = new URL(webhookUrl);
      url.searchParams.set('wait', 'true');

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: payload.formattedContent,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorDetails = await this.extractErrorMessage(response);
        return this.createErrorResult(
          payload,
          `Discord webhook failed [HTTP ${response.status}]: ${errorDetails}`,
          destination,
        );
      }

      const data = (await response.json()) as { id?: string; channel_id?: string };
      const msgId = data.id || `discord_${Date.now()}`;
      const channelId = data.channel_id;
      const postUrl = channelId
        ? `https://discord.com/channels/@me/${channelId}/${msgId}`
        : `https://discord.com/channels/@me/${msgId}`;

      return this.createSuccessResult(payload, {
        postId: String(msgId),
        postUrl,
        targetDestination: destination,
      });
    } catch (err) {
      return this.createErrorResult(
        payload,
        this.formatCatchError(err, 'Discord webhook'),
        destination,
      );
    }
  }

  private resolveTarget(channelName?: string): DiscordTarget {
    const targets = this.config.targets || [];
    if (channelName) {
      const match = targets.find((t) => t.channelName === channelName);
      if (match) return match;
    }
    if (targets.length > 0) {
      return targets[0];
    }
    return { channelName: 'referrals', type: 'webhook' };
  }
}
