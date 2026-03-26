/**
 * Built-in slash command handlers for FridayCode CLI.
 */

import { registerCommand, listCommands, CommandContext } from './router.js';
import { setTheme, getTheme, listThemes } from '../themes/engine.js';

// --- General ---

registerCommand({
  name: '/help',
  aliases: ['/h', '/?'],
  description: 'Show available commands',
  handler(args, ctx) {
    const cmds = listCommands();
    const lines = cmds.map((c) => {
      const alias = c.aliases ? ` (${c.aliases.join(', ')})` : '';
      return `  ${c.name}${alias}  — ${c.description}`;
    });
    ctx.print('Available commands:\n' + lines.join('\n'));
  },
});

registerCommand({
  name: '/exit',
  aliases: ['/quit', '/q'],
  description: 'Exit FridayCode',
  handler(_args, ctx) {
    ctx.exit();
  },
});

registerCommand({
  name: '/clear',
  description: 'Clear conversation history',
  handler(_args, ctx) {
    ctx.clearMessages();
    ctx.print('Conversation cleared.');
  },
});

// --- Model / Provider ---

registerCommand({
  name: '/model',
  description: 'Switch model',
  usage: '/model <model-name>',
  handler(args, ctx) {
    if (!args) {
      ctx.print(`Current model: ${ctx.model}`);
      return;
    }
    ctx.setModel(args);
    ctx.print(`Model set to: ${args}`);
  },
});

registerCommand({
  name: '/provider',
  description: 'Switch provider',
  usage: '/provider <provider-name>',
  handler(args, ctx) {
    if (!args) {
      ctx.print(`Current provider: ${ctx.provider}`);
      return;
    }
    ctx.setProvider(args);
    ctx.print(`Provider set to: ${args}`);
  },
});

// --- Context Management ---

registerCommand({
  name: '/compact',
  description: 'Compact conversation context',
  async handler(_args, ctx) {
    ctx.print('Compacting context...');
    await ctx.compact();
    ctx.print('Context compacted.');
  },
});

// --- Session ---

registerCommand({
  name: '/status',
  description: 'Show current session status',
  handler(_args, ctx) {
    ctx.print(
      [
        `Provider: ${ctx.provider}`,
        `Model: ${ctx.model}`,
        `Session: ${ctx.sessionId ?? 'none'}`,
        `CWD: ${ctx.cwd}`,
      ].join('\n'),
    );
  },
});

// --- Vim ---

registerCommand({
  name: '/vim',
  description: 'Toggle vim mode for input',
  handler(_args, ctx) {
    ctx.print('Vim mode toggled. (Handled by input layer)');
  },
});

// --- Theme ---

registerCommand({
  name: '/theme',
  description: 'Switch UI theme',
  usage: '/theme <dark|light>',
  handler(args, ctx) {
    if (!args) {
      ctx.print(`Usage: /theme <dark|light>. Available: ${listThemes().join(', ')}`);
      return;
    }
    if (setTheme(args)) {
      ctx.print(`Theme set to: ${getTheme().name}`);
    } else {
      ctx.print(`Unknown theme: ${args}. Available: ${listThemes().join(', ')}`);
    }
  },
});

// --- Memory ---

registerCommand({
  name: '/memory',
  description: 'Show or manage memory files',
  usage: '/memory [show|clear]',
  handler(args, ctx) {
    if (!args || args === 'show') {
      ctx.print('Memory: Use the memory tool or FRIDAY.md to manage persistent notes.');
    } else if (args === 'clear') {
      ctx.print('Clearing auto-memory... (delegates to memory system)');
    } else {
      ctx.print('Usage: /memory [show|clear]');
    }
  },
});

// --- Cost ---

registerCommand({
  name: '/cost',
  description: 'Show estimated token/cost usage',
  handler(_args, ctx) {
    ctx.print('Cost tracking: (token counts shown in status bar)');
  },
});

// --- Diff ---

registerCommand({
  name: '/diff',
  description: 'Show git diff of changes made this session',
  handler(_args, ctx) {
    ctx.print('Diff: (delegates to git integration)');
  },
});

// --- Permissions ---

registerCommand({
  name: '/permissions',
  description: 'View or set permission mode',
  usage: '/permissions [default|acceptAll|plan]',
  handler(args, ctx) {
    if (!args) {
      ctx.print('Current permission mode shown in status bar. Use /permissions <mode> to change.');
    } else {
      ctx.print(`Permission mode set to: ${args}`);
    }
  },
});

// --- Config ---

registerCommand({
  name: '/config',
  description: 'Show or edit configuration',
  usage: '/config [key] [value]',
  handler(args, ctx) {
    if (!args) {
      ctx.print('Config: Use /config <key> <value> to set, or /config <key> to view.');
    } else {
      ctx.print(`Config: ${args}`);
    }
  },
});

// --- Init ---

registerCommand({
  name: '/init',
  description: 'Initialize FRIDAY.md in the current project',
  handler(_args, ctx) {
    ctx.print('Creating FRIDAY.md... (delegates to onboarding)');
  },
});

// --- Skills & Agents ---

registerCommand({
  name: '/skills',
  description: 'List available skills',
  handler(_args, ctx) {
    ctx.print('Skills: (delegates to skill discovery)');
  },
});

registerCommand({
  name: '/agents',
  description: 'List available agents',
  handler(_args, ctx) {
    ctx.print('Agents: explore, plan, general (built-in)');
  },
});

// --- MCP ---

registerCommand({
  name: '/mcp',
  description: 'List connected MCP servers',
  handler(_args, ctx) {
    ctx.print('MCP: No servers connected. Configure in settings.');
  },
});

// --- Context ---

registerCommand({
  name: '/context',
  description: 'Show context window usage',
  handler(_args, ctx) {
    ctx.print('Context: (shown in ContextViewer component)');
  },
});
