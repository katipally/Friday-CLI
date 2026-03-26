import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ToolError } from '@fridaycode/shared';
import type { Tool, ToolContext, ToolResult } from '../types.js';

function resolveSafePath(filePath: string, workspaceRoot: string): string {
  const resolved = path.resolve(workspaceRoot, filePath);
  if (!resolved.startsWith(path.resolve(workspaceRoot))) {
    throw new ToolError(
      `Path "${filePath}" is outside the workspace`,
      'notebook_edit',
    );
  }
  return resolved;
}

interface NotebookCell {
  cell_type: string;
  source: string[];
  metadata: Record<string, unknown>;
  outputs?: unknown[];
  execution_count?: number | null;
}

interface Notebook {
  cells: NotebookCell[];
  metadata: Record<string, unknown>;
  nbformat: number;
  nbformat_minor: number;
}

function validateNotebook(data: unknown): data is Notebook {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    Array.isArray(obj.cells) &&
    typeof obj.nbformat === 'number' &&
    typeof obj.metadata === 'object' &&
    obj.metadata !== null
  );
}

function sourceToStringArray(content: string): string[] {
  const lines = content.split('\n');
  // Each line except the last gets a trailing newline, matching .ipynb convention
  return lines.map((line, i) => (i < lines.length - 1 ? line + '\n' : line));
}

function makeCodeCell(content: string): NotebookCell {
  return {
    cell_type: 'code',
    source: sourceToStringArray(content),
    metadata: {},
    outputs: [],
    execution_count: null,
  };
}

function makeMarkdownCell(content: string): NotebookCell {
  return {
    cell_type: 'markdown',
    source: sourceToStringArray(content),
    metadata: {},
  };
}

function formatCellSummary(cells: NotebookCell[]): string {
  if (cells.length === 0) return 'Notebook has no cells.';

  const lines = [`Notebook has ${cells.length} cell(s):\n`];
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const sourceText = cell.source.join('');
    const firstLine = sourceText.split('\n')[0] || '(empty)';
    const lineCount = sourceText.split('\n').length;
    const preview = firstLine.length > 60 ? firstLine.slice(0, 60) + '…' : firstLine;
    lines.push(`  [${i}] ${cell.cell_type} | ${lineCount} line(s) | ${preview}`);
  }
  return lines.join('\n');
}

function createEmptyNotebook(kernel: string): Notebook {
  return {
    cells: [],
    metadata: {
      kernelspec: {
        display_name: kernel === 'python3' ? 'Python 3' : kernel,
        language: kernel === 'python3' ? 'python' : kernel,
        name: kernel,
      },
      language_info: {
        name: kernel === 'python3' ? 'python' : kernel,
      },
    },
    nbformat: 4,
    nbformat_minor: 5,
  };
}

export const notebookEditTool: Tool = {
  name: 'notebook_edit',
  description: 'Read, edit, and create Jupyter notebook cells',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['read', 'edit_cell', 'insert_cell', 'delete_cell', 'create'],
        description: 'Action to perform on the notebook',
      },
      path: {
        type: 'string',
        description: 'Notebook file path relative to workspace root (.ipynb)',
      },
      cellIndex: {
        type: 'number',
        description: 'Cell index (0-based) for edit_cell or delete_cell',
      },
      cellType: {
        type: 'string',
        enum: ['code', 'markdown'],
        description: 'Cell type for insert_cell or edit_cell',
      },
      content: {
        type: 'string',
        description: 'Cell content for edit_cell or insert_cell',
      },
      insertAfter: {
        type: 'number',
        description: 'Insert new cell after this index (-1 to insert at the beginning)',
      },
      kernel: {
        type: 'string',
        description: 'Kernel name for create action (default: python3)',
      },
    },
    required: ['action', 'path'],
  },

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const action = args.action as string;
    const filePath = args.path as string;

    if (!action) {
      return { success: false, output: 'Missing required parameter: action' };
    }
    if (!filePath) {
      return { success: false, output: 'Missing required parameter: path' };
    }

    const validActions = ['read', 'edit_cell', 'insert_cell', 'delete_cell', 'create'];
    if (!validActions.includes(action)) {
      return { success: false, output: `Invalid action "${action}". Must be one of: ${validActions.join(', ')}` };
    }

    const resolved = resolveSafePath(filePath, context.workspaceRoot);

    try {
      if (action === 'create') {
        const kernel = (args.kernel as string) || 'python3';
        const notebook = createEmptyNotebook(kernel);
        await writeFile(resolved, JSON.stringify(notebook, null, 1) + '\n', 'utf-8');
        return {
          success: true,
          output: `Created notebook ${filePath} with kernel "${kernel}"`,
          metadata: { path: filePath, kernel },
        };
      }

      // All other actions require reading an existing notebook
      const raw = await readFile(resolved, 'utf-8');
      let notebook: Notebook;
      try {
        notebook = JSON.parse(raw) as Notebook;
      } catch {
        return { success: false, output: `Failed to parse ${filePath}: not valid JSON` };
      }

      if (!validateNotebook(notebook)) {
        return { success: false, output: `Invalid notebook structure in ${filePath}: missing cells, metadata, or nbformat` };
      }

      if (action === 'read') {
        return {
          success: true,
          output: formatCellSummary(notebook.cells),
          metadata: { path: filePath, cellCount: notebook.cells.length },
        };
      }

      if (action === 'edit_cell') {
        const cellIndex = args.cellIndex as number | undefined;
        const content = args.content as string | undefined;

        if (cellIndex === undefined || typeof cellIndex !== 'number') {
          return { success: false, output: 'Missing required parameter: cellIndex (number)' };
        }
        if (content === undefined || typeof content !== 'string') {
          return { success: false, output: 'Missing required parameter: content (string)' };
        }
        if (cellIndex < 0 || cellIndex >= notebook.cells.length) {
          return { success: false, output: `Cell index ${cellIndex} out of range (0-${notebook.cells.length - 1})` };
        }

        const cellType = args.cellType as string | undefined;
        notebook.cells[cellIndex].source = sourceToStringArray(content);
        if (cellType === 'code' || cellType === 'markdown') {
          notebook.cells[cellIndex].cell_type = cellType;
        }

        await writeFile(resolved, JSON.stringify(notebook, null, 1) + '\n', 'utf-8');
        return {
          success: true,
          output: `Edited cell [${cellIndex}] in ${filePath}`,
          metadata: { path: filePath, cellIndex },
        };
      }

      if (action === 'insert_cell') {
        const content = (args.content as string) ?? '';
        const cellType = (args.cellType as string) || 'code';
        const insertAfter = args.insertAfter as number | undefined;

        if (cellType !== 'code' && cellType !== 'markdown') {
          return { success: false, output: `Invalid cellType "${cellType}". Must be "code" or "markdown"` };
        }

        const newCell = cellType === 'code' ? makeCodeCell(content) : makeMarkdownCell(content);

        let insertPos: number;
        if (insertAfter === undefined || insertAfter === null) {
          // Default: append to end
          insertPos = notebook.cells.length;
        } else if (typeof insertAfter !== 'number') {
          return { success: false, output: 'insertAfter must be a number' };
        } else if (insertAfter === -1) {
          insertPos = 0;
        } else if (insertAfter < -1 || insertAfter >= notebook.cells.length) {
          return { success: false, output: `insertAfter ${insertAfter} out of range (-1 to ${notebook.cells.length - 1})` };
        } else {
          insertPos = insertAfter + 1;
        }

        notebook.cells.splice(insertPos, 0, newCell);
        await writeFile(resolved, JSON.stringify(notebook, null, 1) + '\n', 'utf-8');
        return {
          success: true,
          output: `Inserted ${cellType} cell at position [${insertPos}] in ${filePath}`,
          metadata: { path: filePath, cellIndex: insertPos },
        };
      }

      if (action === 'delete_cell') {
        const cellIndex = args.cellIndex as number | undefined;

        if (cellIndex === undefined || typeof cellIndex !== 'number') {
          return { success: false, output: 'Missing required parameter: cellIndex (number)' };
        }
        if (cellIndex < 0 || cellIndex >= notebook.cells.length) {
          return { success: false, output: `Cell index ${cellIndex} out of range (0-${notebook.cells.length - 1})` };
        }

        const removed = notebook.cells[cellIndex];
        notebook.cells.splice(cellIndex, 1);
        await writeFile(resolved, JSON.stringify(notebook, null, 1) + '\n', 'utf-8');
        return {
          success: true,
          output: `Deleted ${removed.cell_type} cell [${cellIndex}] from ${filePath}. ${notebook.cells.length} cell(s) remaining.`,
          metadata: { path: filePath, cellIndex, deletedType: removed.cell_type },
        };
      }

      return { success: false, output: `Unhandled action: ${action}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, output: `Failed to ${action} notebook "${filePath}": ${message}` };
    }
  },
};
