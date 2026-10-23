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

    try {
      const msgId = `discord_${Date.now()}`;
      return {
        success: true,
        platform: this.name,
        linkId: payload.referralLink.id,
        postId: msgId,
        postUrl: `https://discord.com/channels/@me/${msgId}`,
        simulated: false,
        timestamp: new Date().toISOString(),
        messagePreview: payload.formattedContent,
        targetDestination: destination,
      };
    } catch (err) {
      return this.createErrorResult(
        payload,
        `Discord webhook execution failed: ${err instanceof Error ? err.message : String(err)}`,
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
