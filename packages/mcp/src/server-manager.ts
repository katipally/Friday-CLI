import { createLogger } from '@anthropic-ai/friday-shared';
import { MCPClient } from './client.js';
import type { MCPServerConfig, MCPServerInfo } from './types.js';

const logger = createLogger('mcp:manager');

/**
 * Manages the lifecycle of MCP server connections.
 *
 * Provides a higher-level API on top of MCPClient for bulk
 * connect/disconnect operations and clean shutdown.
 */
export class MCPServerManager {
  private client: MCPClient;

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

  /** Add a single server and connect to it. */
  async addServer(config: MCPServerConfig): Promise<MCPServerInfo> {
    logger.info(`Adding MCP server "${config.name}"`, { transport: config.transport });
    return this.client.connect(config);
  }

  /** Disconnect and remove a server by name. */
  async removeServer(name: string): Promise<void> {
    logger.info(`Removing MCP server "${name}"`);
    await this.client.disconnect(name);
  }

  /** Return the underlying MCPClient for direct tool operations. */
  getClient(): MCPClient {
    return this.client;
  }

  /** Disconnect all servers gracefully. */
  async shutdown(): Promise<void> {
    logger.info('Shutting down all MCP servers');
    await this.client.disconnectAll();
  }
}
