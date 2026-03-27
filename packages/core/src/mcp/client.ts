/**
 * MCP (Model Context Protocol) client — JSON-RPC 2.0 over stdio.
 * Connects to MCP servers, discovers tools/resources/prompts, and
 * proxies calls.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { McpServerConfig } from '@fridaycode/shared';

// ─── JSON-RPC types ──────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

// ─── MCP protocol types ─────────────────────────────────────

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}

export interface McpResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

export interface McpToolResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

// ─── McpClient ───────────────────────────────────────────────

export class McpClient extends EventEmitter {
  readonly serverName: string;
  private config: McpServerConfig;
  private proc: ChildProcess | null = null;
  private pending = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private buffer = '';
  private _connected = false;
  private _tools: McpToolDefinition[] = [];
  private _resources: McpResource[] = [];
  private _prompts: McpPrompt[] = [];

  constructor(serverName: string, config: McpServerConfig) {
    super();
    this.serverName = serverName;
    this.config = config;
  }

  get connected(): boolean { return this._connected; }
  get tools(): McpToolDefinition[] { return this._tools; }
  get resources(): McpResource[] { return this._resources; }
  get prompts(): McpPrompt[] { return this._prompts; }

  // ─── Lifecycle ──────────────────────────────────────────

  async connect(timeoutMs = 10_000): Promise<void> {
    if (this._connected) return;

    const env = { ...process.env, ...(this.config.env ?? {}) };

    this.proc = spawn(this.config.command, this.config.args ?? [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
      shell: false,
    });

    this.proc.stdout!.setEncoding('utf-8');
    this.proc.stdout!.on('data', (data: string) => this.onData(data));
    this.proc.stderr!.on('data', (data: Buffer) => {
      this.emit('stderr', data.toString());
    });

    this.proc.on('exit', (code) => {
      this._connected = false;
      this.rejectAllPending(new Error(`MCP server ${this.serverName} exited (code ${code})`));
      this.emit('exit', code);
    });

    this.proc.on('error', (err) => {
      this._connected = false;
      this.rejectAllPending(err);
      this.emit('error', err);
    });

    // Initialize handshake
    try {
      const initResult = await this.request('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: { listChanged: true },
        },
        clientInfo: { name: 'fridaycode', version: '1.0.0' },
      }, timeoutMs) as Record<string, unknown>;

      // Send initialized notification
      this.notify('notifications/initialized', {});

      this._connected = true;

      // Discover capabilities
      await this.discoverCapabilities();
    } catch (err) {
      this.disconnect();
      throw err;
    }
  }

  disconnect(): void {
    this._connected = false;
    this.rejectAllPending(new Error('Disconnected'));
    if (this.proc && !this.proc.killed) {
      this.proc.kill('SIGTERM');
      setTimeout(() => { if (this.proc && !this.proc.killed) this.proc.kill('SIGKILL'); }, 2000);
    }
    this.proc = null;
  }

  // ─── MCP Operations ────────────────────────────────────

  async listTools(): Promise<McpToolDefinition[]> {
    const result = await this.request('tools/list', {}) as { tools: McpToolDefinition[] };
    this._tools = result.tools ?? [];
    return this._tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
    const result = await this.request('tools/call', { name, arguments: args }) as McpToolResult;
    return result;
  }

  async listResources(): Promise<McpResource[]> {
    const result = await this.request('resources/list', {}) as { resources: McpResource[] };
    this._resources = result.resources ?? [];
    return this._resources;
  }

  async readResource(uri: string): Promise<McpResourceContent[]> {
    const result = await this.request('resources/read', { uri }) as { contents: McpResourceContent[] };
    return result.contents ?? [];
  }

  async listPrompts(): Promise<McpPrompt[]> {
    const result = await this.request('prompts/list', {}) as { prompts: McpPrompt[] };
    this._prompts = result.prompts ?? [];
    return this._prompts;
  }

  async getPrompt(name: string, args?: Record<string, string>): Promise<{
    description?: string;
    messages: Array<{ role: string; content: { type: string; text: string } }>;
  }> {
    return await this.request('prompts/get', { name, arguments: args }) as any;
  }

  // ─── Internal ──────────────────────────────────────────

  private async discoverCapabilities(): Promise<void> {
    // Silently discover tools and resources; prompts are optional
    try { await this.listTools(); } catch { /* server may not support tools */ }
    try { await this.listResources(); } catch { /* server may not support resources */ }
    try { await this.listPrompts(); } catch { /* server may not support prompts */ }
  }

  private request(method: string, params: Record<string, unknown>, timeoutMs = 30_000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.proc || !this.proc.stdin) {
        return reject(new Error('MCP server not running'));
      }

      const id = randomUUID();
      const msg: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };

      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request '${method}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      const data = JSON.stringify(msg) + '\n';
      this.proc.stdin.write(data, (err) => {
        if (err) {
          this.pending.delete(id);
          clearTimeout(timer);
          reject(err);
        }
      });
    });
  }

  private notify(method: string, params: Record<string, unknown>): void {
    if (!this.proc || !this.proc.stdin) return;
    const msg: JsonRpcNotification = { jsonrpc: '2.0', method, params };
    this.proc.stdin.write(JSON.stringify(msg) + '\n');
  }

  private onData(data: string): void {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        if (msg.id && this.pending.has(msg.id)) {
          const entry = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          clearTimeout(entry.timer);
          if (msg.error) {
            entry.reject(new Error(`MCP error ${msg.error.code}: ${msg.error.message}`));
          } else {
            entry.resolve(msg.result);
          }
        } else if (msg.method) {
          // Server-initiated notification
          this.emit('notification', msg.method, msg.params);
        }
      } catch {
        // Malformed JSON line — skip
      }
    }
  }

  private rejectAllPending(err: Error): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(err);
    }
    this.pending.clear();
  }
}
