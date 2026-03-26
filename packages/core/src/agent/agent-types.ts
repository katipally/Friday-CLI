import type { ToolCall, ToolResult, CostEntry, Message } from '@fridaycode/shared';
import type { ToolDefinition, TokenUsage } from '@fridaycode/providers';

export type AgentState = 'IDLE' | 'THINKING' | 'ACTING' | 'OBSERVING' | 'TERMINATED' | 'ERROR';

export type AgentMode = 'code' | 'chat' | 'review' | 'plan' | 'debug';

export interface AgentConfig {
  provider: string;
  model: string;
  mode: AgentMode;
  maxIterations: number;
  systemPrompt?: string;
  projectRules?: string;
  temperature?: number;
  maxTokens?: number;
}

export type AgentEvent =
  | { type: 'state_change'; from: AgentState; to: AgentState }
  | { type: 'thinking'; content: string }
  | { type: 'text_delta'; content: string }
  | { type: 'tool_start'; toolCall: ToolCall }
  | { type: 'tool_result'; toolCall: ToolCall; result: ToolResult }
  | { type: 'permission_request'; toolCall: ToolCall; reason: string; respond: (choice: 'allow_once' | 'allow_always' | 'deny') => void }
  | { type: 'permission_granted'; toolCall: ToolCall }
  | { type: 'permission_denied'; toolCall: ToolCall; reason: string }
  | { type: 'response'; content: string }
  | { type: 'error'; error: Error }
  | { type: 'cost_update'; entry: CostEntry }
  | { type: 'context_summarized'; summary: string }
  | { type: 'iteration'; current: number; max: number }
  | { type: 'done'; usage: TokenUsage };

export interface AgentToolRegistry {
  getToolDefinitions(): ToolDefinition[];
  execute(name: string, args: Record<string, unknown>): Promise<ToolResult>;
  hasTool(name: string): boolean;
}
