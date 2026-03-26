import type { Tool, ToolContext, ToolResult } from '@fridaycode/shared';

interface CronJob {
  id: string;
  schedule: string;
  prompt: string;
  enabled: boolean;
  createdAt: number;
  lastRun?: number;
}

// In-memory cron job storage (persistent storage done via settings)
const cronJobs = new Map<string, CronJob>();
const cronTimers = new Map<string, ReturnType<typeof setInterval>>();

export function getCronJobs(): CronJob[] {
  return [...cronJobs.values()];
}

export function stopAllCronJobs(): void {
  for (const timer of cronTimers.values()) {
    clearInterval(timer);
  }
  cronTimers.clear();
}

// ─── CronCreate ──────────────────────────────────────────────

interface CronCreateInput {
  schedule: string;
  prompt: string;
}

export const cronCreateTool: Tool = {
  definition: {
    name: 'CronCreate',
    description:
      'Create a scheduled recurring task. Uses cron syntax (e.g., "*/5 * * * *" for every 5 minutes). ' +
      'The prompt will be executed on the given schedule.',
    inputSchema: {
      type: 'object',
      properties: {
        schedule: {
          type: 'string',
          description: 'Cron schedule expression (e.g., "0 */2 * * *" for every 2 hours).',
        },
        prompt: {
          type: 'string',
          description: 'The prompt/command to execute on schedule.',
        },
      },
      required: ['schedule', 'prompt'],
    },
    requiresPermission: true,
    isReadOnly: false,
  },

  async execute(raw: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = raw as unknown as CronCreateInput;

    // Validate cron expression (basic check)
    const parts = input.schedule.trim().split(/\s+/);
    if (parts.length < 5 || parts.length > 6) {
      return {
        toolCallId: '',
        content: 'Invalid cron expression. Expected 5-6 space-separated fields.',
        isError: true,
      };
    }

    const { generateId } = await import('@fridaycode/shared');
    const id = generateId();

    const job: CronJob = {
      id,
      schedule: input.schedule,
      prompt: input.prompt,
      enabled: true,
      createdAt: Date.now(),
    };

    cronJobs.set(id, job);

    // Schedule execution using node-cron
    try {
      const cron = await import('node-cron');
      const task = cron.schedule(input.schedule, () => {
        job.lastRun = Date.now();
        // The actual execution is handled by emitting to the hook system
        context.hooks.dispatch({
          event: 'Notification',
          toolName: 'CronCreate',
          toolInput: { cronJobId: id, prompt: input.prompt },
          sessionId: context.sessionId,
        });
      });

      cronTimers.set(id, task as unknown as ReturnType<typeof setInterval>);
    } catch {
      // node-cron not available, store job for manual polling
    }

    return {
      toolCallId: '',
      content: `Created cron job ${id}: "${input.prompt}" on schedule "${input.schedule}"`,
      isError: false,
    };
  },
};

// ─── CronDelete ──────────────────────────────────────────────

interface CronDeleteInput {
  id: string;
}

export const cronDeleteTool: Tool = {
  definition: {
    name: 'CronDelete',
    description: 'Delete a scheduled cron job by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The ID of the cron job to delete.' },
      },
      required: ['id'],
    },
    requiresPermission: true,
    isReadOnly: false,
  },

  async execute(raw: Record<string, unknown>): Promise<ToolResult> {
    const input = raw as unknown as CronDeleteInput;

    if (!cronJobs.has(input.id)) {
      return { toolCallId: '', content: `Cron job ${input.id} not found.`, isError: true };
    }

    cronJobs.delete(input.id);

    const timer = cronTimers.get(input.id);
    if (timer) {
      clearInterval(timer);
      cronTimers.delete(input.id);
    }

    return { toolCallId: '', content: `Deleted cron job ${input.id}`, isError: false };
  },
};

// ─── CronList ────────────────────────────────────────────────

export const cronListTool: Tool = {
  definition: {
    name: 'CronList',
    description: 'List all scheduled cron jobs.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    requiresPermission: false,
    isReadOnly: true,
  },

  async execute(): Promise<ToolResult> {
    const jobs = getCronJobs();

    if (jobs.length === 0) {
      return { toolCallId: '', content: 'No cron jobs scheduled.', isError: false };
    }

    const lines = jobs.map(
      (j) =>
        `- ${j.id}: "${j.prompt}" [${j.schedule}] ${j.enabled ? 'enabled' : 'disabled'}` +
        (j.lastRun ? ` (last run: ${new Date(j.lastRun).toISOString()})` : ''),
    );

    return { toolCallId: '', content: lines.join('\n'), isError: false };
  },
};
