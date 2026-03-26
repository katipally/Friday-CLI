import { Mistral } from '@mistralai/mistralai';
import type { Messages } from '@mistralai/mistralai/models/components/chatcompletionrequest.js';
import type { Tool } from '@mistralai/mistralai/models/components/tool.js';
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

const logger = createLogger('mistral');

const MISTRAL_MODELS: ModelInfo[] = [
  { id: 'mistral-large-latest', name: 'Mistral Large', contextWindow: 128000, inputPricePerMToken: 2.00, outputPricePerMToken: 6.00, supportsVision: false, supportsToolCalling: true },
  { id: 'mistral-medium-latest', name: 'Mistral Medium', contextWindow: 128000, inputPricePerMToken: 2.70, outputPricePerMToken: 8.10, supportsVision: false, supportsToolCalling: true },
  { id: 'mistral-small-latest', name: 'Mistral Small', contextWindow: 128000, inputPricePerMToken: 0.10, outputPricePerMToken: 0.30, supportsVision: false, supportsToolCalling: true },
  { id: 'codestral-latest', name: 'Codestral', contextWindow: 256000, inputPricePerMToken: 0.30, outputPricePerMToken: 0.90, supportsVision: false, supportsToolCalling: true },
];

export class MistralProvider implements LLMProvider {
  readonly name = 'mistral';
  readonly displayName = 'Mistral AI';
  private client: Mistral;

  constructor(config: ProviderConfig) {
    const apiKey = config.apiKey || process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new ProviderError(
        'Mistral API key is required. Set it via config.apiKey or MISTRAL_API_KEY environment variable.',
        'mistral',
      );
    }
    this.client = new Mistral({ apiKey });
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    try {
      const messages = this.formatMessages(request);
      const response = await this.client.chat.complete({
        model: request.model || 'mistral-large-latest',
        messages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        stop: request.stopSequences,
        tools: request.tools ? this.formatTools(request.tools) : undefined,
        responseFormat: request.responseFormat === 'json' ? { type: 'json_object' } : undefined,
      });

      const choice = response.choices?.[0];
      const toolCalls: ToolCallResponse[] = (choice?.message?.toolCalls || []).map((tc) => ({
        id: tc.id || '',
        name: tc.function?.name || '',
        arguments: JSON.parse(typeof tc.function?.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function?.arguments || {})),
      }));

      return {
        content: (choice?.message?.content as string) || '',
        toolCalls,
        usage: {
          inputTokens: response.usage?.promptTokens || 0,
          outputTokens: response.usage?.completionTokens || 0,
          totalTokens: response.usage?.totalTokens || 0,
        },
        model: response.model || request.model || 'mistral-large-latest',
        finishReason: choice?.finishReason === 'tool_calls' ? 'tool_calls' : 'stop',
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *stream(request: GenerateRequest): AsyncGenerator<StreamChunk> {
    try {
      const messages = this.formatMessages(request);
      const stream = await this.client.chat.stream({
        model: request.model || 'mistral-large-latest',
        messages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        stop: request.stopSequences,
      });

      for await (const event of stream) {
        const delta = event.data?.choices?.[0]?.delta;
        if (delta?.content && typeof delta.content === 'string') {
          yield { type: 'text_delta', content: delta.content };
        }
        if (event.data?.usage) {
          yield {
            type: 'usage',
            usage: {
              inputTokens: event.data.usage.promptTokens || 0,
              outputTokens: event.data.usage.completionTokens || 0,
              totalTokens: event.data.usage.totalTokens || 0,
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
      const stream = await this.client.chat.stream({
        model: request.model || 'mistral-large-latest',
        messages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        tools: request.tools ? this.formatTools(request.tools) : undefined,
      });

      const toolCallAccumulator = new Map<number, { id: string; name: string; args: string }>();

      for await (const event of stream) {
        const delta = event.data?.choices?.[0]?.delta;

        if (delta?.content && typeof delta.content === 'string') {
          yield { type: 'text_delta', content: delta.content };
        }

        if (delta?.toolCalls) {
          for (const tc of delta.toolCalls) {
            const idx = (tc as any).index ?? 0;
            if (tc.id) {
              toolCallAccumulator.set(idx, { id: tc.id, name: tc.function?.name || '', args: '' });
              yield {
                type: 'tool_call_start',
                toolCall: { id: tc.id, name: tc.function?.name },
              };
            }
            if (tc.function?.arguments) {
              const existing = toolCallAccumulator.get(idx);
              const argStr = typeof tc.function.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function.arguments);
              if (existing) {
                existing.args += argStr;
              }
              yield { type: 'tool_call_delta', content: argStr };
            }
          }
        }

        if (event.data?.choices?.[0]?.finishReason === 'tool_calls') {
          for (const [, tc] of toolCallAccumulator) {
            yield {
              type: 'tool_call_end',
              toolCall: {
                id: tc.id,
                name: tc.name,
                arguments: JSON.parse(tc.args || '{}'),
              },
            };
          }
        }

        if (event.data?.usage) {
          yield {
            type: 'usage',
            usage: {
              inputTokens: event.data.usage.promptTokens || 0,
              outputTokens: event.data.usage.completionTokens || 0,
              totalTokens: event.data.usage.totalTokens || 0,
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
      embeddings: true,
      jsonMode: true,
      maxContextWindow: 256000,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    return MISTRAL_MODELS;
  }

  async validateApiKey(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  private formatMessages(request: GenerateRequest): Messages[] {
    const messages: Messages[] = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    for (const msg of request.messages) {
      if (msg.role === 'tool') {
        messages.push({
          role: 'tool',
          content: msg.content,
          toolCallId: msg.toolCallId || '',
          name: msg.name || '',
        });
      } else if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        messages.push({
          role: 'assistant',
          content: msg.content || '',
          toolCalls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          })),
        });
      } else if (msg.role === 'system') {
        messages.push({ role: 'system', content: msg.content });
      } else if (msg.role === 'user') {
        messages.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content || '' });
      }
    }
    return messages;
  }

  private formatTools(tools: GenerateRequest['tools']): Tool[] | undefined {
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
    const message = (error as Error).message || 'Unknown Mistral error';
    return new ProviderError(message, 'mistral');
  }
}

registerProvider('mistral', (config) => new MistralProvider(config));
