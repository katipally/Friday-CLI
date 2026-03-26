import { ToolError } from '@fridaycode/shared';
import type { Tool, ToolContext, ToolResult } from '../types.js';

const DEFAULT_MAX_LENGTH = 100_000;
const DEFAULT_TIMEOUT_MS = 30_000;

function htmlToText(html: string): string {
  return html
    // Remove script and style elements
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Replace common block elements with newlines
    .replace(/<\/(p|div|h[1-6]|li|tr|br|hr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    // Convert links to markdown format
    .replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    // Convert headers
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n')
    // Convert list items
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '• $1\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isJsonContentType(contentType: string | null): boolean {
  return !!contentType && contentType.includes('application/json');
}

function isHtmlContentType(contentType: string | null): boolean {
  return !!contentType && contentType.includes('text/html');
}

export const webFetchTool: Tool = {
  name: 'web_fetch',
  description:
    'Fetch a URL from the internet. Returns the response body as text. HTML is simplified to readable text.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch',
      },
      method: {
        type: 'string',
        enum: ['GET', 'POST'],
        description: 'HTTP method (default: GET)',
      },
      headers: {
        type: 'object',
        description: 'Optional HTTP headers as key-value pairs',
        additionalProperties: { type: 'string' },
      },
      body: {
        type: 'string',
        description: 'Optional request body (for POST requests)',
      },
      max_length: {
        type: 'number',
        description: `Maximum response length in characters (default: ${DEFAULT_MAX_LENGTH})`,
      },
    },
    required: ['url'],
  },

  async execute(
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    const url = args.url as string;
    if (!url) {
      return { success: false, output: 'Missing required parameter: url' };
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return { success: false, output: `Invalid URL: ${url}` };
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        success: false,
        output: `Unsupported protocol: ${parsedUrl.protocol}. Only http and https are supported.`,
      };
    }

    // Check network permission
    if (context.checkPermission) {
      const allowed = await context.checkPermission('network', url);
      if (!allowed) {
        return {
          success: false,
          output: `Permission denied: network access to ${url}`,
        };
      }
    }

    const method = ((args.method as string) || 'GET').toUpperCase();
    const headers = (args.headers as Record<string, string>) || {};
    const body = args.body as string | undefined;
    const maxLength =
      typeof args.max_length === 'number' ? args.max_length : DEFAULT_MAX_LENGTH;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      const response = await fetch(url, {
        method,
        headers,
        body: method === 'POST' ? body : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const contentType = response.headers.get('content-type');
      const rawText = await response.text();

      let output: string;

      if (isJsonContentType(contentType)) {
        // Format JSON nicely
        try {
          const parsed = JSON.parse(rawText);
          output = JSON.stringify(parsed, null, 2);
        } catch {
          output = rawText;
        }
      } else if (isHtmlContentType(contentType)) {
        output = htmlToText(rawText);
      } else {
        output = rawText;
      }

      // Truncate if needed
      let truncated = false;
      if (output.length > maxLength) {
        output = output.slice(0, maxLength);
        truncated = true;
      }

      const statusInfo = `HTTP ${response.status} ${response.statusText}`;

      if (truncated) {
        output += `\n\n[Response truncated. Content was ${rawText.length} characters, showing first ${maxLength}.]`;
      }

      if (!response.ok) {
        return {
          success: false,
          output: `${statusInfo}\n\n${output}`,
          metadata: { status: response.status, url, truncated },
        };
      }

      return {
        success: true,
        output,
        metadata: { status: response.status, url, truncated },
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          output: `Request timed out after ${DEFAULT_TIMEOUT_MS / 1000} seconds: ${url}`,
        };
      }
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        output: `Failed to fetch "${url}": ${message}`,
      };
    }
  },
};
