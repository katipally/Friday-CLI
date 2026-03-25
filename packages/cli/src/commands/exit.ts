import type { SlashCommand, CommandContext, CommandResult } from './types.js';

export const exitCommand: SlashCommand = {
  name: 'exit',
  aliases: ['quit', 'q'],
  description: 'Exit the CLI',

  async execute(_args: string[], _context: CommandContext): Promise<CommandResult> {
    return {
      output: 'Goodbye!',
      type: 'info',
      exit: true,
    };
  },
};
