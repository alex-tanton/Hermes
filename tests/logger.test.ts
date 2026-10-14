import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { Logger } from '../src/core/logger.js';

vi.mock('node:fs', () => {
  return {
    default: {
      existsSync: vi.fn(),
      mkdirSync: vi.fn(),
      appendFileSync: vi.fn(),
    },
  };
});

describe('Logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let originalCwd: () => string;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
    originalCwd = process.cwd;
    process.cwd = () => '/mock/cwd';
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    process.cwd = originalCwd;
  });

  describe('Initialization', () => {
    it('creates log directory if it does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      new Logger();
      expect(fs.existsSync).toHaveBeenCalledWith(path.resolve('/mock/cwd', 'logs'));
      expect(fs.mkdirSync).toHaveBeenCalledWith(path.resolve('/mock/cwd', 'logs'), {
        recursive: true,
      });
    });

    it('does not create log directory if it already exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      new Logger();
      expect(fs.existsSync).toHaveBeenCalledWith(path.resolve('/mock/cwd', 'logs'));
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('Core Logging Methods', () => {
    let logger: Logger;

    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      logger = new Logger();
    });

    it('logs info correctly', () => {
      logger.info('test info');
      expect(logSpy).toHaveBeenCalledWith(`${chalk.blue('ℹ')} test info`);
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        path.resolve('/mock/cwd', 'logs/hermes.log'),
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T.* \[INFO\] test info\n/),
        'utf-8',
      );
    });

    it('logs success correctly', () => {
      logger.success('test success');
      expect(logSpy).toHaveBeenCalledWith(`${chalk.green('✔')} ${chalk.green('test success')}`);
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        path.resolve('/mock/cwd', 'logs/hermes.log'),
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T.* \[SUCCESS\] test success\n/),
        'utf-8',
      );
    });

    it('logs warn correctly', () => {
      logger.warn('test warning');
      expect(logSpy).toHaveBeenCalledWith(`${chalk.yellow('⚠')} ${chalk.yellow('test warning')}`);
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        path.resolve('/mock/cwd', 'logs/hermes.log'),
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T.* \[WARN\] test warning\n/),
        'utf-8',
      );
    });

    it('logs error correctly without error object', () => {
      logger.error('test error');
      expect(errorSpy).toHaveBeenCalledWith(`${chalk.red('✖')} ${chalk.red('test error')}`);
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        path.resolve('/mock/cwd', 'logs/hermes.log'),
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T.* \[ERROR\] test error\n/),
        'utf-8',
      );
    });

    it('logs error correctly with error object', () => {
      const err = new Error('details');
      logger.error('test error', err);
      expect(errorSpy).toHaveBeenCalledWith(
        `${chalk.red('✖')} ${chalk.red('test error - details')}`,
      );
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        path.resolve('/mock/cwd', 'logs/hermes.log'),
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T.* \[ERROR\] test error - details\n/),
        'utf-8',
      );
    });

    it('logs dryRun correctly', () => {
      logger.dryRun('test dry run');
      expect(logSpy).toHaveBeenCalledWith(`${chalk.magenta('🔍 [DRY-RUN]')} test dry run`);
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        path.resolve('/mock/cwd', 'logs/hermes.log'),
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T.* \[DRY-RUN\] test dry run\n/),
        'utf-8',
      );
    });

    it('strips ANSI codes before writing to file', () => {
      const msg = `${chalk.cyan('colored')} message`;
      logger.info(msg);
      // It should still log with chalk locally
      expect(logSpy).toHaveBeenCalledWith(`${chalk.blue('ℹ')} ${msg}`);
      // But the file should have clean text
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        path.resolve('/mock/cwd', 'logs/hermes.log'),
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T.* \[INFO\] colored message\n/),
        'utf-8',
      );
    });
  });

  describe('UI & Formatting Methods', () => {
    let logger: Logger;

    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      logger = new Logger();
    });

    it('prints banner correctly', () => {
      logger.banner('TEST BANNER');
      expect(logSpy).toHaveBeenCalledTimes(3);
      expect(logSpy).toHaveBeenNthCalledWith(1, '\n' + chalk.bold.cyan('='.repeat(70)));
      expect(logSpy).toHaveBeenNthCalledWith(2, chalk.bold.cyan('   TEST BANNER'));
      expect(logSpy).toHaveBeenNthCalledWith(3, chalk.bold.cyan('='.repeat(70)) + '\n');
    });

    it('prints previewBox for live dispatch correctly', () => {
      logger.previewBox('discord', '#deals', 'Line 1\nLine 2', false);
      const border = '─'.repeat(68);
      const badge = chalk.bgGreen.black(' LIVE DISPATCHED ');

      expect(logSpy).toHaveBeenCalledWith(chalk.gray(`┌${border}┐`));
      expect(logSpy).toHaveBeenCalledWith(
        chalk.gray('│ ') +
          chalk.bold.yellow('Platform: DISCORD') +
          chalk.gray(' │ Destination: #deals ') +
          badge,
      );
      expect(logSpy).toHaveBeenCalledWith(chalk.gray(`├${border}┤`));
      expect(logSpy).toHaveBeenCalledWith(chalk.gray('│ ') + 'Line 1');
      expect(logSpy).toHaveBeenCalledWith(chalk.gray('│ ') + 'Line 2');
      expect(logSpy).toHaveBeenCalledWith(chalk.gray(`└${border}┘\n`));
    });

    it('prints previewBox for simulated dispatch correctly', () => {
      logger.previewBox('reddit', 'r/churning', 'Test Content', true);
      const badge = chalk.bgMagenta.black(' SIMULATED (DRY RUN) ');

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Platform: REDDIT'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Destination: r/churning'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(badge));
    });
  });

  describe('Error Handling', () => {
    let logger: Logger;

    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      logger = new Logger();
    });

    it('silently ignores file append errors', () => {
      vi.mocked(fs.appendFileSync).mockImplementationOnce(() => {
        throw new Error('EACCES: permission denied');
      });

      // This should not throw
      expect(() => {
        logger.info('test error handling');
      }).not.toThrow();

      // Ensure console log still happened despite file error
      expect(logSpy).toHaveBeenCalledWith(`${chalk.blue('ℹ')} test error handling`);
    });
  });
});
