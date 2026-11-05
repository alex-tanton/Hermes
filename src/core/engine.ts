import { AppConfig, PlatformType, PostResult, ReferralLink, ToneType } from '../types/index.js';
import { platformRegistry } from '../platforms/registry.js';
import { RedditAdapter } from '../platforms/reddit.js';
import { templateEngine } from '../templates/engine.js';
import { historyTracker, HistoryTracker } from './history.js';
import { logger } from './logger.js';

export interface DispatchOptions {
  force?: boolean;
  dryRun?: boolean;
  filterPlatform?: PlatformType;
  filterCategory?: string;
  tone?: ToneType;
}

export class HermesEngine {
  private config: AppConfig;
  private history: HistoryTracker;
  private toneIndex = 0;
  private platformBackoffs: Map<PlatformType, number> = new Map();

  constructor(config: AppConfig, customHistory?: HistoryTracker) {
    this.config = config;
    this.history = customHistory || historyTracker;
    platformRegistry.initialize(this.config.platforms, this.config.dryRun);
  }

  public updateConfig(config: AppConfig): void {
    this.config = config;
    platformRegistry.initialize(this.config.platforms, this.config.dryRun);
  }

  public getConfig(): AppConfig {
    return this.config;
  }

  public isPlatformBackingOff(platform: PlatformType): boolean {
    const expiry = this.platformBackoffs.get(platform);
    return !!expiry && expiry > Date.now();
  }

  public setPlatformBackoff(platform: PlatformType, durationMs = 60 * 60 * 1000): void {
    this.platformBackoffs.set(platform, Date.now() + durationMs);
  }

  public clearPlatformBackoffs(): void {
    this.platformBackoffs.clear();
  }

  /**
   * Executes a full round of posting across eligible platforms and referral links
   */
  public async executeCycle(options: DispatchOptions = {}): Promise<PostResult[]> {
    const isDryRun = options.dryRun ?? this.config.dryRun;
    const results: PostResult[] = [];

    // Check daily rate limit
    const dailyPosts = this.history.getPostsInLast24Hours();
    if (!options.force && dailyPosts >= this.config.schedule.maxPostsPerDay) {
      logger.warn(
        `Daily post limit reached (${dailyPosts}/${this.config.schedule.maxPostsPerDay}). Skipping cycle to avoid spam penalties.`,
      );
      return [];
    }

    const activePlatforms = options.filterPlatform
      ? [options.filterPlatform]
      : platformRegistry.getActivePlatforms();

    if (activePlatforms.length === 0) {
      logger.warn('No active platforms configured or enabled.');
      return [];
    }

    logger.info(
      `Starting referral distribution cycle across ${activePlatforms.length} platform(s) [Mode: ${isDryRun ? 'DRY RUN (Safe)' : 'LIVE'}]`,
    );

    for (const platform of activePlatforms) {
      const adapter = platformRegistry.getAdapter(platform);
      if (!adapter) continue;

      if (!options.force && this.isPlatformBackingOff(platform)) {
        logger.warn(
          `Platform [${platform}] is currently in rate-limit backoff. Skipping platform for this cycle.`,
        );
        continue;
      }

      const platformConfig = this.config.platforms[platform];
      if (!options.force && platformConfig?.maxPostsPerDay !== undefined) {
        const platformDailyPosts = this.history.getPostsInLast24Hours(platform);
        if (platformDailyPosts >= platformConfig.maxPostsPerDay) {
          logger.warn(
            `Platform [${platform}] reached daily post limit (${platformDailyPosts}/${platformConfig.maxPostsPerDay}). Skipping platform for this cycle.`,
          );
          continue;
        }
      }

      // Find eligible links for this platform
      const eligibleLinks = this.getEligibleLinks(platform, options);

      if (eligibleLinks.length === 0) {
        logger.info(
          `Platform [${platform}]: No links currently eligible (cooling down or disabled).`,
        );
        continue;
      }

      // Pick the highest priority or least recently posted link
      const link = eligibleLinks[0];
      const selectedTone = options.tone || this.getNextTone();

      // Render tailored payload
      const payload = templateEngine.render({
        platform,
        referralLink: link,
        personalTouch: this.config.personalTouch,
        tone: selectedTone,
      });

      // Dispatch or simulate
      try {
        const postResults: PostResult[] = [];

        if (platform === 'reddit' && adapter instanceof RedditAdapter) {
          const targets = adapter.getLinkTargets(link);
          if (targets.length > 0) {
            for (const target of targets) {
              const res = await adapter.post(payload, { dryRun: isDryRun, target });
              postResults.push(res);
            }
          }
        }

        if (postResults.length === 0) {
          const res = await adapter.post(payload, { dryRun: isDryRun });
          postResults.push(res);
        }

        for (const postResult of postResults) {
          // Record to persistent audit history
          await this.history.record({
            timestamp: postResult.timestamp,
            platform: postResult.platform,
            linkId: link.id,
            linkName: link.name,
            category: link.category,
            simulated: postResult.simulated,
            targetDestination: postResult.targetDestination,
            status: postResult.success
              ? postResult.simulated
                ? 'simulated'
                : 'success'
              : 'failed',
            error: postResult.error,
          });

          // Visual preview output
          logger.previewBox(
            platform,
            postResult.targetDestination || 'Default',
            postResult.messagePreview,
            postResult.simulated,
          );

          if (postResult.success) {
            logger.success(
              `Posted [${link.name}] to ${platform} -> ${postResult.postUrl || postResult.targetDestination}`,
            );
          } else {
            logger.error(`Failed posting [${link.name}] to ${platform}: ${postResult.error}`);
            if (
              postResult.error &&
              /429|rate\s*limit/i.test(postResult.error) &&
              !postResult.simulated
            ) {
              this.setPlatformBackoff(platform);
              logger.warn(
                `Rate limit detected for [${platform}]. Backing off platform for 60 minutes.`,
              );
            }
          }

          results.push(postResult);
        }
      } catch (err) {
        logger.error(`Unexpected error posting to ${platform}:`, err);
      }
    }

    return results;
  }

  /**
   * Filters enabled links targeting this platform, sorted by priority (descending)
   * and least-recently-posted timestamp (ascending / fair round-robin).
   */
  public getEligibleLinks(platform: PlatformType, options: DispatchOptions = {}): ReferralLink[] {
    const platformConfig = this.config.platforms[platform];
    const cooldownHours = platformConfig?.cooldownHours ?? this.config.schedule.linkCooldownHours;
    const cooldownMs = cooldownHours * 60 * 60 * 1000;
    const now = Date.now();

    // Cache the most recent post time for each link for this platform
    const recentHistory = this.history.getRecent(10000);
    const lastPostMap = new Map<string, number>();

    // We only care about entries for the target platform that didn't fail
    for (const entry of recentHistory) {
      if (entry.platform === platform && entry.status !== 'failed') {
        if (!lastPostMap.has(entry.linkId)) {
          lastPostMap.set(entry.linkId, new Date(entry.timestamp).getTime());
        }
      }
    }

    const eligible = this.config.referralLinks
      .filter((link) => link.enabled)
      .filter((link) => {
        if (options.filterCategory && link.category !== options.filterCategory) {
          return false;
        }
        if (link.targetPlatforms && !link.targetPlatforms.includes(platform)) {
          return false;
        }
        if (!options.force) {
          const lastPost = lastPostMap.get(link.id);
          if (lastPost !== undefined && now - lastPost < cooldownMs) {
            return false;
          }
        }
        return true;
      });

    return eligible.sort((a, b) => {
      const priorityA = a.priority ?? 50;
      const priorityB = b.priority ?? 50;
      if (priorityA !== priorityB) {
        return priorityB - priorityA; // higher priority first
      }
      const lastA = lastPostMap.get(a.id) ?? 0;
      const lastB = lastPostMap.get(b.id) ?? 0;
      return lastA - lastB; // least recently posted (or never posted) first -> fair rotation
    });
  }

  private getNextTone(): ToneType {
    const rotation = this.config.personalTouch.toneRotation || [
      'story',
      'informative',
      'deal_alert',
    ];
    const tone = rotation[this.toneIndex % rotation.length];
    this.toneIndex++;
    return tone;
  }
}
