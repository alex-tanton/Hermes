# Platform Credentials Guide

### Reddit

**Recommended: Devvit 1-Click Authentication (Zero Registration)**

1. In your terminal, run:
   ```bash
   npx devvit login
   ```
2. A browser window will open; click **Allow** to connect your Reddit account.
3. Your secure OAuth token is saved to `~/.devvit/token`. Hermes will automatically detect it with zero configuration!

**Optional: Manual Token or Legacy Script**

- Set `REDDIT_ACCESS_TOKEN=your_token` in `.env`
- Or provide legacy script credentials in `.env`: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USERNAME`, `REDDIT_PASSWORD`.

### Discord

1. In your Discord server, click **Channel Settings** -> **Integrations** -> **Webhooks**.
2. Click **New Webhook**, name it, and click **Copy Webhook URL**.
3. Paste into `config.yaml` or `DISCORD_WEBHOOK_URL` in `.env`.

### Bluesky

1. Log in to [bsky.app](https://bsky.app).
2. Go to **Settings** -> **Privacy & Security** -> **App Passwords**.
3. Click **Add App Password**, name it `hermes`, and copy the password.

### Facebook

1. Visit the [Meta for Developers Portal](https://developers.facebook.com/).
2. Create an app and obtain a **Page Access Token** or **Group Access Token**.

### Twitter / X

1. Visit the [Twitter Developer Portal](https://developer.x.com/).
2. Create a project and app with Read and Write permissions.
3. Generate **API Key**, **API Secret**, **Access Token**, and **Access Secret**.
