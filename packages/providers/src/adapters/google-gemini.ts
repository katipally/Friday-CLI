import { GoogleGenAI, type Content, type Part, type FunctionDeclaration, type GenerateContentResponse } from '@google/genai';
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

const logger = createLogger('google-gemini');

const GEMINI_MODELS: ModelInfo[] = [
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 1048576, inputPricePerMToken: 1.25, outputPricePerMToken: 10.00, supportsVision: true, supportsToolCalling: true },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 1048576, inputPricePerMToken: 0.15, outputPricePerMToken: 0.60, supportsVision: true, supportsToolCalling: true },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1048576, inputPricePerMToken: 0.10, outputPricePerMToken: 0.40, supportsVision: true, supportsToolCalling: true },
];

export class GoogleGeminiProvider implements LLMProvider {
  readonly name = 'google-gemini';
  readonly displayName = 'Google Gemini';
  private client: GoogleGenAI;

  constructor(config: ProviderConfig) {
    const apiKey = config.apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ProviderError(
        'Google Gemini API key is required. Set it via config.apiKey, GOOGLE_API_KEY, or GEMINI_API_KEY environment variable.',
        'google-gemini',
      );
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    try {
      const contents = this.formatMessages(request);
      const tools = request.tools ? this.formatTools(request.tools) : undefined;
      const model = request.model || 'gemini-2.5-flash';

      const response = await this.client.models.generateContent({
        model,
        contents,
        config: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
          stopSequences: request.stopSequences,
          systemInstruction: request.systemPrompt || undefined,
          tools: tools ? [{ functionDeclarations: tools }] : undefined,
          responseMimeType: request.responseFormat === 'json' ? 'application/json' : undefined,
        },
      });

      return this.parseResponse(response, model);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *stream(request: GenerateRequest): AsyncGenerator<StreamChunk> {
    try {
      const contents = this.formatMessages(request);
      const model = request.model || 'gemini-2.5-flash';

      const response = await this.client.models.generateContentStream({
        model,
        contents,
        config: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
          stopSequences: request.stopSequences,
          systemInstruction: request.systemPrompt || undefined,
          responseMimeType: request.responseFormat === 'json' ? 'application/json' : undefined,
        },
      });

      for await (const chunk of response) {
        const text = chunk.text;
        if (text) {
          yield { type: 'text_delta', content: text };
        }
        if (chunk.usageMetadata) {
          yield {
            type: 'usage',
            usage: {
              inputTokens: chunk.usageMetadata.promptTokenCount || 0,
              outputTokens: chunk.usageMetadata.candidatesTokenCount || 0,
              totalTokens: chunk.usageMetadata.totalTokenCount || 0,
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
      const contents = this.formatMessages(request);
      const tools = request.tools ? this.formatTools(request.tools) : undefined;
      const model = request.model || 'gemini-2.5-flash';

      const response = await this.client.models.generateContentStream({
        model,
        contents,
        config: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
          stopSequences: request.stopSequences,
          systemInstruction: request.systemPrompt || undefined,
          tools: tools ? [{ functionDeclarations: tools }] : undefined,
        },
      });

      for await (const chunk of response) {
        const text = chunk.text;
        if (text) {
          yield { type: 'text_delta', content: text };
        }

        const parts = chunk.candidates?.[0]?.content?.parts;
        if (parts) {
          for (const part of parts) {
            if (part.functionCall) {
              const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
              yield {
                type: 'tool_call_start',
                toolCall: { id: callId, name: part.functionCall.name },
              };
              const argsStr = JSON.stringify(part.functionCall.args || {});
              yield { type: 'tool_call_delta', content: argsStr };
              yield {
                type: 'tool_call_end',
                toolCall: {
                  id: callId,
                  name: part.functionCall.name || '',
                  arguments: (part.functionCall.args || {}) as Record<string, unknown>,
                },
              };
            }
          }
        }

        if (chunk.usageMetadata) {
          yield {
            type: 'usage',
            usage: {
              inputTokens: chunk.usageMetadata.promptTokenCount || 0,
              outputTokens: chunk.usageMetadata.candidatesTokenCount || 0,
              totalTokens: chunk.usageMetadata.totalTokenCount || 0,
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
      maxContextWindow: 1048576,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    return GEMINI_MODELS;
  }

  async validateApiKey(): Promise<boolean> {
    try {
      await this.client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: 'hi',
      });
      return true;
    } catch {
      return false;
    }
  }

  private parseResponse(response: GenerateContentResponse, model: string): GenerateResponse {
    let content = '';
    const toolCalls: ToolCallResponse[] = [];
    let finishReason: GenerateResponse['finishReason'] = 'stop';

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.text) {
        content += part.text;
      }
      if (part.functionCall) {
        const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        toolCalls.push({
          id: callId,
          name: part.functionCall.name || '',
          arguments: (part.functionCall.args || {}) as Record<string, unknown>,
        });
        finishReason = 'tool_calls';
      }
    }

    return {
      content,
      toolCalls,
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount || 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0,
      },
      model,
      finishReason,
    };
  }

  private formatMessages(request: GenerateRequest): Content[] {
    const contents: Content[] = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        // System messages handled via systemInstruction config
        continue;
      }

      const role = msg.role === 'assistant' ? 'model' : 'user';
      const parts: Part[] = [];

      if (msg.content) {
        parts.push({ text: msg.content });
      }

      if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          parts.push({
            functionCall: { name: tc.name, args: tc.arguments },
          });
        }
      }

      if (msg.role === 'tool') {
        parts.push({
          functionResponse: {
            name: msg.name || '',
            response: { result: msg.content },
          },
        });
        contents.push({ role: 'user', parts });
        continue;
      }

      if (parts.length > 0) {
        contents.push({ role, parts });
      }
    }

    return contents;
  }

  private formatTools(tools: GenerateRequest['tools']): FunctionDeclaration[] | undefined {
    if (!tools || tools.length === 0) return undefined;
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as FunctionDeclaration['parameters'],
    }));
  }

  private handleError(error: unknown): ProviderError {
    const message = (error as Error).message || 'Unknown Google Gemini error';
    return new ProviderError(message, 'google-gemini');
  }
}

registerProvider('google-gemini', (config) => new GoogleGeminiProvider(config));
