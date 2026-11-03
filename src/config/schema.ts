import { z } from 'zod';

export const PlatformTypeSchema = z.enum(['reddit', 'facebook', 'bluesky', 'discord', 'twitter']);

export const ProgramCategorySchema = z.enum([
  'credit_card',
  'shopping',
  'banking',
  'dining',
  'custom',
]);

export const ToneTypeSchema = z.enum(['story', 'informative', 'deal_alert', 'comparison']);

export const ReferralLinkSchema = z.object({
  id: z.string().min(1, 'Referral link ID is required'),
  enabled: z.boolean().default(true),
  category: ProgramCategorySchema,
  provider: z.string().min(1, 'Provider name is required (e.g. Chase, Rakuten)'),
  name: z.string().min(1, 'Card or deal name is required'),
  url: z.string().url('Must be a valid URL'),
  bonusSummary: z.string().min(1, 'Bonus summary is required'),
  personalAnecdote: z.string().optional(),
  tags: z.array(z.string()).default([]),
  targetPlatforms: z.array(PlatformTypeSchema).optional(),
  priority: z.number().min(1).max(100).default(50).optional(),
});

export const PersonalTouchSchema = z.object({
  authorName: z.string().default('Alex'),
  philosophy: z.string().optional(),
  defaultAnecdote: z
    .string()
    .default(
      'I have personally used these cards for years to maximize rewards. Happy to answer questions!',
    ),
  includeFtcDisclosure: z.boolean().default(true),
  toneRotation: z.array(ToneTypeSchema).default(['story', 'informative', 'deal_alert']),
});

export const ScheduleSchema = z.object({
  cron: z.string().default('15 */6 * * *'),
  jitterMinutes: z.number().min(0).max(180).default(15),
  maxPostsPerDay: z.number().min(1).max(100).default(10),
  linkCooldownHours: z.number().min(1).default(24),
});

export const RedditTargetSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['post', 'comment']).default('post'),
  megathreadSearchQuery: z.string().optional(),
  flair: z.string().optional(),
});

export const RedditConfigSchema = z.object({
  enabled: z.boolean().default(false),
  dryRun: z.boolean().optional(),
  cooldownHours: z.number().min(1).optional(),
  maxPostsPerDay: z.number().min(1).max(100).optional(),
  credentials: z
    .object({
      accessToken: z.string().optional(),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
      userAgent: z.string().optional(),
    })
    .optional(),
  targets: z.array(RedditTargetSchema).default([]),
});

export const FacebookTargetSchema = z.object({
  id: z
    .string()
    .default('group_feed')
    .transform((val) => val.trim() || 'group_feed'),
  name: z.string().default(''),
  type: z.enum(['group', 'page', 'feed']).default('group'),
});

export const FacebookConfigSchema = z.object({
  enabled: z.boolean().default(false),
  dryRun: z.boolean().optional(),
  cooldownHours: z.number().min(1).optional(),
  maxPostsPerDay: z.number().min(1).max(100).optional(),
  credentials: z
    .object({
      accessToken: z.string().optional(),
      appId: z.string().optional(),
      appSecret: z.string().optional(),
    })
    .optional(),
  targets: z.array(FacebookTargetSchema).default([]),
});

export const BlueskyConfigSchema = z.object({
  enabled: z.boolean().default(false),
  dryRun: z.boolean().optional(),
  cooldownHours: z.number().min(1).optional(),
  maxPostsPerDay: z.number().min(1).max(100).optional(),
  credentials: z
    .object({
      service: z.string().default('https://bsky.social'),
      identifier: z.string().optional(),
      password: z.string().optional(),
    })
    .optional(),
  tags: z.array(z.string()).default([]),
});

export const DiscordTargetSchema = z.object({
  channelName: z.string().default('general'),
  type: z.enum(['webhook', 'channel']).default('webhook'),
});

export const DiscordConfigSchema = z.object({
  enabled: z.boolean().default(false),
  dryRun: z.boolean().optional(),
  cooldownHours: z.number().min(1).optional(),
  maxPostsPerDay: z.number().min(1).max(100).optional(),
  credentials: z
    .object({
      webhookUrl: z.string().optional(),
      botToken: z.string().optional(),
    })
    .optional(),
  targets: z.array(DiscordTargetSchema).default([]),
});

export const TwitterConfigSchema = z.object({
  enabled: z.boolean().default(false),
  dryRun: z.boolean().optional(),
  cooldownHours: z.number().min(1).optional(),
  maxPostsPerDay: z.number().min(1).max(100).optional(),
  credentials: z
    .object({
      apiKey: z.string().optional(),
      apiSecret: z.string().optional(),
      accessToken: z.string().optional(),
      accessSecret: z.string().optional(),
      authToken: z.string().optional(),
      ct0: z.string().optional(),
      cookies: z.string().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
      email: z.string().optional(),
      twoFactorSecret: z.string().optional(),
    })
    .optional(),
  tags: z.array(z.string()).default([]),
});

export const PlatformsSchema = z.object({
  reddit: RedditConfigSchema.default({ enabled: false, targets: [] }),
  facebook: FacebookConfigSchema.default({ enabled: false, targets: [] }),
  bluesky: BlueskyConfigSchema.default({ enabled: false, tags: [] }),
  discord: DiscordConfigSchema.default({ enabled: false, targets: [] }),
  twitter: TwitterConfigSchema.default({ enabled: false, tags: [] }),
});

export const AppConfigSchema = z.object({
  dryRun: z.boolean().default(true),
  personalTouch: PersonalTouchSchema.default({
    authorName: 'Alex',
    defaultAnecdote: 'I have used these cards extensively and can vouch for their value.',
    includeFtcDisclosure: true,
    toneRotation: ['story', 'informative', 'deal_alert'],
  }),
  schedule: ScheduleSchema.default({
    cron: '15 */6 * * *',
    jitterMinutes: 15,
    maxPostsPerDay: 10,
    linkCooldownHours: 24,
  }),
  platforms: PlatformsSchema.default({
    reddit: { enabled: false, targets: [] },
    facebook: { enabled: false, targets: [] },
    bluesky: { enabled: false, tags: [] },
    discord: { enabled: false, targets: [] },
    twitter: { enabled: false, tags: [] },
  }),
  referralLinks: z
    .array(ReferralLinkSchema)
    .min(1, 'At least one referral link must be configured'),
});

export type ValidatedAppConfig = z.infer<typeof AppConfigSchema>;
