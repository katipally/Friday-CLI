import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  type ContentBlock,
  type ConversationRole,
  type Message as BedrockMessage,
  type SystemContentBlock,
  type ToolConfiguration,
  type ConverseStreamOutput,
} from '@aws-sdk/client-bedrock-runtime';
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

const logger = createLogger('aws-bedrock');

const BEDROCK_MODELS: ModelInfo[] = [
  { id: 'anthropic.claude-3-5-sonnet-20241022-v2:0', name: 'Claude 3.5 Sonnet v2 (Bedrock)', contextWindow: 200000, inputPricePerMToken: 3.00, outputPricePerMToken: 15.00, supportsVision: true, supportsToolCalling: true },
  { id: 'anthropic.claude-3-5-haiku-20241022-v1:0', name: 'Claude 3.5 Haiku (Bedrock)', contextWindow: 200000, inputPricePerMToken: 0.80, outputPricePerMToken: 4.00, supportsVision: true, supportsToolCalling: true },
  { id: 'anthropic.claude-3-opus-20240229-v1:0', name: 'Claude 3 Opus (Bedrock)', contextWindow: 200000, inputPricePerMToken: 15.00, outputPricePerMToken: 75.00, supportsVision: true, supportsToolCalling: true },
  { id: 'amazon.nova-pro-v1:0', name: 'Amazon Nova Pro', contextWindow: 300000, inputPricePerMToken: 0.80, outputPricePerMToken: 3.20, supportsVision: true, supportsToolCalling: true },
  { id: 'amazon.nova-lite-v1:0', name: 'Amazon Nova Lite', contextWindow: 300000, inputPricePerMToken: 0.06, outputPricePerMToken: 0.24, supportsVision: true, supportsToolCalling: true },
  { id: 'amazon.nova-micro-v1:0', name: 'Amazon Nova Micro', contextWindow: 128000, inputPricePerMToken: 0.035, outputPricePerMToken: 0.14, supportsVision: false, supportsToolCalling: true },
  { id: 'meta.llama3-1-70b-instruct-v1:0', name: 'Llama 3.1 70B Instruct (Bedrock)', contextWindow: 128000, inputPricePerMToken: 0.72, outputPricePerMToken: 0.72, supportsVision: false, supportsToolCalling: true },
  { id: 'meta.llama3-1-8b-instruct-v1:0', name: 'Llama 3.1 8B Instruct (Bedrock)', contextWindow: 128000, inputPricePerMToken: 0.22, outputPricePerMToken: 0.22, supportsVision: false, supportsToolCalling: true },
  { id: 'mistral.mistral-large-2407-v1:0', name: 'Mistral Large (Bedrock)', contextWindow: 128000, inputPricePerMToken: 2.00, outputPricePerMToken: 6.00, supportsVision: false, supportsToolCalling: true },
];

export class AWSBedrockProvider implements LLMProvider {
  readonly name = 'aws-bedrock';
  readonly displayName = 'AWS Bedrock';
  private client: BedrockRuntimeClient;

  constructor(config: ProviderConfig) {
    const region = (config.options?.region as string) || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
    const accessKeyId = (config.options?.accessKeyId as string) || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = (config.options?.secretAccessKey as string) || process.env.AWS_SECRET_ACCESS_KEY;

    if (!region) {
      throw new ProviderError(
        'AWS region is required. Set it via config.options.region or AWS_REGION environment variable.',
        'aws-bedrock',
      );
    }

    // Build client config; credentials are optional (falls back to default credential chain)
    const clientConfig: Record<string, unknown> = { region };
    if (accessKeyId && secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId,
        secretAccessKey,
        ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {}),
      };
    }

    this.client = new BedrockRuntimeClient(clientConfig);
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    try {
      const { system, messages } = this.formatMessages(request);
      const toolConfig = request.tools ? this.formatToolConfig(request.tools) : undefined;

      const command = new ConverseCommand({
        modelId: request.model || 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        system,
        messages,
        inferenceConfig: {
          temperature: request.temperature,
          maxTokens: request.maxTokens || 8192,
          stopSequences: request.stopSequences,
        },
        toolConfig,
      });

      const response = await this.client.send(command);

      let content = '';
      const toolCalls: ToolCallResponse[] = [];

      for (const block of response.output?.message?.content || []) {
        if (block.text) {
          content += block.text;
        } else if (block.toolUse) {
          toolCalls.push({
            id: block.toolUse.toolUseId || '',
            name: block.toolUse.name || '',
            arguments: (block.toolUse.input || {}) as Record<string, unknown>,
          });
        }
      }

      const inputTokens = response.usage?.inputTokens || 0;
      const outputTokens = response.usage?.outputTokens || 0;

      return {
        content,
        toolCalls,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        model: request.model || 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        finishReason: response.stopReason === 'tool_use' ? 'tool_calls'
          : response.stopReason === 'max_tokens' ? 'length'
          : 'stop',
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *stream(request: GenerateRequest): AsyncGenerator<StreamChunk> {
    try {
      const { system, messages } = this.formatMessages(request);

      const command = new ConverseStreamCommand({
        modelId: request.model || 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        system,
        messages,
        inferenceConfig: {
          temperature: request.temperature,
          maxTokens: request.maxTokens || 8192,
          stopSequences: request.stopSequences,
        },
      });

      const response = await this.client.send(command);

      if (response.stream) {
        for await (const event of response.stream) {
          if (event.contentBlockDelta?.delta?.text) {
            yield { type: 'text_delta', content: event.contentBlockDelta.delta.text };
          }
          if (event.metadata?.usage) {
            yield {
              type: 'usage',
              usage: {
                inputTokens: event.metadata.usage.inputTokens || 0,
                outputTokens: event.metadata.usage.outputTokens || 0,
                totalTokens: (event.metadata.usage.inputTokens || 0) + (event.metadata.usage.outputTokens || 0),
              },
            };
          }
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
      const { system, messages } = this.formatMessages(request);
      const toolConfig = request.tools ? this.formatToolConfig(request.tools) : undefined;

      const command = new ConverseStreamCommand({
        modelId: request.model || 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        system,
        messages,
        inferenceConfig: {
          temperature: request.temperature,
          maxTokens: request.maxTokens || 8192,
          stopSequences: request.stopSequences,
        },
        toolConfig,
      });

      const response = await this.client.send(command);

      let currentToolId = '';
      let currentToolName = '';
      let toolInputJson = '';

      if (response.stream) {
        for await (const event of response.stream) {
          if (event.contentBlockDelta?.delta?.text) {
            yield { type: 'text_delta', content: event.contentBlockDelta.delta.text };
          }

          if (event.contentBlockStart?.start?.toolUse) {
            currentToolId = event.contentBlockStart.start.toolUse.toolUseId || '';
            currentToolName = event.contentBlockStart.start.toolUse.name || '';
            toolInputJson = '';
            yield {
              type: 'tool_call_start',
              toolCall: { id: currentToolId, name: currentToolName },
            };
          }

          if (event.contentBlockDelta?.delta?.toolUse?.input) {
            const inputChunk = event.contentBlockDelta.delta.toolUse.input;
            toolInputJson += inputChunk;
            yield { type: 'tool_call_delta', content: inputChunk };
          }

          if (event.contentBlockStop && currentToolId) {
            let parsedArgs: Record<string, unknown> = {};
            try {
              parsedArgs = toolInputJson ? JSON.parse(toolInputJson) : {};
            } catch {
              parsedArgs = {};
            }
            yield {
              type: 'tool_call_end',
              toolCall: {
                id: currentToolId,
                name: currentToolName,
                arguments: parsedArgs,
              },
            };
            currentToolId = '';
            currentToolName = '';
            toolInputJson = '';
          }

          if (event.metadata?.usage) {
            yield {
              type: 'usage',
              usage: {
                inputTokens: event.metadata.usage.inputTokens || 0,
                outputTokens: event.metadata.usage.outputTokens || 0,
                totalTokens: (event.metadata.usage.inputTokens || 0) + (event.metadata.usage.outputTokens || 0),
              },
            };
          }
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
      jsonMode: false,
      maxContextWindow: 300000,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    return BEDROCK_MODELS;
  }

  async validateApiKey(): Promise<boolean> {
    try {
      // Send a minimal request to verify credentials
      const command = new ConverseCommand({
        modelId: 'amazon.nova-micro-v1:0',
        messages: [{
          role: 'user' as ConversationRole,
          content: [{ text: 'hi' }],
        }],
        inferenceConfig: { maxTokens: 1 },
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  private formatMessages(request: GenerateRequest): {
    system: SystemContentBlock[] | undefined;
    messages: BedrockMessage[];
  } {
    let systemText = request.systemPrompt || '';
    const messages: BedrockMessage[] = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        systemText = (systemText ? systemText + '\n\n' : '') + msg.content;
      } else if (msg.role === 'user') {
        messages.push({
          role: 'user' as ConversationRole,
          content: [{ text: msg.content }],
        });
      } else if (msg.role === 'assistant') {
        const contentBlocks: ContentBlock[] = [];
        if (msg.content) {
          contentBlocks.push({ text: msg.content });
        }
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          for (const tc of msg.toolCalls) {
            contentBlocks.push({
              toolUse: {
                toolUseId: tc.id,
                name: tc.name,
                input: tc.arguments as unknown as ContentBlock.ToolUseMember['toolUse']['input'],
              },
            });
          }
        }
        if (contentBlocks.length > 0) {
          messages.push({
            role: 'assistant' as ConversationRole,
            content: contentBlocks,
          });
        }
      } else if (msg.role === 'tool') {
        messages.push({
          role: 'user' as ConversationRole,
          content: [{
            toolResult: {
              toolUseId: msg.toolCallId || '',
              content: [{ text: msg.content }],
            },
          }],
        });
      }
    }

    const system: SystemContentBlock[] | undefined = systemText
      ? [{ text: systemText }]
      : undefined;

    return { system, messages };
  }

  private formatToolConfig(tools: ToolDefinition[]): ToolConfiguration | undefined {
    if (!tools || tools.length === 0) return undefined;
    return {
      tools: tools.map((tool) => ({
        toolSpec: {
          name: tool.name,
          description: tool.description,
          inputSchema: {
            json: tool.parameters,
          } as { json: unknown },
        },
      })) as ToolConfiguration['tools'],
    };
  }

  private handleError(error: unknown): ProviderError {
    if (error instanceof Error) {
      const awsError = error as Error & { $metadata?: { httpStatusCode?: number }; name?: string };
      return new ProviderError(
        error.message,
        'aws-bedrock',
        awsError.$metadata?.httpStatusCode,
        { type: awsError.name },
      );
    }
    return new ProviderError(String(error), 'aws-bedrock');
  }
}

registerProvider('aws-bedrock', (config) => new AWSBedrockProvider(config));
