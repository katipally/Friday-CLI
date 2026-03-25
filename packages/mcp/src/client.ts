import { createLogger } from '@anthropic-ai/friday-shared';
import { StdioTransport } from './transport/stdio.js';
import type { MCPServerConfig, MCPServerInfo, MCPTool, MCPToolResult } from './types.js';

const logger = createLogger('mcp:client');

interface ConnectedServer {
  config: MCPServerConfig;
  transport: StdioTransport;
  tools: MCPTool[];
  info: MCPServerInfo;
}

/**
 * MCP Client — manages connections to one or more MCP servers,
 * discovers their tools, and proxies tool calls.
 */
export class MCPClient {
  private servers = new Map<string, ConnectedServer>();

  /**
   * Connect to an MCP server. Performs the initialize handshake and
   * fetches the list of available tools.
   */
  async connect(config: MCPServerConfig): Promise<MCPServerInfo> {
    if (this.servers.has(config.name)) {
      throw new Error(`Server "${config.name}" is already connected`);
    }

    if (config.transport === 'http-sse') {
      throw new Error('HTTP/SSE transport is not yet implemented');
    }

    if (!config.command) {
      throw new Error('stdio transport requires a "command" field');
    }

    const transport = new StdioTransport(config.command, config.args ?? [], config.env);
    await transport.start();

    try {
      // MCP initialize handshake
      const initResult = (await transport.send('initialize', {
        protocolVersion: '2024-11-05',
        clientInfo: { name: 'friday-cli', version: '0.1.0' },
        capabilities: {},
      })) as {
        serverInfo?: { name?: string; version?: string };
        capabilities?: { tools?: Record<string, unknown>; resources?: Record<string, unknown>; prompts?: Record<string, unknown> };
      };

      const serverInfo: MCPServerInfo = {
        name: initResult?.serverInfo?.name ?? config.name,
        version: initResult?.serverInfo?.version ?? 'unknown',
        capabilities: {
          tools: !!initResult?.capabilities?.tools,
          resources: !!initResult?.capabilities?.resources,
          prompts: !!initResult?.capabilities?.prompts,
        },
      };

      // Notify the server that initialization is complete
      await transport.send('notifications/initialized', {});

      // Fetch available tools
      const toolsResult = (await transport.send('tools/list', {})) as {
        tools?: MCPTool[];
      };
      const tools: MCPTool[] = toolsResult?.tools ?? [];

      logger.info(`Connected to MCP server "${config.name}"`, {
        version: serverInfo.version,
        toolCount: tools.length,
      });

      this.servers.set(config.name, { config, transport, tools, info: serverInfo });
      return serverInfo;
    } catch (err) {
      // If handshake fails, clean up the transport.
      await transport.stop();
      throw err;
    }
  }

  /** Disconnect from a specific server. */
  async disconnect(serverName: string): Promise<void> {
    const server = this.servers.get(serverName);
    if (!server) {
      logger.warn(`Server "${serverName}" is not connected`);
      return;
    }

    try {
      await server.transport.send('shutdown', {});
    } catch {
      // Best-effort; the server may have already exited.
    }

    await server.transport.stop();
    this.servers.delete(serverName);
    logger.info(`Disconnected from MCP server "${serverName}"`);
  }

  /** Disconnect from all connected servers. */
  async disconnectAll(): Promise<void> {
    const names = [...this.servers.keys()];
    await Promise.allSettled(names.map((name) => this.disconnect(name)));
  }

  /**
   * List tools across all connected servers.
   * Each entry includes the server name for disambiguation.
   */
  listTools(): Array<{ server: string; tool: MCPTool }> {
    const results: Array<{ server: string; tool: MCPTool }> = [];
    for (const [serverName, server] of this.servers) {
      for (const tool of server.tools) {
        results.push({ server: serverName, tool });
      }
    }
    return results;
  }

  /** Call a tool on a specific connected server. */
  async callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`Server "${serverName}" is not connected`);
    }

    if (!server.transport.isRunning()) {
      throw new Error(`Server "${serverName}" transport is no longer running`);
    }

    logger.debug('Calling MCP tool', { server: serverName, tool: toolName });

    const result = (await server.transport.send('tools/call', {
      name: toolName,
      arguments: args,
    })) as MCPToolResult;

    return result;
  }

  /**
   * Get tool definitions formatted for the Friday agent loop.
   * Tool names are prefixed with `serverName__` to avoid collisions.
   */
  getToolDefinitions(): Array<{ name: string; description: string; parameters: Record<string, unknown> }> {
    const definitions: Array<{ name: string; description: string; parameters: Record<string, unknown> }> = [];

    for (const [serverName, server] of this.servers) {
      for (const tool of server.tools) {
        definitions.push({
          name: `${serverName}__${tool.name}`,
          description: `[${serverName}] ${tool.description}`,
          parameters: tool.inputSchema,
        });
      }
    }

    return definitions;
  }

  /** Check if a server is currently connected. */
  isConnected(serverName: string): boolean {
    const server = this.servers.get(serverName);
    return !!server && server.transport.isRunning();
  }

  /** Return the names of all connected servers. */
  listServers(): string[] {
    return [...this.servers.keys()];
  }
}
