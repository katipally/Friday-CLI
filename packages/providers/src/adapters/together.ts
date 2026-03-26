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

const logger = createLogger('together');

const TOGETHER_MODELS: ModelInfo[] = [
  { id: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo', name: 'Llama 3.1 405B Instruct Turbo', contextWindow: 130815, inputPricePerMToken: 3.50, outputPricePerMToken: 3.50, supportsVision: false, supportsToolCalling: true },
  { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', name: 'Llama 3.1 70B Instruct Turbo', contextWindow: 130815, inputPricePerMToken: 0.88, outputPricePerMToken: 0.88, supportsVision: false, supportsToolCalling: true },
  { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', name: 'Llama 3.1 8B Instruct Turbo', contextWindow: 130815, inputPricePerMToken: 0.18, outputPricePerMToken: 0.18, supportsVision: false, supportsToolCalling: true },
  { id: 'mistralai/Mixtral-8x22B-Instruct-v0.1', name: 'Mixtral 8x22B Instruct', contextWindow: 65536, inputPricePerMToken: 1.20, outputPricePerMToken: 1.20, supportsVision: false, supportsToolCalling: true },
  { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B Instruct', contextWindow: 32768, inputPricePerMToken: 0.60, outputPricePerMToken: 0.60, supportsVision: false, supportsToolCalling: true },
  { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', name: 'Qwen 2.5 72B Instruct Turbo', contextWindow: 131072, inputPricePerMToken: 1.20, outputPricePerMToken: 1.20, supportsVision: false, supportsToolCalling: true },
];

export class TogetherProvider implements LLMProvider {
  readonly name = 'together';
  readonly displayName = 'Together AI';
  private client: OpenAI;

  constructor(config: ProviderConfig) {
    const apiKey = config.apiKey || process.env.TOGETHER_API_KEY;
    if (!apiKey) {
      throw new ProviderError(
        'Together AI API key is required. Set it via config.apiKey or TOGETHER_API_KEY environment variable.',
        'together',
      );
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: config.baseUrl || 'https://api.together.xyz/v1',
    });
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    try {
      const messages = this.formatMessages(request);
      const response = await this.client.chat.completions.create({
        model: request.model || 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stop: request.stopSequences,
        tools: request.tools ? this.formatTools(request.tools) : undefined,
        response_format: request.responseFormat === 'json' ? { type: 'json_object' } : undefined,
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
        model: request.model || 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stop: request.stopSequences,
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
        model: request.model || 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
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
              if (existing) {
                existing.args += tc.function.arguments;
              }
              yield { type: 'tool_call_delta', content: tc.function.arguments };
            }
          }
        }

        if (chunk.choices[0]?.finish_reason === 'tool_calls') {
          for (const [, tc] of toolCalls) {
            yield {
              type: 'tool_call_end',
              toolCall: {
                id: tc.id,
                name: tc.name,
                arguments: JSON.parse(tc.args),
              },
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
      vision: false,
      embeddings: false,
      jsonMode: true,
      maxContextWindow: 131072,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    const cached = getCachedModels('together');
    if (cached) return cached;

    try {
      const response = await this.client.models.list();
      const models: ModelInfo[] = [];

      for await (const model of response) {
        const fallback = TOGETHER_MODELS.find((m) => model.id === m.id);
        models.push({
          id: model.id,
          name: fallback?.name || model.id,
          contextWindow: fallback?.contextWindow ?? 131072,
          inputPricePerMToken: fallback?.inputPricePerMToken ?? 0,
          outputPricePerMToken: fallback?.outputPricePerMToken ?? 0,
          supportsVision: fallback?.supportsVision ?? false,
          supportsToolCalling: fallback?.supportsToolCalling ?? true,
        });
      }

      if (models.length > 0) {
        setCachedModels('together', models);
        return models;
      }
    } catch (error) {
      logger.warn('Failed to fetch models from Together API, using defaults', {
        error: (error as Error).message,
      });
    }

    return TOGETHER_MODELS;
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
        messages.push({
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.toolCallId || '',
        });
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
        messages.push({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        });
      }
    }
    return messages;
  }

  private formatTools(tools: GenerateRequest['tools']): OpenAI.ChatCompletionTool[] | undefined {
    if (!tools || tools.length === 0) return undefined;
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  private handleError(error: unknown): ProviderError {
    if (error instanceof OpenAI.APIError) {
      return new ProviderError(
        error.message,
        'together',
        error.status,
        { type: error.type },
      );
    }
    return new ProviderError((error as Error).message, 'together');
  }
}

registerProvider('together', (config) => new TogetherProvider(config));
