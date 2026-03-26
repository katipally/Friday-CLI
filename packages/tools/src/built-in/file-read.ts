import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ToolError } from '@fridaycode/shared';
import type { Tool, ToolContext, ToolResult } from '../types.js';

function resolveSafePath(filePath: string, workspaceRoot: string): string {
  const resolved = path.resolve(workspaceRoot, filePath);
  if (!resolved.startsWith(path.resolve(workspaceRoot))) {
    throw new ToolError(
      `Path "${filePath}" is outside the workspace`,
      'file_read',
    );
  }
  return resolved;
}

export const fileReadTool: Tool = {
  name: 'file_read',
  description: 'Read the contents of a file. Returns file content with line numbers.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'File path relative to workspace root',
      },
      startLine: {
        type: 'number',
        description: 'Start line number (1-indexed, inclusive)',
      },
      endLine: {
        type: 'number',
        description: 'End line number (1-indexed, inclusive)',
      },
    },
    required: ['path'],
  },

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const filePath = args.path as string;
    if (!filePath) {
      return { success: false, output: 'Missing required parameter: path' };
    }

    const resolved = resolveSafePath(filePath, context.workspaceRoot);

    try {
      const content = await readFile(resolved, 'utf-8');
      const lines = content.split('\n');

      const startLine = typeof args.startLine === 'number' ? Math.max(1, args.startLine) : 1;
      const endLine = typeof args.endLine === 'number' ? Math.min(lines.length, args.endLine) : lines.length;

      const selectedLines = lines.slice(startLine - 1, endLine);
      const numbered = selectedLines.map(
        (line, i) => `${startLine + i}. ${line}`,
      );

      return {
        success: true,
        output: numbered.join('\n'),
        metadata: {
          path: filePath,
          totalLines: lines.length,
          startLine,
          endLine,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, output: `Failed to read file "${filePath}": ${message}` };
    }
  },
};
