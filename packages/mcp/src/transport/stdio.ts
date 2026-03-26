import { spawn, type ChildProcess } from 'node:child_process';
import { createLogger } from '@fridaycode/shared';
import type { MCPRequest, MCPResponse } from '../types.js';

const logger = createLogger('mcp:stdio');

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * STDIO transport for MCP servers.
 *
 * Spawns a child process and communicates via newline-delimited JSON-RPC
 * messages over stdin/stdout.
 */
export class StdioTransport {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, PendingRequest>();
  private buffer = '';
  private _running = false;

  constructor(
    private readonly command: string,
    private readonly args: string[],
    private readonly env?: Record<string, string>,
  ) {}

  /** Spawn the child process and wire up stdout/stderr listeners. */
  async start(): Promise<void> {
    if (this._running) return;

    const mergedEnv = { ...process.env, ...(this.env ?? {}) };

    logger.debug('Spawning MCP server', { command: this.command, args: this.args });

    this.process = spawn(this.command, this.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: mergedEnv,
    });

    this.process.stdout!.on('data', (chunk: Buffer) => {
      this.onData(chunk.toString('utf-8'));
    });

    this.process.stderr!.on('data', (chunk: Buffer) => {
      logger.warn('MCP server stderr', { data: chunk.toString('utf-8').trim() });
    });

    this.process.on('error', (err) => {
      logger.error('MCP server process error', { error: err.message });
      this.rejectAll(new Error(`MCP server process error: ${err.message}`));
      this._running = false;
    });

    this.process.on('exit', (code, signal) => {
      logger.debug('MCP server exited', { code, signal });
      this.rejectAll(new Error(`MCP server exited with code ${code}, signal ${signal}`));
      this._running = false;
    });

    this._running = true;
  }

  /**
   * Send a JSON-RPC request and wait for the matching response.
   * Returns the `result` field or throws on error.
   */
  async send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this._running || !this.process?.stdin?.writable) {
      throw new Error('StdioTransport is not running');
    }

    const id = ++this.requestId;
    const request: MCPRequest = { jsonrpc: '2.0', id, method, params };

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`MCP request timed out after ${REQUEST_TIMEOUT_MS}ms: ${method}`));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve, reject, timer });

      const data = JSON.stringify(request) + '\n';
      logger.debug('Sending request', { id, method });
      this.process!.stdin!.write(data);
    });
  }

  /** Gracefully stop the child process. */
  async stop(): Promise<void> {
    if (!this._running || !this.process) return;

    this._running = false;
    this.rejectAll(new Error('Transport stopped'));

    // Give the process a moment to exit gracefully, then force-kill.
    return new Promise<void>((resolve) => {
      const forceKill = setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
        resolve();
      }, 3_000);

      this.process!.once('exit', () => {
        clearTimeout(forceKill);
        resolve();
      });

      this.process!.kill('SIGTERM');
    });
  }

  isRunning(): boolean {
    return this._running;
  }

  // ─── Private ────────────────────────────────────────────────────

  /** Buffer incoming data and parse complete newline-delimited JSON messages. */
  private onData(chunk: string): void {
    this.buffer += chunk;

    // Process all complete lines in the buffer.
    let newlineIdx: number;
    while ((newlineIdx = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIdx).trim();
      this.buffer = this.buffer.slice(newlineIdx + 1);

      if (!line) continue;

      try {
        const msg = JSON.parse(line) as MCPResponse;
        this.handleMessage(msg);
      } catch {
        logger.warn('Failed to parse MCP message', { line });
      }
    }
  }

  /** Route a parsed response to its pending request. */
  private handleMessage(msg: MCPResponse): void {
    // Notifications (no id) are logged and ignored.
    if (msg.id == null) {
      logger.debug('Received MCP notification', { method: (msg as unknown as { method?: string }).method });
      return;
    }

    const pending = this.pendingRequests.get(msg.id);
    if (!pending) {
      logger.warn('Received response for unknown request', { id: msg.id });
      return;
    }

    clearTimeout(pending.timer);
    this.pendingRequests.delete(msg.id);

    if (msg.error) {
      pending.reject(new Error(`MCP error ${msg.error.code}: ${msg.error.message}`));
    } else {
      pending.resolve(msg.result);
    }
  }

  /** Reject all pending requests (used on process exit / stop). */
  private rejectAll(err: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(err);
      this.pendingRequests.delete(id);
    }
  }
}
