import type { Message } from '@anthropic-ai/friday-shared';

export interface SlashCommand {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  execute(args: string[], context: CommandContext): Promise<CommandResult>;
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
  getCostSummary: () => { totalCost: number; inputTokens: number; outputTokens: number };
}

export interface CommandResult {
  output: string;
  type: 'info' | 'success' | 'error' | 'table';
  exit?: boolean;
}
