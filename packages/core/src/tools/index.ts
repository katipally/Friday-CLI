export { ToolRegistry } from './registry.js';
export { bashTool } from './bash.js';
export { readTool } from './read.js';
export { writeTool } from './write.js';
export { editTool } from './edit.js';
export { globTool } from './glob.js';
export { grepTool } from './grep.js';
export { listDirTool } from './list-dir.js';
export { webFetchTool } from './web-fetch.js';
export { webSearchTool } from './web-search.js';
export { askUserTool } from './ask-user.js';
export { todoWriteTool, getTodos } from './todo-write.js';
export { cronCreateTool, cronDeleteTool, cronListTool, stopAllCronJobs } from './cron.js';
export {
  taskCreateTool,
  taskGetTool,
  taskListTool,
  taskStopTool,
  taskUpdateTool,
  getTask,
  getAllTasks,
  setTask,
} from './tasks.js';
export { agentTool } from './agent.js';
export { skillTool } from './skill.js';
export {
  notebookEditTool,
  lspTool,
  mcpListResourcesTool,
  mcpReadResourceTool,
} from './advanced.js';

import { ToolRegistry } from './registry.js';
import { bashTool } from './bash.js';
import { readTool } from './read.js';
import { writeTool } from './write.js';
import { editTool } from './edit.js';
import { globTool } from './glob.js';
import { grepTool } from './grep.js';
import { listDirTool } from './list-dir.js';
import { webFetchTool } from './web-fetch.js';
import { webSearchTool } from './web-search.js';
import { askUserTool } from './ask-user.js';
import { todoWriteTool } from './todo-write.js';
import { cronCreateTool, cronDeleteTool, cronListTool } from './cron.js';
import {
  taskCreateTool,
  taskGetTool,
  taskListTool,
  taskStopTool,
  taskUpdateTool,
} from './tasks.js';
import { agentTool } from './agent.js';
import { skillTool } from './skill.js';
import {
  notebookEditTool,
  lspTool,
  mcpListResourcesTool,
  mcpReadResourceTool,
} from './advanced.js';

/**
 * Create a ToolRegistry pre-populated with all built-in tools.
 */
export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Core tools
  registry.register(bashTool);
  registry.register(readTool);
  registry.register(writeTool);
  registry.register(editTool);
  registry.register(globTool);
  registry.register(grepTool);
  registry.register(listDirTool);

  // Web tools
  registry.register(webFetchTool);
  registry.register(webSearchTool);

  // Interactive tools
  registry.register(askUserTool);
  registry.register(todoWriteTool);

  // Cron tools
  registry.register(cronCreateTool);
  registry.register(cronDeleteTool);
  registry.register(cronListTool);

  // Task/agent tools
  registry.register(taskCreateTool);
  registry.register(taskGetTool);
  registry.register(taskListTool);
  registry.register(taskStopTool);
  registry.register(taskUpdateTool);
  registry.register(agentTool);

  // Advanced tools
  registry.register(skillTool);
  registry.register(notebookEditTool);
  registry.register(lspTool);
  registry.register(mcpListResourcesTool);
  registry.register(mcpReadResourceTool);

  return registry;
}
