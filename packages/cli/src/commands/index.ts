export type { SlashCommand, CommandContext, CommandResult } from './types.js';
export type { ToolRegistryLike, MCPManagerLike, MCPClientLike, ToolDefinition } from './types.js';
export { CommandRegistry } from './registry.js';
export { helpCommand, setHelpRegistry } from './help.js';
export { modelCommand } from './model.js';
export { modeCommand } from './mode.js';
export { clearCommand } from './clear.js';
export { compactCommand } from './compact.js';
export { costCommand } from './cost.js';
export { historyCommand } from './history.js';
export { exitCommand } from './exit.js';
export { initCommand } from './init.js';
export { toolsCommand } from './tools.js';
export { mcpCommand } from './mcp.js';
export { updateCommand } from './update.js';

import { CommandRegistry } from './registry.js';
import { helpCommand, setHelpRegistry } from './help.js';
import { modelCommand } from './model.js';
import { modeCommand } from './mode.js';
import { clearCommand } from './clear.js';
import { compactCommand } from './compact.js';
import { costCommand } from './cost.js';
import { historyCommand } from './history.js';
import { exitCommand } from './exit.js';
import { initCommand } from './init.js';
import { toolsCommand } from './tools.js';
import { mcpCommand } from './mcp.js';
import { updateCommand } from './update.js';

export function createCommandRegistry(): CommandRegistry {
  const registry = new CommandRegistry();
  registry.register(helpCommand);
  registry.register(modelCommand);
  registry.register(modeCommand);
  registry.register(clearCommand);
  registry.register(compactCommand);
  registry.register(costCommand);
  registry.register(historyCommand);
  registry.register(exitCommand);
  registry.register(initCommand);
  registry.register(toolsCommand);
  registry.register(mcpCommand);
  registry.register(updateCommand);

  // Wire up help command so it can list all registered commands
  setHelpRegistry(registry);

  return registry;
}
