import { describe, it, expect, vi, beforeEach } from 'vitest';
import { needsOnboarding, detectApiKeys, generateFridayMd } from '../onboarding/wizard.js';
import { getCurrentVersion, checkForUpdate } from '../config/version.js';

// Mock fs and path for onboarding tests
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
}));

vi.mock('@anthropic-ai/friday-shared', () => ({
  getConfigDir: () => '/tmp/test-friday',
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  ConfigError: class ConfigError extends Error {},
}));

describe('Onboarding', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('needsOnboarding', () => {
    it('should return true when no config file exists', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.default.existsSync).mockReturnValue(false);
      expect(needsOnboarding()).toBe(true);
    });

    it('should return false when config file exists', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.default.existsSync).mockReturnValue(true);
      expect(needsOnboarding()).toBe(false);
    });
  });

  describe('detectApiKeys', () => {
    it('should detect OPENAI_API_KEY', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const detected = detectApiKeys();
      expect(detected.some((d) => d.provider === 'openai')).toBe(true);
      delete process.env.OPENAI_API_KEY;
    });

    it('should detect multiple keys', () => {
      process.env.OPENAI_API_KEY = 'test';
      process.env.ANTHROPIC_API_KEY = 'test';
      const detected = detectApiKeys();
      expect(detected.length).toBeGreaterThanOrEqual(2);
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
    });

    it('should return empty when no keys set', () => {
      const keysToRemove = [
        'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY',
        'MISTRAL_API_KEY', 'GROQ_API_KEY', 'DEEPSEEK_API_KEY',
        'AZURE_OPENAI_API_KEY', 'AWS_ACCESS_KEY_ID', 'COHERE_API_KEY',
        'TOGETHER_API_KEY',
      ];
      const saved: Record<string, string | undefined> = {};
      keysToRemove.forEach((k) => {
        saved[k] = process.env[k];
        delete process.env[k];
      });
      const detected = detectApiKeys();
      expect(detected.length).toBe(0);
      keysToRemove.forEach((k) => {
        if (saved[k]) process.env[k] = saved[k];
      });
    });
  });

  describe('generateFridayMd', () => {
    it('should generate markdown with project name', () => {
      const md = generateFridayMd('/home/user/my-project');
      expect(md).toContain('my-project');
      expect(md).toContain('# my-project');
    });

    it('should include standard sections', () => {
      const md = generateFridayMd('/tmp/test');
      expect(md).toContain('Project Overview');
      expect(md).toContain('Tech Stack');
      expect(md).toContain('Coding Conventions');
      expect(md).toContain('Instructions');
      expect(md).toContain('File Structure');
    });
  });
});

describe('Version', () => {
  describe('getCurrentVersion', () => {
    it('should return a version string', () => {
      const version = getCurrentVersion();
      expect(version).toBeDefined();
      expect(typeof version).toBe('string');
    });
  });

  describe('checkForUpdate', () => {
    it('should return version info object', async () => {
      const info = await checkForUpdate();
      expect(info).toHaveProperty('current');
      expect(info).toHaveProperty('latest');
      expect(info).toHaveProperty('updateAvailable');
      expect(typeof info.updateAvailable).toBe('boolean');
    });

    it('should handle network errors gracefully', async () => {
      // Mock fetch to fail
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const info = await checkForUpdate();
      expect(info.latest).toBeNull();
      expect(info.updateAvailable).toBe(false);
      globalThis.fetch = originalFetch;
    });
  });
});
