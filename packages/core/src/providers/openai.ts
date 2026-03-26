import type {
  ProviderType,
  Model,
  ChatOptions,
  StreamChunk,
  ToolDefinition,
  ContentBlock,
} from '@fridaycode/shared';
import { PROVIDER_DEFAULTS } from '@fridaycode/shared';
import { BaseProvider } from './base.js';

interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

interface OpenAIModelsResponse {
  data: OpenAIModel[];
}

interface OpenAIChoice {
  index: number;
  message?: {
    role: string;
    content: string | null;
    tool_calls?: OpenAIToolCall[];
  };
  delta?: {
    role?: string;
    content?: string | null;
    tool_calls?: OpenAIToolCallDelta[];
  };
  finish_reason: string | null;
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OpenAIToolCallDelta {
  index: number;
  id?: string;
  type?: 'function';
  function?: { name?: string; arguments?: string };
}

interface OpenAIChatResponse {
  id: string;
  choices: OpenAIChoice[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export class OpenAIProvider extends BaseProvider {
  readonly type: ProviderType = 'openai';
  readonly name: string = 'OpenAI';

  async fetchModels(): Promise<Model[]> {
    const url = `${this.getBaseUrl()}${PROVIDER_DEFAULTS.openai.modelsEndpoint}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.config.apiKey ?? ''}` },
    });
    if (!res.ok) throw new Error(`OpenAI: failed to list models (${res.status})`);
    const data = (await res.json()) as OpenAIModelsResponse;

    return data.data
      .filter((m) => m.id.startsWith('gpt-') || m.id.startsWith('o') || m.id.startsWith('chatgpt'))
      .map((m) => ({
        id: m.id,
        name: m.id,
        provider: this.type,
        supportsToolUse: true,
        supportsVision: m.id.includes('vision') || m.id.includes('gpt-4o') || m.id.includes('gpt-4-turbo'),
        supportsStreaming: true,
      }));
  }

  async *chat(options: ChatOptions): AsyncIterable<StreamChunk> {
    const url = `${this.getBaseUrl()}${PROVIDER_DEFAULTS.openai.chatEndpoint}`;

    const messages = options.messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          tool_call_id: m.toolCallId ?? '',
          content: typeof m.content === 'string' ? m.content : '',
        };
      }

      if (m.role === 'assistant' && m.toolCalls?.length) {
        return {
          role: 'assistant' as const,
          content: typeof m.content === 'string' ? m.content : null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.input) },
          })),
        };
      }

      if (typeof m.content === 'string') {
        return { role: m.role, content: m.content };
      }

      const text = (m.content as ContentBlock[]).map((b) => b.text ?? '').join('');
      return { role: m.role, content: text };
    });

    if (options.systemPrompt) {
      messages.unshift({ role: 'system', content: options.systemPrompt });
    }

    const body: Record<string, unknown> = {
      model: options.model,
      messages,
      stream: options.stream,
    };

    if (options.tools?.length) {
      body.tools = this.formatTools(options.tools);
    }
    if (options.maxTokens) {
      body.max_tokens = options.maxTokens;
    }
    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey ?? ''}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      yield { type: 'error', content: `OpenAI error: ${res.status} ${errText}` };
      return;
    }

    if (!options.stream) {
      const data = (await res.json()) as OpenAIChatResponse;
      const choice = data.choices[0];
      if (choice?.message?.tool_calls?.length) {
        for (const tc of choice.message.tool_calls) {
          let input: Record<string, unknown> = {};
          try {
            input = JSON.parse(tc.function.arguments) as Record<string, unknown>;
          } catch { /* empty */ }
          yield {
            type: 'tool_use',
            toolCall: { id: tc.id, name: tc.function.name, input },
          };
        }
      } else if (choice?.message?.content) {
        yield { type: 'text', content: choice.message.content };
      }
      yield {
        type: 'done',
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
        },
      };
      return;
    }

    // Streaming with SSE
    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';
    const toolCalls = new Map<number, { id: string; name: string; args: string }>();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        try {
          const data = JSON.parse(jsonStr) as OpenAIChatResponse;
          const choice = data.choices?.[0];
          if (!choice) continue;

          if (choice.delta?.content) {
            yield { type: 'text', content: choice.delta.content };
          }

          if (choice.delta?.tool_calls) {
            for (const tc of choice.delta.tool_calls) {
              const existing = toolCalls.get(tc.index);
              if (!existing) {
                toolCalls.set(tc.index, {
                  id: tc.id ?? '',
                  name: tc.function?.name ?? '',
                  args: tc.function?.arguments ?? '',
                });
              } else {
                if (tc.function?.arguments) {
                  existing.args += tc.function.arguments;
                }
              }
            }
          }

          if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') {
            for (const [, tc] of toolCalls) {
              if (tc.name) {
                let input: Record<string, unknown> = {};
                try {
                  input = JSON.parse(tc.args) as Record<string, unknown>;
                } catch { /* empty */ }
                yield {
                  type: 'tool_use',
                  toolCall: { id: tc.id, name: tc.name, input },
                };
              }
            }
            toolCalls.clear();
          }
        } catch { /* skip malformed */ }
      }
    }

    yield { type: 'done', usage: { inputTokens: 0, outputTokens: 0 } };
  }

  supportsToolUse(): boolean {
    return true;
  }

  supportsVision(): boolean {
    return true;
  }

  supportsStreaming(): boolean {
    return true;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.apiKey;
  }

  protected formatTools(tools: ToolDefinition[] | undefined): unknown[] | undefined {
    if (!tools?.length) return undefined;
    return tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));
  }

  protected parseStreamLine(_line: string): StreamChunk | null {
    return null;
  }
}
