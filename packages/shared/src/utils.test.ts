import { describe, it, expect } from 'vitest';
import { expandHome, generateId, deepMerge, matchToolPattern } from './utils.js';
import { COLORS, ANSI_COLORS, APP_NAME, CLI_COMMAND } from './constants.js';

describe('utils', () => {
  describe('expandHome', () => {
    it('should expand ~ to home directory', () => {
      const result = expandHome('~/test');
      expect(result).toContain('/test');
      expect(result).not.toContain('~');
    });

    it('should leave non-~ paths unchanged', () => {
      expect(expandHome('/usr/local')).toBe('/usr/local');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should generate string IDs', () => {
      expect(typeof generateId()).toBe('string');
    });
  });

  describe('deepMerge', () => {
    it('should merge nested objects', () => {
      const a = { x: 1, nested: { a: 1 } } as Record<string, unknown>;
      const b = { y: 2, nested: { b: 2 } } as Record<string, unknown>;
      const result = deepMerge(a, b);
      expect(result).toEqual({ x: 1, y: 2, nested: { a: 1, b: 2 } });
    });

    it('should override scalar values with source', () => {
      const result = deepMerge({ x: 1 } as Record<string, unknown>, { x: 2 });
      expect(result.x).toBe(2);
    });
  });

  describe('matchToolPattern', () => {
    it('should match exact tool names', () => {
      expect(matchToolPattern('Bash', 'Bash')).toBe(true);
    });

    it('should match tool patterns with commands', () => {
      expect(matchToolPattern('Bash(ls*)', 'Bash', 'ls -la')).toBe(true);
    });

    it('should reject non-matches', () => {
      expect(matchToolPattern('Bash', 'Read')).toBe(false);
    });
  });
});

describe('constants', () => {
  it('should export correct app name', () => {
    expect(APP_NAME).toBe('FridayCode');
    expect(CLI_COMMAND).toBe('friday');
  });

  it('should have color palette', () => {
    expect(COLORS.deepViolet).toBe('#8B5CF6');
    expect(COLORS.starkRose).toBe('#F43F5E');
    expect(COLORS.acidicPistachio).toBe('#A3E635');
    expect(COLORS.icySlate).toBe('#F8FAFC');
    expect(COLORS.midnightSlate).toBe('#334155');
  });

  it('should have ANSI color codes', () => {
    expect(ANSI_COLORS.deepViolet).toBe(99);
    expect(typeof ANSI_COLORS.starkRose).toBe('number');
  });
});
