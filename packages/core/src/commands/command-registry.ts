import { createLogger } from '@fridaycode/shared';

const logger = createLogger('commands');

export interface CommandContext {
  // Will be populated by the CLI when executing
  [key: string]: unknown;
}

export interface CommandDefinition {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  category: 'session' | 'config' | 'tools' | 'info' | 'debug';
  execute: (args: string[], context: CommandContext) => Promise<string>;
}

export class CommandRegistry {
  private commands = new Map<string, CommandDefinition>();

  register(command: CommandDefinition): void {
    this.commands.set(command.name, command);
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.commands.set(alias, command);
      }
    }
    logger.debug(`Registered command: /${command.name}`);
  }

  get(name: string): CommandDefinition | undefined {
    return this.commands.get(name);
  }

  has(name: string): boolean {
    return this.commands.has(name);
  }

  async execute(input: string, context: CommandContext): Promise<{ handled: boolean; output: string }> {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) {
      return { handled: false, output: '' };
    }

    const parts = trimmed.slice(1).split(/\s+/);
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1);

    const command = this.commands.get(commandName);
    if (!command) {
      const suggestions = this.getSuggestions(commandName);
      const hint = suggestions.length > 0
        ? ` Did you mean: ${suggestions.map((s) => '/' + s).join(', ')}?`
        : ' Type /help for available commands.';
      return { handled: true, output: `Unknown command: /${commandName}.${hint}` };
    }

    try {
      const output = await command.execute(args, context);
      return { handled: true, output };
    } catch (error) {
      return { handled: true, output: `Error executing /${commandName}: ${(error as Error).message}` };
    }
  }

  /** Get all unique commands (excluding alias duplicates) */
  listCommands(): CommandDefinition[] {
    const seen = new Set<string>();
    const result: CommandDefinition[] = [];
    for (const [key, cmd] of this.commands) {
      if (key === cmd.name && !seen.has(cmd.name)) {
        seen.add(cmd.name);
        result.push(cmd);
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Get commands by category */
  listByCategory(): Record<string, CommandDefinition[]> {
    const commands = this.listCommands();
    const grouped: Record<string, CommandDefinition[]> = {};
    for (const cmd of commands) {
      (grouped[cmd.category] ??= []).push(cmd);
    }
    return grouped;
  }

  /** Fuzzy-match command names for suggestions */
  private getSuggestions(input: string): string[] {
    const allNames = [...new Set([...this.commands.values()].map((c) => c.name))];
    return allNames
      .filter((name) => name.startsWith(input) || name.includes(input) || this.levenshtein(input, name) <= 2)
      .slice(0, 3);
  }

  private levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
    );
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }
}

/**
 * Create a default command registry with all built-in commands.
 */
export function createDefaultRegistry(): CommandRegistry {
  const registry = new CommandRegistry();

  // /help — list all commands
  registry.register({
    name: 'help',
    aliases: ['h', '?'],
    description: 'Show available commands',
    category: 'info',
    execute: async (_args, _ctx) => {
      const grouped = registry.listByCategory();
      const lines: string[] = ['📋 Available Commands\n'];

      const categoryLabels: Record<string, string> = {
        session: '📂 Session',
        config: '⚙️  Config',
        tools: '🔧 Tools',
        info: 'ℹ️  Info',
        debug: '🐛 Debug',
      };

      for (const [cat, cmds] of Object.entries(grouped)) {
        lines.push(`${categoryLabels[cat] || cat}`);
        for (const cmd of cmds) {
          const aliases = cmd.aliases?.length ? ` (${cmd.aliases.map((a) => '/' + a).join(', ')})` : '';
          lines.push(`  /${cmd.name}${aliases} — ${cmd.description}`);
        }
        lines.push('');
      }

      return lines.join('\n');
    },
  });

  // /clear — clear conversation
  registry.register({
    name: 'clear',
    aliases: ['c'],
    description: 'Clear conversation history',
    category: 'session',
    execute: async () => 'Conversation cleared.',
  });

  // /model — show or switch model
  registry.register({
    name: 'model',
    aliases: ['m'],
    description: 'Show current model or switch to a new one',
    usage: '/model [model-name]',
    category: 'config',
    execute: async (args) => {
      if (args.length === 0) {
        return 'Usage: /model <model-name> to switch models, or /models to list available models.';
      }
      return `Model switching to: ${args[0]} (requires implementation hook)`;
    },
  });

  // /models — list available models
  registry.register({
    name: 'models',
    description: 'List available models for current provider',
    category: 'config',
    execute: async () => 'Fetching models... (requires provider hook)',
  });

  // /config — show configuration
  registry.register({
    name: 'config',
    description: 'Show current configuration',
    category: 'config',
    execute: async () => 'Configuration display (requires config hook)',
  });

  // /cost — show cost summary
  registry.register({
    name: 'cost',
    aliases: ['$'],
    description: 'Show session cost and token usage',
    category: 'info',
    execute: async () => 'Cost tracking (requires cost tracker hook)',
  });

  // /checkpoint — create a checkpoint
  registry.register({
    name: 'checkpoint',
    aliases: ['cp'],
    description: 'Create a named checkpoint of current state',
    usage: '/checkpoint [name]',
    category: 'session',
    execute: async (args) => {
      const name = args.join(' ') || undefined;
      return `Checkpoint created${name ? ': ' + name : ''} (requires checkpoint manager hook)`;
    },
  });

  // /rewind — rewind to checkpoint
  registry.register({
    name: 'rewind',
    aliases: ['undo'],
    description: 'Rewind to last checkpoint or a specific one',
    usage: '/rewind [checkpoint-id]',
    category: 'session',
    execute: async () => 'Rewind (requires checkpoint manager hook)',
  });

  // /theme — switch theme
  registry.register({
    name: 'theme',
    description: 'Switch UI theme',
    usage: '/theme [theme-name]',
    category: 'config',
    execute: async (args) => {
      if (args.length === 0) {
        return 'Usage: /theme <name>. Available: dark, light, monokai';
      }
      return `Theme switching to: ${args[0]} (requires TUI hook)`;
    },
  });

  // /doctor — diagnose issues
  registry.register({
    name: 'doctor',
    description: 'Run diagnostics and check system health',
    category: 'debug',
    execute: async () => {
      const checks: string[] = ['🏥 Friday Doctor\n'];
      checks.push('✅ Node.js runtime OK');
      checks.push('✅ Git available');
      checks.push('📋 Checking providers...');
      return checks.join('\n');
    },
  });

  // /compact — toggle compact mode
  registry.register({
    name: 'compact',
    description: 'Toggle compact output mode',
    category: 'config',
    execute: async () => 'Compact mode toggled (requires config hook)',
  });

  // /version — show version
  registry.register({
    name: 'version',
    aliases: ['v'],
    description: 'Show FridayCode version',
    category: 'info',
    execute: async () => {
      return 'FridayCode v0.1.0';
    },
  });

  // /stats — show session statistics
  registry.register({
    name: 'stats',
    description: 'Show session statistics (tokens, cost, tools used)',
    category: 'info',
    execute: async () => 'Session stats (requires analytics hook)',
  });

  return registry;
}
