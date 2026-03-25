import path from 'node:path';
import fg from 'fast-glob';
import type { Tool, ToolContext, ToolResult } from '../types.js';

export const globTool: Tool = {
  name: 'glob',
  description: 'Find files matching a glob pattern. Returns a list of matching file paths.',
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Glob pattern (e.g., "**/*.ts", "src/**/*.test.js")',
      },
      cwd: {
        type: 'string',
        description: 'Directory to search from (relative to workspace root)',
      },
    },
    required: ['pattern'],
  },

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const pattern = args.pattern as string;
    if (!pattern) {
      return { success: false, output: 'Missing required parameter: pattern' };
    }

    const cwdArg = args.cwd as string | undefined;
    const cwd = cwdArg
      ? path.resolve(context.workspaceRoot, cwdArg)
      : context.workspaceRoot;

    try {
      const files = await fg(pattern, {
        cwd,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
        onlyFiles: true,
        suppressErrors: true,
      });

      if (files.length === 0) {
        return {
          success: true,
          output: `No files found matching pattern "${pattern}"`,
          metadata: { pattern, count: 0 },
        };
      }

      return {
        success: true,
        output: files.join('\n'),
        metadata: { pattern, count: files.length },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, output: `Glob failed: ${message}` };
    }
  },
};
