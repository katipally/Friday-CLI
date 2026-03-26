import { simpleGit } from 'simple-git';
import type { Tool, ToolContext, ToolResult } from '../types.js';

export const gitCheckoutTool: Tool = {
  name: 'git_checkout',
  description:
    'Switch branches, create new branches, or restore files. Provide a branch/commit as the target.',
  parameters: {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        description: 'Branch name or commit hash to check out',
      },
      create: {
        type: 'boolean',
        description: 'If true, create a new branch with the given target name',
      },
      files: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Specific files to checkout from the target, leaving the current branch unchanged',
      },
    },
    required: ['target'],
  },

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const target = args.target as string;
    if (!target) {
      return { success: false, output: 'Missing required parameter: target' };
    }

    const create = args.create as boolean | undefined;
    const files = args.files as string[] | undefined;
    const git = simpleGit(context.workspaceRoot);

    try {
      let output = '';

      if (files && files.length > 0) {
        // Checkout specific files from a target ref
        await git.checkout([target, '--', ...files]);
        output = `Checked out ${files.length} file(s) from ${target}: ${files.join(', ')}`;
      } else if (create) {
        // Create and switch to a new branch
        await git.checkoutLocalBranch(target);
        output = `Created and switched to new branch: ${target}`;
      } else {
        // Switch to existing branch or commit
        await git.checkout(target);
        output = `Switched to: ${target}`;
      }

      return {
        success: true,
        output,
        metadata: { target, create: !!create },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, output: `git checkout failed: ${msg}` };
    }
  },
};
