import { describe, it, expect, vi, afterEach } from 'vitest';
import { getPlatform, getConfigDir, getDataDir, getCacheDir, getShell, isCI } from '../platform.js';

describe('platform utilities', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPlatform', () => {
    it('returns a known platform string', () => {
      const result = getPlatform();
      expect(['macos', 'linux', 'windows', 'unknown']).toContain(result);
    });
  });

  describe('getConfigDir', () => {
    it('returns a non-empty string', () => {
      const dir = getConfigDir();
      expect(typeof dir).toBe('string');
      expect(dir.length).toBeGreaterThan(0);
    });

    it('contains "friday" in the path', () => {
      expect(getConfigDir()).toContain('friday');
    });
  });

  describe('getDataDir', () => {
    it('returns a non-empty string', () => {
      const dir = getDataDir();
      expect(typeof dir).toBe('string');
      expect(dir.length).toBeGreaterThan(0);
    });

    it('contains "friday" in the path', () => {
      expect(getDataDir()).toContain('friday');
    });
  });

  describe('getCacheDir', () => {
    it('returns a non-empty string', () => {
      const dir = getCacheDir();
      expect(typeof dir).toBe('string');
      expect(dir.length).toBeGreaterThan(0);
    });

    it('contains "friday" in the path', () => {
      expect(getCacheDir()).toContain('friday');
    });
  });

  describe('getShell', () => {
    it('returns a non-empty string', () => {
      const shell = getShell();
      expect(typeof shell).toBe('string');
      expect(shell.length).toBeGreaterThan(0);
    });

    it('returns a valid shell path or name', () => {
      const shell = getShell();
      // Should be a path containing "sh" or "cmd" or similar
      expect(shell).toMatch(/sh|cmd|pwsh|powershell|zsh|bash|fish/i);
    });
  });

  describe('isCI', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('returns a boolean', () => {
      expect(typeof isCI()).toBe('boolean');
    });

    it('returns true when CI env var is set', () => {
      process.env.CI = 'true';
      expect(isCI()).toBe(true);
    });

    it('returns true when GITHUB_ACTIONS env var is set', () => {
      delete process.env.CI;
      process.env.GITHUB_ACTIONS = 'true';
      expect(isCI()).toBe(true);
    });

    it('returns true when GITLAB_CI env var is set', () => {
      delete process.env.CI;
      delete process.env.GITHUB_ACTIONS;
      process.env.GITLAB_CI = 'true';
      expect(isCI()).toBe(true);
    });

    it('returns true when JENKINS_URL env var is set', () => {
      delete process.env.CI;
      delete process.env.GITHUB_ACTIONS;
      delete process.env.GITLAB_CI;
      process.env.JENKINS_URL = 'http://jenkins.local';
      expect(isCI()).toBe(true);
    });

    it('returns false when no CI env vars are set', () => {
      delete process.env.CI;
      delete process.env.GITHUB_ACTIONS;
      delete process.env.GITLAB_CI;
      delete process.env.JENKINS_URL;
      expect(isCI()).toBe(false);
    });
  });
});
