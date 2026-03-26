import type { SlashCommand, CommandContext, CommandResult } from './types.js';

const VALID_MODES = ['agent', 'chat', 'plan'] as const;

const MODE_DESCRIPTIONS: Record<string, string> = {
  agent: 'Full AI coding agent — file access, shell, git, tools',
  chat: 'Chat-only mode — no file or command access',
  plan: 'Architect mode — creates plans before implementing',
};

export const modeCommand: SlashCommand = {
  name: 'mode',
  description: 'Show or switch the agent mode',
  usage: '/mode [agent | chat | plan]',

  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    if (args.length === 0) {
      const lines = VALID_MODES.map(m =>
        m === context.currentMode
          ? `  ● ${m} — ${MODE_DESCRIPTIONS[m]} (active)`
          : `    ${m} — ${MODE_DESCRIPTIONS[m]}`,
      );

      return {
        output: ['Agent modes:', ...lines].join('\n'),
        type: 'info',
      };
    }

    const requested = args[0].toLowerCase();
    if (!(VALID_MODES as readonly string[]).includes(requested)) {
      return {
        output: `Unknown mode: "${requested}". Valid: ${VALID_MODES.join(', ')}`,
        type: 'error',
      };
    }

    context.setMode(requested);
    return {
      output: `Switched to ${requested} mode — ${MODE_DESCRIPTIONS[requested]}`,
      type: 'success',
      stateChange: { mode: requested },
    };
  },
};
