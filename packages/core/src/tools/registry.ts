import type { Tool, ToolDefinition, ToolResult, ToolContext } from '@fridaycode/shared';

/**
 * Registry for all available tools.
 * Supports lazy/deferred loading.
 */
export class ToolRegistry {
  private tools = new Map<string, Tool>();
  private deferredFactories = new Map<string, () => Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.definition.name, tool);
  }

  registerDeferred(name: string, factory: () => Tool): void {
    this.deferredFactories.set(name, factory);
  }

  get(name: string): Tool | undefined {
    // Check loaded tools first
    let tool = this.tools.get(name);
    if (tool) return tool;

    // Try deferred loading
    const factory = this.deferredFactories.get(name);
    if (factory) {
      tool = factory();
      this.tools.set(name, tool);
      this.deferredFactories.delete(name);
      return tool;
    }

    return undefined;
  }

  has(name: string): boolean {
    return this.tools.has(name) || this.deferredFactories.has(name);
  }

  /**
   * Get all tool definitions (for sending to the model).
   */
  getDefinitions(): ToolDefinition[] {
    const defs: ToolDefinition[] = [];

    for (const tool of this.tools.values()) {
      defs.push(tool.definition);
    }

    // Include deferred tools definitions by instantiating them
    for (const [name, factory] of this.deferredFactories) {
      const tool = factory();
      this.tools.set(name, tool);
      defs.push(tool.definition);
    }
    this.deferredFactories.clear();

    return defs;
  }

  /**
   * List all tool names (including deferred).
   */
  listNames(): string[] {
    return [
      ...this.tools.keys(),
      ...this.deferredFactories.keys(),
    ];
  }

  /**
   * Search tools by pattern.
   */
  search(pattern: string): ToolDefinition[] {
    const regex = new RegExp(pattern, 'i');
    return this.getDefinitions().filter(
      (d) => regex.test(d.name) || regex.test(d.description),
    );
  }

  /**
   * Execute a tool by name.
   */
  async execute(
    name: string,
    input: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    const tool = this.get(name);
    if (!tool) {
      return {
        toolCallId: '',
        content: `Unknown tool: ${name}`,
        isError: true,
      };
    }

    // Check permissions
    const decision = await context.permissions.check(name, input);
    if (decision === 'deny') {
      return {
        toolCallId: '',
        content: `Permission denied for tool: ${name}`,
        isError: true,
      };
    }

    // Dispatch PreToolUse hook
    await context.hooks.dispatch({
      event: 'PreToolUse',
      toolName: name,
      toolInput: input,
      sessionId: context.sessionId,
    });

    // Execute
    const result = await tool.execute(input, context);

    // Dispatch PostToolUse hook
    await context.hooks.dispatch({
      event: 'PostToolUse',
      toolName: name,
      toolInput: input,
      toolResult: result,
      sessionId: context.sessionId,
    });

    return result;
  }
}
