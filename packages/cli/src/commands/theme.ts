import type { SlashCommand, CommandResult } from './types.js';

// Dynamic import to avoid coupling TUI into CLI commands directly
let setThemeFn: ((name: string) => void) | null = null;
let getThemeNameFn: (() => string) | null = null;

export function wireThemeFunctions(
  setTheme: (name: string) => void,
  getThemeName: () => string,
): void {
  setThemeFn = setTheme;
  getThemeNameFn = getThemeName;
}

const THEMES = ['dark', 'light', 'monokai'];

export const themeCommand: SlashCommand = {
  name: 'theme',
  description: 'Switch terminal color theme',
  usage: '/theme [dark|light|monokai]',

  async execute(args: string[]): Promise<CommandResult> {
    if (!setThemeFn || !getThemeNameFn) {
      return { output: 'Theme system not available.', type: 'error' };
    }

    if (args.length === 0) {
      const current = getThemeNameFn();
      return {
        output: `Current theme: ${current}\nAvailable: ${THEMES.join(', ')}`,
        type: 'info',
      };
    }

    const requested = args[0].toLowerCase();
    if (!THEMES.includes(requested)) {
      return {
        output: `Unknown theme "${requested}". Available: ${THEMES.join(', ')}`,
        type: 'error',
      };
    }

    setThemeFn(requested);
    return {
      output: `Theme switched to "${requested}".`,
      type: 'success',
    };
  },
};
