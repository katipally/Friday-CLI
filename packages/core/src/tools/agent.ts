import type { Tool, ToolContext, ToolResult } from '@fridaycode/shared';

interface AgentInput {
  prompt: string;
  agent?: string;
  model?: string;
  tools?: string[];
  maxTurns?: number;
}

/**
 * The Agent tool runs a foreground subagent — it blocks until the subagent completes.
 * The actual agent engine is injected via context; this tool is just the interface.
 */
export const agentTool: Tool = {
  definition: {
    name: 'Agent',
    description:
      'Spawn a foreground subagent to handle a complex subtask autonomously. ' +
      'The subagent runs with its own context window and tool access. ' +
      'Use for delegating multi-step research, code exploration, or independent tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Detailed instructions for the subagent.',
        },
        agent: {
          type: 'string',
          description: 'Optional named agent to use (e.g., "Explore", "Plan").',
        },
        model: {
          type: 'string',
          description: 'Optional model override for the subagent.',
        },
        tools: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of allowed tool names for the subagent.',
        },
        maxTurns: {
          type: 'number',
          description: 'Maximum conversation turns before auto-stopping.',
        },
      },
      required: ['prompt'],
    },
    requiresPermission: true,
    isReadOnly: false,
  },

  async execute(raw: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = raw as unknown as AgentInput;

    // The agent engine is injected via context by the orchestrator
    const runAgent = (context as unknown as Record<string, unknown>).runAgent as
      | ((input: AgentInput, context: ToolContext) => Promise<string>)
      | undefined;

    if (!runAgent) {
      return {
        toolCallId: '',
        content: 'Agent engine is not available in this context.',
        isError: true,
      };
    }

    await context.hooks.dispatch({
      event: 'SubagentStart',
      sessionId: context.sessionId,
      toolInput: input as unknown as Record<string, unknown>,
    });

    try {
      const result = await runAgent(input, context);

      await context.hooks.dispatch({
        event: 'SubagentStop',
        sessionId: context.sessionId,
        toolResult: { toolCallId: '', content: result, isError: false },
      });

      return { toolCallId: '', content: result, isError: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      await context.hooks.dispatch({
        event: 'SubagentStop',
        sessionId: context.sessionId,
        toolResult: { toolCallId: '', content: msg, isError: true },
      });

      return { toolCallId: '', content: `Agent failed: ${msg}`, isError: true };
    }
  },
};
