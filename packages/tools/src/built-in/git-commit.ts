import { simpleGit } from 'simple-git';
import type { Tool, ToolContext, ToolResult } from '../types.js';

export const gitCommitTool: Tool = {
  name: 'git_commit',
  description:
    'Stage files and create a git commit. If no files are specified, stages all changes before committing.',
  parameters: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Commit message',
      },
      files: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Specific files to stage before committing. If omitted, all changes are staged.',
      },
    },
    required: ['message'],
  },

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const message = args.message as string;
    if (!message) {
      return { success: false, output: 'Missing required parameter: message' };
    }

    const files = args.files as string[] | undefined;
    const git = simpleGit(context.workspaceRoot);

    try {
      // Stage files
      if (files && files.length > 0) {
        await git.add(files);
      } else {
        await git.add('-A');
      }

      // Commit
      const result = await git.commit(message);

      if (!result.commit) {
        return { success: false, output: 'Nothing to commit (working tree clean)' };
      }

      const output = [
        `Commit: ${result.commit}`,
        `Summary: ${result.summary.changes} file(s) changed, ${result.summary.insertions} insertion(s), ${result.summary.deletions} deletion(s)`,
      ].join('\n');

      return {
        success: true,
        output,
        metadata: { commit: result.commit, summary: result.summary },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, output: `git commit failed: ${msg}` };
    }
  },
};
