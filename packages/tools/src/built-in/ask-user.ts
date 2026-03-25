import type { Tool, ToolContext, ToolResult } from '../types.js';

export const askUserTool: Tool = {
  name: 'ask_user',
  description: 'Ask the user a question. The TUI layer handles collecting the actual input.',
  parameters: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'The question to ask the user',
      },
      choices: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional list of choices to present to the user',
      },
    },
    required: ['question'],
  },

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const question = args.question as string;
    if (!question) {
      return { success: false, output: 'Missing required parameter: question' };
    }

    const choices = args.choices as string[] | undefined;
    let output = question;
    if (choices && choices.length > 0) {
      output += '\n\nOptions:\n' + choices.map((c, i) => `  ${i + 1}. ${c}`).join('\n');
    }

    return {
      success: true,
      output,
      metadata: {
        requiresInput: true,
        question,
        choices: choices || [],
      },
    };
  },
};
