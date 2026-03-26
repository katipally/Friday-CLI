import OpenAI from 'openai';
import { createLogger, ProviderError } from '@fridaycode/shared';
import type {
  LLMProvider,
  GenerateRequest,
  GenerateResponse,
  StreamChunk,
  ProviderCapabilities,
  ModelInfo,
  ProviderConfig,
  ToolCallResponse,
} from '../types.js';
import { registerProvider } from '../registry.js';
import { getCachedModels, setCachedModels } from '../model-cache.js';

const logger = createLogger('xai');

const XAI_DEFAULT_MODELS: ModelInfo[] = [
  { id: 'grok-2', name: 'Grok 2', contextWindow: 131072, inputPricePerMToken: 2.00, outputPricePerMToken: 10.00, supportsVision: true, supportsToolCalling: true },
  { id: 'grok-2-mini', name: 'Grok 2 Mini', contextWindow: 131072, inputPricePerMToken: 0.30, outputPricePerMToken: 1.00, supportsVision: false, supportsToolCalling: true },
  { id: 'grok-3', name: 'Grok 3', contextWindow: 131072, inputPricePerMToken: 3.00, outputPricePerMToken: 15.00, supportsVision: true, supportsToolCalling: true },
];

export class XAIProvider implements LLMProvider {
  readonly name = 'xai';
  readonly displayName = 'xAI (Grok)';
  private client: OpenAI;
  private apiKey: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey || process.env.XAI_API_KEY || '';
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: config.baseUrl || 'https://api.x.ai/v1',
    });
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    try {
      const messages = this.formatMessages(request);
      const response = await this.client.chat.completions.create({
        model: request.model || 'grok-2',
        messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stop: request.stopSequences,
        tools: request.tools ? this.formatTools(request.tools) : undefined,
      });

      const choice = response.choices[0];
      const toolCalls: ToolCallResponse[] = (choice.message.tool_calls || []).map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));

      return {
        content: choice.message.content || '',
        toolCalls,
        usage: {
          inputTokens: response.usage?.prompt_tokens || 0,
          outputTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        model: response.model,
        finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *stream(request: GenerateRequest): AsyncGenerator<StreamChunk> {
    try {
      const messages = this.formatMessages(request);
      const stream = await this.client.chat.completions.create({
        model: request.model || 'grok-2',
        messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: true,
        stream_options: { include_usage: true },
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          yield { type: 'text_delta', content: delta.content };
        }
        if (chunk.usage) {
          yield {
            type: 'usage',
            usage: {
              inputTokens: chunk.usage.prompt_tokens,
              outputTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            },
          };
        }
      }
      yield { type: 'done' };
    } catch (error) {
      yield { type: 'error', error: (error as Error).message };
    }
  }

  async generateWithTools(request: GenerateRequest): Promise<GenerateResponse> {
    return this.generate(request);
  }

  async *streamWithTools(request: GenerateRequest): AsyncGenerator<StreamChunk> {
    try {
      const messages = this.formatMessages(request);
      const stream = await this.client.chat.completions.create({
        model: request.model || 'grok-2',
        messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        tools: request.tools ? this.formatTools(request.tools) : undefined,
        stream: true,
        stream_options: { include_usage: true },
      });

      const toolCalls = new Map<number, { id: string; name: string; args: string }>();

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          yield { type: 'text_delta', content: delta.content };
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.id) {
              toolCalls.set(tc.index, { id: tc.id, name: tc.function?.name || '', args: '' });
              yield {
                type: 'tool_call_start',
                toolCall: { id: tc.id, name: tc.function?.name },
              };
            }
            if (tc.function?.arguments) {
              const existing = toolCalls.get(tc.index);
              if (existing) existing.args += tc.function.arguments;
              yield { type: 'tool_call_delta', content: tc.function.arguments };
            }
          }
        }

        if (chunk.choices[0]?.finish_reason === 'tool_calls') {
          for (const [, tc] of toolCalls) {
            yield {
              type: 'tool_call_end',
              toolCall: { id: tc.id, name: tc.name, arguments: JSON.parse(tc.args) },
            };
          }
        }

        if (chunk.usage) {
          yield {
            type: 'usage',
            usage: {
              inputTokens: chunk.usage.prompt_tokens,
              outputTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            },
          };
        }
      }
      yield { type: 'done' };
    } catch (error) {
      yield { type: 'error', error: (error as Error).message };
    }
  }

  capabilities(): ProviderCapabilities {
    return {
      streaming: true,
      toolCalling: true,
      vision: true,
      embeddings: false,
      jsonMode: true,
      maxContextWindow: 131072,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    const cached = getCachedModels('xai');
    if (cached) return cached;

    try {
      const response = await fetch('https://api.x.ai/v1/models', {
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
      });

      if (response.ok) {
        const data = await response.json() as {
          data: Array<{ id: string; object: string }>;
        };

        const models: ModelInfo[] = data.data.map((m) => {
          const defaultModel = XAI_DEFAULT_MODELS.find((dm) => dm.id === m.id);
          return {
            id: m.id,
            name: defaultModel?.name || m.id,
            contextWindow: defaultModel?.contextWindow || 131072,
            inputPricePerMToken: defaultModel?.inputPricePerMToken || 2.00,
            outputPricePerMToken: defaultModel?.outputPricePerMToken || 10.00,
            supportsVision: defaultModel?.supportsVision ?? false,
            supportsToolCalling: defaultModel?.supportsToolCalling ?? true,
          };
        });

        if (models.length > 0) {
          setCachedModels('xai', models);
          return models;
        }
      }
    } catch (error) {
      logger.warn('Failed to fetch models from xAI API, using defaults', {
        error: (error as Error).message,
      });
    }

    return XAI_DEFAULT_MODELS;
  }

  async validateApiKey(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  private formatMessages(request: GenerateRequest): OpenAI.ChatCompletionMessageParam[] {
    const messages: OpenAI.ChatCompletionMessageParam[] = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    for (const msg of request.messages) {
      if (msg.role === 'tool') {
        messages.push({ role: 'tool', content: msg.content, tool_call_id: msg.toolCallId || '' });
      } else if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        messages.push({
          role: 'assistant',
          content: msg.content || null,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          })),
        });
      } else {
        messages.push({ role: msg.role as 'user' | 'assistant' | 'system', content: msg.content });
      }
    }
    return messages;
  }

  private formatTools(tools: GenerateRequest['tools']): OpenAI.ChatCompletionTool[] | undefined {
    if (!tools || tools.length === 0) return undefined;
    return tools.map((tool) => ({
      type: 'function' as const,
      function: { name: tool.name, description: tool.description, parameters: tool.parameters },
    }));
  }

  private handleError(error: unknown): ProviderError {
    if (error instanceof OpenAI.APIError) {
      return new ProviderError(error.message, 'xai', error.status, { type: error.type });
    }
    return new ProviderError((error as Error).message, 'xai');
  }
}

registerProvider('xai', (config) => new XAIProvider(config));
