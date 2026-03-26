import type { Tool, ToolContext, ToolResult } from '@fridaycode/shared';

interface AskUserInput {
  question: string;
  options?: string[];
}

/**
 * AskUser tool — prompts the user for input.
 * The actual UI rendering is handled by the CLI layer.
 * This tool uses a callback-based approach via context.
 */
export const askUserTool: Tool = {
  definition: {
    name: 'AskUser',
    description:
      'Ask the user a question and wait for their response. ' +
      'Use when you need clarification, confirmation, or a choice from the user.',
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The question to ask the user.',
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of choices for the user to select from.',
        },
      },
      required: ['question'],
    },
    requiresPermission: false,
    isReadOnly: true,
  },

  async execute(raw: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = raw as unknown as AskUserInput;

    // The ask function is injected into context by the CLI layer
    const askFn = (context as unknown as Record<string, unknown>).askUser as
      | ((question: string, options?: string[]) => Promise<string>)
      | undefined;

    if (!askFn) {
      return {
        toolCallId: '',
        content: 'AskUser is not available in this context (no interactive UI).',
        isError: true,
      };
    }

    try {
      const answer = await askFn(input.question, input.options);
      return { toolCallId: '', content: answer, isError: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolCallId: '', content: `User input failed: ${msg}`, isError: true };
    }
  },
};
