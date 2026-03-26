import type { SlashCommand, CommandContext, CommandResult } from './types.js';

const VALID_MODES = ['code', 'chat', 'review', 'plan', 'debug'] as const;

const MODE_DESCRIPTIONS: Record<string, string> = {
  code: 'AI coding assistant with full file and shell access',
  chat: 'Chat-only mode — no file or command access',
  review: 'Code reviewer — read-only analysis of your codebase',
  plan: 'Software architect — creates implementation plans before coding',
  debug: 'Expert debugger — methodical diagnosis and fixes',
};

export const modeCommand: SlashCommand = {
  name: 'mode',
  description: 'Show or switch the agent mode',
  usage: '/mode [code | chat | review | plan | debug]',

  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    if (args.length === 0) {
      const lines = VALID_MODES.map(m =>
        m === context.currentMode
          ? `  * ${m} — ${MODE_DESCRIPTIONS[m]} (current)`
          : `    ${m} — ${MODE_DESCRIPTIONS[m]}`,
      );

      return {
        output: ['Agent modes:', '', ...lines].join('\n'),
        type: 'info',
      };
    }

    const requested = args[0].toLowerCase();
    if (!(VALID_MODES as readonly string[]).includes(requested)) {
      return {
        output: `Unknown mode: "${requested}". Valid modes: ${VALID_MODES.join(', ')}`,
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
