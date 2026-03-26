import type { SlashCommand, CommandContext, CommandResult } from './types.js';
import { execSync } from 'node:child_process';

export const diffCommand: SlashCommand = {
  name: 'diff',
  aliases: ['changes'],
  description: 'Show recent Git changes in the workspace',
  usage: '/diff [staged|file]',

  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    const cwd = context.workspacePath;
    const sub = args[0]?.toLowerCase();

    try {
      let diff: string;
      let label: string;

      if (sub === 'staged') {
        diff = execSync('git diff --cached --stat', { encoding: 'utf8', cwd, timeout: 10000 });
        label = 'Staged changes';
      } else if (sub && sub !== 'staged') {
        diff = execSync(`git diff -- ${sub}`, { encoding: 'utf8', cwd, timeout: 10000 });
        label = `Changes in ${sub}`;
      } else {
        diff = execSync('git diff --stat', { encoding: 'utf8', cwd, timeout: 10000 });
        label = 'Unstaged changes';
      }

      if (!diff.trim()) {
        return { output: `${label}: no changes.`, type: 'info' };
      }

      return { output: `${label}:\n${diff.trim()}`, type: 'info' };
    } catch (err) {
      return {
        output: `Git error: ${(err as Error).message}`,
        type: 'error',
      };
    }
  },
};
