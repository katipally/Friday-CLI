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

interface AnthropicModel {
  id: string;
  display_name: string;
  created_at: string;
}

interface AnthropicMessage {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: string | null;
  usage: { input_tokens: number; output_tokens: number };
}

interface AnthropicContentBlock {
  type: 'text' | 'tool_use' | 'thinking';
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface AnthropicStreamEvent {
  type: string;
  index?: number;
  delta?: {
    type: string;
    text?: string;
    partial_json?: string;
  };
  content_block?: AnthropicContentBlock;
  message?: AnthropicMessage;
  usage?: { input_tokens: number; output_tokens: number };
}

const KNOWN_MODELS: Model[] = [
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    contextWindow: 200000,
    supportsToolUse: true,
    supportsVision: true,
    supportsStreaming: true,
    maxOutputTokens: 16384,
  },
  {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    provider: 'anthropic',
    contextWindow: 200000,
    supportsToolUse: true,
    supportsVision: true,
    supportsStreaming: true,
    maxOutputTokens: 16384,
  },
  {
    id: 'claude-haiku-3-5-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    contextWindow: 200000,
    supportsToolUse: true,
    supportsVision: true,
    supportsStreaming: true,
    maxOutputTokens: 8192,
  },
];

export class AnthropicProvider extends BaseProvider {
  readonly type: ProviderType = 'anthropic';
  readonly name = 'Anthropic';

  async fetchModels(): Promise<Model[]> {
    // Anthropic doesn't have a reliable public model-listing endpoint.
    // Return known models; we can extend when the API evolves.
    return KNOWN_MODELS;
  }

  async *chat(options: ChatOptions): AsyncIterable<StreamChunk> {
    const url = `${this.getBaseUrl()}${PROVIDER_DEFAULTS.anthropic.chatEndpoint}`;

    const messages = options.messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        if (m.role === 'tool') {
          return {
            role: 'user' as const,
            content: [
              {
                type: 'tool_result' as const,
                tool_use_id: m.toolCallId,
                content: typeof m.content === 'string' ? m.content : '',
              },
            ],
          };
        }

        if (typeof m.content === 'string') {
          return { role: m.role, content: m.content };
        }

        const blocks = (m.content as ContentBlock[]).map((b) => {
          if (b.type === 'tool_use') {
            return { type: 'tool_use', id: b.toolUseId, name: b.toolName, input: b.input };
          }
          if (b.type === 'tool_result') {
            return { type: 'tool_result', tool_use_id: b.toolUseId, content: b.content };
          }
          return { type: 'text', text: b.text ?? '' };
        });

        return { role: m.role, content: blocks };
      });

    const body: Record<string, unknown> = {
      model: options.model,
      messages,
      max_tokens: options.maxTokens ?? 8192,
      stream: options.stream,
    };

    if (options.systemPrompt) {
      body.system = options.systemPrompt;
    }

    if (options.tools?.length) {
      body.tools = this.formatTools(options.tools);
    }

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey ?? '',
      'anthropic-version': PROVIDER_DEFAULTS.anthropic.apiVersion,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      yield { type: 'error', content: `Anthropic error: ${res.status} ${errText}` };
      return;
    }

    if (!options.stream) {
      const data = (await res.json()) as AnthropicMessage;
      for (const block of data.content) {
        if (block.type === 'text' && block.text) {
          yield { type: 'text', content: block.text };
        } else if (block.type === 'thinking' && block.thinking) {
          yield { type: 'thinking', content: block.thinking };
        } else if (block.type === 'tool_use' && block.id && block.name) {
          yield {
            type: 'tool_use',
            toolCall: { id: block.id, name: block.name, input: block.input ?? {} },
          };
        }
      }
      yield {
        type: 'done',
        usage: {
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens,
        },
      };
      return;
    }

    // Streaming with SSE
    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';
    let currentToolId = '';
    let currentToolName = '';
    let toolJsonBuffer = '';
    let totalInput = 0;
    let totalOutput = 0;

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
          const event = JSON.parse(jsonStr) as AnthropicStreamEvent;

          if (event.type === 'content_block_start' && event.content_block) {
            if (event.content_block.type === 'tool_use') {
              currentToolId = event.content_block.id ?? '';
              currentToolName = event.content_block.name ?? '';
              toolJsonBuffer = '';
            }
          } else if (event.type === 'content_block_delta' && event.delta) {
            if (event.delta.type === 'text_delta' && event.delta.text) {
              yield { type: 'text', content: event.delta.text };
            } else if (event.delta.type === 'thinking_delta' && event.delta.text) {
              yield { type: 'thinking', content: event.delta.text };
            } else if (event.delta.type === 'input_json_delta' && event.delta.partial_json) {
              toolJsonBuffer += event.delta.partial_json;
            }
          } else if (event.type === 'content_block_stop') {
            if (currentToolId && currentToolName) {
              let input: Record<string, unknown> = {};
              try {
                input = JSON.parse(toolJsonBuffer) as Record<string, unknown>;
              } catch { /* empty */ }
              yield {
                type: 'tool_use',
                toolCall: { id: currentToolId, name: currentToolName, input },
              };
              currentToolId = '';
              currentToolName = '';
              toolJsonBuffer = '';
            }
          } else if (event.type === 'message_delta' && event.usage) {
            totalOutput = event.usage.output_tokens;
          } else if (event.type === 'message_start' && event.message?.usage) {
            totalInput = event.message.usage.input_tokens;
          }
        } catch { /* skip malformed */ }
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
    return !!this.config.apiKey;
  }

  protected formatTools(tools: ToolDefinition[] | undefined): unknown[] | undefined {
    if (!tools?.length) return undefined;
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));
  }

  protected parseStreamLine(_line: string): StreamChunk | null {
    // Handled in chat() directly due to SSE complexity
    return null;
  }
}
