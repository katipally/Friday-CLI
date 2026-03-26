import { describe, it, expect, vi } from 'vitest';

vi.mock('@fridaycode/shared', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { MessageHistory } from '../context/message-history.js';
import { ContextManager } from '../context/context-manager.js';
import type { Message } from '@fridaycode/shared';

function msg(role: Message['role'], content: string): Message {
  return { role, content };
}

// ---------------------------------------------------------------------------
// MessageHistory
// ---------------------------------------------------------------------------
describe('MessageHistory', () => {
  it('add and getAll', () => {
    const h = new MessageHistory();
    h.add(msg('user', 'hello'));
    h.add(msg('assistant', 'hi'));
    expect(h.getAll()).toHaveLength(2);
  });

  it('getLast returns last N messages', () => {
    const h = new MessageHistory();
    h.add(msg('user', 'a'));
    h.add(msg('assistant', 'b'));
    h.add(msg('user', 'c'));
    const last = h.getLast(2);
    expect(last).toHaveLength(2);
    expect(last[0].content).toBe('b');
    expect(last[1].content).toBe('c');
  });

  it('getLast(0) returns empty', () => {
    const h = new MessageHistory();
    h.add(msg('user', 'a'));
    expect(h.getLast(0)).toHaveLength(0);
  });

  it('getByRole filters correctly', () => {
    const h = new MessageHistory();
    h.add(msg('user', 'u1'));
    h.add(msg('assistant', 'a1'));
    h.add(msg('user', 'u2'));
    const users = h.getByRole('user');
    expect(users).toHaveLength(2);
    expect(users[0].content).toBe('u1');
  });

  it('clear empties the history', () => {
    const h = new MessageHistory();
    h.add(msg('user', 'a'));
    h.add(msg('assistant', 'b'));
    h.clear();
    expect(h.size()).toBe(0);
    expect(h.getAll()).toHaveLength(0);
  });

  it('size returns correct count', () => {
    const h = new MessageHistory();
    expect(h.size()).toBe(0);
    h.add(msg('user', 'a'));
    expect(h.size()).toBe(1);
    h.add(msg('assistant', 'b'));
    expect(h.size()).toBe(2);
  });

  it('getWithinBudget respects token budget', () => {
    const h = new MessageHistory();
    // Each message "x".repeat(400) ≈ 100 tokens
    for (let i = 0; i < 10; i++) {
      h.add(msg('user', 'x'.repeat(400)));
    }
    // Budget for ~3 messages worth of tokens
    const result = h.getWithinBudget(300);
    expect(result.length).toBeLessThan(10);
    expect(result.length).toBeGreaterThan(0);
  });

  it('getWithinBudget includes system messages when requested', () => {
    const h = new MessageHistory();
    h.add(msg('system', 'sys'));
    h.add(msg('user', 'u1'));
    h.add(msg('assistant', 'a1'));
    const result = h.getWithinBudget(10000, { includeSystem: true });
    const hasSystem = result.some((m) => m.role === 'system');
    expect(hasSystem).toBe(true);
  });

  it('getWithinBudget always includes last N messages', () => {
    const h = new MessageHistory();
    for (let i = 0; i < 5; i++) {
      h.add(msg('user', `msg-${i}`));
    }
    // Very small budget but alwaysIncludeLast = 2
    const result = h.getWithinBudget(1, { alwaysIncludeLast: 2 });
    expect(result.length).toBeGreaterThanOrEqual(2);
    // Should include the last two messages
    const last = result.slice(-2);
    expect(last[0].content).toBe('msg-3');
    expect(last[1].content).toBe('msg-4');
  });
});

// ---------------------------------------------------------------------------
// ContextManager
// ---------------------------------------------------------------------------
describe('ContextManager', () => {
  it('estimateTokens approximation (~4 chars per token)', () => {
    const cm = new ContextManager();
    // 100 chars / 4 = 25 tokens
    expect(cm.estimateTokens('x'.repeat(100))).toBe(25);
    // 7 chars / 4 = ceil(1.75) = 2
    expect(cm.estimateTokens('abcdefg')).toBe(2);
    // Empty string
    expect(cm.estimateTokens('')).toBe(0);
  });

  it('getUsageStats returns correct values', () => {
    const cm = new ContextManager({ maxContextTokens: 1000, reservedForResponse: 200 });
    cm.addMessage(msg('user', 'x'.repeat(400))); // ~100 tokens
    const stats = cm.getUsageStats();
    expect(stats.totalMessages).toBe(1);
    expect(stats.estimatedTokens).toBe(100);
    // budget = 1000 - 200 = 800; used = 100/800 = 0.125
    expect(stats.budgetUsed).toBeCloseTo(0.125, 2);
    expect(stats.budgetRemaining).toBe(700);
  });

  it('addMessage and getHistory work together', () => {
    const cm = new ContextManager();
    cm.addMessage(msg('user', 'hi'));
    cm.addMessage(msg('assistant', 'hello'));
    expect(cm.getHistory().size()).toBe(2);
  });

  it('clear resets history and summary', () => {
    const cm = new ContextManager();
    cm.addMessage(msg('user', 'hi'));
    cm.clear();
    expect(cm.getHistory().size()).toBe(0);
    expect(cm.getSummary()).toBeNull();
  });

  it('prepare returns messages within budget', () => {
    const cm = new ContextManager({ maxContextTokens: 500, reservedForResponse: 100 });
    for (let i = 0; i < 20; i++) {
      cm.addMessage(msg('user', 'x'.repeat(200)));
    }
    const prepared = cm.prepare('System prompt');
    // Should have fewer messages than the full 20
    expect(prepared.length).toBeLessThan(20);
    expect(prepared.length).toBeGreaterThan(0);
  });

  it('shouldSummarize returns false when under threshold', () => {
    const cm = new ContextManager({ maxContextTokens: 100000, reservedForResponse: 4096 });
    cm.addMessage(msg('user', 'short'));
    expect(cm.shouldSummarize()).toBe(false);
  });
});
