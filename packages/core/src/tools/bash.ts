import { spawn } from 'node:child_process';
import type { Tool, ToolContext, ToolResult } from '@fridaycode/shared';
import { DEFAULT_TOOL_TIMEOUT_MS } from '@fridaycode/shared';

interface BashInput {
  command: string;
  timeout?: number;
  cwd?: string;
}

export const bashTool: Tool = {
  definition: {
    name: 'Bash',
    description:
      'Execute a shell command in the working directory. ' +
      'Commands run in a persistent bash session. ' +
      'Use for running scripts, installing packages, git operations, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute.',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 30000).',
        },
        cwd: {
          type: 'string',
          description: 'Working directory for the command. Defaults to session working dir.',
        },
      },
      required: ['command'],
    },
    requiresPermission: true,
    isReadOnly: false,
  },

  async execute(raw: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = raw as unknown as BashInput;
    const timeout = input.timeout ?? DEFAULT_TOOL_TIMEOUT_MS;
    const cwd = input.cwd ?? context.workingDir;

    return new Promise((resolve) => {
      const chunks: string[] = [];
      let killed = false;

      const proc = spawn('bash', ['-c', input.command], {
        cwd,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const timer = setTimeout(() => {
        killed = true;
        proc.kill('SIGTERM');
        // Give process 5s to handle SIGTERM before SIGKILL
        setTimeout(() => {
          if (!proc.killed) proc.kill('SIGKILL');
        }, 5_000);
      }, timeout);

      if (context.abortSignal) {
        context.abortSignal.addEventListener('abort', () => {
          killed = true;
          proc.kill('SIGTERM');
        });
      }

      proc.stdout.on('data', (data: Buffer) => {
        chunks.push(data.toString());
      });

      proc.stderr.on('data', (data: Buffer) => {
        chunks.push(data.toString());
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        const output = chunks.join('');
        const truncated =
          output.length > 60_000
            ? output.slice(0, 30_000) + '\n\n... (output truncated) ...\n\n' + output.slice(-30_000)
            : output;

        if (killed) {
          resolve({
            toolCallId: '',
            content: truncated + '\n\n[Process timed out or was aborted]',
            isError: true,
          });
        } else {
          resolve({
            toolCallId: '',
            content: truncated || '(no output)',
            isError: (code ?? 1) !== 0,
          });
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          toolCallId: '',
          content: `Failed to execute command: ${err.message}`,
          isError: true,
        });
      });
    });
  },
};
