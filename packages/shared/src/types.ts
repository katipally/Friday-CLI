export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}

export interface StreamChunk {
  type: 'text' | 'tool_call_start' | 'tool_call_delta' | 'tool_call_end' | 'done';
  content?: string;
  toolCall?: Partial<ToolCall>;
}

export interface CostEntry {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  totalSessionCost: number;
  timestamp: Date;
}

export interface SessionInfo {
  id: string;
  projectPath: string;
  startedAt: Date;
  lastActiveAt: Date;
  messageCount: number;
  totalCost: number;
  model: string;
  provider: string;
}
