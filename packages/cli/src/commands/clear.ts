import type { SlashCommand, CommandContext, CommandResult } from './types.js';

export const clearCommand: SlashCommand = {
  name: 'clear',
  aliases: ['c'],
  description: 'Clear conversation history',

  async execute(_args: string[], context: CommandContext): Promise<CommandResult> {
    context.clearHistory();
    return {
      output: 'Conversation history cleared.',
      type: 'success',
    };
  },
};
