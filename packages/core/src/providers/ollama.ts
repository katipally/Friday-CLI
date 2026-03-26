import type {
  ProviderType,
  Model,
  ChatOptions,
  StreamChunk,
  ToolDefinition,
} from '@fridaycode/shared';
import { PROVIDER_DEFAULTS } from '@fridaycode/shared';
import { BaseProvider } from './base.js';

interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
  details?: {
    parameter_size?: string;
    quantization_level?: string;
    family?: string;
  };
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

interface OllamaChatChunk {
  model: string;
  message?: { role: string; content: string; tool_calls?: OllamaToolCall[] };
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

export class OllamaProvider extends BaseProvider {
  readonly type: ProviderType = 'ollama';
  readonly name = 'Ollama';

  async fetchModels(): Promise<Model[]> {
    const url = `${this.getBaseUrl()}${PROVIDER_DEFAULTS.ollama.modelsEndpoint}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Ollama: failed to list models (${res.status})`);
    const data = (await res.json()) as OllamaTagsResponse;

    return data.models.map((m) => ({
      id: m.name,
      name: m.name,
      provider: this.type,
      supportsToolUse: true,
      supportsVision: m.name.includes('llava') || m.name.includes('vision'),
      supportsStreaming: true,
    }));
  }

  async *chat(options: ChatOptions): AsyncIterable<StreamChunk> {
    const url = `${this.getBaseUrl()}${PROVIDER_DEFAULTS.ollama.chatEndpoint}`;

    const messages = options.messages.map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : m.content.map((b) => b.text ?? '').join(''),
    }));

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
      body.options = { num_predict: options.maxTokens };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: undefined,
    });

    if (!res.ok) {
      yield { type: 'error', content: `Ollama error: ${res.status} ${await res.text()}` };
      return;
    }

    if (!options.stream) {
      const data = (await res.json()) as OllamaChatChunk;
      if (data.message?.tool_calls?.length) {
        for (const tc of data.message.tool_calls) {
          yield {
            type: 'tool_use',
            toolCall: {
              id: `ollama_${Date.now()}_${tc.function.name}`,
              name: tc.function.name,
              input: tc.function.arguments,
            },
          };
        }
      } else if (data.message?.content) {
        yield { type: 'text', content: data.message.content };
      }
      yield {
        type: 'done',
        usage: {
          inputTokens: data.prompt_eval_count ?? 0,
          outputTokens: data.eval_count ?? 0,
        },
      };
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';
    let totalInput = 0;
    let totalOutput = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = this.parseStreamLine(line);
        if (chunk) {
          if (chunk.usage) {
            totalInput += chunk.usage.inputTokens;
            totalOutput += chunk.usage.outputTokens;
          }
          yield chunk;
        }
      }
    }

    yield {
      type: 'done',
      usage: { inputTokens: totalInput, outputTokens: totalOutput },
    };
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
    try {
      const res = await fetch(this.getBaseUrl(), { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
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

  protected parseStreamLine(line: string): StreamChunk | null {
    try {
      const data = JSON.parse(line) as OllamaChatChunk;

      if (data.message?.tool_calls?.length) {
        const tc = data.message.tool_calls[0];
        return {
          type: 'tool_use',
          toolCall: {
            id: `ollama_${Date.now()}_${tc.function.name}`,
            name: tc.function.name,
            input: tc.function.arguments,
          },
        };
      }

      if (data.message?.content) {
        return { type: 'text', content: data.message.content };
      }

      if (data.done) {
        return {
          type: 'done',
          usage: {
            inputTokens: data.prompt_eval_count ?? 0,
            outputTokens: data.eval_count ?? 0,
          },
        };
      }

      return null;
    } catch {
      return null;
    }
  }
}
