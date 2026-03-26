import { resolve } from 'node:path';
import type { Tool, ToolContext, ToolResult } from '@fridaycode/shared';

interface GlobInput {
  pattern: string;
  cwd?: string;
  ignore?: string[];
}

export const globTool: Tool = {
  definition: {
    name: 'Glob',
    description:
      'Find files matching a glob pattern. Returns matching file paths relative to the working directory. ' +
      'Useful for discovering files by name pattern.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern (e.g., "**/*.ts", "src/**/*.{js,jsx}").',
        },
        cwd: {
          type: 'string',
          description: 'Directory to search from. Defaults to working directory.',
        },
        ignore: {
          type: 'array',
          items: { type: 'string' },
          description: 'Patterns to exclude (default: node_modules, .git, dist).',
        },
      },
      required: ['pattern'],
    },
    requiresPermission: false,
    isReadOnly: true,
  },

  async execute(raw: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = raw as unknown as GlobInput;
    const cwd = input.cwd ? resolve(context.workingDir, input.cwd) : context.workingDir;
    const ignore = input.ignore ?? ['**/node_modules/**', '**/.git/**', '**/dist/**'];

    try {
      const fg = await import('fast-glob');
      const files = await fg.default(input.pattern, {
        cwd,
        ignore,
        dot: false,
        onlyFiles: true,
        followSymbolicLinks: false,
      });

      if (files.length === 0) {
        return {
          toolCallId: '',
          content: `No files matched pattern: ${input.pattern}`,
          isError: false,
        };
      }

      // Limit output size
      const maxFiles = 500;
      const truncated = files.length > maxFiles;
      const listed = files.slice(0, maxFiles).join('\n');
      const suffix = truncated ? `\n\n... and ${files.length - maxFiles} more files` : '';

      return {
        toolCallId: '',
        content: `Found ${files.length} file(s):\n${listed}${suffix}`,
        isError: false,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolCallId: '', content: `Glob search failed: ${msg}`, isError: true };
    }
  },
};
