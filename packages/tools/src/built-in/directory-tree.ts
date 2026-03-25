import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Tool, ToolContext, ToolResult } from '../types.js';

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', '.next', '.cache',
  '__pycache__', '.turbo', 'coverage', '.output',
]);

async function buildTree(
  dirPath: string,
  prefix: string,
  depth: number,
  maxDepth: number,
): Promise<string[]> {
  if (depth > maxDepth) return [];

  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  // Sort: directories first, then files, both alphabetically
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  // Filter ignored directories
  entries = entries.filter((e) => {
    if (e.name.startsWith('.') && e.isDirectory() && e.name !== '.github') return false;
    if (e.isDirectory() && IGNORED_DIRS.has(e.name)) return false;
    return true;
  });

  const lines: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isLast = i === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';

    if (entry.isDirectory()) {
      lines.push(`${prefix}${connector}${entry.name}/`);
      const children = await buildTree(
        path.join(dirPath, entry.name),
        prefix + childPrefix,
        depth + 1,
        maxDepth,
      );
      lines.push(...children);
    } else {
      lines.push(`${prefix}${connector}${entry.name}`);
    }
  }

  return lines;
}

export const directoryTreeTool: Tool = {
  name: 'directory_tree',
  description: 'Show the directory structure as a tree. Respects common ignore patterns.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Directory path relative to workspace root (defaults to workspace root)',
      },
      depth: {
        type: 'number',
        description: 'Maximum depth to traverse (default: 3)',
      },
    },
    required: [],
  },

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const dirPath = args.path
      ? path.resolve(context.workspaceRoot, args.path as string)
      : context.workspaceRoot;
    const maxDepth = typeof args.depth === 'number' ? args.depth : 3;

    try {
      const info = await stat(dirPath);
      if (!info.isDirectory()) {
        return { success: false, output: `"${args.path || '.'}" is not a directory` };
      }

      const rootName = path.basename(dirPath) + '/';
      const tree = await buildTree(dirPath, '', 0, maxDepth);

      return {
        success: true,
        output: `${rootName}\n${tree.join('\n')}`,
        metadata: { path: args.path || '.', depth: maxDepth },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, output: `Failed to list directory: ${message}` };
    }
  },
};
