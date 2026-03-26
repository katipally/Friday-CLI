import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Tool, ToolContext, ToolResult } from '@fridaycode/shared';

interface EditInput {
  filePath: string;
  oldString: string;
  newString: string;
}

export const editTool: Tool = {
  definition: {
    name: 'Edit',
    description:
      'Make a targeted edit to a file by replacing an exact string match. ' +
      'The oldString must appear exactly once in the file. ' +
      'Include enough context (3+ lines) to uniquely identify the location.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Absolute or relative path to the file to edit.',
        },
        oldString: {
          type: 'string',
          description: 'The exact text to find and replace. Must match exactly once.',
        },
        newString: {
          type: 'string',
          description: 'The replacement text.',
        },
      },
      required: ['filePath', 'oldString', 'newString'],
    },
    requiresPermission: true,
    isReadOnly: false,
  },

  async execute(raw: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = raw as unknown as EditInput;
    const absPath = resolve(context.workingDir, input.filePath);

    try {
      const content = await readFile(absPath, 'utf-8');

      // Count occurrences
      const occurrences = content.split(input.oldString).length - 1;

      if (occurrences === 0) {
        return {
          toolCallId: '',
          content: `The specified oldString was not found in ${absPath}. Ensure it matches exactly, including whitespace and indentation.`,
          isError: true,
        };
      }

      if (occurrences > 1) {
        return {
          toolCallId: '',
          content: `The specified oldString was found ${occurrences} times in ${absPath}. It must match exactly once. Add more context lines to make the match unique.`,
          isError: true,
        };
      }

      const updated = content.replace(input.oldString, input.newString);
      await writeFile(absPath, updated, 'utf-8');

      // Report the edit location
      const lineNum = content.substring(0, content.indexOf(input.oldString)).split('\n').length;

      return {
        toolCallId: '',
        content: `Successfully edited ${absPath} at line ${lineNum}`,
        isError: false,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolCallId: '', content: `Failed to edit file: ${msg}`, isError: true };
    }
  },
};
