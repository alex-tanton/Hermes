import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import dotenv from 'dotenv';
import { AppConfigSchema, ValidatedAppConfig } from './schema.js';
import { DEFAULT_CONFIG } from './defaults.js';
import { AppConfig } from '../types/index.js';

// Load .env if present
dotenv.config();

/**
 * Replaces ${VAR_NAME} environment variable references inside string values recursively
 */
export function substituteEnvVars(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Za-z0-9_]+)(?::-([^}]*))?\}/g, (_, varName, defaultValue) => {
      const envVal = process.env[varName];
      if (envVal !== undefined && envVal !== '') {
        return envVal;
      }
      return defaultValue ?? '';
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => substituteEnvVars(item));
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = substituteEnvVars(val);
    }
    return result;
  }

  return value;
}

/**
 * Finds the config file in standard locations
 */
export function findConfigFile(customPath?: string): string | null {
  if (customPath) {
    const resolved = path.resolve(process.cwd(), customPath);
    if (fs.existsSync(resolved)) return resolved;
    throw new Error(`Specified config file not found: ${customPath}`);
  }

  const candidates = [
    'config.yaml',
    'config.yml',
    'config.json',
    'config.local.yaml',
    'config.example.yaml',
  ];

  for (const candidate of candidates) {
    const fullPath = path.resolve(process.cwd(), candidate);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Loads and validates configuration from disk, falling back to defaults
 */
export function loadConfig(configPath?: string): ValidatedAppConfig {
  const filePath = findConfigFile(configPath);

  if (!filePath) {
    // If no config file found at all, validate and return default config
    const parseResult = AppConfigSchema.safeParse(DEFAULT_CONFIG);
    if (!parseResult.success) {
      throw new Error(`Default config validation failed: ${parseResult.error.message}`);
    }
    return parseResult.data;
  }

  try {
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    let parsedRaw: unknown;

    if (filePath.endsWith('.json')) {
      parsedRaw = JSON.parse(rawContent);
    } else {
      parsedRaw = YAML.parse(rawContent);
    }

    const resolved = substituteEnvVars(parsedRaw);
    const result = AppConfigSchema.safeParse(resolved);

    if (!result.success) {
      const errorDetails = result.error.issues
        .map((err) => `  - [${err.path.join('.')}]: ${err.message}`)
        .join('\n');
      throw new Error(`Configuration error in ${filePath}:\n${errorDetails}`);
    }

    return result.data;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Configuration error')) {
      throw error;
    }
    throw new Error(
      `Failed to parse config file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Saves an AppConfig to YAML format
 */
export function saveConfig(config: AppConfig, targetPath = 'config.yaml'): void {
  const fullPath = path.resolve(process.cwd(), targetPath);
  const yamlString = YAML.stringify(config, {
    indent: 2,
  });
  fs.writeFileSync(fullPath, yamlString, 'utf-8');
}
