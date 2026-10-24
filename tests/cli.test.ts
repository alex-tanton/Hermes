import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { runValidateCommand } from '../src/cli/commands/validate.js';
import { runPostCommand } from '../src/cli/commands/post.js';
import { runHistoryCommand } from '../src/cli/commands/history.js';
import { loadConfig, findConfigFile, substituteEnvVars } from '../src/config/loader.js';
import { historyTracker } from '../src/core/history.js';

describe('CLI Commands & Config Loader', () => {
  const exampleConfigPath = path.resolve(process.cwd(), 'config.example.yaml');
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await historyTracker.clear();
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('runValidateCommand', () => {
    it('validates a valid configuration file without throwing', () => {
      expect(() => {
        runValidateCommand({ config: exampleConfigPath });
      }).not.toThrow();
    });

    it('exits with error code 1 when config file is invalid', () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit(1)');
      }) as never);

      expect(() => {
        runValidateCommand({ config: 'non-existent-config-file.yaml' });
      }).toThrow('process.exit(1)');

      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
    });
  });

  describe('runPostCommand', () => {
    it('executes a safe dry-run distribution cycle across configured platforms', async () => {
      await expect(
        runPostCommand({
          config: exampleConfigPath,
          dryRun: true,
          platform: 'discord',
        }),
      ).resolves.not.toThrow();

      const stats = historyTracker.getStats();
      expect(stats.total).toBeGreaterThanOrEqual(1);
      expect(stats.simulated).toBeGreaterThanOrEqual(1);
    });

    it('handles --live flag correctly in post execution', async () => {
      // In dry-run config, --live forces dryRun = false, but since credentials are mock, it records error or attempts dispatch
      await expect(
        runPostCommand({
          config: exampleConfigPath,
          live: true,
          platform: 'discord',
        }),
      ).resolves.not.toThrow();
    });

    it('exits with error when custom config does not exist', async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit(1)');
      }) as never);

      await expect(
        runPostCommand({
          config: 'missing.yaml',
        }),
      ).rejects.toThrow('process.exit(1)');

      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
    });
  });

  describe('runHistoryCommand', () => {
    it('displays history statistics and recent entries without error', async () => {
      await historyTracker.record({
        timestamp: new Date().toISOString(),
        platform: 'discord',
        linkId: 'test-card',
        linkName: 'Test Card',
        category: 'credit_card',
        simulated: true,
        status: 'simulated',
      });

      await expect(runHistoryCommand({ limit: '5' })).resolves.not.toThrow();
    });

    it('clears posting history when --clear option is passed', async () => {
      await historyTracker.record({
        timestamp: new Date().toISOString(),
        platform: 'discord',
        linkId: 'test-card',
        linkName: 'Test Card',
        category: 'credit_card',
        simulated: true,
        status: 'simulated',
      });

      expect(historyTracker.getStats().total).toBe(1);
      await expect(runHistoryCommand({ clear: true })).resolves.not.toThrow();
      expect(historyTracker.getStats().total).toBe(0);
    });
  });

  describe('Config Loader Edge Cases', () => {
    it('substitutes environment variables with default values when env is absent', () => {
      const result = substituteEnvVars('${NON_EXISTENT_VAR:-my_fallback}');
      expect(result).toBe('my_fallback');
    });

    it('throws error when custom config path does not exist', () => {
      expect(() => findConfigFile('non-existent-path.yaml')).toThrow(
        /Specified config file not found/,
      );
    });

    it('falls back to default config when no config file exists in working dir', () => {
      const customLoaderConfig = loadConfig();
      expect(customLoaderConfig).toBeDefined();
      expect(customLoaderConfig.dryRun).toBeDefined();
    });

    it('saves and serializes configuration to disk via saveConfig', async () => {
      const { saveConfig } = await import('../src/config/loader.js');
      const tempConfig = path.resolve(process.cwd(), '.data/test-save-config.yaml');
      const sampleConfig = loadConfig(exampleConfigPath);
      saveConfig(sampleConfig, '.data/test-save-config.yaml');
      expect(fs.existsSync(tempConfig)).toBe(true);
      fs.unlinkSync(tempConfig);
    });
  });

  describe('runDaemonCommand', () => {
    it('initializes and starts the scheduler daemon', async () => {
      const { runDaemonCommand } = await import('../src/cli/commands/daemon.js');
      const { AutonomousScheduler } = await import('../src/core/scheduler.js');
      const startSpy = vi
        .spyOn(AutonomousScheduler.prototype, 'start')
        .mockImplementation(() => {});

      expect(() => {
        runDaemonCommand({ config: exampleConfigPath });
      }).not.toThrow();

      expect(startSpy).toHaveBeenCalled();
      startSpy.mockRestore();
    });
  });
});
