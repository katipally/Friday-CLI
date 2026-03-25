import { simpleGit } from 'simple-git';
import type { Tool, ToolContext, ToolResult } from '../types.js';

const ALLOWED_COMMANDS = new Set([
  'status', 'diff', 'log', 'branch', 'add', 'commit', 'stash',
]);

export const gitTool: Tool = {
  name: 'git',
  description: 'Run git operations. Supported commands: status, diff, log, branch, add, commit, stash.',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Git command to run',
        enum: ['status', 'diff', 'log', 'branch', 'add', 'commit', 'stash'],
      },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Files to stage (for "add" command)',
      },
      message: {
        type: 'string',
        description: 'Commit message (for "commit" command)',
      },
      maxCount: {
        type: 'number',
        description: 'Maximum number of log entries to return (default: 10)',
      },
    },
    required: ['command'],
  },

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const command = args.command as string;
    if (!command || !ALLOWED_COMMANDS.has(command)) {
      return {
        success: false,
        output: `Invalid git command: "${command}". Allowed: ${[...ALLOWED_COMMANDS].join(', ')}`,
      };
    }

    const git = simpleGit(context.workspaceRoot);

    try {
      let output = '';

      switch (command) {
        case 'status': {
          const status = await git.status();
          const lines: string[] = [];
          if (status.staged.length > 0) lines.push(`Staged:\n  ${status.staged.join('\n  ')}`);
          if (status.modified.length > 0) lines.push(`Modified:\n  ${status.modified.join('\n  ')}`);
          if (status.not_added.length > 0) lines.push(`Untracked:\n  ${status.not_added.join('\n  ')}`);
          if (status.deleted.length > 0) lines.push(`Deleted:\n  ${status.deleted.join('\n  ')}`);
          if (status.conflicted.length > 0) lines.push(`Conflicted:\n  ${status.conflicted.join('\n  ')}`);
          output = lines.length > 0
            ? `Branch: ${status.current}\n${lines.join('\n')}`
            : `Branch: ${status.current}\nClean working tree`;
          break;
        }

        case 'diff': {
          output = await git.diff();
          if (!output) output = 'No unstaged changes';
          break;
        }

        case 'log': {
          const maxCount = typeof args.maxCount === 'number' ? args.maxCount : 10;
          const log = await git.log({ maxCount });
          output = log.all
            .map((entry) => `${entry.hash.substring(0, 8)} ${entry.date} ${entry.author_name}: ${entry.message}`)
            .join('\n');
          if (!output) output = 'No commits found';
          break;
        }

        case 'branch': {
          const branches = await git.branchLocal();
          output = branches.all
            .map((b) => `${b === branches.current ? '* ' : '  '}${b}`)
            .join('\n');
          break;
        }

        case 'add': {
          const files = args.files as string[] | undefined;
          if (!files || files.length === 0) {
            return { success: false, output: 'Missing required parameter: files (array of file paths)' };
          }
          await git.add(files);
          output = `Staged: ${files.join(', ')}`;
          break;
        }

        case 'commit': {
          const message = args.message as string;
          if (!message) {
            return { success: false, output: 'Missing required parameter: message' };
          }
          const result = await git.commit(message);
          output = `Committed: ${result.commit} (${result.summary.changes} changes, ${result.summary.insertions} insertions, ${result.summary.deletions} deletions)`;
          break;
        }

        case 'stash': {
          const result = await git.stash();
          output = result || 'Stash applied';
          break;
        }
      }

      return {
        success: true,
        output,
        metadata: { command },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, output: `Git ${command} failed: ${message}` };
    }
  },
};
