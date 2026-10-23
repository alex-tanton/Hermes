import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import YAML from 'yaml';

const rootDir = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

describe('Production Daemon Packaging (PROD-01 & PROD-02)', () => {
  describe('Dockerfile (PROD-01)', () => {
    const dockerfilePath = path.join(rootDir, 'Dockerfile');

    it('exists and contains multi-stage build structure', () => {
      expect(fs.existsSync(dockerfilePath)).toBe(true);
      const content = fs.readFileSync(dockerfilePath, 'utf-8');

      // Builder stage
      expect(content).toMatch(/FROM node:20-alpine AS builder/i);
      expect(content).toMatch(/npm ci/);
      expect(content).toMatch(/npm run build/);

      // Runner stage
      expect(content).toMatch(/FROM node:20-alpine AS runner/i);
      expect(content).toMatch(/ENV NODE_ENV=production/);
      expect(content).toMatch(/npm ci --omit=dev/);
      expect(content).toMatch(/COPY --from=builder \/app\/dist \.\/dist/);
    });

    it('enforces security hardening and non-root execution', () => {
      const content = fs.readFileSync(dockerfilePath, 'utf-8');

      expect(content).toMatch(/chown -R node:node \/app/);
      expect(content).toMatch(/USER node/);
      expect(content).toMatch(/VOLUME \["\/app\/\.data", "\/app\/logs"\]/);
      expect(content).toMatch(/CMD \["node", "dist\/cli\/index\.js", "daemon"\]/);
    });
  });

  describe('.dockerignore (PROD-01)', () => {
    const dockerignorePath = path.join(rootDir, '.dockerignore');

    it('exists and excludes development artifacts and sensitive state', () => {
      expect(fs.existsSync(dockerignorePath)).toBe(true);
      const content = fs.readFileSync(dockerignorePath, 'utf-8');
      const lines = content
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));

      const requiredExclusions = [
        'node_modules',
        'dist',
        '.git',
        '.husky',
        '.planning',
        '.data',
        'logs',
        '.env',
        'tests',
        '*.log',
      ];

      for (const exclusion of requiredExclusions) {
        expect(lines).toContain(exclusion);
      }
    });
  });

  describe('docker-compose.yml (PROD-01)', () => {
    const composePath = path.join(rootDir, 'docker-compose.yml');

    it('is valid YAML with expected service specification', () => {
      expect(fs.existsSync(composePath)).toBe(true);
      const raw = fs.readFileSync(composePath, 'utf-8');
      const doc = YAML.parse(raw);

      expect(doc).toBeDefined();
      expect(doc.services).toBeDefined();
      expect(doc.services['referral-repeater']).toBeDefined();

      const service = doc.services['referral-repeater'];
      expect(service.image).toBe('referral-repeater:latest');
      expect(service.container_name).toBe('referral-repeater');
      expect(service.restart).toBe('unless-stopped');
      expect(service.init).toBe(true);
      expect(service.environment).toContain('NODE_ENV=production');

      // Check volume mounts
      expect(service.volumes).toBeDefined();
      expect(service.volumes).toContain('./config.yaml:/app/config.yaml:ro');
      expect(service.volumes).toContain('./.data:/app/.data');
      expect(service.volumes).toContain('./logs:/app/logs');

      // Logging configuration
      expect(service.logging?.driver).toBe('json-file');
      expect(service.logging?.options?.['max-size']).toBe('10m');
      expect(service.logging?.options?.['max-file']).toBe('3');
    });
  });

  describe('PM2 ecosystem.config.cjs (PROD-02)', () => {
    const pm2Path = path.join(rootDir, 'ecosystem.config.cjs');

    it('exports valid CommonJS configuration with process management rules', () => {
      expect(fs.existsSync(pm2Path)).toBe(true);

      const config = require(pm2Path);
      expect(config).toBeDefined();
      expect(Array.isArray(config.apps)).toBe(true);
      expect(config.apps.length).toBeGreaterThan(0);

      const app = config.apps[0];
      expect(app.name).toBe('referral-repeater');
      expect(app.script).toBe('./dist/cli/index.js');
      expect(app.args).toBe('daemon');
      expect(app.instances).toBe(1);
      expect(app.autorestart).toBe(true);
      expect(app.watch).toBe(false);
      expect(app.max_memory_restart).toBe('300M');
      expect(app.env?.NODE_ENV).toBe('production');
      expect(app.output).toBe('./logs/pm2-out.log');
      expect(app.error).toBe('./logs/pm2-error.log');
      expect(app.merge_logs).toBe(true);
      expect(app.time).toBe(true);
    });
  });

  describe('Linux systemd referral-repeater.service (PROD-02)', () => {
    const servicePath = path.join(rootDir, 'referral-repeater.service');

    it('contains valid systemd sections and daemon directives', () => {
      expect(fs.existsSync(servicePath)).toBe(true);
      const content = fs.readFileSync(servicePath, 'utf-8');

      // Sections
      expect(content).toMatch(/\[Unit\]/);
      expect(content).toMatch(/\[Service\]/);
      expect(content).toMatch(/\[Install\]/);

      // Unit directives
      expect(content).toMatch(/Description=Referral-Repeater Autonomous Daemon/);
      expect(content).toMatch(/After=network-online\.target/);
      expect(content).toMatch(/Wants=network-online\.target/);

      // Service execution directives
      expect(content).toMatch(/Type=simple/);
      expect(content).toMatch(/User=referral-repeater/);
      expect(content).toMatch(/Group=referral-repeater/);
      expect(content).toMatch(/WorkingDirectory=\/opt\/referral-repeater/);
      expect(content).toMatch(
        /ExecStart=\/usr\/bin\/node \/opt\/referral-repeater\/dist\/cli\/index\.js daemon/,
      );
      expect(content).toMatch(/Restart=always/);
      expect(content).toMatch(/RestartSec=10/);
      expect(content).toMatch(/Environment=NODE_ENV=production/);

      // Security sandboxing
      expect(content).toMatch(/NoNewPrivileges=true/);
      expect(content).toMatch(/ProtectSystem=strict/);
      expect(content).toMatch(
        /ReadWritePaths=\/opt\/referral-repeater\/\.data \/opt\/referral-repeater\/logs/,
      );
      expect(content).toMatch(/ReadOnlyPaths=\/opt\/referral-repeater\/config\.yaml/);

      // Install directive
      expect(content).toMatch(/WantedBy=multi-user\.target/);
    });
  });
});
