import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import type { Tool, ToolContext, ToolResult } from '../types.js';

export const grepTool: Tool = {
  name: 'grep',
  description: 'Search file contents for a pattern. Returns matching lines with file path and line number.',
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Regular expression pattern to search for',
      },
      path: {
        type: 'string',
        description: 'Directory or file to search in (relative to workspace, defaults to workspace root)',
      },
      glob: {
        type: 'string',
        description: 'Glob pattern to filter files (e.g., "*.ts", "**/*.js")',
      },
      ignoreCase: {
        type: 'boolean',
        description: 'Case-insensitive search (default: false)',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of matching lines to return (default: 100)',
      },
    },
    required: ['pattern'],
  },

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const pattern = args.pattern as string;
    if (!pattern) {
      return { success: false, output: 'Missing required parameter: pattern' };
    }

    const ignoreCase = args.ignoreCase === true;
    const maxResults = typeof args.maxResults === 'number' ? args.maxResults : 100;
    const searchPath = args.path
      ? path.resolve(context.workspaceRoot, args.path as string)
      : context.workspaceRoot;
    const globPattern = (args.glob as string) || '**/*';

    let regex: RegExp;
    try {
      regex = new RegExp(pattern, ignoreCase ? 'i' : '');
    } catch {
      return { success: false, output: `Invalid regex pattern: ${pattern}` };
    }

    try {
      const files = await fg(globPattern, {
        cwd: searchPath,
        absolute: true,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
        onlyFiles: true,
        suppressErrors: true,
      });

      const results: string[] = [];
      let totalMatches = 0;

      for (const file of files) {
        if (totalMatches >= maxResults) break;

        try {
          const content = await readFile(file, 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            if (totalMatches >= maxResults) break;
            if (regex.test(lines[i])) {
              const relativePath = path.relative(context.workspaceRoot, file);
              results.push(`${relativePath}:${i + 1}:${lines[i]}`);
              totalMatches++;
            }
          }
        } catch {
          // Skip binary or unreadable files
        }
      }

      if (results.length === 0) {
        return {
          success: true,
          output: `No matches found for pattern "${pattern}"`,
          metadata: { pattern, matchCount: 0 },
        };
      }

      const truncated = totalMatches >= maxResults;
      const output = truncated
        ? `${results.join('\n')}\n\n(Results truncated at ${maxResults} matches)`
        : results.join('\n');

      return {
        success: true,
        output,
        metadata: { pattern, matchCount: totalMatches, truncated },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, output: `Grep failed: ${message}` };
    }
  },
};
