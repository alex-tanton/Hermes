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

    const isDry = (pDry?: boolean) => globalDryRun || (pDry ?? true);

    if (platforms.reddit?.enabled) {
      this.adapters.set(
        'reddit',
        new RedditAdapter({ config: platforms.reddit, dryRun: isDry(platforms.reddit.dryRun) }),
      );
    }
    if (platforms.facebook?.enabled) {
      this.adapters.set(
        'facebook',
        new FacebookAdapter({
          config: platforms.facebook,
          dryRun: isDry(platforms.facebook.dryRun),
        }),
      );
    }
    if (platforms.bluesky?.enabled) {
      this.adapters.set(
        'bluesky',
        new BlueskyAdapter({ config: platforms.bluesky, dryRun: isDry(platforms.bluesky.dryRun) }),
      );
    }
    if (platforms.discord?.enabled) {
      this.adapters.set(
        'discord',
        new DiscordAdapter({ config: platforms.discord, dryRun: isDry(platforms.discord.dryRun) }),
      );
    }
    if (platforms.twitter?.enabled) {
      this.adapters.set(
        'twitter',
        new TwitterAdapter({ config: platforms.twitter, dryRun: isDry(platforms.twitter.dryRun) }),
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
