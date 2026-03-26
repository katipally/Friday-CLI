import { describe, it, expect, vi } from 'vitest';

vi.mock('@fridaycode/shared', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  ToolError: class ToolError extends Error {
    code: string;
    tool: string;
    constructor(message: string, tool: string) {
      super(message);
      this.name = 'ToolError';
      this.code = 'TOOL_ERROR';
      this.tool = tool;
    }
  },
}));

import { webFetchTool } from '../../built-in/web-fetch.js';
import type { ToolContext } from '../../types.js';

const defaultContext: ToolContext = {
  workspaceRoot: '/test',
  cwd: '/test',
};

describe('web_fetch Tool Integration', () => {
  describe('tool definition', () => {
    it('has the correct name', () => {
      expect(webFetchTool.name).toBe('web_fetch');
    });

    it('has a description', () => {
      expect(webFetchTool.description).toBeTruthy();
      expect(typeof webFetchTool.description).toBe('string');
    });

    it('defines url as a required parameter', () => {
      const params = webFetchTool.parameters as Record<string, unknown>;
      expect(params.required).toContain('url');
    });

    it('defines expected parameter properties', () => {
      const params = webFetchTool.parameters as Record<string, unknown>;
      const props = params.properties as Record<string, unknown>;
      expect(props).toHaveProperty('url');
      expect(props).toHaveProperty('method');
      expect(props).toHaveProperty('headers');
      expect(props).toHaveProperty('body');
      expect(props).toHaveProperty('max_length');
    });

    it('restricts method to GET and POST', () => {
      const params = webFetchTool.parameters as Record<string, unknown>;
      const props = params.properties as Record<string, unknown>;
      const method = props.method as Record<string, unknown>;
      expect(method.enum).toEqual(['GET', 'POST']);
    });
  });

  describe('URL validation', () => {
    it('rejects missing url', async () => {
      const result = await webFetchTool.execute({}, defaultContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain('url');
    });

    it('rejects invalid URL', async () => {
      const result = await webFetchTool.execute({ url: 'not-a-url' }, defaultContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain('Invalid URL');
    });

    it('rejects unsupported protocols', async () => {
      const result = await webFetchTool.execute({ url: 'ftp://example.com' }, defaultContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain('Unsupported protocol');
    });

    it('rejects file:// protocol', async () => {
      const result = await webFetchTool.execute({ url: 'file:///etc/passwd' }, defaultContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain('Unsupported protocol');
    });
  });

  describe('permission checking', () => {
    it('respects permission denial', async () => {
      const ctx: ToolContext = {
        ...defaultContext,
        checkPermission: vi.fn().mockResolvedValue(false),
      };
      const result = await webFetchTool.execute({ url: 'https://example.com' }, ctx);
      expect(result.success).toBe(false);
      expect(result.output).toContain('Permission denied');
      expect(ctx.checkPermission).toHaveBeenCalledWith('network', 'https://example.com');
    });

    it('proceeds when permission is granted', async () => {
      // Mock fetch to avoid actual network call
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Hello World', { status: 200, headers: { 'content-type': 'text/plain' } }),
      );

      const ctx: ToolContext = {
        ...defaultContext,
        checkPermission: vi.fn().mockResolvedValue(true),
      };
      const result = await webFetchTool.execute({ url: 'https://example.com' }, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello World');

      globalThis.fetch = originalFetch;
    });
  });

  describe('parameter validation', () => {
    it('handles max_length parameter', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('A'.repeat(200), { status: 200, headers: { 'content-type': 'text/plain' } }),
      );

      const result = await webFetchTool.execute(
        { url: 'https://example.com', max_length: 50 },
        defaultContext,
      );
      expect(result.success).toBe(true);
      expect(result.output).toContain('truncated');

      globalThis.fetch = originalFetch;
    });

    it('handles JSON response formatting', async () => {
      const jsonBody = JSON.stringify({ key: 'value', nested: { a: 1 } });
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(jsonBody, { status: 200, headers: { 'content-type': 'application/json' } }),
      );

      const result = await webFetchTool.execute({ url: 'https://api.example.com/data' }, defaultContext);
      expect(result.success).toBe(true);
      // JSON should be pretty-printed
      expect(result.output).toContain('"key": "value"');

      globalThis.fetch = originalFetch;
    });

    it('handles HTML to text conversion', async () => {
      const html = '<html><body><h1>Title</h1><p>Paragraph text</p></body></html>';
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }),
      );

      const result = await webFetchTool.execute({ url: 'https://example.com' }, defaultContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain('Title');
      expect(result.output).toContain('Paragraph text');
      // HTML tags should be stripped
      expect(result.output).not.toContain('<h1>');
      expect(result.output).not.toContain('<p>');

      globalThis.fetch = originalFetch;
    });

    it('handles HTTP error status', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Not Found', { status: 404, statusText: 'Not Found', headers: { 'content-type': 'text/plain' } }),
      );

      const result = await webFetchTool.execute({ url: 'https://example.com/missing' }, defaultContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain('404');

      globalThis.fetch = originalFetch;
    });

    it('handles network errors', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network unreachable'));

      const result = await webFetchTool.execute({ url: 'https://example.com' }, defaultContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain('Network unreachable');

      globalThis.fetch = originalFetch;
    });
  });

  describe('tool registry', () => {
    it('has an execute function', () => {
      expect(typeof webFetchTool.execute).toBe('function');
    });

    it('has well-formed parameters schema', () => {
      const params = webFetchTool.parameters as Record<string, unknown>;
      expect(params.type).toBe('object');
      expect(params.properties).toBeDefined();
      expect(params.required).toBeDefined();
      expect(Array.isArray(params.required)).toBe(true);
    });
  });
});
