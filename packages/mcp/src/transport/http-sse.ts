import { createLogger } from '@anthropic-ai/friday-shared';
import type { MCPRequest, MCPResponse } from '../types.js';

const logger = createLogger('mcp:http-sse');

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const INITIAL_RECONNECT_DELAY_MS = 1_000;

/**
 * HTTP/SSE transport for MCP servers.
 *
 * Sends JSON-RPC requests via HTTP POST and receives streamed
 * responses via Server-Sent Events over a persistent connection.
 */
export class HttpSseTransport {
  private requestId = 0;
  private pendingRequests = new Map<number, PendingRequest>();
  private _running = false;
  private abortController: AbortController | null = null;
  private reconnectAttempts = 0;
  private sseEndpoint: string | null = null;
  private messageEndpoint: string;

  constructor(private readonly serverUrl: string) {
    // The base URL is used for the initial SSE connection.
    // The server responds with an endpoint URL for sending messages.
    const base = serverUrl.replace(/\/$/, '');
    this.messageEndpoint = `${base}/message`;
  }

  /** Connect to the SSE endpoint and start listening for events. */
  async start(): Promise<void> {
    if (this._running) return;

    this.abortController = new AbortController();
    this._running = true;
    this.reconnectAttempts = 0;

    // Fire-and-forget: SSE stream processing runs in background
    this.connectSSE().catch(() => {
      // Errors are handled inside connectSSE via reconnection
    });
  }

  /**
   * Send a JSON-RPC request via HTTP POST and wait for the response
   * (delivered through the SSE stream).
   */
  async send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this._running) {
      throw new Error('HttpSseTransport is not running');
    }

    const id = ++this.requestId;
    const request: MCPRequest = { jsonrpc: '2.0', id, method, params };
    const endpoint = this.sseEndpoint ?? this.messageEndpoint;

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`MCP request timed out after ${REQUEST_TIMEOUT_MS}ms: ${method}`));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve, reject, timer });

      logger.debug('Sending HTTP request', { id, method, endpoint });

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: this.abortController?.signal,
      }).catch((err: Error) => {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingRequests.delete(id);
          pending.reject(new Error(`HTTP request failed: ${err.message}`));
        }
      });
    });
  }

  /** Disconnect and clean up. */
  async stop(): Promise<void> {
    if (!this._running) return;

    this._running = false;
    this.abortController?.abort();
    this.abortController = null;
    this.rejectAll(new Error('Transport stopped'));
  }

  isRunning(): boolean {
    return this._running;
  }

  // ─── Private ────────────────────────────────────────────────────

  /** Establish an SSE connection using fetch with streaming body. */
  private async connectSSE(): Promise<void> {
    const sseUrl = `${this.serverUrl.replace(/\/$/, '')}/sse`;

    try {
      logger.debug('Connecting to SSE endpoint', { url: sseUrl });

      const response = await fetch(sseUrl, {
        headers: { Accept: 'text/event-stream' },
        signal: this.abortController?.signal,
      });

      if (!response.ok) {
        throw new Error(`SSE connection failed with status ${response.status}`);
      }

      if (!response.body) {
        throw new Error('SSE response has no body');
      }

      this.reconnectAttempts = 0;
      logger.info('SSE connection established');

      // Process the SSE stream
      await this.processSSEStream(response.body);
    } catch (err) {
      if (!this._running) return; // Intentional shutdown

      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('abort')) return; // Intentional abort

      logger.warn('SSE connection failed', { error: message });
      await this.scheduleReconnect();
    }
  }

  /** Parse the SSE stream line by line. */
  private async processSSEStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';
    let currentData = '';

    try {
      while (this._running) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);

          if (line === '') {
            // Empty line = end of event
            if (currentData) {
              this.handleSSEEvent(currentEvent, currentData);
            }
            currentEvent = '';
            currentData = '';
            continue;
          }

          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            const dataValue = line.slice(5).trim();
            currentData = currentData ? `${currentData}\n${dataValue}` : dataValue;
          }
          // Ignore comments (lines starting with ':') and other fields
        }
      }
    } catch (err) {
      if (!this._running) return;
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('abort')) {
        logger.warn('SSE stream read error', { error: message });
        await this.scheduleReconnect();
      }
    } finally {
      reader.releaseLock();
    }

    // If we exited cleanly but are still supposed to be running, reconnect
    if (this._running) {
      await this.scheduleReconnect();
    }
  }

  /** Handle a parsed SSE event. */
  private handleSSEEvent(event: string, data: string): void {
    if (event === 'endpoint') {
      // The server tells us which endpoint to POST messages to
      const endpoint = data.trim();
      if (endpoint.startsWith('/') || endpoint.startsWith('http')) {
        this.sseEndpoint = endpoint.startsWith('http')
          ? endpoint
          : `${this.serverUrl.replace(/\/$/, '')}${endpoint}`;
        logger.debug('Received message endpoint', { endpoint: this.sseEndpoint });
      }
      return;
    }

    if (event === 'message' || event === '') {
      try {
        const msg = JSON.parse(data) as MCPResponse;
        this.handleMessage(msg);
      } catch {
        logger.warn('Failed to parse SSE message data', { data });
      }
    }
  }

  /** Route a parsed response to its pending request. */
  private handleMessage(msg: MCPResponse): void {
    if (msg.id == null) {
      logger.debug('Received MCP notification', {
        method: (msg as unknown as { method?: string }).method,
      });
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

  /** Reconnect with exponential backoff. */
  private async scheduleReconnect(): Promise<void> {
    if (!this._running) return;

    this.reconnectAttempts++;
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY_MS,
    );

    logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    await new Promise((resolve) => setTimeout(resolve, delay));

    if (this._running) {
      await this.connectSSE();
    }
  }

  /** Reject all pending requests. */
  private rejectAll(err: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(err);
      this.pendingRequests.delete(id);
    }
  }
}
