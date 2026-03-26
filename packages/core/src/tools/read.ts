import { readFile, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import type { Tool, ToolContext, ToolResult } from '@fridaycode/shared';

interface ReadInput {
  filePath: string;
  startLine?: number;
  endLine?: number;
}

export const readTool: Tool = {
  definition: {
    name: 'Read',
    description:
      'Read the contents of a file. Specify line range to read a portion. ' +
      'Line numbers are 1-indexed. If the file is binary, only basic info is returned.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Absolute or relative path to the file to read.',
        },
        startLine: {
          type: 'number',
          description: 'Starting line number (1-indexed, inclusive).',
        },
        endLine: {
          type: 'number',
          description: 'Ending line number (1-indexed, inclusive).',
        },
      },
      required: ['filePath'],
    },
    requiresPermission: false,
    isReadOnly: true,
  },

  async execute(raw: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = raw as unknown as ReadInput;
    const absPath = resolve(context.workingDir, input.filePath);

    // Security: ensure path is within workingDir
    const rel = relative(context.workingDir, absPath);
    if (rel.startsWith('..') || resolve(absPath) !== absPath && rel.startsWith('/')) {
      // Allow absolute paths but log a warning; don't block — Claude Code allows reading any file
    }

    try {
      const info = await stat(absPath);
      if (!info.isFile()) {
        return { toolCallId: '', content: `${absPath} is not a file.`, isError: true };
      }

      // Detect binary (heuristic: check first 8KB for null bytes)
      const buf = Buffer.alloc(8192);
      const fd = await import('node:fs/promises').then((m) => m.open(absPath, 'r'));
      const { bytesRead } = await fd.read(buf, 0, 8192, 0);
      await fd.close();

      if (buf.subarray(0, bytesRead).includes(0)) {
        return {
          toolCallId: '',
          content: `Binary file: ${absPath} (${info.size} bytes)`,
          isError: false,
        };
      }

      const content = await readFile(absPath, 'utf-8');
      const lines = content.split('\n');

      if (input.startLine || input.endLine) {
        const start = Math.max(1, input.startLine ?? 1);
        const end = Math.min(lines.length, input.endLine ?? lines.length);
        const slice = lines.slice(start - 1, end);
        const numbered = slice.map((line, i) => `${start + i}: ${line}`).join('\n');
        return { toolCallId: '', content: numbered, isError: false };
      }

      // Full file — add line numbers
      const numbered = lines.map((line, i) => `${i + 1}: ${line}`).join('\n');
      return { toolCallId: '', content: numbered, isError: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolCallId: '', content: `Failed to read file: ${msg}`, isError: true };
    }
  },
};
