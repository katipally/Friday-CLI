import { describe, it, expect, vi } from 'vitest';
import { createCommandRegistry, CommandRegistry } from '../commands/index.js';
import type { CommandContext } from '../commands/types.js';

function mockContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    currentProvider: 'anthropic',
    currentModel: 'claude-sonnet-4-20250514',
    currentMode: 'code',
    sessionId: 'test-session-123',
    workspacePath: '/test/workspace',
    setProvider: vi.fn(),
    setModel: vi.fn(),
    setMode: vi.fn(),
    clearHistory: vi.fn(),
    getHistory: vi.fn().mockReturnValue([]),
    getCostSummary: vi.fn().mockReturnValue({
      totalCost: 0.0042,
      inputTokens: 1500,
      outputTokens: 500,
    }),
    ...overrides,
  };
}

describe('CommandRegistry', () => {
  it('createCommandRegistry registers all 12 commands', () => {
    const registry = createCommandRegistry();
    const all = registry.getAll();
    expect(all).toHaveLength(12);
    const names = all.map((c) => c.name);
    expect(names).toContain('help');
    expect(names).toContain('model');
    expect(names).toContain('mode');
    expect(names).toContain('clear');
    expect(names).toContain('compact');
    expect(names).toContain('cost');
    expect(names).toContain('history');
    expect(names).toContain('exit');
    expect(names).toContain('init');
    expect(names).toContain('tools');
    expect(names).toContain('mcp');
    expect(names).toContain('update');
  });

  it('parse() correctly splits /command args', () => {
    const registry = new CommandRegistry();
    const parsed = registry.parse('/model gpt-4');
    expect(parsed).toEqual({ command: 'model', args: ['gpt-4'] });
  });

  it('parse() handles multiple args', () => {
    const registry = new CommandRegistry();
    const parsed = registry.parse('/help model extra');
    expect(parsed).toEqual({ command: 'help', args: ['model', 'extra'] });
  });

  it('parse() returns null for non-slash input', () => {
    const registry = new CommandRegistry();
    expect(registry.parse('just a message')).toBeNull();
    expect(registry.parse('hello /slash')).toBeNull();
  });

  it('parse() returns null for just a slash', () => {
    const registry = new CommandRegistry();
    expect(registry.parse('/')).toBeNull();
  });
});

describe('Slash commands', () => {
  it('/help returns list of commands', async () => {
    const registry = createCommandRegistry();
    const ctx = mockContext();
    const result = await registry.execute('/help', ctx);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('info');
    expect(result!.output).toContain('Available commands');
    expect(result!.output).toContain('/help');
    expect(result!.output).toContain('/exit');
  });

  it('/cost returns cost info', async () => {
    const registry = createCommandRegistry();
    const ctx = mockContext();
    const result = await registry.execute('/cost', ctx);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('table');
    expect(result!.output).toContain('anthropic');
    expect(result!.output).toContain('1,500');
    expect(result!.output).toContain('500');
    expect(result!.output).toContain('$0.0042');
  });

  it('/exit returns exit: true', async () => {
    const registry = createCommandRegistry();
    const ctx = mockContext();
    const result = await registry.execute('/exit', ctx);
    expect(result).not.toBeNull();
    expect(result!.exit).toBe(true);
    expect(result!.output).toContain('Goodbye');
  });

  it('/clear calls clearHistory', async () => {
    const registry = createCommandRegistry();
    const ctx = mockContext();
    const result = await registry.execute('/clear', ctx);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('success');
    expect(ctx.clearHistory).toHaveBeenCalledTimes(1);
  });

  it('unknown command returns error message', async () => {
    const registry = createCommandRegistry();
    const ctx = mockContext();
    const result = await registry.execute('/nonexistent', ctx);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('error');
    expect(result!.output).toContain('Unknown command');
  });

  it('non-command input returns null', async () => {
    const registry = createCommandRegistry();
    const ctx = mockContext();
    const result = await registry.execute('hello', ctx);
    expect(result).toBeNull();
  });

  it('aliases work (/q for /exit)', async () => {
    const registry = createCommandRegistry();
    const ctx = mockContext();
    const result = await registry.execute('/q', ctx);
    expect(result).not.toBeNull();
    expect(result!.exit).toBe(true);
  });

  it('aliases work (/h for /help)', async () => {
    const registry = createCommandRegistry();
    const ctx = mockContext();
    const result = await registry.execute('/h', ctx);
    expect(result).not.toBeNull();
    expect(result!.output).toContain('Available commands');
  });
});

describe('/init command', () => {
  it('returns error when FRIDAY.md already exists (no --force)', async () => {
    const registry = createCommandRegistry();
    // Use a mock that simulates an existing file via fs.access succeeding
    // The test workspace is the cli package root which doesn't have FRIDAY.md,
    // so we use the monorepo root which does
    const { join } = await import('node:path');
    const { access } = await import('node:fs/promises');

    // Find a directory that actually has a FRIDAY.md
    // Walk up from the CLI package to the monorepo root
    let testDir = process.cwd();
    try {
      await access(join(testDir, 'FRIDAY.md'));
    } catch {
      // Try parent directories
      const { dirname } = await import('node:path');
      testDir = dirname(dirname(testDir)); // Go up to monorepo root
    }

    const ctx = mockContext({ workspacePath: testDir });
    const result = await registry.execute('/init', ctx);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('error');
    expect(result!.output).toContain('already exists');
  });

  it('aliases /setup works', async () => {
    const registry = createCommandRegistry();
    const cmd = registry.get('setup');
    expect(cmd).toBeDefined();
    expect(cmd!.name).toBe('init');
  });

  it('aliases /initialize works', async () => {
    const registry = createCommandRegistry();
    const cmd = registry.get('initialize');
    expect(cmd).toBeDefined();
    expect(cmd!.name).toBe('init');
  });
});

describe('/tools command', () => {
  it('returns error when toolRegistry is not available', async () => {
    const registry = createCommandRegistry();
    const ctx = mockContext();
    const result = await registry.execute('/tools', ctx);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('error');
    expect(result!.output).toContain('not available');
  });

  it('lists tools when registry is available', async () => {
    const registry = createCommandRegistry();
    const ctx = mockContext({
      toolRegistry: {
        getToolDefinitions: () => [
          { name: 'file_read', description: 'Read file contents', parameters: {} },
          { name: 'shell_exec', description: 'Execute shell commands', parameters: {} },
        ],
      },
    });
    const result = await registry.execute('/tools', ctx);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('table');
    expect(result!.output).toContain('file_read');
    expect(result!.output).toContain('shell_exec');
    expect(result!.output).toContain('2');
  });

  it('shows detail for a specific tool', async () => {
    const registry = createCommandRegistry();
    const ctx = mockContext({
      toolRegistry: {
        getToolDefinitions: () => [
          {
            name: 'file_read',
            description: 'Read file contents',
            parameters: {
              properties: {
                path: { type: 'string', description: 'File path to read' },
              },
              required: ['path'],
            },
          },
        ],
      },
    });
    const result = await registry.execute('/tools file_read', ctx);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('info');
    expect(result!.output).toContain('file_read');
    expect(result!.output).toContain('path');
    expect(result!.output).toContain('required');
  });

  it('returns error for unknown tool name', async () => {
    const registry = createCommandRegistry();
    const ctx = mockContext({
      toolRegistry: {
        getToolDefinitions: () => [
          { name: 'file_read', description: 'Read file contents', parameters: {} },
        ],
      },
    });
    const result = await registry.execute('/tools nonexistent', ctx);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('error');
    expect(result!.output).toContain('Unknown tool');
  });

  it('aliases /capabilities works', async () => {
    const registry = createCommandRegistry();
    const cmd = registry.get('capabilities');
    expect(cmd).toBeDefined();
    expect(cmd!.name).toBe('tools');
  });
});

describe('/mcp command', () => {
  it('returns info when mcpManager is not configured', async () => {
    const registry = createCommandRegistry();
    const ctx = mockContext();
    const result = await registry.execute('/mcp', ctx);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('info');
    expect(result!.output).toContain('not configured');
  });

  it('/mcp list shows servers', async () => {
    const registry = createCommandRegistry();
    const ctx = mockContext({
      mcpManager: {
        getClient: () => ({
          listServers: () => ['sqlite', 'github'],
          isConnected: (name: string) => name === 'sqlite',
          listTools: () => [],
          disconnectAll: vi.fn(),
        }),
      },
    });
    const result = await registry.execute('/mcp list', ctx);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('table');
    expect(result!.output).toContain('sqlite');
    expect(result!.output).toContain('connected');
    expect(result!.output).toContain('github');
    expect(result!.output).toContain('disconnected');
  });

  it('/mcp status shows tools grouped by server', async () => {
    const registry = createCommandRegistry();
    const ctx = mockContext({
      mcpManager: {
        getClient: () => ({
          listServers: () => ['sqlite'],
          isConnected: () => true,
          listTools: () => [
            { server: 'sqlite', tool: { name: 'query' } },
            { server: 'sqlite', tool: { name: 'list_tables' } },
          ],
          disconnectAll: vi.fn(),
        }),
      },
    });
    const result = await registry.execute('/mcp status', ctx);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('table');
    expect(result!.output).toContain('sqlite');
    expect(result!.output).toContain('query');
    expect(result!.output).toContain('list_tables');
    expect(result!.output).toContain('2 total');
  });

  it('/mcp reload calls disconnectAll', async () => {
    const disconnectAll = vi.fn().mockResolvedValue(undefined);
    const registry = createCommandRegistry();
    const ctx = mockContext({
      mcpManager: {
        getClient: () => ({
          listServers: () => [],
          isConnected: () => false,
          listTools: () => [],
          disconnectAll,
        }),
      },
    });
    const result = await registry.execute('/mcp reload', ctx);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('success');
    expect(disconnectAll).toHaveBeenCalledTimes(1);
  });

  it('aliases /plugins works', async () => {
    const registry = createCommandRegistry();
    const cmd = registry.get('plugins');
    expect(cmd).toBeDefined();
    expect(cmd!.name).toBe('mcp');
  });
});

describe('/update command', () => {
  it('shows current version', async () => {
    const registry = createCommandRegistry();
    const ctx = mockContext();
    const result = await registry.execute('/update', ctx);
    expect(result).not.toBeNull();
    expect(result!.output).toContain('fridaycode v');
  });

  it('aliases /version works', async () => {
    const registry = createCommandRegistry();
    const cmd = registry.get('version');
    expect(cmd).toBeDefined();
    expect(cmd!.name).toBe('update');
  });

  it('aliases /ver works', async () => {
    const registry = createCommandRegistry();
    const cmd = registry.get('ver');
    expect(cmd).toBeDefined();
    expect(cmd!.name).toBe('update');
  });
});
