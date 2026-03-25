import { spawn } from 'node:child_process';
import path from 'node:path';
import type { Tool, ToolContext, ToolResult } from '../types.js';

export const shellExecTool: Tool = {
  name: 'shell_exec',
  description: 'Execute a shell command and return its output.',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute',
      },
      cwd: {
        type: 'string',
        description: 'Working directory (relative to workspace root)',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 30000)',
      },
    },
    required: ['command'],
  },

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const command = args.command as string;
    if (!command) {
      return { success: false, output: 'Missing required parameter: command' };
    }

    const timeout = typeof args.timeout === 'number' ? args.timeout : 30_000;
    const cwdArg = args.cwd as string | undefined;
    const cwd = cwdArg
      ? path.resolve(context.workspaceRoot, cwdArg)
      : context.cwd;

    return new Promise<ToolResult>((resolve) => {
      const chunks: Buffer[] = [];
      let killed = false;

      const proc = spawn('sh', ['-c', command], {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      const timer = setTimeout(() => {
        killed = true;
        proc.kill('SIGTERM');
      }, timeout);

      proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      proc.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));

      proc.on('error', (error) => {
        clearTimeout(timer);
        resolve({
          success: false,
          output: `Failed to execute command: ${error.message}`,
          metadata: { command },
        });
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        const output = Buffer.concat(chunks).toString('utf-8');

        if (killed) {
          resolve({
            success: false,
            output: `Command timed out after ${timeout}ms\n${output}`,
            metadata: { command, exitCode: code, timedOut: true },
          });
          return;
        }

        resolve({
          success: code === 0,
          output: output || (code === 0 ? '(no output)' : `Command exited with code ${code}`),
          metadata: { command, exitCode: code },
        });
      });
    });
  },
};
