import { PlatformType, PlatformsConfig } from '../types/index.js';
import { BasePlatformAdapter } from './base.js';
import { RedditAdapter } from './reddit.js';
import { FacebookAdapter } from './facebook.js';
import { BlueskyAdapter } from './bluesky.js';
import { DiscordAdapter } from './discord.js';
import { TwitterAdapter } from './twitter.js';

export class PlatformRegistry {
  private adapters: Map<PlatformType, BasePlatformAdapter> = new Map();

  /**
   * Initializes platform adapters from application configuration
   */
  public initialize(platforms: PlatformsConfig, globalDryRun: boolean): void {
    this.adapters.clear();

    if (platforms.reddit?.enabled) {
      this.adapters.set(
        'reddit',
        new RedditAdapter({
          config: platforms.reddit,
          dryRun: globalDryRun || (platforms.reddit.dryRun ?? true),
        }),
      );
    }

    if (platforms.facebook?.enabled) {
      this.adapters.set(
        'facebook',
        new FacebookAdapter({
          config: platforms.facebook,
          dryRun: globalDryRun || (platforms.facebook.dryRun ?? true),
        }),
      );
    }

    if (platforms.bluesky?.enabled) {
      this.adapters.set(
        'bluesky',
        new BlueskyAdapter({
          config: platforms.bluesky,
          dryRun: globalDryRun || (platforms.bluesky.dryRun ?? true),
        }),
      );
    }

    if (platforms.discord?.enabled) {
      this.adapters.set(
        'discord',
        new DiscordAdapter({
          config: platforms.discord,
          dryRun: globalDryRun || (platforms.discord.dryRun ?? true),
        }),
      );
    }

    if (platforms.twitter?.enabled) {
      this.adapters.set(
        'twitter',
        new TwitterAdapter({
          config: platforms.twitter,
          dryRun: globalDryRun || (platforms.twitter.dryRun ?? true),
        }),
      );
    }
  }

  public getAdapter(platform: PlatformType): BasePlatformAdapter | undefined {
    return this.adapters.get(platform);
  }

  public getAllAdapters(): BasePlatformAdapter[] {
    return Array.from(this.adapters.values());
  }

  public getActivePlatforms(): PlatformType[] {
    return Array.from(this.adapters.keys());
  }
}

export const platformRegistry = new PlatformRegistry();
