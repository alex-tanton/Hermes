/**
 * Core type definitions for Referral-Repeater
 */

export type PlatformType = 'reddit' | 'facebook' | 'bluesky' | 'discord' | 'twitter';

export type ProgramCategory = 'credit_card' | 'shopping' | 'banking' | 'dining' | 'custom';

export type ToneType = 'story' | 'informative' | 'deal_alert' | 'comparison';

/**
 * Referral link entity
 */
export interface ReferralLink {
  id: string;
  enabled: boolean;
  category: ProgramCategory;
  provider: string;
  name: string;
  url: string;
  bonusSummary: string;
  personalAnecdote?: string;
  tags?: string[];
  targetPlatforms?: PlatformType[];
  priority?: number;
}

/**
 * Personalization & tone settings
 */
export interface PersonalTouchConfig {
  authorName: string;
  philosophy?: string;
  defaultAnecdote?: string;
  includeFtcDisclosure: boolean;
  toneRotation?: ToneType[];
}

/**
 * Scheduler settings
 */
export interface ScheduleConfig {
  cron: string;
  jitterMinutes: number;
  maxPostsPerDay: number;
  linkCooldownHours: number;
}

/**
 * Platform target destinations
 */
export interface RedditTarget {
  name: string;
  type: 'post' | 'comment';
  megathreadSearchQuery?: string;
  flair?: string;
}

export interface FacebookTarget {
  id: string;
  name: string;
  type: 'group' | 'page' | 'feed';
}

export interface DiscordTarget {
  channelName: string;
  type: 'webhook' | 'channel';
}

/**
 * Platform-specific configurations
 */
export interface RedditConfig {
  enabled: boolean;
  dryRun?: boolean;
  cooldownHours?: number;
  maxPostsPerDay?: number;
  credentials?: {
    clientId?: string;
    clientSecret?: string;
    username?: string;
    password?: string;
    userAgent?: string;
  };
  targets?: RedditTarget[];
}

export interface FacebookConfig {
  enabled: boolean;
  dryRun?: boolean;
  cooldownHours?: number;
  maxPostsPerDay?: number;
  credentials?: {
    accessToken?: string;
    appId?: string;
    appSecret?: string;
  };
  targets?: FacebookTarget[];
}

export interface BlueskyConfig {
  enabled: boolean;
  dryRun?: boolean;
  cooldownHours?: number;
  maxPostsPerDay?: number;
  credentials?: {
    service?: string;
    identifier?: string;
    password?: string;
  };
  tags?: string[];
}

export interface DiscordConfig {
  enabled: boolean;
  dryRun?: boolean;
  cooldownHours?: number;
  maxPostsPerDay?: number;
  credentials?: {
    webhookUrl?: string;
    botToken?: string;
  };
  targets?: DiscordTarget[];
}

export interface TwitterConfig {
  enabled: boolean;
  dryRun?: boolean;
  cooldownHours?: number;
  maxPostsPerDay?: number;
  credentials?: {
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    accessSecret?: string;
  };
  tags?: string[];
}

export interface PlatformsConfig {
  reddit?: RedditConfig;
  facebook?: FacebookConfig;
  bluesky?: BlueskyConfig;
  discord?: DiscordConfig;
  twitter?: TwitterConfig;
}

/**
 * Overall Application Configuration
 */
export interface AppConfig {
  dryRun: boolean;
  personalTouch: PersonalTouchConfig;
  schedule: ScheduleConfig;
  platforms: PlatformsConfig;
  referralLinks: ReferralLink[];
}

/**
 * Payload sent to a platform adapter
 */
export interface PostPayload {
  platform: PlatformType;
  referralLink: ReferralLink;
  title: string;
  body: string;
  formattedContent: string;
  tags: string[];
  tone: ToneType;
  metadata?: Record<string, unknown>;
}

/**
 * Result returned by a platform adapter after posting
 */
export interface PostResult {
  success: boolean;
  platform: PlatformType;
  linkId: string;
  postId?: string;
  postUrl?: string;
  simulated: boolean;
  timestamp: string;
  messagePreview: string;
  targetDestination?: string;
  error?: string;
}

/**
 * Post history entry stored locally for audit & deduplication
 */
export interface HistoryEntry {
  id: string;
  timestamp: string;
  platform: PlatformType;
  linkId: string;
  linkName: string;
  category: ProgramCategory;
  simulated: boolean;
  targetDestination?: string;
  status: 'simulated' | 'success' | 'failed';
  error?: string;
}

/**
 * Program definition for extending categories
 */
export interface ProgramDefinition {
  category: ProgramCategory;
  displayName: string;
  description: string;
  recommendedPlatforms: PlatformType[];
  defaultDisclosure: string;
}

/**
 * Thrown when cross-process lock acquisition times out
 */
export class LockTimeoutError extends Error {
  public readonly code = 'LOCK_TIMEOUT';
  public readonly filePath: string;
  public readonly timeoutMs: number;

  constructor(filePath: string, timeoutMs: number, cause?: unknown) {
    super(
      `Failed to acquire file lock for "${filePath}" within ${timeoutMs}ms. ` +
        `Another process (such as a background daemon or CLI instance) may be holding the lock. ` +
        `Check running processes or remove stale lockfile directory "${filePath}.lock" if no other process is active.`,
    );
    this.name = 'LockTimeoutError';
    this.filePath = filePath;
    this.timeoutMs = timeoutMs;
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Thrown when filesystem storage writes or atomic renames fail
 */
export class HistoryStorageError extends Error {
  public readonly code = 'STORAGE_ERROR';
  public readonly filePath: string;

  constructor(message: string, filePath: string, cause?: unknown) {
    super(message);
    this.name = 'HistoryStorageError';
    this.filePath = filePath;
    if (cause) {
      this.cause = cause;
    }
  }
}
