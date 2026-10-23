# External Integrations & Services

## Overview
Referral-Repeater coordinates referral distribution across multiple social platforms, messaging ecosystems, and community forums. The architecture decouples platform-specific API semantics into pluggable adapters managed by `PlatformRegistry`.

---

## Platform Integrations

### 1. Reddit (`src/platforms/reddit.ts`)
- **Target Surfaces**:
  - Subreddit link posts (`type: 'post'`)
  - Subreddit megathreads and discussion comments (`type: 'comment'`)
  - Subreddit flair tagging (e.g., `flair: 'Credit Cards'`)
- **Credentials Required**:
  - `clientId`: Reddit OAuth application client ID
  - `clientSecret`: Reddit OAuth application client secret
  - `username`: Reddit account username
  - `password`: Reddit account password
  - `userAgent`: Formatted user-agent string (default: `node:referral-repeater:v1.0.0 (by /u/alex)`)
- **Formatting**: Full Markdown support (headers, bullet points, horizontal rules, italicized FTC disclosures).
- **Current Integration Status**: Fully validated credentials and target resolution; live dispatch currently operates via safe stub returning simulated or mock Reddit post IDs (`t3_${Date.now()}`).

---

### 2. Discord (`src/platforms/discord.ts`)
- **Target Surfaces**:
  - Discord channel webhooks (`type: 'webhook'`)
  - Discord bot channels (`type: 'channel'`)
- **Credentials Required**:
  - `webhookUrl`: Direct incoming webhook URL (e.g., `https://discord.com/api/webhooks/...`)
  - `botToken`: Optional bot authorization token
- **Formatting**: Rich Discord Markdown (bold titles, blockquotes, italic disclosures) up to 2,000 characters.
- **Current Integration Status**: Validates webhook URL presence; live dispatch currently returns mock Discord message IDs (`discord_${Date.now()}`).

---

### 3. Bluesky / AT Protocol (`src/platforms/bluesky.ts`)
- **Target Surfaces**:
  - Public Bluesky feed / timeline microblog posts
- **Credentials Required**:
  - `service`: XRPC endpoint (defaults to `https://bsky.social`)
  - `identifier`: User handle (e.g., `user.bsky.social`)
  - `password`: Bluesky App Password (not primary account password)
- **Formatting**: Character-budgeted microblog text capped at 300 characters using `fitToLength()`.
- **Current Integration Status**: Validates handle and app password; live dispatch currently returns mock AT Protocol record IDs (`bsky_${Date.now()}`).

---

### 4. Facebook (`src/platforms/facebook.ts`)
- **Target Surfaces**:
  - Facebook Groups (`type: 'group'`)
  - Facebook Pages (`type: 'page'`)
  - Personal Profile Feed (`type: 'feed'`)
- **Credentials Required**:
  - `accessToken`: Graph API user or page access token
  - `appId`: Meta App ID
  - `appSecret`: Meta App Secret
- **Formatting**: Clean conversational plain text. Automatically strips markdown formatting (`**`, `###`) and promotional emoji headers.
- **Current Integration Status**: Validates access token; live dispatch returns mock Graph API post IDs (`fb_${Date.now()}`).

---

### 5. Twitter / X (`src/platforms/twitter.ts`)
- **Target Surfaces**:
  - User timeline tweets
- **Credentials Required**:
  - `apiKey`: Twitter Developer API Key
  - `apiSecret`: Twitter Developer API Secret
  - `accessToken`: User OAuth 1.0a Access Token
  - `accessSecret`: User OAuth 1.0a Access Secret
- **Formatting**: Character-budgeted tweet text strictly capped at 280 characters using `fitToLength()`. Automatically preserves URL and `#ad` FTC tags.
- **Current Integration Status**: Validates four-part OAuth credentials; live dispatch returns mock tweet IDs (`tweet_${Date.now()}`).

---

## Secrets & Environment Variable Resolution

Referral-Repeater avoids storing sensitive credentials in plain text configuration files:
- **Loader**: `src/config/loader.ts` runs `dotenv.config()` on application start.
- **Variable Substitution Engine**:
  ```typescript
  // Matches ${VAR_NAME} or ${VAR_NAME:-default}
  value.replace(/\$\{([A-Za-z0-9_]+)(?::-([^}]*))?\}/g, (_, varName, defaultValue) => {
    const envVal = process.env[varName];
    return (envVal !== undefined && envVal !== '') ? envVal : (defaultValue ?? '');
  });
  ```
- All string values inside `config.yaml` are recursively scanned and interpolated before Zod schema validation.

---

## Filesystem & Storage Integrations

1. **Audit & Cooldown History**:
   - Location: `.data/history.json`
   - Role: Preserves all dispatched and simulated posts, timestamps, platform targets, status flags, and error traces.
   - Used by `ReferralRepeaterEngine` to compute 24-hour rate limits and per-link cooldown windows.
2. **Execution Logs**:
   - Location: `logs/referral-repeater.log`
   - Role: Appends timestamped log lines across `INFO`, `SUCCESS`, `WARN`, `ERROR`, and `DRY-RUN` levels.
