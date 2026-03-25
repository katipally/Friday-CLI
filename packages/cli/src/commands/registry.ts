import type { SlashCommand, CommandContext, CommandResult } from './types.js';

export class CommandRegistry {
  private commands: Map<string, SlashCommand> = new Map();
  private aliases: Map<string, string> = new Map();

  register(command: SlashCommand): void {
    this.commands.set(command.name, command);
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.set(alias, command.name);
      }
    }
  }

  get(nameOrAlias: string): SlashCommand | undefined {
    const name = this.aliases.get(nameOrAlias) ?? nameOrAlias;
    return this.commands.get(name);
  }

  getAll(): SlashCommand[] {
    return Array.from(this.commands.values());
  }

  parse(input: string): { command: string; args: string[] } | null {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) {
      return null;
    }

    const parts = trimmed.slice(1).split(/\s+/);
    const command = parts[0]?.toLowerCase();
    if (!command) {
      return null;
    }

    const args = parts.slice(1);
    return { command, args };
  }

  async execute(input: string, context: CommandContext): Promise<CommandResult | null> {
    const parsed = this.parse(input);
    if (!parsed) {
      return null;
    }

    const command = this.get(parsed.command);
    if (!command) {
      return {
        output: `Unknown command: /${parsed.command}. Type /help for available commands.`,
        type: 'error',
      };
    }

    return command.execute(parsed.args, context);
  }
}
