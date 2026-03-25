import type { ToolResult } from '@anthropic-ai/friday-shared';
import type { ToolDefinition } from '@anthropic-ai/friday-providers';

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}

export interface ToolContext {
  workspaceRoot: string;
  cwd: string;
  checkPermission?: (action: string, target: string) => Promise<boolean>;
}

export type { ToolResult, ToolDefinition };
