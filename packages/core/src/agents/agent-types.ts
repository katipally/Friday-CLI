/**
 * Sub-Agent type definitions for the FridayCode delegation system.
 *
 * These types are distinct from the main AgentConfig/AgentMode in agent/agent-types.ts.
 * SubAgentConfig defines lightweight, task-specific agents that can be orchestrated
 * by the main agent loop.
 */

export type AgentRole = 'code' | 'review' | 'test' | 'debug' | 'research' | 'refactor' | 'custom';

export interface SubAgentConfig {
  role: AgentRole;
  name: string;
  description: string;
  systemPrompt: string;
  tools?: string[];
  maxTurns?: number;
  maxTokens?: number;
  provider?: string;
  model?: string;
}

export interface AgentTask {
  id: string;
  instruction: string;
  context?: string;
  files?: string[];
  parentAgentId?: string;
}

export interface AgentResult {
  taskId: string;
  agentRole: AgentRole;
  success: boolean;
  output: string;
  toolCalls: number;
  tokensUsed: { input: number; output: number };
  duration: number;
  error?: string;
}
