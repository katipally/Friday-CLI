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

const logger = createLogger('deepseek');

const DEEPSEEK_MODELS: ModelInfo[] = [
  { id: 'deepseek-chat', name: 'DeepSeek Chat', contextWindow: 64000, inputPricePerMToken: 0.14, outputPricePerMToken: 0.28, supportsVision: false, supportsToolCalling: true },
  { id: 'deepseek-coder', name: 'DeepSeek Coder', contextWindow: 64000, inputPricePerMToken: 0.14, outputPricePerMToken: 0.28, supportsVision: false, supportsToolCalling: true },
  { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', contextWindow: 64000, inputPricePerMToken: 0.55, outputPricePerMToken: 2.19, supportsVision: false, supportsToolCalling: false },
];

export class DeepSeekProvider implements LLMProvider {
  readonly name = 'deepseek';
  readonly displayName = 'DeepSeek';
  private client: OpenAI;

  constructor(config: ProviderConfig) {
    const apiKey = config.apiKey || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new ProviderError(
        'DeepSeek API key is required. Set it via config.apiKey or DEEPSEEK_API_KEY environment variable.',
        'deepseek',
      );
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: config.baseUrl || 'https://api.deepseek.com',
    });
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    try {
      const messages = this.formatMessages(request);
      const response = await this.client.chat.completions.create({
        model: request.model || 'deepseek-chat',
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
        model: request.model || 'deepseek-chat',
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
        model: request.model || 'deepseek-chat',
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
      maxContextWindow: 64000,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    return DEEPSEEK_MODELS;
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
        'deepseek',
        error.status,
        { type: error.type },
      );
    }
    return new ProviderError((error as Error).message, 'deepseek');
  }
}

registerProvider('deepseek', (config) => new DeepSeekProvider(config));
