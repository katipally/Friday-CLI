import type { Tool, ToolContext, ToolResult } from '@fridaycode/shared';

interface TodoItem {
  id: number;
  title: string;
  status: 'not-started' | 'in-progress' | 'completed';
}

interface TodoWriteInput {
  todoList: TodoItem[];
}

// Session-scoped todo storage
const sessionTodos = new Map<string, TodoItem[]>();

export function getTodos(sessionId: string): TodoItem[] {
  return sessionTodos.get(sessionId) ?? [];
}

export const todoWriteTool: Tool = {
  definition: {
    name: 'TodoWrite',
    description:
      'Manage a session-scoped task checklist. Provide the complete array of todo items including all existing and new items. ' +
      'Use to track progress on multi-step tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        todoList: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'Unique ID for the todo item.' },
              title: { type: 'string', description: 'Short description of the task.' },
              status: {
                type: 'string',
                enum: ['not-started', 'in-progress', 'completed'],
                description: 'Current status.',
              },
            },
            required: ['id', 'title', 'status'],
          },
          description: 'Complete list of all todo items.',
        },
      },
      required: ['todoList'],
    },
    requiresPermission: false,
    isReadOnly: false,
  },

  async execute(raw: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = raw as unknown as TodoWriteInput;

    // Validate
    if (!Array.isArray(input.todoList)) {
      return { toolCallId: '', content: 'todoList must be an array.', isError: true };
    }

    const inProgress = input.todoList.filter((t) => t.status === 'in-progress');
    if (inProgress.length > 1) {
      return {
        toolCallId: '',
        content: 'Only one todo may be in-progress at a time.',
        isError: true,
      };
    }

    sessionTodos.set(context.sessionId, input.todoList);

    const completed = input.todoList.filter((t) => t.status === 'completed').length;
    const total = input.todoList.length;

    return {
      toolCallId: '',
      content: `Todo list updated: ${completed}/${total} completed.`,
      isError: false,
    };
  },
};
