/**
 * Slash command router — dispatches /commands to handlers.
 */

export interface CommandContext {
  /** Current working directory */
  cwd: string;
  /** Active session ID */
  sessionId?: string;
  /** Current model identifier */
  model: string;
  /** Current provider name */
  provider: string;
  /** Print output to the terminal */
  print: (text: string) => void;
  /** Set model/provider on the app */
  setModel: (model: string) => void;
  setProvider: (provider: string) => void;
  /** Clear conversation */
  clearMessages: () => void;
  /** Trigger exit */
  exit: () => void;
  /** Compact conversation context */
  compact: () => Promise<void>;
}

export interface SlashCommand {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  handler: (args: string, ctx: CommandContext) => Promise<void> | void;
}

const commands = new Map<string, SlashCommand>();

/**
 * Register a slash command.
 */
export function registerCommand(cmd: SlashCommand): void {
  commands.set(cmd.name, cmd);
  if (cmd.aliases) {
    for (const alias of cmd.aliases) {
      commands.set(alias, cmd);
    }
  }
}

/**
 * Parse and execute a slash command.
 * Returns true if the input was a command; false otherwise.
 */
export async function executeCommand(input: string, ctx: CommandContext): Promise<boolean> {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return false;

  const spaceIndex = trimmed.indexOf(' ');
  const name = spaceIndex >= 0 ? trimmed.slice(0, spaceIndex) : trimmed;
  const args = spaceIndex >= 0 ? trimmed.slice(spaceIndex + 1).trim() : '';

  const cmd = commands.get(name);
  if (!cmd) {
    ctx.print(`Unknown command: ${name}. Type /help for available commands.`);
    return true;
  }

  try {
    await cmd.handler(args, ctx);
  } catch (err: any) {
    ctx.print(`Command error: ${err.message}`);
  }

  return true;
}

/**
 * List all registered commands.
 */
export function listCommands(): SlashCommand[] {
  const unique = new Map<string, SlashCommand>();
  for (const cmd of commands.values()) {
    unique.set(cmd.name, cmd);
  }
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getCommand(name: string): SlashCommand | undefined {
  return commands.get(name);
}
