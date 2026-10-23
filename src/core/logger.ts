import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

export class Logger {
  private logDir: string;
  private logFile: string;

  constructor() {
    this.logDir = path.resolve(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, 'referral-repeater.log');
    this.ensureLogDir();
  }

  private ensureLogDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private writeToFile(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    // eslint-disable-next-line no-control-regex
    const cleanMsg = message.replace(/\u001b\[[0-9;]*m/g, ''); // strip ANSI codes
    const line = `[${timestamp}] [${level.toUpperCase()}] ${cleanMsg}\n`;
    try {
      fs.appendFileSync(this.logFile, line, 'utf-8');
    } catch {
      // ignore file write errors in transient environments
    }
  }

  public info(message: string): void {
    console.log(`${chalk.blue('ℹ')} ${message}`);
    this.writeToFile('INFO', message);
  }

  public success(message: string): void {
    console.log(`${chalk.green('✔')} ${chalk.green(message)}`);
    this.writeToFile('SUCCESS', message);
  }

  public warn(message: string): void {
    console.log(`${chalk.yellow('⚠')} ${chalk.yellow(message)}`);
    this.writeToFile('WARN', message);
  }

  public error(message: string, error?: unknown): void {
    const details = error instanceof Error ? ` - ${error.message}` : '';
    console.error(`${chalk.red('✖')} ${chalk.red(message + details)}`);
    this.writeToFile('ERROR', message + details);
  }

  public dryRun(message: string): void {
    console.log(`${chalk.magenta('🔍 [DRY-RUN]')} ${message}`);
    this.writeToFile('DRY-RUN', message);
  }

  public banner(title: string): void {
    console.log('\n' + chalk.bold.cyan('='.repeat(70)));
    console.log(chalk.bold.cyan(`   ${title}`));
    console.log(chalk.bold.cyan('='.repeat(70)) + '\n');
  }

  public previewBox(
    platform: string,
    destination: string,
    content: string,
    simulated: boolean,
  ): void {
    const border = '─'.repeat(68);
    const badge = simulated
      ? chalk.bgMagenta.black(' SIMULATED (DRY RUN) ')
      : chalk.bgGreen.black(' LIVE DISPATCHED ');

    console.log(chalk.gray(`┌${border}┐`));
    console.log(
      chalk.gray('│ ') +
        chalk.bold.yellow(`Platform: ${platform.toUpperCase()}`) +
        chalk.gray(` │ Destination: ${destination} `) +
        badge,
    );
    console.log(chalk.gray(`├${border}┤`));
    for (const line of content.split('\n')) {
      console.log(chalk.gray('│ ') + line);
    }
    console.log(chalk.gray(`└${border}┘\n`));
  }
}

export const logger = new Logger();
