import type { ToolResult } from '@fridaycode/shared';
import type { ToolDefinition } from '@fridaycode/providers';
import type { AgentToolRegistry } from '@fridaycode/core';
import { createLogger, ToolError } from '@fridaycode/shared';
import type { Tool, ToolContext } from './types.js';

const logger = createLogger('tools:registry');

/** Callback to invoke an MCP tool on a remote server. */
export type MCPToolCallFn = (
  serverName: string,
  toolName: string,
  args: Record<string, unknown>,
) => Promise<unknown>;

/** Minimal shape of an MCP tool descriptor (avoids hard dependency on mcp pkg). */
export interface MCPToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export class ToolRegistry implements AgentToolRegistry {
  private tools = new Map<string, Tool>();

  constructor(private context: ToolContext) {}

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      logger.warn(`Tool "${tool.name}" is already registered, overwriting`);
    }
    this.tools.set(tool.name, tool);
    logger.debug(`Registered tool: ${tool.name}`);
  }

  /**
   * Register tools from an MCP server.
   * Tool names are namespaced as `serverName__toolName` to avoid conflicts.
   */
  registerMCPTools(
    serverName: string,
    tools: MCPToolDescriptor[],
    callFn: MCPToolCallFn,
  ): void {
    for (const mcpTool of tools) {
      const namespacedName = `${serverName}__${mcpTool.name}`;

      const tool: Tool = {
        name: namespacedName,
        description: `[${serverName}] ${mcpTool.description}`,
        parameters: mcpTool.inputSchema,
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
          try {
            const result = await callFn(serverName, mcpTool.name, args);
            const resultObj = result as { content?: Array<{ text?: string }>; isError?: boolean };
            const outputText = resultObj?.content
              ?.map((c) => c.text ?? '')
              .join('\n') ?? JSON.stringify(result);

            return {
              success: !resultObj?.isError,
              output: outputText,
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, output: message };
          }
        },
      };

      this.register(tool);
      logger.debug(`Registered MCP tool: ${namespacedName} from server "${serverName}"`);
    }
  }

  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new ToolError(`Unknown tool: ${name}`, name);
    }

    logger.debug(`Executing tool: ${name}`, args);

    try {
      const result = await tool.execute(args, this.context);
      logger.debug(`Tool ${name} completed`, { success: result.success });
      return result;
    } catch (error) {
      if (error instanceof ToolError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new ToolError(`Tool "${name}" failed: ${message}`, name);
    }
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  getContext(): ToolContext {
    return this.context;
  }

  getRegisteredTools(): string[] {
    return Array.from(this.tools.keys());
  }
}
