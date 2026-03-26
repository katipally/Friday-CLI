import type { Tool, ToolContext, ToolResult } from '@fridaycode/shared';

interface WebSearchInput {
  query: string;
  maxResults?: number;
}

export const webSearchTool: Tool = {
  definition: {
    name: 'WebSearch',
    description:
      'Search the web for information. Returns search results with titles, URLs, and snippets. ' +
      'Useful when you need up-to-date information or references.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query.',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (default: 5).',
        },
      },
      required: ['query'],
    },
    requiresPermission: true,
    isReadOnly: true,
  },

  async execute(raw: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = raw as unknown as WebSearchInput;
    const maxResults = input.maxResults ?? 5;

    // Use DuckDuckGo HTML lite as a free search provider
    try {
      const params = new URLSearchParams({ q: input.query });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      const resp = await fetch(`https://html.duckduckgo.com/html/?${params.toString()}`, {
        headers: {
          'User-Agent': 'FridayCode/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!resp.ok) {
        return {
          toolCallId: '',
          content: `Search request failed with HTTP ${resp.status}`,
          isError: true,
        };
      }

      const html = await resp.text();
      const results = parseSearchResults(html, maxResults);

      if (results.length === 0) {
        return {
          toolCallId: '',
          content: `No results found for: ${input.query}`,
          isError: false,
        };
      }

      const output = results
        .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
        .join('\n\n');

      return { toolCallId: '', content: output, isError: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolCallId: '', content: `Web search failed: ${msg}`, isError: true };
    }
  },
};

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function parseSearchResults(html: string, max: number): SearchResult[] {
  const results: SearchResult[] = [];

  // DuckDuckGo HTML lite result parsing
  const resultBlocks = html.match(/<a[^>]+class="result__a"[^>]*>[\s\S]*?<\/a>/gi) ?? [];
  const snippetBlocks = html.match(/<a[^>]+class="result__snippet"[^>]*>[\s\S]*?<\/a>/gi) ?? [];

  for (let i = 0; i < Math.min(resultBlocks.length, max); i++) {
    const titleMatch = resultBlocks[i].match(/>([^<]+)</);
    const urlMatch = resultBlocks[i].match(/href="([^"]+)"/);
    const snippetMatch = snippetBlocks[i]?.replace(/<[^>]+>/g, '') ?? '';

    if (titleMatch && urlMatch) {
      let url = urlMatch[1];
      // DDG wraps URLs in redirect — extract the actual URL
      const uddgMatch = url.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        url = decodeURIComponent(uddgMatch[1]);
      }

      results.push({
        title: titleMatch[1].trim(),
        url,
        snippet: snippetMatch.trim(),
      });
    }
  }

  return results;
}
