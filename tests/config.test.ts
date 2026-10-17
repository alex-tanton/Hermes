import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppConfigSchema } from '../src/config/schema.js';
import { substituteEnvVars } from '../src/config/loader.js';
import { DEFAULT_CONFIG } from '../src/config/defaults.js';

describe('Config Schema & Validation', () => {
  it('validates DEFAULT_CONFIG successfully', () => {
    const result = AppConfigSchema.safeParse(DEFAULT_CONFIG);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.referralLinks.length).toBeGreaterThan(0);
      expect(result.data.dryRun).toBe(true);
    }
  });

  it('rejects configuration missing required referral link fields', () => {
    const invalidConfig = {
      ...DEFAULT_CONFIG,
      referralLinks: [
        {
          id: 'test-link',
          // missing provider, url, etc.
          name: 'Incomplete Card',
        },
      ],
    };
    const result = AppConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('rejects invalid URLs in referral links', () => {
    const invalidUrlConfig = {
      ...DEFAULT_CONFIG,
      referralLinks: [
        {
          id: 'invalid-url-card',
          enabled: true,
          category: 'credit_card',
          provider: 'Bank',
          name: 'Card',
          url: 'not-a-valid-url',
          bonusSummary: 'Earn $100',
        },
      ],
    };
    const result = AppConfigSchema.safeParse(invalidUrlConfig);
    expect(result.success).toBe(false);
  });

  it('requires at least one referral link', () => {
    const emptyLinksConfig = {
      ...DEFAULT_CONFIG,
      referralLinks: [],
    };
    const result = AppConfigSchema.safeParse(emptyLinksConfig);
    expect(result.success).toBe(false);
  });
});

describe('Environment Variable Substitution', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, TEST_SECRET: 'super-secret-token', USER_ALIAS: 'MaxPoints' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('substitutes ${VAR_NAME} in strings', () => {
    const input = 'Bearer ${TEST_SECRET}';
    const output = substituteEnvVars(input);
    expect(output).toBe('Bearer super-secret-token');
  });

  it('substitutes environment variables in nested objects and arrays', () => {
    const input = {
      auth: { token: '${TEST_SECRET}' },
      users: ['${USER_ALIAS}', 'static_user'],
      numberVal: 42,
    };
    const output = substituteEnvVars(input) as typeof input;
    expect(output.auth.token).toBe('super-secret-token');
    expect(output.users[0]).toBe('MaxPoints');
    expect(output.users[1]).toBe('static_user');
    expect(output.numberVal).toBe(42);
  });

  it('replaces undefined env vars with empty string', () => {
    const input = 'Key: ${NON_EXISTENT_VAR_12345}';
    const output = substituteEnvVars(input);
    expect(output).toBe('Key: ');
  });

  it('supports ${VAR:-fallback} default value syntax when env var is not set', () => {
    const input = 'Host: ${UNDEFINED_PORT:-8080}';
    const output = substituteEnvVars(input);
    expect(output).toBe('Host: 8080');

    // When set, the environment value takes precedence
    const inputWithSet = 'User: ${USER_ALIAS:-default_user}';
    const outputWithSet = substituteEnvVars(inputWithSet);
    expect(outputWithSet).toBe('User: MaxPoints');
  });
});
