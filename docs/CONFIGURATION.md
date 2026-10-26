# Configuration Reference (`config.yaml`)

```yaml
# Global safety switch. Set to false ONLY when ready to post live.
dryRun: true

# Personal touch and story injection
personalTouch:
  authorName: 'Alex'
  philosophy: 'Smart reward strategies turn everyday spending into free vacations.'
  defaultAnecdote: 'I have used these cards for years to maximize travel points.'
  includeFtcDisclosure: true # Appends FTC compliance disclosure
  toneRotation:
    - 'story'
    - 'informative'
    - 'deal_alert'

# Autonomous scheduler settings
schedule:
  cron: '15 */6 * * *' # Standard 5-field cron expression
  jitterMinutes: 20 # Random delay up to 20 minutes to avoid robotic timing
  maxPostsPerDay: 12 # Daily cap across all platforms
  linkCooldownHours: 24 # Global fallback cooldown per link/platform

# Platform toggles, credentials, and optional per-platform rate limits
platforms:
  reddit:
    enabled: true
    dryRun: true
    cooldownHours: 720 # Per-platform override: 30-day cooldown for monthly megathread rules
    maxPostsPerDay: 1 # Per-platform override: limit Reddit to 1 post per day
    credentials:
      accessToken: '${REDDIT_ACCESS_TOKEN:-}'
      userAgent: 'node:hermes:v1.1.0'
    targets:
      - name: 'churning'
        type: 'comment'
      - name: 'referralcodes'
        type: 'post'
        flair: 'Credit Cards'

  discord:
    enabled: true
    dryRun: true
    cooldownHours: 12 # Per-platform override: 12-hour turnaround for active deal channels
    maxPostsPerDay: 6 # Per-platform override: up to 6 posts/day
    credentials:
      webhookUrl: '${DISCORD_WEBHOOK_URL}'
    targets:
      - channelName: 'deals-and-referrals'

  bluesky:
    enabled: true
    dryRun: true
    credentials:
      identifier: '${BLUESKY_HANDLE}'
      password: '${BLUESKY_APP_PASSWORD}'

  facebook:
    enabled: false
    dryRun: true

  twitter:
    enabled: false
    dryRun: true

# Configured referral links (Credit cards, shopping, banking, etc.)
referralLinks:
  - id: 'chase-freedom'
    enabled: true
    category: 'credit_card'
    provider: 'Chase'
    name: 'Chase Freedom Unlimited or Flex'
    url: 'https://www.referyourchasecard.com/18s/FIG0CQ5GP4'
    bonusSummary: 'Earn cash back welcome bonus after qualifying purchases.'
    personalAnecdote: 'My go-to daily driver card! 1.5% base plus 3% on dining adds up fast.'
    tags: ['chase', 'cashback', 'no-annual-fee']
    priority: 85 # Priority (1-100, default 50). High priority links are picked first.
```
