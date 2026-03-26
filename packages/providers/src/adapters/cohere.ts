import { CohereClient } from 'cohere-ai';
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
  Message,
  ToolDefinition,
} from '../types.js';
import { registerProvider } from '../registry.js';
import { getCachedModels, setCachedModels } from '../model-cache.js';

const logger = createLogger('cohere');

const COHERE_MODELS: ModelInfo[] = [
  { id: 'command-r-plus', name: 'Command R+', contextWindow: 128000, inputPricePerMToken: 2.50, outputPricePerMToken: 10.00, supportsVision: false, supportsToolCalling: true },
  { id: 'command-r', name: 'Command R', contextWindow: 128000, inputPricePerMToken: 0.15, outputPricePerMToken: 0.60, supportsVision: false, supportsToolCalling: true },
  { id: 'command-a', name: 'Command A', contextWindow: 256000, inputPricePerMToken: 2.50, outputPricePerMToken: 10.00, supportsVision: false, supportsToolCalling: true },
  { id: 'command-r-plus-08-2024', name: 'Command R+ (08-2024)', contextWindow: 128000, inputPricePerMToken: 2.50, outputPricePerMToken: 10.00, supportsVision: false, supportsToolCalling: true },
  { id: 'command-r-08-2024', name: 'Command R (08-2024)', contextWindow: 128000, inputPricePerMToken: 0.15, outputPricePerMToken: 0.60, supportsVision: false, supportsToolCalling: true },
];

export class CohereProvider implements LLMProvider {
  readonly name = 'cohere';
  readonly displayName = 'Cohere';
  private client: CohereClient;
  private apiKey: string;

  constructor(config: ProviderConfig) {
    const apiKey = config.apiKey || process.env.COHERE_API_KEY;
    if (!apiKey) {
      throw new ProviderError(
        'Cohere API key is required. Set it via config.apiKey or COHERE_API_KEY environment variable.',
        'cohere',
      );
    }
    this.apiKey = apiKey;
    this.client = new CohereClient({ token: apiKey });
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    try {
      const { chatHistory, message, system } = this.formatMessages(request);

      const response = await this.client.chat({
        model: request.model || 'command-r-plus',
        message,
        chatHistory,
        preamble: system || undefined,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        stopSequences: request.stopSequences,
        tools: request.tools ? this.formatTools(request.tools) : undefined,
      });

      const toolCalls: ToolCallResponse[] = (response.toolCalls || []).map((tc, index) => ({
        id: tc.name + '_' + index,
        name: tc.name,
        arguments: tc.parameters as Record<string, unknown>,
      }));

      const inputTokens = response.meta?.tokens?.inputTokens ?? 0;
      const outputTokens = response.meta?.tokens?.outputTokens ?? 0;

      return {
        content: response.text || '',
        toolCalls,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        model: request.model || 'command-r-plus',
        finishReason: response.finishReason === 'COMPLETE' ? 'stop'
          : response.finishReason === 'MAX_TOKENS' ? 'length'
          : toolCalls.length > 0 ? 'tool_calls'
          : 'stop',
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *stream(request: GenerateRequest): AsyncGenerator<StreamChunk> {
    try {
      const { chatHistory, message, system } = this.formatMessages(request);

      const stream = await this.client.chatStream({
        model: request.model || 'command-r-plus',
        message,
        chatHistory,
        preamble: system || undefined,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        stopSequences: request.stopSequences,
      });

      let inputTokens = 0;
      let outputTokens = 0;

      for await (const event of stream) {
        if (event.eventType === 'text-generation') {
          yield { type: 'text_delta', content: event.text };
        } else if (event.eventType === 'stream-end') {
          inputTokens = event.response?.meta?.tokens?.inputTokens ?? 0;
          outputTokens = event.response?.meta?.tokens?.outputTokens ?? 0;
        }
      }

      yield {
        type: 'usage',
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
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
      const { chatHistory, message, system } = this.formatMessages(request);

      const stream = await this.client.chatStream({
        model: request.model || 'command-r-plus',
        message,
        chatHistory,
        preamble: system || undefined,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        tools: request.tools ? this.formatTools(request.tools) : undefined,
      });

      let inputTokens = 0;
      let outputTokens = 0;
      let currentToolName = '';

      for await (const event of stream) {
        if (event.eventType === 'text-generation') {
          yield { type: 'text_delta', content: event.text };
        } else if (event.eventType === 'tool-calls-chunk') {
          if (event.toolCallDelta?.name) {
            currentToolName = event.toolCallDelta.name;
            yield {
              type: 'tool_call_start',
              toolCall: {
                id: currentToolName + '_call',
                name: currentToolName,
              },
            };
          }
          if (event.toolCallDelta?.parameters) {
            yield { type: 'tool_call_delta', content: event.toolCallDelta.parameters };
          }
        } else if (event.eventType === 'tool-calls-generation') {
          for (const tc of event.toolCalls || []) {
            yield {
              type: 'tool_call_end',
              toolCall: {
                id: tc.name + '_call',
                name: tc.name,
                arguments: tc.parameters as Record<string, unknown>,
              },
            };
          }
        } else if (event.eventType === 'stream-end') {
          inputTokens = event.response?.meta?.tokens?.inputTokens ?? 0;
          outputTokens = event.response?.meta?.tokens?.outputTokens ?? 0;
        }
      }

      yield {
        type: 'usage',
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
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
      vision: false,
      embeddings: true,
      jsonMode: false,
      maxContextWindow: 256000,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    const cached = getCachedModels('cohere');
    if (cached) return cached;

    try {
      const response = await fetch('https://api.cohere.com/v2/models', {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });

      if (response.ok) {
        const data = await response.json() as { models: Array<{ name: string; endpoints: string[]; context_length?: number }> };
        const models: ModelInfo[] = data.models
          .filter((m) => m.endpoints?.includes('chat'))
          .map((m) => {
            const fallback = COHERE_MODELS.find((f) => m.name.startsWith(f.id));
            return {
              id: m.name,
              name: fallback?.name || m.name,
              contextWindow: m.context_length || fallback?.contextWindow || 128000,
              inputPricePerMToken: fallback?.inputPricePerMToken ?? 0,
              outputPricePerMToken: fallback?.outputPricePerMToken ?? 0,
              supportsVision: fallback?.supportsVision ?? false,
              supportsToolCalling: fallback?.supportsToolCalling ?? true,
            };
          });

        if (models.length > 0) {
          setCachedModels('cohere', models);
          return models;
        }
      }
    } catch (error) {
      logger.warn('Failed to fetch models from Cohere API, using defaults', {
        error: (error as Error).message,
      });
    }

    return COHERE_MODELS;
  }

  async validateApiKey(): Promise<boolean> {
    try {
      await this.client.chat({
        model: 'command-r',
        message: 'hi',
        maxTokens: 1,
      });
      return true;
    } catch {
      return false;
    }
  }

  private formatMessages(request: GenerateRequest): {
    chatHistory: Array<{ role: 'USER' | 'CHATBOT' | 'SYSTEM' | 'TOOL'; message: string; toolResults?: Array<{ call: { name: string; parameters: Record<string, unknown> }; outputs: Array<Record<string, unknown>> }> }>;
    message: string;
    system: string | undefined;
  } {
    let system = request.systemPrompt;
    const chatHistory: Array<{ role: 'USER' | 'CHATBOT' | 'SYSTEM' | 'TOOL'; message: string; toolResults?: Array<{ call: { name: string; parameters: Record<string, unknown> }; outputs: Array<Record<string, unknown>> }> }> = [];
    let lastUserMessage = '';

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        system = (system ? system + '\n\n' : '') + msg.content;
      } else if (msg.role === 'user') {
        lastUserMessage = msg.content;
      } else if (msg.role === 'assistant') {
        // If there's a pending user message, push it first
        if (lastUserMessage) {
          chatHistory.push({ role: 'USER', message: lastUserMessage });
          lastUserMessage = '';
        }
        chatHistory.push({ role: 'CHATBOT', message: msg.content });
      } else if (msg.role === 'tool') {
        chatHistory.push({
          role: 'TOOL',
          message: '',
          toolResults: [{
            call: { name: msg.name || 'tool', parameters: {} },
            outputs: [{ result: msg.content }],
          }],
        });
      }
    }

    // The last user message becomes the current message
    const message = lastUserMessage || '';

    return { chatHistory, message, system };
  }

  private formatTools(tools: ToolDefinition[]): Array<{
    name: string;
    description: string;
    parameterDefinitions?: Record<string, { description?: string; type: string; required?: boolean }>;
  }> | undefined {
    if (!tools || tools.length === 0) return undefined;
    return tools.map((tool) => {
      const paramDefs: Record<string, { description?: string; type: string; required?: boolean }> = {};
      const params = tool.parameters as Record<string, unknown>;
      const properties = (params?.properties || {}) as Record<string, Record<string, unknown>>;
      const required = (params?.required || []) as string[];

      for (const [key, value] of Object.entries(properties)) {
        paramDefs[key] = {
          description: (value.description as string) || '',
          type: (value.type as string) || 'string',
          required: required.includes(key),
        };
      }

      return {
        name: tool.name,
        description: tool.description,
        parameterDefinitions: Object.keys(paramDefs).length > 0 ? paramDefs : undefined,
      };
    });
  }

  private handleError(error: unknown): ProviderError {
    if (error instanceof Error) {
      const statusMatch = (error as unknown as Record<string, unknown>).status || (error as unknown as Record<string, unknown>).statusCode;
      return new ProviderError(
        error.message,
        'cohere',
        typeof statusMatch === 'number' ? statusMatch : undefined,
      );
    }
    return new ProviderError(String(error), 'cohere');
  }
}

registerProvider('cohere', (config) => new CohereProvider(config));
