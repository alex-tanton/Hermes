# Phase 04: Production Daemon Packaging - Research

**Phase:** 04-production-daemon-packaging  
**Domain:** Docker, docker-compose, PM2 process management, systemd daemonization, production deployment guide  
**Confidence:** HIGH  
**Date:** 2026-10-23  

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **PROD-01** | Create lightweight multi-stage `Dockerfile` and `docker-compose.yml` for containerized background execution. | Multi-stage Dockerfile based on `node:20-alpine` (builder stage compiling TypeScript via `npm run build`, runner stage with `npm ci --omit=dev`, non-root `node` user, and `/app/.data` & `/app/logs` volume mounts). `docker-compose.yml` configuring continuous unattended background daemon execution (`node dist/cli/index.js daemon`) with persistent host volume mounts for `config.yaml`, `.data/`, and `logs/`. |
| **PROD-02** | Provide ready-to-use PM2 `ecosystem.config.cjs` and Linux `systemd` unit files for unattended 24/7 server hosting. | `ecosystem.config.cjs` tailored for CommonJS NodeNext output, configuring 1 instance of `referral-repeater daemon`, automated restart on crash, memory-based restart guard (`max_memory_restart: '300M'`), and unified log file outputs. `referral-repeater.service` systemd service unit template providing `Restart=always`, `RestartSec=10`, user specification, environment flags, and journalctl logging. |
| **PROD-03** | Update `INSTALL.md` with containerized and process-managed deployment instructions. | Expand `INSTALL.md` with comprehensive instructions for running under Docker, Docker Compose, PM2 via `ecosystem.config.cjs`, and Linux `systemd`, including log inspection, container lifecycle management, and secrets management via `.env`. |
</phase_requirements>

---

## Executive Summary

Referral-Repeater is designed to run unattended 24/7 as an autonomous background daemon (`referral-repeater daemon`). While the CLI and core engine are fully implemented and verified through Phase 3, production users running on VPS instances, home servers (Raspberry Pi, unRAID, TrueNAS), or local machines require turnkey packaging assets to keep the process running reliably across reboots, process crashes, and resource constraints.

Phase 4 packages the application into production-grade artifacts:
1. **Containerization (PROD-01)**:
   - A multi-stage `Dockerfile` ensuring clean production builds without development toolchains (TypeScript compiler, linters, test harnesses) in the final image, minimizing image size (< 180MB) and attack surface.
   - Non-root user execution (`USER node`) and proper directory permissions for `/app/.data` and `/app/logs`.
   - `docker-compose.yml` defining mount mappings (`./config.yaml`, `./.data`, `./logs`, and `./.env`), init process handling (`init: true`) for signal reaping (SIGINT/SIGTERM), and restart policies (`unless-stopped`).
   - `.dockerignore` to prevent uploading node_modules, git histories, local logs, and cache data to Docker build contexts.

2. **Process Management & Service Templates (PROD-02)**:
   - `ecosystem.config.cjs` for PM2 users, defining production process parameters, log redirection, and a 300MB memory restart ceiling.
   - `referral-repeater.service` for Linux systemd environments, complete with user directives, restart policies, and working directory configurations.

3. **Production Deployment Documentation (PROD-03)**:
   - Thoroughly document deployment via Docker Compose, PM2, and systemd in `INSTALL.md`.
   - Provide concrete commands for log inspection, stopping, restarting, and updating.

4. **Automated Verification**:
   - A dedicated test suite (`tests/packaging.test.ts`) that verifies Dockerfile syntax/stages, `docker-compose.yml` schema and volume bindings, `ecosystem.config.cjs` exports, and `referral-repeater.service` directives deterministically in CI.

---

## Technical Specifications & Best Practices

### 1. Docker Multi-Stage Build & Configuration

#### Base Image Selection
- `node:20-alpine`: Modern LTS, ultra-lightweight (~130MB base), contains native Node 20 runtime with built-in `fetch` and `node:crypto`.
- Alpine includes the standard `node` user (UID 1000) for running unprivileged processes.

#### Build Stage (`builder`)
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build
```

#### Runner Stage (`runner`)
```dockerfile
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Create runtime directories with node user ownership
RUN mkdir -p /app/.data /app/logs && chown -R node:node /app

USER node

VOLUME ["/app/.data", "/app/logs"]

CMD ["node", "dist/cli/index.js", "daemon"]
```

#### Docker Compose Specification (`docker-compose.yml`)
```yaml
version: '3.8'

services:
  referral-repeater:
    build:
      context: .
      dockerfile: Dockerfile
    image: referral-repeater:latest
    container_name: referral-repeater
    restart: unless-stopped
    init: true
    environment:
      - NODE_ENV=production
    env_file:
      - path: .env
        required: false
    volumes:
      - ./config.yaml:/app/config.yaml:ro
      - ./.data:/app/.data
      - ./logs:/app/logs
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

### 2. PM2 Ecosystem Configuration (`ecosystem.config.cjs`)

Because the project outputs NodeNext CommonJS bundles, PM2 can directly execute `./dist/cli/index.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'referral-repeater',
      script: './dist/cli/index.js',
      args: 'daemon',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
      output: './logs/pm2-out.log',
      error: './logs/pm2-error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
```

### 3. Linux Systemd Unit File (`referral-repeater.service`)

```ini
[Unit]
Description=Referral-Repeater Autonomous Daemon
Documentation=https://github.com/alex-tanton/Referral-Repeater
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=referral-repeater
Group=referral-repeater
WorkingDirectory=/opt/referral-repeater
ExecStart=/usr/bin/node /opt/referral-repeater/dist/cli/index.js daemon
Restart=always
RestartSec=10
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal
SyslogIdentifier=referral-repeater

# Security sandboxing
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/referral-repeater/.data /opt/referral-repeater/logs
ReadOnlyPaths=/opt/referral-repeater/config.yaml

[Install]
WantedBy=multi-user.target
```

---

## Verification & Testing Strategy

To ensure CI reproducibility without requiring a Docker daemon installed on developer machines or test runners:
1. `tests/packaging.test.ts`:
   - Validates `Dockerfile` exists, contains multi-stage targets (`AS builder`, `AS runner`), specifies non-root `USER node`, and default `CMD`.
   - Validates `.dockerignore` exists and ignores sensitive/bulky folders (`node_modules`, `.git`, `.data`, `logs`, `.env`).
   - Validates `docker-compose.yml` is valid YAML, contains the `referral-repeater` service, mounts `config.yaml`, `.data`, and `logs`, and sets `restart: unless-stopped`.
   - Validates `ecosystem.config.cjs` exports a valid CommonJS app array with correct script, args (`daemon`), and `max_memory_restart`.
   - Validates `referral-repeater.service` contains required systemd sections `[Unit]`, `[Service]`, and `[Install]`, with `ExecStart` pointing to the daemon.
2. Full suite run (`npm test`, `npm run lint`, `npm run format:check`) to guarantee no regressions across the entire project.
