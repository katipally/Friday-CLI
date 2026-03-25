import type { ToolResult } from '@anthropic-ai/friday-shared';
import type { ToolDefinition } from '@anthropic-ai/friday-providers';
import type { AgentToolRegistry } from '@anthropic-ai/friday-core';
import { createLogger, ToolError } from '@anthropic-ai/friday-shared';
import type { Tool, ToolContext } from './types.js';

const logger = createLogger('tools:registry');

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
