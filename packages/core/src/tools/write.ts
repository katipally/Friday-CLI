import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import type { Tool, ToolContext, ToolResult } from '@fridaycode/shared';

interface WriteInput {
  filePath: string;
  content: string;
}

export const writeTool: Tool = {
  definition: {
    name: 'Write',
    description:
      'Create or overwrite a file with the given content. ' +
      'Parent directories are created automatically if they do not exist.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Absolute or relative path to the file to write.',
        },
        content: {
          type: 'string',
          description: 'The full content to write to the file.',
        },
      },
      required: ['filePath', 'content'],
    },
    requiresPermission: true,
    isReadOnly: false,
  },

  async execute(raw: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = raw as unknown as WriteInput;
    const absPath = resolve(context.workingDir, input.filePath);

    try {
      await mkdir(dirname(absPath), { recursive: true });
      await writeFile(absPath, input.content, 'utf-8');

      return {
        toolCallId: '',
        content: `Successfully wrote to ${absPath}`,
        isError: false,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolCallId: '', content: `Failed to write file: ${msg}`, isError: true };
    }
  },
};
