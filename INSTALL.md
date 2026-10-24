# Installation & Setup Guide: Hermes

### The Messenger of the Gods

> **Why it fits:** Hermes is famous for his incredible speed, his winged sandals, and his role as the ultimate courier who delivers messages across vast distances.
>
> **The connection:** Just as Hermes carried messages to every corner of the mortal and immortal worlds, your program swiftly carries your referral codes and delivers them across various online platforms. It’s the perfect namesake for a fast, reliable distribution tool.

This document provides complete, step-by-step instructions for installing, configuring, and running **Hermes** on Windows, macOS, and Linux.

---

## Table of Contents

1. [System Prerequisites](#1-system-prerequisites)
2. [Quick Installation](#2-quick-installation)
3. [Configuration](#3-configuration)
   - [Option A: Interactive Wizard (Recommended)](#option-a-interactive-setup-wizard-recommended)
   - [Option B: Manual Configuration (`config.yaml`)](#option-b-manual-configuration-configyaml)
4. [Validating Your Setup](#4-validating-your-setup)
5. [Testing Safe Dry-Run Posts](#5-testing-safe-dry-run-posts)
6. [Autonomous Background Execution & Production Hosting](#6-autonomous-background-execution--production-hosting)
   - [Option A: Docker & Docker Compose (Recommended for Containers)](#option-a-docker--docker-compose-recommended-for-containers)
   - [Option B: PM2 Process Manager (Recommended for Node Servers)](#option-b-pm2-process-manager-recommended-for-node-servers)
   - [Option C: Linux Systemd Service (`hermes.service`)](#option-c-linux-systemd-service)
   - [Option D: Windows Task Scheduler](#option-d-windows-task-scheduler)
   - [Option E: Built-in Terminal Daemon](#option-e-built-in-terminal-daemon)
7. [State Persistence & Backup Best Practices](#7-state-persistence--backup-best-practices)
8. [Platform Credentials Guide](#8-platform-credentials-guide)
9. [Troubleshooting & FAQ](#9-troubleshooting--faq)

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
   cd Hermes
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
# or: npx hermes init
```

The wizard prompts you for:

- Your name or preferred posting alias.
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
# or: npx hermes validate
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
# or: npx hermes post
```

In dry-run mode:

- No network requests are sent to real forum APIs.
- The engine formats the post, injects personal anecdotes, calculates character counts, and verifies disclosures.
- A visual preview box is displayed in the terminal showing the exact formatted message.
- A simulated log entry is saved to `.data/history.json` and `logs/hermes.log`.

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

# Live mode (send real posts)
npm run post -- --live
```

---

## 6. Autonomous Background Execution & Production Hosting

Hermes is designed to operate unattended 24/7. Choose the deployment method that fits your environment:

### Option A: Docker & Docker Compose (Recommended for Containers)

Docker provides an isolated, unprivileged container environment with zero local Node.js dependency management. The container builds with a multi-stage Dockerfile (`node:20-alpine`) running under the non-root `node` user and utilizes Docker's built-in `init` system for clean PID 1 signal forwarding.

#### 1. Quickstart

Ensure you have your `config.yaml` created and validated, then start the container in detached mode:

```bash
docker compose up -d
```

#### 2. Volume Mounts & Architecture

The `docker-compose.yml` mounts host files and folders directly to preserve state across container recreations:

- `./config.yaml:/app/config.yaml:ro` — Read-only bind mount for your configuration settings.
- `./.data:/app/.data` — Persistent volume storing `.data/history.json` (audit trail, link cooldowns, and lockfiles).
- `./logs:/app/logs` — Persistent volume for runtime application log files.
- `.env` — Optional secrets file automatically mapped if present.

#### 3. Monitoring & Inspecting Logs

Follow live output from the daemon:

```bash
docker compose logs -f hermes
```

Container logs are automatically capped at `10m` with a 3-file rotation limit to prevent disk exhaustion.

#### 4. Updating the Container

To upgrade to the latest version with zero state loss:

```bash
# Pull new git updates or Dockerfile modifications
git pull

# Rebuild and relaunch the container
docker compose build --pull
docker compose up -d
```

#### 5. Stopping and Restarting

```bash
# Restart the service
docker compose restart

# Gracefully stop the daemon
docker compose down
```

---

### Option B: PM2 Process Manager (Recommended for Node Servers)

For dedicated Linux VPS instances, macOS home servers, or Raspberry Pis with Node.js installed, PM2 offers rock-solid process supervision, automatic reboot persistence, and memory threshold restarts.

Hermes includes a pre-configured `ecosystem.config.cjs` ready for production:

```bash
# 1. Install PM2 globally
npm install -g pm2

# 2. Build the latest TypeScript code
npm run build

# 3. Start the daemon using the bundled ecosystem configuration
pm2 start ecosystem.config.cjs

# 4. Save running state and configure startup script for system reboots
pm2 save
pm2 startup
```

#### Managing the PM2 Process

```bash
# Live dashboard and memory inspection
pm2 monit

# Tail application logs (combines output and error streams)
pm2 logs hermes

# Restart after modifying config.yaml
pm2 restart hermes

# Stop the daemon
pm2 stop hermes
```

_Note: `ecosystem.config.cjs` is configured with `max_memory_restart: '300M'` to proactively restart the daemon if memory consumption exceeds 300MB._

---

### Option C: Linux Systemd Service

For native Linux system administration without third-party process managers, Hermes includes a hardened systemd service unit template (`hermes.service`).

#### Step-by-Step Setup

1. **Create an unprivileged system user**:

   ```bash
   sudo useradd -r -s /bin/false hermes
   ```

2. **Prepare the installation directory**:

   ```bash
   sudo mkdir -p /opt/hermes
   sudo cp -r dist package*.json node_modules config.yaml /opt/hermes/
   sudo mkdir -p /opt/hermes/.data /opt/hermes/logs
   sudo chown -R hermes:hermes /opt/hermes
   ```

3. **Install the service unit**:

   ```bash
   sudo cp hermes.service /etc/systemd/system/
   sudo systemctl daemon-reload
   ```

4. **Enable and start on boot**:

   ```bash
   sudo systemctl enable --now hermes
   ```

5. **Inspect status and view journal logs**:
   ```bash
   sudo systemctl status hermes
   sudo journalctl -u hermes -f
   ```

The service unit enforces strict systemd sandboxing (`NoNewPrivileges=true`, `ProtectSystem=strict`, and explicit `ReadWritePaths` for `.data` and `logs`).

---

### Option D: Windows Task Scheduler

1. Open **Task Scheduler** in Windows (`taskschd.msc`).
2. Select **Create Basic Task**.
3. Name: `Hermes`.
4. Trigger: **When the computer starts** or **When I log on**.
5. Action: **Start a program**:
   - Program/script: `node.exe` (or full path, e.g., `C:\Program Files\nodejs\node.exe`)
   - Arguments: `dist\cli\index.js daemon`
   - Start in: `C:\path\to\Hermes`

---

### Option E: Built-in Terminal Daemon

For local development or foreground testing, run the daemon directly in your active terminal:

```bash
npm run daemon
# or: npx hermes daemon
```

The daemon will:

1. Initialize the cron schedule from `config.yaml`.
2. Apply randomized anti-bot jitter delays.
3. Automatically execute the distribution cycle on schedule.
4. Enforce daily post caps and per-link cooldowns to protect your accounts.

---

## 7. State Persistence & Backup Best Practices

Hermes follows a zero-database architecture, storing all persistent state in lightweight, auditable JSON and rotating log files:

### Data Architecture

- **`.data/history.json`**: Primary ledger containing full distribution history, last-posted timestamps, FTC disclosure records, and per-link cooldown caches.
- **Cross-Process Mutex**: Writes are protected by `proper-lockfile` and atomic temporary file renames (`.data/history.json.tmp.*`), ensuring zero data corruption during concurrent operations or process restarts.
- **`logs/hermes.log`**: Detailed runtime log recording cycle executions, link selections, network responses, and simulation results.

### Recommended Backup Strategy

To preserve your link rotation memory and avoid repeating recently shared links:

```bash
# Create an ad-hoc backup of posting history
cp .data/history.json .data/history.backup.$(date +%Y%m%d).json
```

In Docker environments, the host `./.data` directory is permanently mapped, ensuring backups can be taken directly from the host filesystem without entering the container.

---

## 8. Platform Credentials Guide

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

---

## 9. Troubleshooting & FAQ

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
