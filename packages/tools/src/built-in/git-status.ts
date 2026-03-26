import { simpleGit } from 'simple-git';
import type { Tool, ToolContext, ToolResult } from '../types.js';

export const gitStatusTool: Tool = {
  name: 'git_status',
  description:
    'Show the current git status including branch, staged, unstaged, and untracked files.',
  parameters: {
    type: 'object',
    properties: {},
  },

  async execute(_args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const git = simpleGit(context.workspaceRoot);

    try {
      const status = await git.status();
      const sections: string[] = [];

      sections.push(`Branch: ${status.current ?? '(detached HEAD)'}`);

      if (status.tracking) {
        const ahead = status.ahead ?? 0;
        const behind = status.behind ?? 0;
        if (ahead || behind) {
          sections.push(`Tracking: ${status.tracking} [ahead ${ahead}, behind ${behind}]`);
        } else {
          sections.push(`Tracking: ${status.tracking} (up to date)`);
        }
      }

      if (status.staged.length > 0) {
        sections.push(`\nStaged:\n  ${status.staged.join('\n  ')}`);
      }

      if (status.modified.length > 0) {
        sections.push(`\nModified (unstaged):\n  ${status.modified.join('\n  ')}`);
      }

      if (status.not_added.length > 0) {
        sections.push(`\nUntracked:\n  ${status.not_added.join('\n  ')}`);
      }

      if (status.deleted.length > 0) {
        sections.push(`\nDeleted:\n  ${status.deleted.join('\n  ')}`);
      }

      if (status.renamed.length > 0) {
        const renames = status.renamed.map((r) => `${r.from} -> ${r.to}`);
        sections.push(`\nRenamed:\n  ${renames.join('\n  ')}`);
      }

      if (status.conflicted.length > 0) {
        sections.push(`\nConflicted:\n  ${status.conflicted.join('\n  ')}`);
      }

      const isClean =
        status.staged.length === 0 &&
        status.modified.length === 0 &&
        status.not_added.length === 0 &&
        status.deleted.length === 0 &&
        status.conflicted.length === 0;

      if (isClean) {
        sections.push('\nWorking tree clean');
      }

      return {
        success: true,
        output: sections.join('\n'),
        metadata: {
          branch: status.current,
          staged: status.staged.length,
          modified: status.modified.length,
          untracked: status.not_added.length,
          isClean,
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, output: `git status failed: ${msg}` };
    }
  },
};
