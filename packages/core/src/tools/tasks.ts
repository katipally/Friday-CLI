import type { Tool, ToolContext, ToolResult, AgentInstance } from '@fridaycode/shared';
import { generateId } from '@fridaycode/shared';

// In-memory background task storage
const tasks = new Map<string, AgentInstance>();

export function getTask(id: string): AgentInstance | undefined {
  return tasks.get(id);
}

export function getAllTasks(): AgentInstance[] {
  return [...tasks.values()];
}

export function setTask(task: AgentInstance): void {
  tasks.set(task.id, task);
}

// ─── TaskCreate ──────────────────────────────────────────────

interface TaskCreateInput {
  prompt: string;
  agent?: string;
  model?: string;
}

export const taskCreateTool: Tool = {
  definition: {
    name: 'TaskCreate',
    description:
      'Create a background task (subagent) that runs independently. ' +
      'Returns a task ID for monitoring with TaskGet/TaskList.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The instruction for the background task.' },
        agent: { type: 'string', description: 'Optional agent name to use (e.g., "Explore").' },
        model: { type: 'string', description: 'Optional model override for this task.' },
      },
      required: ['prompt'],
    },
    requiresPermission: true,
    isReadOnly: false,
  },

  async execute(raw: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = raw as unknown as TaskCreateInput;

    const task: AgentInstance = {
      id: generateId(),
      definition: {
        name: input.agent ?? 'background-task',
        description: input.prompt,
        model: input.model,
        background: true,
        initialPrompt: input.prompt,
      },
      mode: 'background',
      status: 'running',
      sessionId: context.sessionId,
      createdAt: Date.now(),
    };

    tasks.set(task.id, task);

    // Dispatch SubagentStart hook
    await context.hooks.dispatch({
      event: 'SubagentStart',
      agentId: task.id,
      sessionId: context.sessionId,
    });

    // Actual execution is handled by the agent engine in the CLI layer
    // This tool just registers the task and returns the ID

    return {
      toolCallId: '',
      content: `Created background task ${task.id}: "${input.prompt}"`,
      isError: false,
    };
  },
};

// ─── TaskGet ─────────────────────────────────────────────────

interface TaskGetInput {
  id: string;
}

export const taskGetTool: Tool = {
  definition: {
    name: 'TaskGet',
    description: 'Get the status and result of a background task.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The task ID.' },
      },
      required: ['id'],
    },
    requiresPermission: false,
    isReadOnly: true,
  },

  async execute(raw: Record<string, unknown>): Promise<ToolResult> {
    const input = raw as unknown as TaskGetInput;
    const task = tasks.get(input.id);

    if (!task) {
      return { toolCallId: '', content: `Task ${input.id} not found.`, isError: true };
    }

    const info = [
      `ID: ${task.id}`,
      `Agent: ${task.definition.name}`,
      `Status: ${task.status}`,
      `Created: ${new Date(task.createdAt).toISOString()}`,
    ];

    if (task.result) {
      info.push(`Result: ${task.result}`);
    }

    return { toolCallId: '', content: info.join('\n'), isError: false };
  },
};

// ─── TaskList ────────────────────────────────────────────────

export const taskListTool: Tool = {
  definition: {
    name: 'TaskList',
    description: 'List all background tasks and their status.',
    inputSchema: { type: 'object', properties: {} },
    requiresPermission: false,
    isReadOnly: true,
  },

  async execute(): Promise<ToolResult> {
    const all = getAllTasks();

    if (all.length === 0) {
      return { toolCallId: '', content: 'No background tasks.', isError: false };
    }

    const lines = all.map(
      (t) =>
        `- ${t.id} [${t.status}] ${t.definition.name}: ${t.definition.description ?? t.definition.initialPrompt ?? ''}`,
    );

    return { toolCallId: '', content: lines.join('\n'), isError: false };
  },
};

// ─── TaskStop ────────────────────────────────────────────────

interface TaskStopInput {
  id: string;
}

export const taskStopTool: Tool = {
  definition: {
    name: 'TaskStop',
    description: 'Stop a running background task.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The task ID to stop.' },
      },
      required: ['id'],
    },
    requiresPermission: true,
    isReadOnly: false,
  },

  async execute(raw: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = raw as unknown as TaskStopInput;
    const task = tasks.get(input.id);

    if (!task) {
      return { toolCallId: '', content: `Task ${input.id} not found.`, isError: true };
    }

    if (task.status !== 'running') {
      return {
        toolCallId: '',
        content: `Task ${input.id} is already ${task.status}.`,
        isError: true,
      };
    }

    task.status = 'stopped';
    tasks.set(task.id, task);

    await context.hooks.dispatch({
      event: 'SubagentStop',
      agentId: task.id,
      sessionId: context.sessionId,
    });

    return { toolCallId: '', content: `Stopped task ${input.id}`, isError: false };
  },
};

// ─── TaskUpdate ──────────────────────────────────────────────

interface TaskUpdateInput {
  id: string;
  message: string;
}

export const taskUpdateTool: Tool = {
  definition: {
    name: 'SendMessage',
    description:
      'Send a follow-up message to a running background task (subagent). ' +
      'Use to provide additional instructions or data.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The task ID.' },
        message: { type: 'string', description: 'The message to send to the task.' },
      },
      required: ['id', 'message'],
    },
    requiresPermission: false,
    isReadOnly: false,
  },

  async execute(raw: Record<string, unknown>): Promise<ToolResult> {
    const input = raw as unknown as TaskUpdateInput;
    const task = tasks.get(input.id);

    if (!task) {
      return { toolCallId: '', content: `Task ${input.id} not found.`, isError: true };
    }

    if (task.status !== 'running') {
      return {
        toolCallId: '',
        content: `Task ${input.id} is not running (status: ${task.status}).`,
        isError: true,
      };
    }

    // The actual message dispatch is handled by the agent engine
    return {
      toolCallId: '',
      content: `Message queued for task ${input.id}`,
      isError: false,
    };
  },
};
