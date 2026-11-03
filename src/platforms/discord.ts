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
    if (options.dryRun !== undefined) {
      this.dryRun = options.dryRun;
    } else if (this.config.dryRun !== undefined) {
      this.dryRun = this.config.dryRun;
    }
  }

  public getEffectiveWebhookUrl(): string | null {
    return this.config.credentials?.webhookUrl || process.env.DISCORD_WEBHOOK_URL || null;
  }

  public getEffectiveBotToken(): string | null {
    return this.config.credentials?.botToken || process.env.DISCORD_BOT_TOKEN || null;
  }

  public validateCredentials(): { valid: boolean; reason?: string } {
    const webhookUrl = this.getEffectiveWebhookUrl();
    const botToken = this.getEffectiveBotToken();
    if (!webhookUrl && !botToken) {
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

    const webhookUrl = this.getEffectiveWebhookUrl();
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
      const messageId = data.id || `msg_${Date.now()}`;
      const channelId = data.channel_id || target.channelName;
      const postUrl = `https://discord.com/channels/@me/${channelId}/${messageId}`;

      return this.createSuccessResult(payload, {
        postId: messageId,
        postUrl,
        targetDestination: destination,
      });
    } catch (err) {
      return this.createErrorResult(payload, this.formatCatchError(err, 'Discord'), destination);
    }
  }

  private resolveTarget(overrideName?: string): DiscordTarget {
    const targets = this.config.targets || [];
    if (targets.length === 0) {
      return { channelName: 'general', type: 'webhook' };
    }
    if (overrideName) {
      const found = targets.find((t) => t.channelName === overrideName);
      if (found) return found;
    }
    return targets[0];
  }
}
