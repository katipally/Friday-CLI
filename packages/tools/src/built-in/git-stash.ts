import { simpleGit } from 'simple-git';
import type { Tool, ToolContext, ToolResult } from '../types.js';

const ALLOWED_ACTIONS = new Set(['push', 'pop', 'list', 'drop']);

export const gitStashTool: Tool = {
  name: 'git_stash',
  description: 'Manage git stash: push, pop, list, or drop stashed changes.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Stash action to perform',
        enum: ['push', 'pop', 'list', 'drop'],
      },
      message: {
        type: 'string',
        description: 'Optional message for the stash (only used with "push")',
      },
    },
    required: ['action'],
  },

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const action = args.action as string;
    if (!action || !ALLOWED_ACTIONS.has(action)) {
      return {
        success: false,
        output: `Invalid stash action: "${action}". Allowed: ${[...ALLOWED_ACTIONS].join(', ')}`,
      };
    }

    const git = simpleGit(context.workspaceRoot);

    try {
      let output = '';

      switch (action) {
        case 'push': {
          const message = args.message as string | undefined;
          const stashArgs = ['push'];
          if (message) {
            stashArgs.push('-m', message);
          }
          output = await git.stash(stashArgs);
          if (!output) output = 'Changes stashed successfully';
          break;
        }

        case 'pop': {
          output = await git.stash(['pop']);
          if (!output) output = 'Stash popped successfully';
          break;
        }

        case 'list': {
          output = await git.stash(['list']);
          if (!output) output = 'No stashes found';
          break;
        }

        case 'drop': {
          output = await git.stash(['drop']);
          if (!output) output = 'Stash dropped successfully';
          break;
        }
      }

      return {
        success: true,
        output,
        metadata: { action },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, output: `git stash ${action} failed: ${msg}` };
    }
  },
};
