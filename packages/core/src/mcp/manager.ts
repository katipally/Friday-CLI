/**
 * MCP Server Manager — manages lifecycle of configured MCP servers,
 * auto-connects them, and provides a unified interface for the CLI.
 */

import type { McpServerConfig, Tool, ToolContext, ToolResult } from '@fridaycode/shared';
import { McpClient, type McpToolDefinition } from './client.js';

export interface McpServerStatus {
  name: string;
  connected: boolean;
  toolCount: number;
  resourceCount: number;
  promptCount: number;
  error?: string;
}

export class McpServerManager {
  private clients = new Map<string, McpClient>();
  private configs: Record<string, McpServerConfig>;

  constructor(configs: Record<string, McpServerConfig>) {
    this.configs = configs;
  }

  // ─── Lifecycle ──────────────────────────────────────────

  async connectAll(): Promise<McpServerStatus[]> {
    const statuses: McpServerStatus[] = [];

    for (const [name, config] of Object.entries(this.configs)) {
      const status = await this.connectServer(name, config);
      statuses.push(status);
    }

    return statuses;
  }

  async connectServer(name: string, config: McpServerConfig): Promise<McpServerStatus> {
    const client = new McpClient(name, config);
    try {
      await client.connect();
      this.clients.set(name, client);
      return {
        name,
        connected: true,
        toolCount: client.tools.length,
        resourceCount: client.resources.length,
        promptCount: client.prompts.length,
      };
    } catch (err) {
      return {
        name,
        connected: false,
        toolCount: 0,
        resourceCount: 0,
        promptCount: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async disconnectAll(): Promise<void> {
    for (const client of this.clients.values()) {
      client.disconnect();
    }
    this.clients.clear();
  }

  async disconnectServer(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      client.disconnect();
      this.clients.delete(name);
    }
  }

  // ─── Queries ────────────────────────────────────────────

  getStatuses(): McpServerStatus[] {
    return [...this.clients.entries()].map(([name, client]) => ({
      name,
      connected: client.connected,
      toolCount: client.tools.length,
      resourceCount: client.resources.length,
      promptCount: client.prompts.length,
    }));
  }

  getConnectedServers(): string[] {
    return [...this.clients.entries()]
      .filter(([, c]) => c.connected)
      .map(([name]) => name);
  }

  getClient(name: string): McpClient | undefined {
    return this.clients.get(name);
  }

  // ─── Tool Registration ─────────────────────────────────

  /**
   * Convert all MCP server tools into Tool objects that can be registered
   * into our ToolRegistry.
   */
  createToolAdapters(): Tool[] {
    const tools: Tool[] = [];

    for (const [serverName, client] of this.clients) {
      if (!client.connected) continue;

      for (const mcpTool of client.tools) {
        tools.push(this.createToolAdapter(serverName, client, mcpTool));
      }
    }

    return tools;
  }

  private createToolAdapter(serverName: string, client: McpClient, mcpTool: McpToolDefinition): Tool {
    const qualifiedName = `mcp_${serverName}_${mcpTool.name}`;

    return {
      definition: {
        name: qualifiedName,
        description: mcpTool.description
          ? `[MCP: ${serverName}] ${mcpTool.description}`
          : `MCP tool from ${serverName}`,
        inputSchema: (mcpTool.inputSchema as Tool['definition']['inputSchema']) ?? {
          type: 'object',
          properties: {},
        },
        requiresPermission: true,
        isReadOnly: false,
      },
      async execute(raw: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
        try {
          const result = await client.callTool(mcpTool.name, raw);
          const text = result.content
            .map((c) => c.text ?? '')
            .filter(Boolean)
            .join('\n');
          return {
            toolCallId: '',
            content: text || '(empty response)',
            isError: result.isError ?? false,
          };
        } catch (err) {
          return {
            toolCallId: '',
            content: `MCP tool error: ${err instanceof Error ? err.message : String(err)}`,
            isError: true,
          };
        }
      },
    };
  }

  // ─── Resource Access (for existing MCP tools) ──────────

  async listResources(serverName: string): Promise<string> {
    const client = this.clients.get(serverName);
    if (!client?.connected) return `Server "${serverName}" not connected.`;
    const resources = await client.listResources();
    if (resources.length === 0) return 'No resources available.';
    return resources.map(r => `  ${r.uri}  —  ${r.name ?? ''}${r.description ? ` (${r.description})` : ''}`).join('\n');
  }

  async readResource(serverName: string, uri: string): Promise<string> {
    const client = this.clients.get(serverName);
    if (!client?.connected) return `Server "${serverName}" not connected.`;
    const contents = await client.readResource(uri);
    return contents.map(c => c.text ?? '(binary content)').join('\n');
  }
}
