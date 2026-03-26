import type { Tool, ToolContext, ToolResult } from '@fridaycode/shared';

interface SkillInput {
  name: string;
  arguments?: string;
}

export const skillTool: Tool = {
  definition: {
    name: 'Skill',
    description:
      'Invoke a named skill (from .friday/skills/ or installed plugins). ' +
      'Skills provide domain-specific expertise and workflows.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the skill to invoke.' },
        arguments: { type: 'string', description: 'Arguments to pass to the skill.' },
      },
      required: ['name'],
    },
    requiresPermission: false,
    isReadOnly: false,
  },

  async execute(raw: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = raw as unknown as SkillInput;

    // Skill engine injected via context by CLI layer
    const runSkill = (context as unknown as Record<string, unknown>).runSkill as
      | ((name: string, args: string | undefined, context: ToolContext) => Promise<string>)
      | undefined;

    if (!runSkill) {
      return {
        toolCallId: '',
        content: 'Skill engine not available.',
        isError: true,
      };
    }

    try {
      const result = await runSkill(input.name, input.arguments, context);
      return { toolCallId: '', content: result, isError: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolCallId: '', content: `Skill failed: ${msg}`, isError: true };
    }
  },
};
