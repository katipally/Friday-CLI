import type { SlashCommand, CommandContext, CommandResult } from './types.js';

export const costCommand: SlashCommand = {
  name: 'cost',
  description: 'Show token usage and estimated cost for current session',

  async execute(_args: string[], context: CommandContext): Promise<CommandResult> {
    const summary = context.getCostSummary();

    const lines = [
      'Session Usage:',
      `  Provider:      ${context.currentProvider}`,
      `  Model:         ${context.currentModel}`,
      `  Input tokens:  ${summary.inputTokens.toLocaleString()}`,
      `  Output tokens: ${summary.outputTokens.toLocaleString()}`,
      `  Total tokens:  ${(summary.inputTokens + summary.outputTokens).toLocaleString()}`,
      `  Est. cost:     $${summary.totalCost.toFixed(4)}`,
    ];

    return { output: lines.join('\n'), type: 'table' };
  },
};
