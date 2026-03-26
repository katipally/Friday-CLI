import type { Message } from '@fridaycode/shared';

export interface SlashCommand {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  execute(args: string[], context: CommandContext): Promise<CommandResult>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolRegistryLike {
  getToolDefinitions(): ToolDefinition[];
}

export interface MCPTool {
  name: string;
  description?: string;
}

export interface MCPClientLike {
  listServers(): string[];
  isConnected(serverName: string): boolean;
  listTools(): Array<{ server: string; tool: MCPTool }>;
  disconnectAll(): Promise<void>;
}

export interface MCPManagerLike {
  getClient(): MCPClientLike;
}

export interface CommandContext {
  currentProvider: string;
  currentModel: string;
  currentMode: string;
  sessionId: string;
  workspacePath: string;

  setProvider: (provider: string) => void;
  setModel: (model: string) => void;
  setMode: (mode: string) => void;
  clearHistory: () => void;
  getHistory: () => Message[];
  setHistory: (messages: Message[]) => void;
  getCostSummary: () => { totalCost: number; inputTokens: number; outputTokens: number };
  listModels?: () => Promise<string[]>;
  completionRequest?: (prompt: string) => Promise<string>;

  toolRegistry?: ToolRegistryLike;
  mcpManager?: MCPManagerLike;
}

export interface CommandResult {
  output: string;
  type: 'info' | 'success' | 'error' | 'table';
  exit?: boolean;
  stateChange?: {
    model?: string;
    provider?: string;
    mode?: string;
  };
}
