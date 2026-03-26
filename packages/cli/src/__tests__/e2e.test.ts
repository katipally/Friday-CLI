import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock shared module used by loader
vi.mock('@fridaycode/shared', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  getConfigDir: () => '/nonexistent-friday-config-dir',
  ConfigError: class ConfigError extends Error {},
}));

import { fridayConfigSchema } from '../config/schema.js';
import { createCommandRegistry, CommandRegistry } from '../commands/index.js';

describe('Config Schema', () => {
  describe('fridayConfigSchema.parse({})', () => {
    it('returns defaults for empty object', () => {
      const config = fridayConfigSchema.parse({});

      expect(config.defaultProvider).toBe('openai');
      expect(config.defaultModel).toBe('gpt-4o');
      expect(config.theme).toBe('dark');
      expect(config.language).toBe('en');
      expect(config.telemetry).toBe(false);
      expect(config.maxIterations).toBe(50);
      expect(config.temperature).toBe(0.7);
      expect(config.providers).toEqual({});
    });

    it('returns default permissions', () => {
      const config = fridayConfigSchema.parse({});

      expect(config.permissions.autoApproveRead).toBe(true);
      expect(config.permissions.autoApproveWrite).toBe(false);
      expect(config.permissions.blockedCommands).toEqual(['rm -rf /', 'sudo rm']);
      expect(config.permissions.workspaceOnly).toBe(true);
    });

    it('returns default cost budget', () => {
      const config = fridayConfigSchema.parse({});

      expect(config.costBudget.perSession).toBeNull();
      expect(config.costBudget.perDay).toBeNull();
    });

    it('returns default mcp config', () => {
      const config = fridayConfigSchema.parse({});

      expect(config.mcp.servers).toEqual([]);
    });
  });

  describe('custom values', () => {
    it('parses custom provider and model', () => {
      const config = fridayConfigSchema.parse({
        defaultProvider: 'anthropic',
        defaultModel: 'claude-3-opus',
        temperature: 0.5,
      });

      expect(config.defaultProvider).toBe('anthropic');
      expect(config.defaultModel).toBe('claude-3-opus');
      expect(config.temperature).toBe(0.5);
    });

    it('parses provider configs', () => {
      const config = fridayConfigSchema.parse({
        providers: {
          openai: { apiKey: 'sk-test', baseUrl: 'http://localhost' },
        },
      });

      expect(config.providers.openai.apiKey).toBe('sk-test');
      expect(config.providers.openai.baseUrl).toBe('http://localhost');
    });

    it('parses custom permissions', () => {
      const config = fridayConfigSchema.parse({
        permissions: {
          autoApproveRead: false,
          autoApproveWrite: true,
          blockedCommands: ['drop database'],
          workspaceOnly: false,
        },
      });

      expect(config.permissions.autoApproveRead).toBe(false);
      expect(config.permissions.autoApproveWrite).toBe(true);
      expect(config.permissions.blockedCommands).toEqual(['drop database']);
    });

    it('parses maxTokens when specified', () => {
      const config = fridayConfigSchema.parse({ maxTokens: 4096 });
      expect(config.maxTokens).toBe(4096);
    });

    it('parses mcp server config', () => {
      const config = fridayConfigSchema.parse({
        mcp: {
          servers: [
            { name: 'test-server', command: 'node', args: ['server.js'], transport: 'stdio' },
          ],
        },
      });

      expect(config.mcp.servers).toHaveLength(1);
      expect(config.mcp.servers[0].name).toBe('test-server');
      expect(config.mcp.servers[0].transport).toBe('stdio');
    });
  });

  describe('validation', () => {
    it('clamps maxIterations to min 1', () => {
      expect(() => fridayConfigSchema.parse({ maxIterations: 0 })).toThrow();
    });

    it('clamps maxIterations to max 200', () => {
      expect(() => fridayConfigSchema.parse({ maxIterations: 201 })).toThrow();
    });

    it('rejects temperature below 0', () => {
      expect(() => fridayConfigSchema.parse({ temperature: -1 })).toThrow();
    });

    it('rejects temperature above 2', () => {
      expect(() => fridayConfigSchema.parse({ temperature: 3 })).toThrow();
    });

    it('accepts boundary values', () => {
      const config = fridayConfigSchema.parse({
        maxIterations: 1,
        temperature: 0,
      });
      expect(config.maxIterations).toBe(1);
      expect(config.temperature).toBe(0);
    });
  });
});

describe('loadConfig', () => {
  // loadConfig depends on fs and getConfigDir, so we test it via schema
  // since it ultimately delegates to fridayConfigSchema.safeParse
  it('schema safeParse returns success for valid config', () => {
    const result = fridayConfigSchema.safeParse({
      defaultProvider: 'anthropic',
      defaultModel: 'claude-3',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.defaultProvider).toBe('anthropic');
    }
  });

  it('schema safeParse fails for invalid maxIterations', () => {
    const result = fridayConfigSchema.safeParse({ maxIterations: -5 });
    expect(result.success).toBe(false);
  });
});

describe('CommandRegistry', () => {
  describe('createCommandRegistry()', () => {
    it('returns a CommandRegistry instance', () => {
      const registry = createCommandRegistry();
      expect(registry).toBeInstanceOf(CommandRegistry);
    });

    it('has all built-in commands registered', () => {
      const registry = createCommandRegistry();
      const commands = registry.getAll();
      const names = commands.map((c) => c.name);

      expect(names).toContain('help');
      expect(names).toContain('model');
      expect(names).toContain('mode');
      expect(names).toContain('clear');
      expect(names).toContain('compact');
      expect(names).toContain('cost');
      expect(names).toContain('history');
      expect(names).toContain('exit');
    });

    it('registers exactly 17 commands', () => {
      const registry = createCommandRegistry();
      expect(registry.getAll()).toHaveLength(17);
    });
  });

  describe('parse()', () => {
    it('parses slash command with no args', () => {
      const registry = createCommandRegistry();
      const result = registry.parse('/help');
      expect(result).toEqual({ command: 'help', args: [] });
    });

    it('parses slash command with args', () => {
      const registry = createCommandRegistry();
      const result = registry.parse('/model gpt-4o');
      expect(result).toEqual({ command: 'model', args: ['gpt-4o'] });
    });

    it('parses command with multiple args', () => {
      const registry = createCommandRegistry();
      const result = registry.parse('/model arg1 arg2 arg3');
      expect(result).toEqual({ command: 'model', args: ['arg1', 'arg2', 'arg3'] });
    });

    it('returns null for non-slash input', () => {
      const registry = createCommandRegistry();
      expect(registry.parse('hello')).toBeNull();
    });

    it('returns null for empty slash', () => {
      const registry = createCommandRegistry();
      expect(registry.parse('/')).toBeNull();
    });

    it('lowercases command name', () => {
      const registry = createCommandRegistry();
      const result = registry.parse('/HELP');
      expect(result).toEqual({ command: 'help', args: [] });
    });

    it('trims whitespace', () => {
      const registry = createCommandRegistry();
      const result = registry.parse('  /help  ');
      expect(result).toEqual({ command: 'help', args: [] });
    });
  });

  describe('get()', () => {
    it('finds command by name', () => {
      const registry = createCommandRegistry();
      const cmd = registry.get('help');
      expect(cmd).toBeDefined();
      expect(cmd!.name).toBe('help');
    });

    it('returns undefined for unknown command', () => {
      const registry = createCommandRegistry();
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });

  describe('execute()', () => {
    it('returns null for non-slash input', async () => {
      const registry = createCommandRegistry();
      const mockContext = makeMockContext();
      const result = await registry.execute('hello', mockContext);
      expect(result).toBeNull();
    });

    it('returns error result for unknown command', async () => {
      const registry = createCommandRegistry();
      const mockContext = makeMockContext();
      const result = await registry.execute('/unknowncmd', mockContext);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('error');
      expect(result!.output).toContain('Unknown command');
      expect(result!.output).toContain('unknowncmd');
    });
  });
});

function makeMockContext() {
  return {
    currentProvider: 'openai',
    currentModel: 'gpt-4o',
    currentMode: 'code',
    sessionId: 'test-session',
    workspacePath: '/test',
    setProvider: vi.fn(),
    setModel: vi.fn(),
    setMode: vi.fn(),
    clearHistory: vi.fn(),
    getHistory: vi.fn(() => []),
    getCostSummary: vi.fn(() => ({ totalCost: 0, inputTokens: 0, outputTokens: 0 })),
  };
}
