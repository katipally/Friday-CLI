import type { SlashCommand, CommandContext, CommandResult } from './types.js';

// Injected after registry is created so help can list all commands
let registryRef: { getAll(): SlashCommand[]; get(name: string): SlashCommand | undefined } | null = null;

export function setHelpRegistry(registry: typeof registryRef): void {
  registryRef = registry;
}

export const helpCommand: SlashCommand = {
  name: 'help',
  aliases: ['h', '?'],
  description: 'Show available commands or detailed help for a specific command',
  usage: '/help [command]',

  async execute(args: string[], _context: CommandContext): Promise<CommandResult> {
    if (args.length > 0 && registryRef) {
      const target = registryRef.get(args[0].toLowerCase());
      if (!target) {
        return {
          output: `Unknown command: ${args[0]}. Type /help for available commands.`,
          type: 'error',
        };
      }

      const lines = [
        `/${target.name} — ${target.description}`,
        target.usage ? `Usage: ${target.usage}` : '',
        target.aliases?.length ? `Aliases: ${target.aliases.map(a => `/${a}`).join(', ')}` : '',
      ].filter(Boolean);

      return { output: lines.join('\n'), type: 'info' };
    }

    const commands = registryRef?.getAll() ?? [];
    const maxLen = Math.max(...commands.map(c => c.name.length));
    const lines = commands.map(cmd => {
      const name = `/${cmd.name}`.padEnd(maxLen + 2);
      return `  ${name}  ${cmd.description}`;
    });

    return {
      output: ['Available commands:', '', ...lines, '', 'Type /help <command> for details.'].join('\n'),
      type: 'info',
    };
  },
};
