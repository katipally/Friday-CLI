import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ToolError } from '@fridaycode/shared';
import type { Tool, ToolContext, ToolResult } from '../types.js';

function resolveSafePath(filePath: string, workspaceRoot: string): string {
  const resolved = path.resolve(workspaceRoot, filePath);
  if (!resolved.startsWith(path.resolve(workspaceRoot))) {
    throw new ToolError(
      `Path "${filePath}" is outside the workspace`,
      'file_edit',
    );
  }
  return resolved;
}

export const fileEditTool: Tool = {
  name: 'file_edit',
  description: 'Make a surgical text replacement in a file. Finds exactly one occurrence of old_str and replaces it with new_str.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'File path relative to workspace root',
      },
      old_str: {
        type: 'string',
        description: 'The exact string to find (must appear exactly once)',
      },
      new_str: {
        type: 'string',
        description: 'The string to replace old_str with',
      },
    },
    required: ['path', 'old_str', 'new_str'],
  },

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const filePath = args.path as string;
    const oldStr = args.old_str as string;
    const newStr = args.new_str as string;

    if (!filePath) {
      return { success: false, output: 'Missing required parameter: path' };
    }
    if (typeof oldStr !== 'string') {
      return { success: false, output: 'Missing required parameter: old_str' };
    }
    if (typeof newStr !== 'string') {
      return { success: false, output: 'Missing required parameter: new_str' };
    }

    const resolved = resolveSafePath(filePath, context.workspaceRoot);

    try {
      const content = await readFile(resolved, 'utf-8');

      // Count occurrences
      let count = 0;
      let searchPos = 0;
      while (true) {
        const idx = content.indexOf(oldStr, searchPos);
        if (idx === -1) break;
        count++;
        searchPos = idx + oldStr.length;
      }

      if (count === 0) {
        return {
          success: false,
          output: `old_str not found in ${filePath}. Make sure the string matches exactly.`,
        };
      }
      if (count > 1) {
        return {
          success: false,
          output: `old_str found ${count} times in ${filePath}. It must appear exactly once. Add more context to make it unique.`,
        };
      }

      const updated = content.replace(oldStr, newStr);
      await writeFile(resolved, updated, 'utf-8');

      // Build context snippet around the change
      const lines = updated.split('\n');
      const changeIndex = updated.indexOf(newStr);
      const lineNumber = updated.substring(0, changeIndex).split('\n').length;
      const contextStart = Math.max(0, lineNumber - 3);
      const contextEnd = Math.min(lines.length, lineNumber + newStr.split('\n').length + 2);
      const contextLines = lines
        .slice(contextStart, contextEnd)
        .map((line, i) => `${contextStart + i + 1}. ${line}`)
        .join('\n');

      return {
        success: true,
        output: `Successfully edited ${filePath}:\n${contextLines}`,
        metadata: { path: filePath, lineNumber },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, output: `Failed to edit file "${filePath}": ${message}` };
    }
  },
};
