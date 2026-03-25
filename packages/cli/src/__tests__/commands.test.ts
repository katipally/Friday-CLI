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
  it('createCommandRegistry registers all 8 commands', () => {
    const registry = createCommandRegistry();
    const all = registry.getAll();
    expect(all).toHaveLength(8);
    const names = all.map((c) => c.name);
    expect(names).toContain('help');
    expect(names).toContain('model');
    expect(names).toContain('mode');
    expect(names).toContain('clear');
    expect(names).toContain('compact');
    expect(names).toContain('cost');
    expect(names).toContain('history');
    expect(names).toContain('exit');
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
