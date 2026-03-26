export type { Tool, ToolContext, ToolResult, ToolDefinition } from './types.js';
export { ToolRegistry } from './registry.js';
export type { MCPToolCallFn, MCPToolDescriptor } from './registry.js';
export {
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  shellExecTool,
  grepTool,
  globTool,
  directoryTreeTool,
  gitTool,
  gitCommitTool,
  gitStashTool,
  gitCheckoutTool,
  gitStatusTool,
  askUserTool,
  webFetchTool,
  notebookEditTool,
  browserTool,
} from './built-in/index.js';

import type { ToolContext } from './types.js';
import { ToolRegistry } from './registry.js';
import {
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  shellExecTool,
  grepTool,
  globTool,
  directoryTreeTool,
  gitTool,
  gitCommitTool,
  gitStashTool,
  gitCheckoutTool,
  gitStatusTool,
  askUserTool,
  webFetchTool,
  notebookEditTool,
  browserTool,
} from './built-in/index.js';

export function createDefaultRegistry(context: ToolContext): ToolRegistry {
  const registry = new ToolRegistry(context);

  registry.register(fileReadTool);
  registry.register(fileWriteTool);
  registry.register(fileEditTool);
  registry.register(shellExecTool);
  registry.register(grepTool);
  registry.register(globTool);
  registry.register(directoryTreeTool);
  registry.register(gitTool);
  registry.register(gitCommitTool);
  registry.register(gitStashTool);
  registry.register(gitCheckoutTool);
  registry.register(gitStatusTool);
  registry.register(askUserTool);
  registry.register(webFetchTool);
  registry.register(notebookEditTool);
  registry.register(browserTool);

  return registry;
}
