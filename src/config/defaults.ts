import { AppConfig } from '../types/index.js';

export const DEFAULT_CONFIG: AppConfig = {
  dryRun: true,
  personalTouch: {
    authorName: 'Alex',
    philosophy:
      'Smart reward strategies and referral bonuses turn everyday spending into free travel and cash savings.',
    defaultAnecdote:
      'I have personally used these cards for years to maximize cash back and travel for pennies on the dollar. Feel free to ask any questions!',
    includeFtcDisclosure: true,
    toneRotation: ['story', 'informative', 'deal_alert'],
  },
  schedule: {
    cron: '15 */6 * * *',
    jitterMinutes: 20,
    maxPostsPerDay: 12,
    linkCooldownHours: 24,
  },
  platforms: {
    reddit: {
      enabled: true,
      dryRun: true,
      credentials: {
        accessToken: process.env.REDDIT_ACCESS_TOKEN || '',
        clientId: process.env.REDDIT_CLIENT_ID || '',
        clientSecret: process.env.REDDIT_CLIENT_SECRET || '',
        username: process.env.REDDIT_USERNAME || '',
        password: process.env.REDDIT_PASSWORD || '',
        userAgent: 'node:hermes:v1.1.0',
      },
      targets: [
        { name: 'churning', type: 'comment', megathreadSearchQuery: 'Monthly Referral Thread' },
        { name: 'CreditCards', type: 'comment' },
        { name: 'referralcodes', type: 'post', flair: 'Credit Cards' },
      ],
    },
    facebook: {
      enabled: true,
      dryRun: true,
      credentials: {
        accessToken: process.env.FACEBOOK_ACCESS_TOKEN || '',
        appId: process.env.FACEBOOK_APP_ID || '',
        appSecret: process.env.FACEBOOK_APP_SECRET || '',
      },
      targets: [{ id: 'group_cc_rewards', name: 'Credit Card & Travel Community', type: 'group' }],
    },
    bluesky: {
      enabled: true,
      dryRun: true,
      credentials: {
        service: 'https://bsky.social',
        identifier: process.env.BLUESKY_HANDLE || '',
        password: process.env.BLUESKY_APP_PASSWORD || '',
      },
      tags: ['#CreditCards', '#TravelHacking', '#PointsAndMiles', '#Referral'],
    },
    discord: {
      enabled: true,
      dryRun: true,
      credentials: {
        webhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
        botToken: process.env.DISCORD_BOT_TOKEN || '',
      },
      targets: [{ channelName: 'deals-and-referrals', type: 'webhook' }],
    },
    twitter: {
      enabled: true,
      dryRun: true,
      credentials: {
        apiKey: process.env.TWITTER_API_KEY || '',
        apiSecret: process.env.TWITTER_API_SECRET || '',
        accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
        accessSecret: process.env.TWITTER_ACCESS_SECRET || '',
      },
      tags: ['#CreditCard', '#BonusRewards', '#ReferralBonus'],
    },
  },
  referralLinks: [
    {
      id: 'chase-freedom',
      enabled: true,
      category: 'credit_card',
      provider: 'Chase',
      name: 'Chase Freedom Unlimited or Chase Freedom Flex',
      url: 'https://www.referyourchasecard.com/18s/FIG0CQ5GP4',
      bonusSummary:
        'Earn cash back with the Chase Freedom Unlimited or Chase Freedom Flex credit card.',
      personalAnecdote:
        'My favorite no-annual-fee card! 1.5% cash back on everything plus 3% on dining adds up quick.',
      tags: ['chase', 'freedom', 'cashback', 'no-annual-fee'],
      targetPlatforms: ['reddit', 'facebook', 'bluesky', 'discord', 'twitter'],
    },
    {
      id: 'chase-sapphire',
      enabled: true,
      category: 'credit_card',
      provider: 'Chase',
      name: 'Chase Sapphire Reserve® or Sapphire Preferred®',
      url: 'https://www.referyourchasecard.com/19y/MSUZXKR6HR',
      bonusSummary:
        'Earn 100,000 bonus points with Sapphire Reserve® or 75,000 bonus points with Sapphire Preferred®.',
      personalAnecdote:
        'Hands down the best travel points card. Transferred points to Hyatt and saved thousands on vacation.',
      tags: ['chase', 'sapphire', 'travel', 'points'],
      targetPlatforms: ['reddit', 'facebook', 'bluesky', 'discord', 'twitter'],
    },
    {
      id: 'capital-one-ventureone',
      enabled: true,
      category: 'credit_card',
      provider: 'Capital One',
      name: 'Capital One VentureOne',
      url: 'https://i.capitalone.com/JpOQ4YOO3',
      bonusSummary: 'Earn bonus miles with no annual fee and zero foreign transaction fees.',
      personalAnecdote:
        'I have a Capital One VentureOne credit card and really like it. Great everyday card for traveling abroad without fees.',
      tags: ['capital-one', 'venture', 'no-annual-fee', 'travel'],
      targetPlatforms: ['reddit', 'facebook', 'bluesky', 'discord', 'twitter'],
    },
    {
      id: 'rakuten-shopping',
      enabled: true,
      category: 'shopping',
      provider: 'Rakuten',
      name: 'Rakuten Cash Back Shopping',
      url: 'https://www.rakuten.com/r/EXAMPLE_REFERRAL',
      bonusSummary: 'Get $30 bonus after your first qualifying purchase.',
      personalAnecdote:
        'Free cashback for stores like Target, Nike, and Walmart. I never buy anything online without activating Rakuten first!',
      tags: ['shopping', 'cashback', 'rakuten'],
      targetPlatforms: ['reddit', 'facebook', 'discord', 'bluesky'],
    },
  ],
};
