import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRun = vi.fn();
const mockReset = vi.fn();

// Mock all external dependencies before importing Friday
vi.mock('@anthropic-ai/friday-shared', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@anthropic-ai/friday-providers', () => ({
  createProvider: vi.fn(),
}));

vi.mock('@anthropic-ai/friday-tools', () => ({
  createDefaultRegistry: vi.fn(() => ({
    getToolDefinitions: () => [],
    execute: vi.fn(async () => ({ success: true, output: 'done' })),
    hasTool: vi.fn(() => false),
  })),
}));

vi.mock('@anthropic-ai/friday-core', () => ({
  AgentLoop: vi.fn().mockImplementation(() => ({
    run: mockRun,
    reset: mockReset,
  })),
}));

import { Friday } from '../friday.js';
import { createProvider } from '@anthropic-ai/friday-providers';
import { AgentLoop } from '@anthropic-ai/friday-core';

async function* fakeEvents(events: Array<{ type: string; content?: string }>) {
  for (const e of events) {
    yield e;
  }
}

describe('Friday', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('creates instance with provider config', () => {
      const friday = new Friday({
        provider: { provider: 'openai', apiKey: 'test-key', model: 'gpt-4o' },
      });

      expect(friday).toBeInstanceOf(Friday);
      expect(createProvider).toHaveBeenCalledWith({
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o',
      });
    });

    it('creates AgentLoop with correct config', () => {
      new Friday({
        provider: { provider: 'anthropic', model: 'claude-3' },
        agent: { mode: 'chat', maxIterations: 10 },
      });

      const calls = vi.mocked(AgentLoop).mock.calls;
      expect(calls).toHaveLength(1);
      const config = calls[0][1];
      expect(config).toMatchObject({
        provider: 'anthropic',
        model: 'claude-3',
        mode: 'chat',
        maxIterations: 10,
      });
    });

    it('disables tools when tools option is false', () => {
      new Friday({
        provider: { provider: 'openai' },
        tools: false,
      });

      const calls = vi.mocked(AgentLoop).mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0][2]).toBeNull();
    });

    it('uses default model gpt-4o when not specified', () => {
      new Friday({
        provider: { provider: 'openai' },
      });

      const calls = vi.mocked(AgentLoop).mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0][1]).toMatchObject({ model: 'gpt-4o' });
    });
  });

  describe('ask()', () => {
    it('returns accumulated text from text_delta events', async () => {
      mockRun.mockReturnValue(
        fakeEvents([
          { type: 'text_delta', content: 'Hello' },
          { type: 'text_delta', content: ' world' },
        ]),
      );

      const friday = new Friday({
        provider: { provider: 'openai', apiKey: 'key' },
      });

      const result = await friday.ask('Hi');
      expect(result).toBe('Hello world');
    });

    it('returns response event content when present', async () => {
      mockRun.mockReturnValue(
        fakeEvents([
          { type: 'text_delta', content: 'partial' },
          { type: 'response', content: 'Final answer' },
        ]),
      );

      const friday = new Friday({
        provider: { provider: 'openai', apiKey: 'key' },
      });

      const result = await friday.ask('Question');
      expect(result).toBe('Final answer');
    });

    it('returns empty string when no text events', async () => {
      mockRun.mockReturnValue(
        fakeEvents([
          { type: 'state_change' },
          { type: 'done' },
        ]),
      );

      const friday = new Friday({
        provider: { provider: 'openai', apiKey: 'key' },
      });

      const result = await friday.ask('Silent');
      expect(result).toBe('');
    });
  });

  describe('chat()', () => {
    it('yields events from agent loop', async () => {
      const expectedEvents = [
        { type: 'text_delta', content: 'chunk1' },
        { type: 'text_delta', content: 'chunk2' },
        { type: 'done' },
      ];
      mockRun.mockReturnValue(fakeEvents(expectedEvents));

      const friday = new Friday({
        provider: { provider: 'openai', apiKey: 'key' },
      });

      const collected: Array<{ type: string }> = [];
      for await (const event of friday.chat('Hi')) {
        collected.push(event);
      }

      expect(collected).toHaveLength(3);
      expect(collected[0]).toEqual({ type: 'text_delta', content: 'chunk1' });
      expect(collected[1]).toEqual({ type: 'text_delta', content: 'chunk2' });
      expect(collected[2]).toEqual({ type: 'done' });
    });

    it('returns async generator', () => {
      mockRun.mockReturnValue(fakeEvents([]));

      const friday = new Friday({
        provider: { provider: 'openai', apiKey: 'key' },
      });

      const gen = friday.chat('Hi');
      expect(gen[Symbol.asyncIterator]).toBeDefined();
    });
  });

  describe('reset()', () => {
    it('calls agentLoop.reset()', () => {
      const friday = new Friday({
        provider: { provider: 'openai', apiKey: 'key' },
      });

      friday.reset();
      expect(mockReset).toHaveBeenCalled();
    });
  });
});
