import OpenAI from 'openai';
import { createLogger, ProviderError } from '@anthropic-ai/friday-shared';
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

const logger = createLogger('azure-openai');

const AZURE_OPENAI_MODELS: ModelInfo[] = [
  { id: 'gpt-4o', name: 'GPT-4o (Azure)', contextWindow: 128000, inputPricePerMToken: 2.50, outputPricePerMToken: 10.00, supportsVision: true, supportsToolCalling: true },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Azure)', contextWindow: 128000, inputPricePerMToken: 0.15, outputPricePerMToken: 0.60, supportsVision: true, supportsToolCalling: true },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo (Azure)', contextWindow: 128000, inputPricePerMToken: 10.00, outputPricePerMToken: 30.00, supportsVision: true, supportsToolCalling: true },
  { id: 'gpt-4', name: 'GPT-4 (Azure)', contextWindow: 8192, inputPricePerMToken: 30.00, outputPricePerMToken: 60.00, supportsVision: false, supportsToolCalling: true },
  { id: 'gpt-35-turbo', name: 'GPT-3.5 Turbo (Azure)', contextWindow: 16384, inputPricePerMToken: 0.50, outputPricePerMToken: 1.50, supportsVision: false, supportsToolCalling: true },
];

export class AzureOpenAIProvider implements LLMProvider {
  readonly name = 'azure-openai';
  readonly displayName = 'Azure OpenAI';
  private client: OpenAI;
  private deploymentName: string;

  constructor(config: ProviderConfig) {
    const endpoint = (config.options?.endpoint as string) || process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = config.apiKey || process.env.AZURE_OPENAI_API_KEY;
    const deploymentName = (config.options?.deploymentName as string) || config.model || process.env.AZURE_OPENAI_DEPLOYMENT || '';
    const apiVersion = (config.options?.apiVersion as string) || process.env.AZURE_OPENAI_API_VERSION || '2024-10-21';

    if (!endpoint) {
      throw new ProviderError(
        'Azure OpenAI endpoint is required. Set it via config.options.endpoint or AZURE_OPENAI_ENDPOINT environment variable.',
        'azure-openai',
      );
    }
    if (!apiKey) {
      throw new ProviderError(
        'Azure OpenAI API key is required. Set it via config.apiKey or AZURE_OPENAI_API_KEY environment variable.',
        'azure-openai',
      );
    }

    this.deploymentName = deploymentName;

    const baseURL = endpoint.replace(/\/+$/, '') + '/openai/deployments/' + deploymentName;

    this.client = new OpenAI({
      apiKey,
      baseURL,
      defaultHeaders: { 'api-key': apiKey },
      defaultQuery: { 'api-version': apiVersion },
    });
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    try {
      const messages = this.formatMessages(request);
      const response = await this.client.chat.completions.create({
        model: request.model || this.deploymentName,
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
        model: request.model || this.deploymentName,
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
        model: request.model || this.deploymentName,
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
      vision: true,
      embeddings: true,
      jsonMode: true,
      maxContextWindow: 128000,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    return AZURE_OPENAI_MODELS;
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
        'azure-openai',
        error.status,
        { type: error.type },
      );
    }
    return new ProviderError((error as Error).message, 'azure-openai');
  }
}

registerProvider('azure-openai', (config) => new AzureOpenAIProvider(config));
