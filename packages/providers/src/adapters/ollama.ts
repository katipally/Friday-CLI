import { createLogger, ProviderError } from '@fridaycode/shared';
import type {
  LLMProvider,
  GenerateRequest,
  GenerateResponse,
  StreamChunk,
  ProviderCapabilities,
  ModelInfo,
  ProviderConfig,
} from '../types.js';
import { registerProvider } from '../registry.js';
import { getCachedModels, setCachedModels } from '../model-cache.js';

const logger = createLogger('ollama');

export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  readonly displayName = 'Ollama (Local)';
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    this.baseUrl = config.baseUrl || process.env.OLLAMA_HOST || 'http://localhost:11434';
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    try {
      const messages = this.formatMessages(request);
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: request.model || 'llama3.1',
          messages,
          stream: false,
          options: {
            temperature: request.temperature,
            num_predict: request.maxTokens,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      return {
        content: data.message?.content || '',
        toolCalls: [],
        usage: {
          inputTokens: data.prompt_eval_count || 0,
          outputTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
        model: data.model || request.model || 'llama3.1',
        finishReason: 'stop',
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *stream(request: GenerateRequest): AsyncGenerator<StreamChunk> {
    try {
      const messages = this.formatMessages(request);
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: request.model || 'llama3.1',
          messages,
          stream: true,
          options: {
            temperature: request.temperature,
            num_predict: request.maxTokens,
          },
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              yield { type: 'text_delta', content: data.message.content };
            }
            if (data.done) {
              yield {
                type: 'usage',
                usage: {
                  inputTokens: data.prompt_eval_count || 0,
                  outputTokens: data.eval_count || 0,
                  totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
                },
              };
            }
          } catch {
            // skip malformed JSON lines
          }
        }
      }

      // Flush remaining buffer
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          if (data.message?.content) {
            yield { type: 'text_delta', content: data.message.content };
          }
          if (data.done) {
            yield {
              type: 'usage',
              usage: {
                inputTokens: data.prompt_eval_count || 0,
                outputTokens: data.eval_count || 0,
                totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
              },
            };
          }
        } catch {
          // skip malformed JSON
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
    yield* this.stream(request);
  }

  capabilities(): ProviderCapabilities {
    return {
      streaming: true,
      toolCalling: false,
      vision: true,
      embeddings: true,
      jsonMode: false,
      maxContextWindow: 128000,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    const cached = getCachedModels('ollama');
    if (cached) return cached;

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];
      const data = await response.json() as any;
      const models: ModelInfo[] = (data.models || []).map((m: any) => ({
        id: m.name,
        name: m.name,
        contextWindow: 128000,
        inputPricePerMToken: 0,
        outputPricePerMToken: 0,
        supportsVision: m.name.includes('vision') || m.name.includes('llava'),
        supportsToolCalling: false,
      }));
      setCachedModels('ollama', models);
      return models;
    } catch {
      return [];
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  private formatMessages(request: GenerateRequest): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    for (const msg of request.messages) {
      if (msg.role !== 'tool') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    return messages;
  }

  private handleError(error: unknown): ProviderError {
    const msg = (error as Error).message;
    if (msg.includes('ECONNREFUSED')) {
      return new ProviderError(
        'Cannot connect to Ollama. Is it running? Start with: ollama serve',
        'ollama',
      );
    }
    return new ProviderError(msg, 'ollama');
  }
}

registerProvider('ollama', (config) => new OllamaProvider(config));
