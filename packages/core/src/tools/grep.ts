import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import type { Tool, ToolContext, ToolResult } from '@fridaycode/shared';

interface GrepInput {
  pattern: string;
  path?: string;
  include?: string;
  isRegex?: boolean;
  maxResults?: number;
}

interface GrepMatch {
  file: string;
  line: number;
  text: string;
}

async function* walkDir(
  dir: string,
  include?: RegExp,
): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', '.friday'].includes(entry.name)) continue;
      yield* walkDir(full, include);
    } else if (entry.isFile()) {
      if (include && !include.test(entry.name)) continue;
      yield full;
    }
  }
}

export const grepTool: Tool = {
  definition: {
    name: 'Grep',
    description:
      'Search for text or regex patterns in files. Returns matching lines with file paths and line numbers. ' +
      'Use for finding code, strings, or patterns across the workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Text or regex pattern to search for (case-insensitive by default).',
        },
        path: {
          type: 'string',
          description: 'File or directory to search in. Defaults to working directory.',
        },
        include: {
          type: 'string',
          description: 'File name pattern to include (e.g., "*.ts"). Glob-style.',
        },
        isRegex: {
          type: 'boolean',
          description: 'Whether pattern is a regex (default: false, plain text).',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum results to return (default: 100).',
        },
      },
      required: ['pattern'],
    },
    requiresPermission: false,
    isReadOnly: true,
  },

  async execute(raw: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = raw as unknown as GrepInput;
    const searchPath = input.path
      ? resolve(context.workingDir, input.path)
      : context.workingDir;
    const maxResults = input.maxResults ?? 100;

    let regex: RegExp;
    try {
      regex = input.isRegex
        ? new RegExp(input.pattern, 'i')
        : new RegExp(escapeRegex(input.pattern), 'i');
    } catch {
      return { toolCallId: '', content: `Invalid regex pattern: ${input.pattern}`, isError: true };
    }

    // Convert glob-like include to regex for filename matching
    let includeRegex: RegExp | undefined;
    if (input.include) {
      const escapedGlob = input.include
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      includeRegex = new RegExp(`^${escapedGlob}$`, 'i');
    }

    const matches: GrepMatch[] = [];

    try {
      const info = await stat(searchPath);

      if (info.isFile()) {
        await searchFile(searchPath, context.workingDir, regex, matches, maxResults);
      } else {
        for await (const file of walkDir(searchPath, includeRegex)) {
          if (matches.length >= maxResults) break;
          await searchFile(file, context.workingDir, regex, matches, maxResults);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolCallId: '', content: `Grep failed: ${msg}`, isError: true };
    }

    if (matches.length === 0) {
      return { toolCallId: '', content: `No matches found for: ${input.pattern}`, isError: false };
    }

    const output = matches
      .map((m) => `${m.file}:${m.line}: ${m.text}`)
      .join('\n');
    const truncNote =
      matches.length >= maxResults ? `\n\n(limited to ${maxResults} results)` : '';

    return {
      toolCallId: '',
      content: `Found ${matches.length} match(es):\n${output}${truncNote}`,
      isError: false,
    };
  },
};

async function searchFile(
  absPath: string,
  workingDir: string,
  regex: RegExp,
  matches: GrepMatch[],
  maxResults: number,
): Promise<void> {
  try {
    const content = await readFile(absPath, 'utf-8');
    // Skip binary files
    if (content.includes('\0')) return;

    const relPath = relative(workingDir, absPath);
    const lines = content.split('\n');

    for (let i = 0; i < lines.length && matches.length < maxResults; i++) {
      if (regex.test(lines[i])) {
        matches.push({
          file: relPath,
          line: i + 1,
          text: lines[i].trimEnd(),
        });
      }
    }
  } catch {
    // Skip files we can't read
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
