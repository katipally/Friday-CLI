import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing AgentLoop
vi.mock('@anthropic-ai/friday-shared', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../agent/modes/index.js', () => ({
  getModeSystemPrompt: (mode: string) => `System prompt for ${mode}`,
}));

import { AgentLoop } from '../agent/agent-loop.js';
import type { AgentConfig, AgentToolRegistry, AgentEvent } from '../agent/agent-types.js';
import type { LLMProvider, StreamChunk, ToolDefinition } from '@anthropic-ai/friday-providers';

// Helper to collect all events from an async generator
async function collectEvents(gen: AsyncGenerator<AgentEvent>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}

function makeConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  return {
    provider: 'mock',
    model: 'mock-model',
    mode: 'code',
    maxIterations: 10,
    ...overrides,
  };
}

// Creates an async generator from an array of chunks
async function* chunksToStream(chunks: StreamChunk[]): AsyncGenerator<StreamChunk> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

function makeMockProvider(streamChunks: StreamChunk[]): LLMProvider {
  return {
    name: 'mock',
    displayName: 'Mock Provider',
    generate: vi.fn(),
    stream: vi.fn(() => chunksToStream(streamChunks)),
    generateWithTools: vi.fn(),
    streamWithTools: vi.fn(() => chunksToStream(streamChunks)),
    capabilities: vi.fn(() => ({
      streaming: true,
      toolCalling: true,
      vision: false,
      embeddings: false,
      jsonMode: false,
      maxContextWindow: 128000,
    })),
    listModels: vi.fn(async () => []),
    validateApiKey: vi.fn(async () => true),
  };
}

function makeMockToolRegistry(
  tools: ToolDefinition[] = [],
  executeResult: { success: boolean; output: string } = { success: true, output: 'done' },
): AgentToolRegistry {
  return {
    getToolDefinitions: () => tools,
    execute: vi.fn(async () => executeResult),
    hasTool: vi.fn((name: string) => tools.some((t) => t.name === name)),
  };
}

describe('AgentLoop', () => {
  describe('initial state', () => {
    it('starts in IDLE state', () => {
      const provider = makeMockProvider([]);
      const loop = new AgentLoop(provider, makeConfig());
      expect(loop.getState()).toBe('IDLE');
    });

    it('starts with empty history', () => {
      const provider = makeMockProvider([]);
      const loop = new AgentLoop(provider, makeConfig());
      expect(loop.getHistory()).toEqual([]);
    });

    it('starts at iteration 0', () => {
      const provider = makeMockProvider([]);
      const loop = new AgentLoop(provider, makeConfig());
      expect(loop.getIteration()).toBe(0);
    });
  });

  describe('simple response (no tools)', () => {
    it('transitions IDLE → THINKING → TERMINATED', async () => {
      const chunks: StreamChunk[] = [
        { type: 'text_delta', content: 'Hello' },
        { type: 'text_delta', content: ' world' },
        { type: 'usage', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
      ];
      const provider = makeMockProvider(chunks);
      const loop = new AgentLoop(provider, makeConfig());
      const events = await collectEvents(loop.run('Hi'));

      const stateChanges = events.filter((e) => e.type === 'state_change') as Array<{
        type: 'state_change';
        from: string;
        to: string;
      }>;

      expect(stateChanges[0]).toEqual({ type: 'state_change', from: 'IDLE', to: 'THINKING' });
      expect(stateChanges[stateChanges.length - 1].to).toBe('TERMINATED');
      expect(loop.getState()).toBe('TERMINATED');
    });

    it('emits text_delta events', async () => {
      const chunks: StreamChunk[] = [
        { type: 'text_delta', content: 'Hello' },
        { type: 'usage', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
      ];
      const provider = makeMockProvider(chunks);
      const loop = new AgentLoop(provider, makeConfig());
      const events = await collectEvents(loop.run('Hi'));

      const deltas = events.filter((e) => e.type === 'text_delta');
      expect(deltas.length).toBeGreaterThan(0);
    });

    it('emits a response event with the full text', async () => {
      const chunks: StreamChunk[] = [
        { type: 'text_delta', content: 'Full response' },
        { type: 'usage', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
      ];
      const provider = makeMockProvider(chunks);
      const loop = new AgentLoop(provider, makeConfig());
      const events = await collectEvents(loop.run('Hi'));

      const response = events.find((e) => e.type === 'response') as { type: 'response'; content: string };
      expect(response).toBeDefined();
      expect(response.content).toBe('Full response');
    });

    it('adds user and assistant messages to history', async () => {
      const chunks: StreamChunk[] = [
        { type: 'text_delta', content: 'Reply' },
        { type: 'usage', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
      ];
      const provider = makeMockProvider(chunks);
      const loop = new AgentLoop(provider, makeConfig());
      await collectEvents(loop.run('Hello'));

      const history = loop.getHistory();
      expect(history[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(history[1].role).toBe('assistant');
      expect(history[1].content).toBe('Reply');
    });

    it('calls provider.stream when no tool registry', async () => {
      const chunks: StreamChunk[] = [
        { type: 'text_delta', content: 'ok' },
        { type: 'usage', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ];
      const provider = makeMockProvider(chunks);
      const loop = new AgentLoop(provider, makeConfig());
      await collectEvents(loop.run('test'));
      expect(provider.stream).toHaveBeenCalled();
    });
  });

  describe('with tool calls', () => {
    it('transitions THINKING → ACTING → OBSERVING → THINKING → TERMINATED', async () => {
      // First call: provider returns a tool call
      const toolCallChunks: StreamChunk[] = [
        { type: 'tool_call_start', toolCall: { id: 'tc1', name: 'read_file' } },
        { type: 'tool_call_delta', content: '{"path":"/test"}' },
        { type: 'tool_call_end', toolCall: { id: 'tc1', name: 'read_file', arguments: { path: '/test' } } },
        { type: 'usage', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
      ];

      // Second call: provider returns text (final response)
      const finalChunks: StreamChunk[] = [
        { type: 'text_delta', content: 'Done!' },
        { type: 'usage', usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 } },
      ];

      let callCount = 0;
      const provider = makeMockProvider([]);
      (provider.streamWithTools as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        return chunksToStream(callCount === 1 ? toolCallChunks : finalChunks);
      });

      const tools: ToolDefinition[] = [
        { name: 'read_file', description: 'Read a file', parameters: { type: 'object' } },
      ];
      const toolRegistry = makeMockToolRegistry(tools, { success: true, output: 'file content' });
      const loop = new AgentLoop(provider, makeConfig(), toolRegistry);
      const events = await collectEvents(loop.run('Read the file'));

      const stateChanges = events.filter((e) => e.type === 'state_change') as Array<{
        type: 'state_change';
        from: string;
        to: string;
      }>;

      const states = stateChanges.map((e) => e.to);
      expect(states).toContain('THINKING');
      expect(states).toContain('ACTING');
      expect(states).toContain('OBSERVING');
      expect(states).toContain('TERMINATED');
      expect(loop.getState()).toBe('TERMINATED');
    });

    it('executes tools and emits tool_start and tool_result events', async () => {
      const toolCallChunks: StreamChunk[] = [
        { type: 'tool_call_start', toolCall: { id: 'tc1', name: 'bash' } },
        { type: 'tool_call_delta', content: '{}' },
        { type: 'tool_call_end', toolCall: { id: 'tc1', name: 'bash', arguments: { cmd: 'ls' } } },
        { type: 'usage', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
      ];
      const finalChunks: StreamChunk[] = [
        { type: 'text_delta', content: 'All done' },
        { type: 'usage', usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 } },
      ];

      let callCount = 0;
      const provider = makeMockProvider([]);
      (provider.streamWithTools as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        return chunksToStream(callCount === 1 ? toolCallChunks : finalChunks);
      });

      const tools: ToolDefinition[] = [
        { name: 'bash', description: 'Run bash', parameters: { type: 'object' } },
      ];
      const toolRegistry = makeMockToolRegistry(tools, { success: true, output: 'file1\nfile2' });
      const loop = new AgentLoop(provider, makeConfig(), toolRegistry);
      const events = await collectEvents(loop.run('List files'));

      expect(events.some((e) => e.type === 'tool_start')).toBe(true);
      expect(events.some((e) => e.type === 'tool_result')).toBe(true);
    });

    it('handles unknown tool gracefully', async () => {
      const toolCallChunks: StreamChunk[] = [
        { type: 'tool_call_start', toolCall: { id: 'tc1', name: 'unknown_tool' } },
        { type: 'tool_call_end', toolCall: { id: 'tc1', name: 'unknown_tool', arguments: {} } },
        { type: 'usage', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
      ];
      const finalChunks: StreamChunk[] = [
        { type: 'text_delta', content: 'Handled' },
        { type: 'usage', usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 } },
      ];

      let callCount = 0;
      const provider = makeMockProvider([]);
      (provider.streamWithTools as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        return chunksToStream(callCount === 1 ? toolCallChunks : finalChunks);
      });

      const tools: ToolDefinition[] = [
        { name: 'bash', description: 'Run bash', parameters: {} },
      ];
      const toolRegistry = makeMockToolRegistry(tools);
      const loop = new AgentLoop(provider, makeConfig(), toolRegistry);
      const events = await collectEvents(loop.run('Do something'));

      const toolResults = events.filter((e) => e.type === 'tool_result') as Array<{
        type: 'tool_result';
        result: { output: string };
      }>;
      expect(toolResults.length).toBeGreaterThan(0);
      expect(toolResults[0].result.output).toContain('Unknown tool');
    });
  });

  describe('max iterations', () => {
    it('stops and emits error when max iterations reached', async () => {
      // Provider always returns a tool call, never a text response
      const toolCallChunks: StreamChunk[] = [
        { type: 'tool_call_start', toolCall: { id: 'tc1', name: 'bash' } },
        { type: 'tool_call_end', toolCall: { id: 'tc1', name: 'bash', arguments: {} } },
        { type: 'usage', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
      ];

      const provider = makeMockProvider([]);
      (provider.streamWithTools as ReturnType<typeof vi.fn>).mockImplementation(() =>
        chunksToStream(toolCallChunks),
      );

      const tools: ToolDefinition[] = [
        { name: 'bash', description: 'Run bash', parameters: {} },
      ];
      const toolRegistry = makeMockToolRegistry(tools, { success: true, output: 'ok' });
      const loop = new AgentLoop(provider, makeConfig({ maxIterations: 2 }), toolRegistry);
      const events = await collectEvents(loop.run('Loop forever'));

      const errorEvents = events.filter((e) => e.type === 'error') as Array<{
        type: 'error';
        error: Error;
      }>;
      expect(errorEvents.length).toBeGreaterThan(0);
      expect(errorEvents[0].error.message).toContain('Max iterations');
      expect(loop.getState()).toBe('TERMINATED');
    });
  });

  describe('error handling', () => {
    it('transitions to ERROR state on provider exception', async () => {
      const provider = makeMockProvider([]);
      (provider.stream as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('API connection failed');
      });

      const loop = new AgentLoop(provider, makeConfig());
      const events = await collectEvents(loop.run('Crash'));

      const errorEvents = events.filter((e) => e.type === 'error');
      expect(errorEvents.length).toBeGreaterThan(0);
      expect(loop.getState()).toBe('ERROR');
    });

    it('handles tool execution errors', async () => {
      const toolCallChunks: StreamChunk[] = [
        { type: 'tool_call_start', toolCall: { id: 'tc1', name: 'bash' } },
        { type: 'tool_call_end', toolCall: { id: 'tc1', name: 'bash', arguments: {} } },
        { type: 'usage', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
      ];
      const finalChunks: StreamChunk[] = [
        { type: 'text_delta', content: 'Recovered' },
        { type: 'usage', usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 } },
      ];

      let callCount = 0;
      const provider = makeMockProvider([]);
      (provider.streamWithTools as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        return chunksToStream(callCount === 1 ? toolCallChunks : finalChunks);
      });

      const tools: ToolDefinition[] = [
        { name: 'bash', description: 'Run bash', parameters: {} },
      ];
      const toolRegistry = makeMockToolRegistry(tools);
      (toolRegistry.execute as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('exec failed'));
      const loop = new AgentLoop(provider, makeConfig(), toolRegistry);
      const events = await collectEvents(loop.run('Run something'));

      const toolResults = events.filter((e) => e.type === 'tool_result') as Array<{
        type: 'tool_result';
        result: { output: string };
      }>;
      expect(toolResults.length).toBeGreaterThan(0);
      expect(toolResults[0].result.output).toContain('Tool error');
      // Should still terminate normally since tool errors are caught
      expect(loop.getState()).toBe('TERMINATED');
    });
  });

  describe('reset', () => {
    it('resets state, history, and iteration', async () => {
      const chunks: StreamChunk[] = [
        { type: 'text_delta', content: 'ok' },
        { type: 'usage', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ];
      const provider = makeMockProvider(chunks);
      const loop = new AgentLoop(provider, makeConfig());
      await collectEvents(loop.run('test'));

      expect(loop.getState()).toBe('TERMINATED');
      expect(loop.getHistory().length).toBeGreaterThan(0);

      loop.reset();
      expect(loop.getState()).toBe('IDLE');
      expect(loop.getHistory()).toEqual([]);
      expect(loop.getIteration()).toBe(0);
    });
  });

  describe('addSystemMessage', () => {
    it('adds a system message to history', () => {
      const provider = makeMockProvider([]);
      const loop = new AgentLoop(provider, makeConfig());
      loop.addSystemMessage('You are helpful');
      const history = loop.getHistory();
      expect(history).toEqual([{ role: 'system', content: 'You are helpful' }]);
    });
  });
});
