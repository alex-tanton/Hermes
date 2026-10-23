import { AppConfig, PlatformType, PostResult, ReferralLink, ToneType } from '../types/index.js';
import { platformRegistry } from '../platforms/registry.js';
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

export class ReferralRepeaterEngine {
  private config: AppConfig;
  private history: HistoryTracker;
  private toneIndex = 0;

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
        const postResult = await adapter.post(payload, { dryRun: isDryRun });

        // Record to persistent audit history
        this.history.record({
          timestamp: postResult.timestamp,
          platform: postResult.platform,
          linkId: link.id,
          linkName: link.name,
          category: link.category,
          simulated: postResult.simulated,
          targetDestination: postResult.targetDestination,
          status: postResult.success ? (postResult.simulated ? 'simulated' : 'success') : 'failed',
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
        }

        results.push(postResult);
      } catch (err) {
        logger.error(`Unexpected error posting to ${platform}:`, err);
      }
    }

    return results;
  }

  /**
   * Filters enabled links targeting this platform, sorted by least-recently-posted
   */
  public getEligibleLinks(platform: PlatformType, options: DispatchOptions = {}): ReferralLink[] {
    const cooldownHours = this.config.schedule.linkCooldownHours;

    return this.config.referralLinks
      .filter((link) => link.enabled)
      .filter((link) => {
        if (options.filterCategory && link.category !== options.filterCategory) {
          return false;
        }
        if (link.targetPlatforms && !link.targetPlatforms.includes(platform)) {
          return false;
        }
        if (!options.force && this.history.isCoolingDown(link.id, platform, cooldownHours)) {
          return false;
        }
        return true;
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
