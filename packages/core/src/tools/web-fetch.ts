import type { Tool, ToolContext, ToolResult } from '@fridaycode/shared';

interface WebFetchInput {
  url: string;
  maxLength?: number;
}

export const webFetchTool: Tool = {
  definition: {
    name: 'WebFetch',
    description:
      'Fetch the content of a web page and extract its main text. ' +
      'HTML is converted to readable text. Useful for reading documentation or web resources.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to fetch content from.',
        },
        maxLength: {
          type: 'number',
          description: 'Maximum character length of returned content (default: 50000).',
        },
      },
      required: ['url'],
    },
    requiresPermission: true,
    isReadOnly: true,
  },

  async execute(raw: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = raw as unknown as WebFetchInput;
    const maxLength = input.maxLength ?? 50_000;

    // Basic URL validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(input.url);
    } catch {
      return { toolCallId: '', content: `Invalid URL: ${input.url}`, isError: true };
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { toolCallId: '', content: 'Only http and https URLs are supported.', isError: true };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      const resp = await fetch(input.url, {
        headers: {
          'User-Agent': 'FridayCode/1.0',
          Accept: 'text/html,application/xhtml+xml,text/plain,application/json',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeout);

      if (!resp.ok) {
        return {
          toolCallId: '',
          content: `HTTP ${resp.status}: ${resp.statusText}`,
          isError: true,
        };
      }

      const contentType = resp.headers.get('content-type') ?? '';
      const text = await resp.text();

      let output: string;
      if (contentType.includes('text/html') || contentType.includes('xhtml')) {
        output = extractTextFromHtml(text);
      } else {
        output = text;
      }

      // Truncate
      if (output.length > maxLength) {
        output = output.slice(0, maxLength) + '\n\n... (content truncated)';
      }

      return { toolCallId: '', content: output, isError: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolCallId: '', content: `Fetch failed: ${msg}`, isError: true };
    }
  },
};

/**
 * Basic HTML to text extraction.
 * Strips tags, decodes common entities, normalizes whitespace.
 */
function extractTextFromHtml(html: string): string {
  // Remove script and style blocks
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // Replace block-level tags with newlines
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|br|blockquote|pre|hr)[^>]*>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));

  // Normalize whitespace
  text = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
    .join('\n')
    .trim();

  return text;
}
