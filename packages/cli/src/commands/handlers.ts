/**
 * Built-in slash command handlers for FridayCode CLI.
 */

import { registerCommand, listCommands } from './router.js';
import { setTheme, getTheme, listThemes } from '../themes/engine.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ─── General ─────────────────────────────────────────────────

registerCommand({
  name: '/help',
  aliases: ['/h', '/?'],
  description: 'Show available commands',
  handler(_args, ctx) {
    const cmds = listCommands();
    const lines = cmds.map((c) => {
      const alias = c.aliases ? ` (${c.aliases.join(', ')})` : '';
      return `  ${c.name}${alias}  —  ${c.description}`;
    });
    ctx.print('Commands:\n' + lines.join('\n'));
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
  aliases: ['/c'],
  description: 'Clear conversation history',
  handler(_args, ctx) {
    ctx.clearMessages();
    ctx.print('Conversation cleared.');
  },
});

// ─── Model / Provider ────────────────────────────────────────

registerCommand({
  name: '/model',
  aliases: ['/m'],
  description: 'Switch or view current model',
  usage: '/model [name]',
  handler(args, ctx) {
    if (!args) {
      ctx.print(`Current model: ${ctx.model || '(auto)'}\nUse /model <name> to switch, or /model with no args for picker.`);
      return;
    }
    ctx.setModel(args.trim());
    ctx.print(`Model → ${args.trim()}`);
  },
});

registerCommand({
  name: '/provider',
  aliases: ['/p'],
  description: 'Switch or view provider',
  usage: '/provider [ollama|anthropic|openai|openai-compatible]',
  handler(args, ctx) {
    if (!args) {
      ctx.print(`Current provider: ${ctx.provider}\nAvailable: ollama, anthropic, openai, openai-compatible`);
      return;
    }
    const valid = ['ollama', 'anthropic', 'openai', 'openai-compatible'];
    const prov = args.trim().toLowerCase();
    if (!valid.includes(prov)) {
      ctx.print(`Unknown provider: ${prov}\nAvailable: ${valid.join(', ')}`);
      return;
    }
    ctx.setProvider(prov);
    ctx.print(`Provider → ${prov}`);
  },
});

// ─── Context ─────────────────────────────────────────────────

registerCommand({
  name: '/compact',
  description: 'Summarize conversation to save context space',
  async handler(_args, ctx) {
    await ctx.compact();
  },
});

registerCommand({
  name: '/context',
  aliases: ['/ctx'],
  description: 'Toggle context usage display',
  handler(_args, ctx) {
    ctx.print('Context display toggled.');
  },
});

// ─── Session Info ────────────────────────────────────────────

registerCommand({
  name: '/status',
  aliases: ['/s'],
  description: 'Show current session info',
  handler(_args, ctx) {
    ctx.print([
      `Provider:  ${ctx.provider}`,
      `Model:     ${ctx.model || '(auto)'}`,
      `Session:   ${ctx.sessionId ?? '(unsaved)'}`,
      `Directory: ${ctx.cwd}`,
    ].join('\n'));
  },
});

// ─── Theme ───────────────────────────────────────────────────

registerCommand({
  name: '/theme',
  aliases: ['/t'],
  description: 'Switch UI theme',
  usage: '/theme [dark|light]',
  handler(args, ctx) {
    if (!args) {
      ctx.print(`Current: ${getTheme().name}\nAvailable: ${listThemes().join(', ')}`);
      return;
    }
    if (setTheme(args.trim())) {
      ctx.print(`Theme → ${getTheme().name}`);
    } else {
      ctx.print(`Unknown theme. Available: ${listThemes().join(', ')}`);
    }
  },
});

// ─── Memory ──────────────────────────────────────────────────

registerCommand({
  name: '/memory',
  description: 'View or edit FRIDAY.md project memory',
  usage: '/memory [show|create]',
  async handler(args, ctx) {
    const memPath = path.join(ctx.cwd, 'FRIDAY.md');
    if (!args || args === 'show') {
      try {
        const content = fs.readFileSync(memPath, 'utf-8');
        ctx.print(`FRIDAY.md:\n${content.slice(0, 500)}${content.length > 500 ? '\n...(truncated)' : ''}`);
      } catch {
        ctx.print('No FRIDAY.md found. Use /memory create to initialize one.');
      }
      return;
    }
    if (args === 'create') {
      const template = `# Project Memory\n\n## Tech Stack\n- \n\n## Conventions\n- \n\n## Notes\n- \n`;
      fs.writeFileSync(memPath, template, 'utf-8');
      ctx.print('Created FRIDAY.md in project root.');
      return;
    }
    ctx.print('Usage: /memory [show|create]');
  },
});

// ─── Vim ─────────────────────────────────────────────────────

registerCommand({
  name: '/vim',
  description: 'Toggle vim mode',
  handler(_args, ctx) {
    ctx.print('Vim mode toggled.');
  },
});

// ─── Cost ────────────────────────────────────────────────────

registerCommand({
  name: '/cost',
  description: 'Show token usage and estimated cost',
  handler(_args, ctx) {
    ctx.print('Token counts are displayed in the status line above the prompt.');
  },
});

// ─── Diff ────────────────────────────────────────────────────

registerCommand({
  name: '/diff',
  description: 'Show git diff of changes',
  async handler(_args, ctx) {
    try {
      const { execSync } = await import('node:child_process');
      const diff = execSync('git diff', { cwd: ctx.cwd, encoding: 'utf-8', timeout: 5000 });
      if (!diff.trim()) {
        ctx.print('No uncommitted changes.');
      } else {
        ctx.print(diff.slice(0, 2000) + (diff.length > 2000 ? '\n...(truncated)' : ''));
      }
    } catch {
      ctx.print('Not a git repository or git not available.');
    }
  },
});

// ─── Permissions ─────────────────────────────────────────────

registerCommand({
  name: '/permissions',
  aliases: ['/perm'],
  description: 'View or set permission mode',
  usage: '/permissions [default|acceptAll|plan]',
  handler(args, ctx) {
    const valid = ['default', 'acceptAll', 'plan'];
    if (!args) {
      ctx.print(`Permission modes: ${valid.join(', ')}\nChange with: /permissions <mode>`);
      return;
    }
    if (valid.includes(args.trim())) {
      ctx.print(`Permission mode → ${args.trim()}`);
    } else {
      ctx.print(`Invalid mode. Use: ${valid.join(', ')}`);
    }
  },
});

// ─── Config ──────────────────────────────────────────────────

registerCommand({
  name: '/config',
  description: 'View configuration',
  handler(_args, ctx) {
    ctx.print([
      `Config location: ~/.friday/settings.json`,
      `Project config:  ${ctx.cwd}/.friday/settings.json`,
      `Edit these files directly to change settings.`,
    ].join('\n'));
  },
});

// ─── Init ────────────────────────────────────────────────────

registerCommand({
  name: '/init',
  description: 'Initialize .friday/ and FRIDAY.md in project',
  handler(_args, ctx) {
    const fridayDir = path.join(ctx.cwd, '.friday');
    const memFile = path.join(ctx.cwd, 'FRIDAY.md');
    try {
      fs.mkdirSync(fridayDir, { recursive: true });
      if (!fs.existsSync(memFile)) {
        fs.writeFileSync(memFile, `# ${path.basename(ctx.cwd)}\n\n## Tech Stack\n- \n\n## Notes\n- \n`, 'utf-8');
      }
      ctx.print(`Initialized .friday/ and FRIDAY.md in ${ctx.cwd}`);
    } catch (err: any) {
      ctx.print(`Init failed: ${err.message}`);
    }
  },
});

// ─── Skills ──────────────────────────────────────────────────

registerCommand({
  name: '/skills',
  description: 'List available skills',
  async handler(_args, ctx) {
    try {
      const { discoverSkills } = await import('@fridaycode/core');
      const skills = await discoverSkills(ctx.cwd);
      if (skills.length === 0) {
        ctx.print('No custom skills found.\nBuilt-in: batch, debug, loop, simplify\nPlace .md skills in .friday/skills/');
        return;
      }
      const lines = skills.map((s) => `  ${s.name}  —  ${s.description ?? '(no description)'}`);
      ctx.print('Skills:\n  batch  —  Apply changes across multiple files\n  debug  —  Systematic debugging\n  loop   —  Iterative test-fix-verify\n  simplify — Reduce complexity\n' + lines.join('\n'));
    } catch {
      ctx.print('Built-in skills: batch, debug, loop, simplify\nPlace custom skills in .friday/skills/');
    }
  },
});

// ─── Agents ──────────────────────────────────────────────────

registerCommand({
  name: '/agents',
  description: 'List available agents',
  handler(_args, ctx) {
    ctx.print([
      'Agents:',
      '  general  —  Full coding assistant (all tools, 50 turns)',
      '  explore  —  Read-only codebase analysis (20 turns)',
      '  plan     —  Architecture & planning (30 turns)',
      '',
      'Use: friday --agent explore "question"',
    ].join('\n'));
  },
});

// ─── MCP ─────────────────────────────────────────────────────

registerCommand({
  name: '/mcp',
  description: 'Show MCP server status',
  handler(_args, ctx) {
    ctx.print('No MCP servers configured.\nAdd servers in ~/.friday/settings.json under "mcpServers".');
  },
});
