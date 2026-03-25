import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpSseTransport } from '../transport/http-sse.js';

describe('HttpSseTransport', () => {
  let transport: HttpSseTransport;

  beforeEach(() => {
    transport = new HttpSseTransport('http://localhost:3000');
  });

  afterEach(async () => {
    await transport.stop();
    vi.restoreAllMocks();
  });

  it('should initialize in non-running state', () => {
    expect(transport.isRunning()).toBe(false);
  });

  it('should throw when sending before start', async () => {
    await expect(transport.send('test', {})).rejects.toThrow(
      'HttpSseTransport is not running',
    );
  });

  it('should handle stop gracefully when not running', async () => {
    await expect(transport.stop()).resolves.not.toThrow();
  });

  it('should set running state after start (with mocked fetch)', async () => {
    const mockReadable = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: endpoint\ndata: /message\n\n'));
        setTimeout(() => controller.close(), 100);
      },
    });

    const mockResponse = new Response(mockReadable, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse);

    await transport.start();
    expect(transport.isRunning()).toBe(true);
  }, 10_000);

  it('should handle SSE message events and resolve pending requests', async () => {
    const responsePayload = { tools: [] };
    let sseController: ReadableStreamDefaultController<Uint8Array>;

    const mockSSEStream = new ReadableStream<Uint8Array>({
      start(controller) {
        sseController = controller;
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('event: endpoint\ndata: /message\n\n'));
      },
    });

    const sseResponse = new Response(mockSSEStream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/sse')) {
        return sseResponse;
      }
      // For POST requests, simulate the server pushing a response via SSE
      setTimeout(() => {
        const encoder = new TextEncoder();
        sseController.enqueue(
          encoder.encode(
            `event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: 1, result: responsePayload })}\n\n`,
          ),
        );
      }, 20);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    await transport.start();
    // Wait for the SSE connection to be established
    await new Promise((r) => setTimeout(r, 50));

    const result = await transport.send('tools/list', {});
    expect(result).toEqual(responsePayload);
  }, 10_000);

  it('should stop cleanly and reject pending requests', async () => {
    const mockSSEStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: endpoint\ndata: /message\n\n'));
      },
    });

    const sseResponse = new Response(mockSSEStream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/sse')) {
        return sseResponse;
      }
      // POST hangs forever
      return new Promise(() => {});
    });

    await transport.start();
    await new Promise((r) => setTimeout(r, 50));

    const sendPromise = transport.send('test/method', {});

    await transport.stop();
    expect(transport.isRunning()).toBe(false);

    await expect(sendPromise).rejects.toThrow();
  }, 10_000);
});
