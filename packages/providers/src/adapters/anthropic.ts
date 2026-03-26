import Anthropic from '@anthropic-ai/sdk';
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

const logger = createLogger('anthropic');

const ANTHROPIC_MODELS: ModelInfo[] = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000, inputPricePerMToken: 3.00, outputPricePerMToken: 15.00, supportsVision: true, supportsToolCalling: true },
  { id: 'claude-haiku-3-5-20241022', name: 'Claude 3.5 Haiku', contextWindow: 200000, inputPricePerMToken: 0.80, outputPricePerMToken: 4.00, supportsVision: true, supportsToolCalling: true },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', contextWindow: 200000, inputPricePerMToken: 15.00, outputPricePerMToken: 75.00, supportsVision: true, supportsToolCalling: true },
];

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly displayName = 'Anthropic';
  private client: Anthropic;

  constructor(config: ProviderConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
      baseURL: config.baseUrl,
    });
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    try {
      const { system, messages } = this.formatMessages(request);
      const response = await this.client.messages.create({
        model: request.model || 'claude-sonnet-4-20250514',
        max_tokens: request.maxTokens || 8192,
        system: system || undefined,
        messages,
        temperature: request.temperature,
        stop_sequences: request.stopSequences,
        tools: request.tools ? this.formatTools(request.tools) : undefined,
      });

      let content = '';
      const toolCalls: ToolCallResponse[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          content += block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            name: block.name,
            arguments: block.input as Record<string, unknown>,
          });
        }
      }

      return {
        content,
        toolCalls,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        model: response.model,
        finishReason: response.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *stream(request: GenerateRequest): AsyncGenerator<StreamChunk> {
    try {
      const { system, messages } = this.formatMessages(request);
      const stream = this.client.messages.stream({
        model: request.model || 'claude-sonnet-4-20250514',
        max_tokens: request.maxTokens || 8192,
        system: system || undefined,
        messages,
        temperature: request.temperature,
        stop_sequences: request.stopSequences,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield { type: 'text_delta', content: event.delta.text };
        }
      }

      const finalMessage = await stream.finalMessage();
      yield {
        type: 'usage',
        usage: {
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
          totalTokens: finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
        },
      };
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
      const { system, messages } = this.formatMessages(request);
      const stream = this.client.messages.stream({
        model: request.model || 'claude-sonnet-4-20250514',
        max_tokens: request.maxTokens || 8192,
        system: system || undefined,
        messages,
        temperature: request.temperature,
        tools: request.tools ? this.formatTools(request.tools) : undefined,
      });

      let currentToolId = '';
      let currentToolName = '';
      let toolArgs = '';

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            currentToolId = event.content_block.id;
            currentToolName = event.content_block.name;
            toolArgs = '';
            yield {
              type: 'tool_call_start',
              toolCall: { id: currentToolId, name: currentToolName },
            };
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            yield { type: 'text_delta', content: event.delta.text };
          } else if (event.delta.type === 'input_json_delta') {
            toolArgs += event.delta.partial_json;
            yield { type: 'tool_call_delta', content: event.delta.partial_json };
          }
        } else if (event.type === 'content_block_stop') {
          if (currentToolId) {
            yield {
              type: 'tool_call_end',
              toolCall: {
                id: currentToolId,
                name: currentToolName,
                arguments: toolArgs ? JSON.parse(toolArgs) : {},
              },
            };
            currentToolId = '';
            currentToolName = '';
            toolArgs = '';
          }
        }
      }

      const finalMessage = await stream.finalMessage();
      yield {
        type: 'usage',
        usage: {
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
          totalTokens: finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
        },
      };
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
      maxContextWindow: 200000,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    const cached = getCachedModels('anthropic');
    if (cached) return cached;

    try {
      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': this.client.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '',
          'anthropic-version': '2023-06-01',
        },
      });

      if (response.ok) {
        const data = await response.json() as { data: Array<{ id: string; display_name: string; type: string }> };
        const models: ModelInfo[] = data.data
          .filter((m) => m.type === 'model')
          .map((m) => {
            const fallback = ANTHROPIC_MODELS.find((f) => m.id.startsWith(f.id));
            return {
              id: m.id,
              name: m.display_name || m.id,
              contextWindow: fallback?.contextWindow ?? 200000,
              inputPricePerMToken: fallback?.inputPricePerMToken ?? 3.00,
              outputPricePerMToken: fallback?.outputPricePerMToken ?? 15.00,
              supportsVision: fallback?.supportsVision ?? true,
              supportsToolCalling: fallback?.supportsToolCalling ?? true,
            };
          });

        if (models.length > 0) {
          setCachedModels('anthropic', models);
          return models;
        }
      }
    } catch (error) {
      logger.warn('Failed to fetch models from Anthropic API, using defaults', {
        error: (error as Error).message,
      });
    }

    return ANTHROPIC_MODELS;
  }

  async validateApiKey(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: 'claude-haiku-3-5-20241022',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      return true;
    } catch {
      return false;
    }
  }

  private formatMessages(request: GenerateRequest): {
    system: string | undefined;
    messages: Anthropic.MessageParam[];
  } {
    let system = request.systemPrompt;
    const messages: Anthropic.MessageParam[] = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        system = (system ? system + '\n\n' : '') + msg.content;
      } else if (msg.role === 'tool') {
        messages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: msg.toolCallId || '',
            content: msg.content,
          }],
        });
      } else if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        const contentBlocks: (Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam)[] = [];
        if (msg.content) {
          contentBlocks.push({ type: 'text', text: msg.content });
        }
        for (const tc of msg.toolCalls) {
          contentBlocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          });
        }
        messages.push({ role: 'assistant', content: contentBlocks });
      } else {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    return { system, messages };
  }

  private formatTools(tools: GenerateRequest['tools']): Anthropic.Tool[] | undefined {
    if (!tools || tools.length === 0) return undefined;
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters as Anthropic.Tool.InputSchema,
    }));
  }

  private handleError(error: unknown): ProviderError {
    if (error instanceof Anthropic.APIError) {
      return new ProviderError(
        error.message,
        'anthropic',
        error.status,
      );
    }
    return new ProviderError((error as Error).message, 'anthropic');
  }
}

registerProvider('anthropic', (config) => new AnthropicProvider(config));
