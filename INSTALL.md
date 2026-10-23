# Installation & Setup Guide: Referral-Repeater

This document provides complete, step-by-step instructions for installing, configuring, and running **Referral-Repeater** on Windows, macOS, and Linux.

---

## Table of Contents

1. [System Prerequisites](#1-system-prerequisites)
2. [Quick Installation](#2-quick-installation)
3. [Configuration](#3-configuration)
   - [Option A: Interactive Wizard (Recommended)](#option-a-interactive-setup-wizard-recommended)
   - [Option B: Manual Configuration (`config.yaml`)](#option-b-manual-configuration-configyaml)
4. [Validating Your Setup](#4-validating-your-setup)
5. [Testing Safe Dry-Run Posts](#5-testing-safe-dry-run-posts)
6. [Autonomous Background Execution](#6-autonomous-background-execution)
   - [Using the Built-in Daemon](#using-the-built-in-daemon)
   - [Using PM2 Process Manager (Recommended for 24/7)](#using-pm2-process-manager-recommended-for-247)
   - [Using Windows Task Scheduler](#using-windows-task-scheduler)
   - [Using Linux Systemd Service](#using-linux-systemd-service)
7. [Platform Credentials Guide](#7-platform-credentials-guide)
8. [Troubleshooting & FAQ](#8-troubleshooting--faq)

---

## 1. System Prerequisites

Ensure you have the following installed:

- **Node.js**: Version 18.0.0 or newer (Node 20+ LTS recommended).
- **npm**: Version 9.0.0 or newer (packaged with Node.js).
- **Git**: For version control.

Check your versions:

```bash
node -v   # Should output v18.x.x, v20.x.x, or newer
npm -v    # Should output 9.x.x or newer
```

If Node.js is not yet installed:

- **Windows / macOS**: Download from [nodejs.org](https://nodejs.org/).
- **Linux (Debian/Ubuntu)**:
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```

---

## 2. Quick Installation

1. Navigate to the project root directory:

   ```bash
   cd Referral-Repeater
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the TypeScript distribution:

   ```bash
   npm run build
   ```

4. Verify tests pass:
   ```bash
   npm test
   ```

---

## 3. Configuration

### Option A: Interactive Setup Wizard (Recommended)

For friends, family, or quick setup, run the interactive guided wizard:

```bash
npm run setup
```

The wizard prompts you for:

- Your name or posting alias.
- Emotional philosophy and personal anecdotes.
- Which platforms to enable (Reddit, Facebook, Bluesky, Discord, Twitter).
- Your referral links (or offers to import pre-configured Chase Freedom, Sapphire, and Capital One VentureOne cards).
- Safe dry-run preference.

Once finished, the wizard generates a clean `config.yaml` file.

### Option B: Manual Configuration (`config.yaml`)

1. Copy the annotated example template:

   ```bash
   cp config.example.yaml config.yaml   # macOS / Linux
   copy config.example.yaml config.yaml # Windows
   ```

2. Open `config.yaml` in your favorite editor. The file includes detailed comments explaining every property:
   - `dryRun: true` (Leave as `true` initially for 100% safe testing).
   - `personalTouch`: Your author name, story hooks, and FTC disclosure toggle.
   - `schedule`: Cron expression (default: `15 */6 * * *` = every 6 hours), jitter, and cooldown hours.
   - `platforms`: Toggle `enabled: true/false` and configure target subreddits, groups, or channels.
   - `referralLinks`: List of cards, shopping portals, banking, or dining referral programs.

3. (Optional) Create a `.env` file for credentials:
   ```bash
   # .env
   REDDIT_CLIENT_ID=your_id
   REDDIT_CLIENT_SECRET=your_secret
   REDDIT_USERNAME=your_username
   REDDIT_PASSWORD=your_password
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
   BLUESKY_HANDLE=yourname.bsky.social
   BLUESKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
   ```
   _Values in `config.yaml` like `${REDDIT_CLIENT_ID}` will automatically resolve from this file._

---

## 4. Validating Your Setup

Check that your configuration file syntax, schema, credentials, and links are valid:

```bash
npm run validate
```

This prints a clear diagnostic summary:

- General settings and schedule.
- Active platforms with credentials health checks.
- Formatted list of all loaded referral links and their target platforms.

---

## 5. Testing Safe Dry-Run Posts

Before ever making live posts, test the distribution cycle in safe simulation mode:

```bash
npm run post
```

In dry-run mode:

- No network requests are sent to real forum APIs.
- The engine formats the post, injects personal anecdotes, calculates character counts, and verifies disclosures.
- A visual preview box is displayed in the terminal showing the exact formatted message.
- A simulated log entry is saved to `.data/history.json` and `logs/referral-repeater.log`.

### CLI Options for Testing

```bash
# Test a specific platform only
npm run post -- --platform discord

# Test a specific category (e.g., credit_card or shopping)
npm run post -- --category shopping

# Test with a specific tone (story, informative, deal_alert, comparison)
npm run post -- --tone deal_alert

# Bypass link cooldown limits during testing
npm run post -- --force
```

---

## 6. Autonomous Background Execution

### Using the Built-in Daemon

To run Referral-Repeater continuously in the background on your machine:

```bash
npm run daemon
```

The daemon will:

1. Initialize the cron schedule from `config.yaml`.
2. Apply randomized anti-bot jitter delays.
3. Automatically execute the distribution cycle on schedule.
4. Enforce daily post caps and per-link cooldowns to protect your accounts from spam penalties.

### Using PM2 Process Manager (Recommended for 24/7)

For continuous operation on home servers, Raspberry Pis, or VPS instances:

```bash
# Install PM2 globally
npm install -g pm2

# Start daemon under PM2 supervision
pm2 start dist/cli/index.js --name "referral-repeater" -- daemon

# View logs
pm2 logs referral-repeater

# Save configuration to restart automatically on server reboot
pm2 save
pm2 startup
```

### Using Windows Task Scheduler

1. Open **Task Scheduler** in Windows.
2. Select **Create Basic Task**.
3. Name: `ReferralRepeater`.
4. Trigger: Daily or at system startup.
5. Action: **Start a program**:
   - Program/script: `node` (or path to `node.exe`)
   - Arguments: `dist/cli/index.js daemon`
   - Start in: `C:\path\to\Referral-Repeater`

### Using Linux Systemd Service

Create `/etc/systemd/system/referral-repeater.service`:

```ini
[Unit]
Description=Referral-Repeater Daemon
After=network.target

[Service]
Type=simple
User=yourusername
WorkingDirectory=/home/yourusername/Referral-Repeater
ExecStart=/usr/bin/node dist/cli/index.js daemon
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable referral-repeater
sudo systemctl start referral-repeater
```

---

## 7. Platform Credentials Guide

### Reddit

1. Visit [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps).
2. Click **Create another app...** (select **script**).
3. Copy the **Client ID** (under app name) and **Client Secret**.
4. Set `userAgent` to `platform:referral-repeater:v1.0.0 (by /u/YourRedditUsername)`.

### Discord

1. In your Discord server, click **Channel Settings** -> **Integrations** -> **Webhooks**.
2. Click **New Webhook**, name it, and click **Copy Webhook URL**.
3. Paste into `config.yaml` or `DISCORD_WEBHOOK_URL` in `.env`.

### Bluesky

1. Log in to [bsky.app](https://bsky.app).
2. Go to **Settings** -> **Privacy & Security** -> **App Passwords**.
3. Click **Add App Password**, name it `referral-repeater`, and copy the password.

### Facebook

1. Visit the [Meta for Developers Portal](https://developers.facebook.com/).
2. Create an app and obtain a **Page Access Token** or **Group Access Token**.

### Twitter / X

1. Visit the [Twitter Developer Portal](https://developer.x.com/).
2. Create a project and app with Read and Write permissions.
3. Generate **API Key**, **API Secret**, **Access Token**, and **Access Secret**.

---

## 8. Troubleshooting & FAQ

### Q: Why are no posts showing up on forums?

- Ensure `dryRun: false` in `config.yaml` (or pass `--live` on the CLI). By default, the application runs in **Safe Dry-Run** mode to protect your accounts until you intentionally activate live mode.

### Q: Why did the engine skip posting a card?

- Check link cooldowns: Each card has a `linkCooldownHours` setting (default: 24h) to avoid posting duplicate offers repeatedly. Use `--force` to bypass cooldowns during manual testing.
- View recent history with:
  ```bash
  npm run history
  ```

### Q: How do I clear the cooldown and post history?

```bash
npm run history -- --clear
```

### Q: How do I add my own credit card or shopping link?

- Simply add a new item under `referralLinks:` in `config.yaml` or re-run `npm run setup`.
