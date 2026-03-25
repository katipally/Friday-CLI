import type { SlashCommand, CommandContext, CommandResult } from './types.js';

export const historyCommand: SlashCommand = {
  name: 'history',
  description: 'Show recent conversation messages in this session',

  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    const history = context.getHistory();
    if (history.length === 0) {
      return { output: 'No conversation history yet.', type: 'info' };
    }

    const limit = args.length > 0 ? parseInt(args[0], 10) : 10;
    const count = Number.isNaN(limit) ? 10 : Math.min(limit, history.length);
    const recent = history.slice(-count);

    const lines = recent.map((msg, i) => {
      const role = msg.role.padEnd(9);
      const preview = msg.content.length > 80
        ? msg.content.slice(0, 77).replace(/\n/g, ' ') + '...'
        : msg.content.replace(/\n/g, ' ');
      return `  ${history.length - count + i + 1}. [${role}] ${preview}`;
    });

    const header = count < history.length
      ? `Showing last ${count} of ${history.length} messages:`
      : `All ${history.length} messages:`;

    return { output: [header, '', ...lines].join('\n'), type: 'info' };
  },
};
