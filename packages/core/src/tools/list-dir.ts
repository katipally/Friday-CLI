import { readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { Tool, ToolContext, ToolResult } from '@fridaycode/shared';

interface ListDirInput {
  path: string;
}

export const listDirTool: Tool = {
  definition: {
    name: 'ListDir',
    description:
      'List the contents of a directory. Returns child names; names ending with / are directories.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute or relative path to the directory.' },
      },
      required: ['path'],
    },
    requiresPermission: false,
    isReadOnly: true,
  },

  async execute(raw: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = raw as unknown as ListDirInput;
    const absPath = resolve(context.workingDir, input.path);

    try {
      const entries = await readdir(absPath, { withFileTypes: true });
      const lines = entries
        .sort((a, b) => {
          // Directories first
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        })
        .map((e) => (e.isDirectory() ? e.name + '/' : e.name));

      return {
        toolCallId: '',
        content: lines.join('\n') || '(empty directory)',
        isError: false,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolCallId: '', content: `Failed to list directory: ${msg}`, isError: true };
    }
  },
};
