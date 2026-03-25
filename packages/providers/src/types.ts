export interface LLMProvider {
  readonly name: string;
  readonly displayName: string;

  generate(request: GenerateRequest): Promise<GenerateResponse>;
  stream(request: GenerateRequest): AsyncGenerator<StreamChunk>;
  generateWithTools(request: GenerateRequest): Promise<GenerateResponse>;
  streamWithTools(request: GenerateRequest): AsyncGenerator<StreamChunk>;
  capabilities(): ProviderCapabilities;
  listModels(): Promise<ModelInfo[]>;
  validateApiKey(): Promise<boolean>;
}

export interface GenerateRequest {
  messages: Message[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stopSequences?: string[];
  tools?: ToolDefinition[];
  responseFormat?: 'text' | 'json';
}

export interface GenerateResponse {
  content: string;
  toolCalls: ToolCallResponse[];
  usage: TokenUsage;
  model: string;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

export interface ToolCallResponse {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface StreamChunk {
  type: 'text_delta' | 'tool_call_start' | 'tool_call_delta' | 'tool_call_end' | 'usage' | 'done' | 'error';
  content?: string;
  toolCall?: Partial<ToolCallResponse>;
  usage?: TokenUsage;
  error?: string;
}

export interface ProviderCapabilities {
  streaming: boolean;
  toolCalling: boolean;
  vision: boolean;
  embeddings: boolean;
  jsonMode: boolean;
  maxContextWindow: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  inputPricePerMToken: number;
  outputPricePerMToken: number;
  supportsVision: boolean;
  supportsToolCalling: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCallResponse[];
}

export interface ProviderConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  options?: Record<string, unknown>;
}
