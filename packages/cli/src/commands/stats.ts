import type { SlashCommand, CommandContext, CommandResult } from './types.js';

export const statsCommand: SlashCommand = {
  name: 'stats',
  aliases: ['usage'],
  description: 'Show session statistics and token usage',

  async execute(_args: string[], context: CommandContext): Promise<CommandResult> {
    const cost = context.getCostSummary();
    const history = context.getHistory();
    const userMsgs = history.filter((m) => m.role === 'user').length;
    const assistantMsgs = history.filter((m) => m.role === 'assistant').length;
    const toolMsgs = history.filter((m) => m.role === 'tool').length;
    const totalChars = history.reduce((sum, m) => sum + m.content.length, 0);

    const lines = [
      'Session Statistics',
      '',
      `Provider:  ${context.currentProvider}`,
      `Model:     ${context.currentModel}`,
      `Mode:      ${context.currentMode}`,
      `Session:   ${context.sessionId}`,
      '',
      'Messages:',
      `  User:      ${userMsgs}`,
      `  Assistant: ${assistantMsgs}`,
      `  Tool:      ${toolMsgs}`,
      `  Total:     ${history.length}`,
      '',
      'Tokens:',
      `  Input:     ${cost.inputTokens.toLocaleString()}`,
      `  Output:    ${cost.outputTokens.toLocaleString()}`,
      `  Total:     ${(cost.inputTokens + cost.outputTokens).toLocaleString()}`,
      '',
      `Cost:        $${cost.totalCost.toFixed(4)}`,
      `Context:     ~${Math.round(totalChars / 4).toLocaleString()} tokens used`,
    ];

    return { output: lines.join('\n'), type: 'info' };
  },
};
