import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { Tool, ToolContext, ToolResult } from '@fridaycode/shared';

interface NotebookEditInput {
  filePath: string;
  cellIndex: number;
  source?: string;
  cellType?: 'code' | 'markdown';
  action: 'update' | 'insert' | 'delete';
}

export const notebookEditTool: Tool = {
  definition: {
    name: 'NotebookEdit',
    description:
      'Edit a Jupyter notebook (.ipynb) file. Supports updating cell content, inserting new cells, and deleting cells.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to the .ipynb file.' },
        cellIndex: { type: 'number', description: 'Cell index (0-based).' },
        source: { type: 'string', description: 'New cell source content (for update/insert).' },
        cellType: {
          type: 'string',
          enum: ['code', 'markdown'],
          description: 'Cell type (for insert, default: code).',
        },
        action: {
          type: 'string',
          enum: ['update', 'insert', 'delete'],
          description: 'The operation to perform.',
        },
      },
      required: ['filePath', 'cellIndex', 'action'],
    },
    requiresPermission: true,
    isReadOnly: false,
  },

  async execute(raw: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = raw as unknown as NotebookEditInput;
    const absPath = resolve(context.workingDir, input.filePath);

    try {
      const content = await readFile(absPath, 'utf-8');
      const notebook = JSON.parse(content);

      if (!notebook.cells || !Array.isArray(notebook.cells)) {
        return { toolCallId: '', content: 'Invalid notebook format: no cells array.', isError: true };
      }

      switch (input.action) {
        case 'update': {
          if (input.cellIndex < 0 || input.cellIndex >= notebook.cells.length) {
            return { toolCallId: '', content: `Cell index ${input.cellIndex} out of range.`, isError: true };
          }
          if (!input.source) {
            return { toolCallId: '', content: 'source is required for update.', isError: true };
          }
          notebook.cells[input.cellIndex].source = input.source.split('\n').map((l: string, i: number, arr: string[]) =>
            i < arr.length - 1 ? l + '\n' : l,
          );
          break;
        }

        case 'insert': {
          const cellType = input.cellType ?? 'code';
          const newCell = {
            cell_type: cellType,
            metadata: {},
            source: (input.source ?? '').split('\n').map((l: string, i: number, arr: string[]) =>
              i < arr.length - 1 ? l + '\n' : l,
            ),
            ...(cellType === 'code' ? { execution_count: null, outputs: [] } : {}),
          };
          notebook.cells.splice(input.cellIndex, 0, newCell);
          break;
        }

        case 'delete': {
          if (input.cellIndex < 0 || input.cellIndex >= notebook.cells.length) {
            return { toolCallId: '', content: `Cell index ${input.cellIndex} out of range.`, isError: true };
          }
          notebook.cells.splice(input.cellIndex, 1);
          break;
        }
      }

      const { writeFile: writeFileAsync } = await import('node:fs/promises');
      await writeFileAsync(absPath, JSON.stringify(notebook, null, 1), 'utf-8');

      return {
        toolCallId: '',
        content: `Notebook ${input.action}d cell ${input.cellIndex} in ${absPath}`,
        isError: false,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolCallId: '', content: `NotebookEdit failed: ${msg}`, isError: true };
    }
  },
};

// ─── LSP Tool ────────────────────────────────────────────────

interface LspInput {
  action: 'definition' | 'references' | 'hover' | 'diagnostics';
  filePath: string;
  line?: number;
  character?: number;
}

export const lspTool: Tool = {
  definition: {
    name: 'LSP',
    description:
      'Query the Language Server Protocol for code intelligence: go to definition, find references, hover info, diagnostics.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['definition', 'references', 'hover', 'diagnostics'],
          description: 'LSP action to perform.',
        },
        filePath: { type: 'string', description: 'File to query.' },
        line: { type: 'number', description: 'Line number (0-based).' },
        character: { type: 'number', description: 'Character position (0-based).' },
      },
      required: ['action', 'filePath'],
    },
    requiresPermission: false,
    isReadOnly: true,
  },

  async execute(raw: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = raw as unknown as LspInput;

    // LSP integration requires an active language server connection
    // injected via the CLI layer
    const lspClient = (context as unknown as Record<string, unknown>).lspClient as
      | {
          definition: (file: string, line: number, char: number) => Promise<string>;
          references: (file: string, line: number, char: number) => Promise<string>;
          hover: (file: string, line: number, char: number) => Promise<string>;
          diagnostics: (file: string) => Promise<string>;
        }
      | undefined;

    if (!lspClient) {
      return {
        toolCallId: '',
        content: 'LSP is not available. No language server connection.',
        isError: true,
      };
    }

    try {
      const absPath = resolve(context.workingDir, input.filePath);
      let result: string;

      switch (input.action) {
        case 'definition':
          result = await lspClient.definition(absPath, input.line ?? 0, input.character ?? 0);
          break;
        case 'references':
          result = await lspClient.references(absPath, input.line ?? 0, input.character ?? 0);
          break;
        case 'hover':
          result = await lspClient.hover(absPath, input.line ?? 0, input.character ?? 0);
          break;
        case 'diagnostics':
          result = await lspClient.diagnostics(absPath);
          break;
      }

      return { toolCallId: '', content: result, isError: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolCallId: '', content: `LSP query failed: ${msg}`, isError: true };
    }
  },
};

// ─── MCP Resource Tools ──────────────────────────────────────

interface McpListInput {
  server: string;
}

interface McpReadInput {
  server: string;
  uri: string;
}

export const mcpListResourcesTool: Tool = {
  definition: {
    name: 'ListMcpResources',
    description: 'List the available resources from an MCP (Model Context Protocol) server.',
    inputSchema: {
      type: 'object',
      properties: {
        server: { type: 'string', description: 'Name of the MCP server.' },
      },
      required: ['server'],
    },
    requiresPermission: false,
    isReadOnly: true,
  },

  async execute(raw: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = raw as unknown as McpListInput;

    const mcpClient = (context as unknown as Record<string, unknown>).mcpClient as
      | { listResources: (server: string) => Promise<string> }
      | undefined;

    if (!mcpClient) {
      return {
        toolCallId: '',
        content: 'MCP client not available. No MCP servers configured.',
        isError: true,
      };
    }

    try {
      const result = await mcpClient.listResources(input.server);
      return { toolCallId: '', content: result, isError: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolCallId: '', content: `MCP error: ${msg}`, isError: true };
    }
  },
};

export const mcpReadResourceTool: Tool = {
  definition: {
    name: 'ReadMcpResource',
    description: 'Read a specific resource from an MCP server.',
    inputSchema: {
      type: 'object',
      properties: {
        server: { type: 'string', description: 'Name of the MCP server.' },
        uri: { type: 'string', description: 'URI of the resource to read.' },
      },
      required: ['server', 'uri'],
    },
    requiresPermission: false,
    isReadOnly: true,
  },

  async execute(raw: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = raw as unknown as McpReadInput;

    const mcpClient = (context as unknown as Record<string, unknown>).mcpClient as
      | { readResource: (server: string, uri: string) => Promise<string> }
      | undefined;

    if (!mcpClient) {
      return {
        toolCallId: '',
        content: 'MCP client not available.',
        isError: true,
      };
    }

    try {
      const result = await mcpClient.readResource(input.server, input.uri);
      return { toolCallId: '', content: result, isError: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolCallId: '', content: `MCP error: ${msg}`, isError: true };
    }
  },
};
