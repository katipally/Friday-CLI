import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { ToolError } from '@fridaycode/shared';
import type { Tool, ToolContext, ToolResult } from '../types.js';

function resolveSafePath(filePath: string, workspaceRoot: string): string {
  const resolved = path.resolve(workspaceRoot, filePath);
  if (!resolved.startsWith(path.resolve(workspaceRoot))) {
    throw new ToolError(
      `Path "${filePath}" is outside the workspace`,
      'file_write',
    );
  }
  return resolved;
}

export const fileWriteTool: Tool = {
  name: 'file_write',
  description: 'Write content to a file. Creates the file if it does not exist.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'File path relative to workspace root',
      },
      content: {
        type: 'string',
        description: 'Content to write to the file',
      },
      createDirectories: {
        type: 'boolean',
        description: 'Create parent directories if they do not exist (default: true)',
      },
    },
    required: ['path', 'content'],
  },

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const filePath = args.path as string;
    const content = args.content as string;
    if (!filePath) {
      return { success: false, output: 'Missing required parameter: path' };
    }
    if (typeof content !== 'string') {
      return { success: false, output: 'Missing required parameter: content' };
    }

    const createDirectories = args.createDirectories !== false;
    const resolved = resolveSafePath(filePath, context.workspaceRoot);

    try {
      if (createDirectories) {
        await mkdir(path.dirname(resolved), { recursive: true });
      }

      await writeFile(resolved, content, 'utf-8');
      const byteCount = Buffer.byteLength(content, 'utf-8');

      return {
        success: true,
        output: `Successfully wrote ${byteCount} bytes to ${filePath}`,
        metadata: {
          path: filePath,
          bytes: byteCount,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, output: `Failed to write file "${filePath}": ${message}` };
    }
  },
};
