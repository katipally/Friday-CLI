import type { SlashCommand, CommandContext, CommandResult } from './types.js';

export const compactCommand: SlashCommand = {
  name: 'compact',
  description: 'Summarize conversation history to free up context',

  async execute(_args: string[], context: CommandContext): Promise<CommandResult> {
    const history = context.getHistory();
    if (history.length === 0) {
      return {
        output: 'No conversation history to compact.',
        type: 'info',
      };
    }

    const userMessages = history.filter(m => m.role === 'user').length;
    const assistantMessages = history.filter(m => m.role === 'assistant').length;
    const totalChars = history.reduce((sum, m) => sum + m.content.length, 0);

    context.clearHistory();

    return {
      output: [
        'Conversation compacted.',
        `  Removed ${history.length} messages (${userMessages} user, ${assistantMessages} assistant)`,
        `  Freed ~${Math.round(totalChars / 4)} tokens`,
      ].join('\n'),
      type: 'success',
    };
  },
};
