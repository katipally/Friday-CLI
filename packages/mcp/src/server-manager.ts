import { createLogger } from '@anthropic-ai/friday-shared';
import { MCPClient } from './client.js';
import type { MCPServerConfig, MCPServerInfo, MCPTool, MCPToolResult } from './types.js';

const logger = createLogger('mcp:manager');

export interface MCPServerStatus {
  name: string;
  connected: boolean;
  tools: number;
}

/**
 * Manages the lifecycle of MCP server connections.
 *
 * Provides a higher-level API on top of MCPClient for bulk
 * connect/disconnect operations, tool aggregation, and clean shutdown.
 */
export class MCPServerManager {
  private client: MCPClient;
  private configs = new Map<string, MCPServerConfig>();

  constructor() {
    this.client = new MCPClient();
  }

  /** Connect to every server described in the provided config array. */
  async connectFromConfig(servers: MCPServerConfig[]): Promise<void> {
    const results = await Promise.allSettled(
      servers.map((config) => this.addServer(config)),
    );

    for (const [i, result] of results.entries()) {
      if (result.status === 'rejected') {
        logger.error(`Failed to connect to MCP server "${servers[i].name}"`, {
          error: String(result.reason),
        });
      }
    }
  }

  /** Alias for connectFromConfig. */
  async startAll(servers: MCPServerConfig[]): Promise<void> {
    return this.connectFromConfig(servers);
  }

  /** Add a single server and connect to it. */
  async addServer(config: MCPServerConfig): Promise<MCPServerInfo> {
    logger.info(`Adding MCP server "${config.name}"`, { transport: config.transport });
    this.configs.set(config.name, config);
    return this.client.connect(config);
  }

  /** Disconnect and remove a server by name. */
  async removeServer(name: string): Promise<void> {
    logger.info(`Removing MCP server "${name}"`);
    await this.client.disconnect(name);
    this.configs.delete(name);
  }

  /** Disconnect a server and reconnect it using its stored config. */
  async restart(serverName: string): Promise<void> {
    const config = this.configs.get(serverName);
    if (!config) {
      throw new Error(`No config found for server "${serverName}"`);
    }

    logger.info(`Restarting MCP server "${serverName}"`);
    await this.client.disconnect(serverName);
    await this.client.connect(config);
  }

  /** Get an MCPClient reference (or undefined if name doesn't match). */
  getClient(name?: string): MCPClient | undefined {
    if (name && !this.client.isConnected(name)) {
      return undefined;
    }
    return this.client;
  }

  /** Aggregate tools from all connected servers. */
  getAllTools(): MCPTool[] {
    return this.client.listTools().map((entry) => entry.tool);
  }

  /** Get status of all tracked servers. */
  getStatus(): MCPServerStatus[] {
    const statuses: MCPServerStatus[] = [];
    for (const [name] of this.configs) {
      const connected = this.client.isConnected(name);
      const tools = connected
        ? this.client.listTools().filter((t) => t.server === name).length
        : 0;
      statuses.push({ name, connected, tools });
    }
    return statuses;
  }

  /** Call a tool on a specific server by name. */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<MCPToolResult> {
    return this.client.callTool(serverName, toolName, args);
  }

  /** Return the underlying MCPClient for direct tool operations. */
  getUnderlyingClient(): MCPClient {
    return this.client;
  }

  /** Disconnect all servers gracefully. */
  async shutdown(): Promise<void> {
    logger.info('Shutting down all MCP servers');
    await this.client.disconnectAll();
  }

  /** Alias for shutdown. */
  async stopAll(): Promise<void> {
    return this.shutdown();
  }
}
