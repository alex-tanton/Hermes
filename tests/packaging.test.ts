import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import YAML from 'yaml';

const rootDir = path.resolve(__dirname, '..');

describe('Production Daemon Packaging (PROD-01)', () => {
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
      expect(doc.services['hermes']).toBeDefined();

      const service = doc.services['hermes'];
      expect(service.image).toBe('hermes:latest');
      expect(service.container_name).toBe('hermes');
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
});
