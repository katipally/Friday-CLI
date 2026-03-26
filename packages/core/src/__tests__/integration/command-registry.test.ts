import { describe, it, expect, vi } from 'vitest';

vi.mock('@fridaycode/shared', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { createDefaultRegistry, CommandRegistry } from '../../commands/command-registry.js';

describe('CommandRegistry Integration', () => {
  describe('createDefaultRegistry', () => {
    it('returns a CommandRegistry instance', () => {
      const registry = createDefaultRegistry();
      expect(registry).toBeInstanceOf(CommandRegistry);
    });

    it('registers all expected built-in commands', () => {
      const registry = createDefaultRegistry();
      const commands = registry.listCommands();
      const names = commands.map((c) => c.name);

      expect(names).toContain('help');
      expect(names).toContain('clear');
      expect(names).toContain('model');
      expect(names).toContain('models');
      expect(names).toContain('config');
      expect(names).toContain('cost');
      expect(names).toContain('checkpoint');
      expect(names).toContain('rewind');
      expect(names).toContain('theme');
      expect(names).toContain('doctor');
      expect(names).toContain('compact');
      expect(names).toContain('version');
      expect(names).toContain('stats');
      expect(commands.length).toBe(13);
    });
  });

  describe('command lookup', () => {
    it('finds a command by name', () => {
      const registry = createDefaultRegistry();
      const cmd = registry.get('help');
      expect(cmd).toBeDefined();
      expect(cmd!.name).toBe('help');
      expect(cmd!.description).toBe('Show available commands');
    });

    it('finds a command by alias', () => {
      const registry = createDefaultRegistry();
      const byAlias = registry.get('h');
      const byName = registry.get('help');
      expect(byAlias).toBe(byName);
    });

    it('returns undefined for unknown command', () => {
      const registry = createDefaultRegistry();
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('has() returns true for registered names and aliases', () => {
      const registry = createDefaultRegistry();
      expect(registry.has('help')).toBe(true);
      expect(registry.has('h')).toBe(true);
      expect(registry.has('?')).toBe(true);
      expect(registry.has('clear')).toBe(true);
      expect(registry.has('c')).toBe(true);
      expect(registry.has('nope')).toBe(false);
    });
  });

  describe('execute', () => {
    it('returns handled: false for non-slash input', async () => {
      const registry = createDefaultRegistry();
      const result = await registry.execute('hello world', {});
      expect(result.handled).toBe(false);
      expect(result.output).toBe('');
    });

    it('executes a known command', async () => {
      const registry = createDefaultRegistry();
      const result = await registry.execute('/version', {});
      expect(result.handled).toBe(true);
      expect(result.output).toContain('FridayCode');
    });

    it('suggests similar commands for unknown slash commands', async () => {
      const registry = createDefaultRegistry();
      const result = await registry.execute('/hel', {});
      expect(result.handled).toBe(true);
      expect(result.output).toContain('Unknown command');
      expect(result.output).toContain('/help');
    });

    it('passes arguments to command handler', async () => {
      const registry = createDefaultRegistry();
      const result = await registry.execute('/model gpt-4o', {});
      expect(result.handled).toBe(true);
      expect(result.output).toContain('gpt-4o');
    });
  });

  describe('category grouping', () => {
    it('groups commands into expected categories', () => {
      const registry = createDefaultRegistry();
      const grouped = registry.listByCategory();
      const categories = Object.keys(grouped);

      expect(categories).toContain('session');
      expect(categories).toContain('config');
      expect(categories).toContain('info');
      expect(categories).toContain('debug');
    });

    it('places commands in the correct category', () => {
      const registry = createDefaultRegistry();
      const grouped = registry.listByCategory();

      const sessionNames = grouped['session'].map((c) => c.name);
      expect(sessionNames).toContain('clear');
      expect(sessionNames).toContain('checkpoint');
      expect(sessionNames).toContain('rewind');

      const infoNames = grouped['info'].map((c) => c.name);
      expect(infoNames).toContain('help');
      expect(infoNames).toContain('version');
      expect(infoNames).toContain('cost');
      expect(infoNames).toContain('stats');

      const debugNames = grouped['debug'].map((c) => c.name);
      expect(debugNames).toContain('doctor');
    });
  });

  describe('help text generation', () => {
    it('/help output lists all commands grouped by category', async () => {
      const registry = createDefaultRegistry();
      const result = await registry.execute('/help', {});
      expect(result.handled).toBe(true);

      const output = result.output;
      expect(output).toContain('Available Commands');
      expect(output).toContain('/help');
      expect(output).toContain('/clear');
      expect(output).toContain('/model');
      expect(output).toContain('/version');
      expect(output).toContain('/doctor');
    });

    it('/help output includes aliases', async () => {
      const registry = createDefaultRegistry();
      const result = await registry.execute('/help', {});
      expect(result.output).toContain('/h');
      expect(result.output).toContain('/?');
    });
  });

  describe('listCommands', () => {
    it('returns sorted unique commands without alias duplicates', () => {
      const registry = createDefaultRegistry();
      const commands = registry.listCommands();
      const names = commands.map((c) => c.name);

      // Should be sorted alphabetically
      const sorted = [...names].sort();
      expect(names).toEqual(sorted);

      // No duplicates
      expect(new Set(names).size).toBe(names.length);
    });
  });
});
