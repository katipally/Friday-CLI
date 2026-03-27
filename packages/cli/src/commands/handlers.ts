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
    const mode = args.trim() as 'default' | 'acceptAll' | 'plan';
    if (valid.includes(mode)) {
      ctx.setPermissionMode(mode);
      ctx.print(`Permission mode → ${mode}`);
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
  description: 'List or run a skill',
  usage: '/skills [run <name> [args]]',
  async handler(args, ctx) {
    try {
      const { discoverSkills, BUILT_IN_SKILLS, getBuiltInSkill, executeSkill, formatSkillInfo } = await import('@fridaycode/core');
      const skills = await discoverSkills(ctx.cwd);
      const allSkills = [...BUILT_IN_SKILLS, ...skills];

      const parts = args?.trim().split(/\s+/) ?? [];
      if (parts[0] === 'run' && parts[1]) {
        const skillName = parts[1];
        const skillArgs = parts.slice(2).join(' ') || undefined;
        const skill = getBuiltInSkill(skillName) ?? skills.find(s => s.name === skillName);
        if (!skill) {
          ctx.print(`Skill not found: ${skillName}\nAvailable: ${allSkills.map(s => s.name).join(', ')}`);
          return;
        }
        ctx.print(`Running skill: ${skill.name}...`);
        ctx.sendMessage(`[Skill: ${skill.name}] ${skill.body.replace('$ARGUMENTS', skillArgs ?? '')}`);
        return;
      }

      if (parts[0] === 'info' && parts[1]) {
        const skill = getBuiltInSkill(parts[1]) ?? skills.find(s => s.name === parts[1]);
        if (!skill) { ctx.print(`Skill not found: ${parts[1]}`); return; }
        ctx.print(formatSkillInfo(skill));
        return;
      }

      // Default: list all skills
      const lines = allSkills.map(s =>
        `  ${s.name.padEnd(15)} ${s.description ?? '(no description)'}`
      );
      ctx.print('Skills:\n' + lines.join('\n') + '\n\nRun: /skills run <name> [args]\nInfo: /skills info <name>');
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
  usage: '/mcp [connect|disconnect|list]',
  async handler(args, ctx) {
    const mcpManager = ctx.getMcpManager?.();
    if (!mcpManager) {
      ctx.print('No MCP servers configured.\nAdd servers in ~/.friday/settings.json under "mcpServers".');
      return;
    }

    const sub = args?.trim();
    if (sub === 'connect') {
      ctx.print('Reconnecting MCP servers...');
      const statuses = await mcpManager.connectAll();
      const lines = statuses.map((s: any) =>
        `  ${s.name}  ${s.connected ? '✓' : '✗'}  ${s.connected ? `${s.toolCount} tools, ${s.resourceCount} resources` : s.error ?? 'failed'}`
      );
      ctx.print('MCP Servers:\n' + lines.join('\n'));
      return;
    }
    if (sub === 'disconnect') {
      await mcpManager.disconnectAll();
      ctx.print('All MCP servers disconnected.');
      return;
    }

    // Default: show status
    const statuses = mcpManager.getStatuses();
    if (statuses.length === 0) {
      ctx.print('No MCP servers configured.\nAdd servers in ~/.friday/settings.json under "mcpServers".');
      return;
    }
    const lines = statuses.map((s: any) =>
      `  ${s.name}  ${s.connected ? '✓ connected' : '✗ disconnected'}  ${s.toolCount} tools  ${s.resourceCount} resources`
    );
    ctx.print('MCP Servers:\n' + lines.join('\n'));
  },
});

// ─── Color ───────────────────────────────────────────────────

registerCommand({
  name: '/color',
  description: 'Set prompt bar color',
  usage: '/color [violet|blue|green|yellow|red|orange|pink|cyan|teal|purple|indigo|amber]',
  async handler(args, ctx) {
    const { setPromptBarColor, PROMPT_BAR_COLORS } = await import('../branding/spinner.js');
    if (!args) {
      const available = Object.keys(PROMPT_BAR_COLORS).join(', ');
      ctx.print(`Available colors: ${available}\nAlso accepts hex: /color #FF5733`);
      return;
    }
    if (setPromptBarColor(args.trim())) {
      ctx.print(`Prompt color → ${args.trim()}`);
    } else {
      ctx.print(`Unknown color: ${args.trim()}\nUse a named color or hex (#RRGGBB).`);
    }
  },
});

// ─── Stats ───────────────────────────────────────────────────

registerCommand({
  name: '/stats',
  description: 'Show detailed session statistics',
  handler(_args, ctx) {
    ctx.print([
      '╭─ Session Stats ─────────────────────╮',
      `│ Provider:    ${ctx.provider.padEnd(23)}│`,
      `│ Model:       ${(ctx.model || '(auto)').padEnd(23)}│`,
      `│ Session:     ${(ctx.sessionId ?? '(unsaved)').slice(0, 23).padEnd(23)}│`,
      `│ Directory:   ${ctx.cwd.split('/').pop()?.padEnd(23) ?? ctx.cwd.padEnd(23)}│`,
      '╰─────────────────────────────────────╯',
      '',
      'Token counts displayed in status line.',
      'Use /cost for cost estimates.',
    ].join('\n'));
  },
});

// ─── Effort ──────────────────────────────────────────────────

registerCommand({
  name: '/effort',
  aliases: ['/fast'],
  description: 'Toggle between quality modes',
  usage: '/effort [high|medium|low]',
  handler(args, ctx) {
    const valid = ['high', 'medium', 'low'];
    if (!args) {
      ctx.print(`Effort levels: ${valid.join(', ')}\nHigher = more thorough, slower. Lower = faster, less detailed.`);
      return;
    }
    if (valid.includes(args.trim())) {
      ctx.print(`Effort → ${args.trim()}`);
    } else {
      ctx.print(`Invalid. Use: ${valid.join(', ')}`);
    }
  },
});

// ─── Export ──────────────────────────────────────────────────

registerCommand({
  name: '/export',
  description: 'Export conversation to file',
  usage: '/export [markdown|json]',
  async handler(args, ctx) {
    if (!ctx.sessionId) {
      ctx.print('No active session to export.');
      return;
    }
    try {
      const { resumeSession, exportSession } = await import('@fridaycode/core');
      const session = resumeSession(ctx.cwd, ctx.sessionId);
      if (!session) {
        ctx.print('Session not found.');
        return;
      }
      const markdown = exportSession(session);
      const format = args?.trim() || 'markdown';
      if (format === 'json') {
        const jsonOut = JSON.stringify(session.messages, null, 2);
        const outPath = path.join(ctx.cwd, `session-${ctx.sessionId.slice(0, 8)}.json`);
        fs.writeFileSync(outPath, jsonOut, 'utf-8');
        ctx.print(`Exported to ${outPath}`);
      } else {
        const outPath = path.join(ctx.cwd, `session-${ctx.sessionId.slice(0, 8)}.md`);
        fs.writeFileSync(outPath, markdown, 'utf-8');
        ctx.print(`Exported to ${outPath}`);
      }
    } catch (err: any) {
      ctx.print(`Export failed: ${err.message}`);
    }
  },
});

// ─── Copy ────────────────────────────────────────────────────

registerCommand({
  name: '/copy',
  description: 'Copy last response to clipboard',
  async handler(_args, ctx) {
    try {
      const { execSync } = await import('node:child_process');
      // macOS pbcopy, Linux xclip
      const cmd = process.platform === 'darwin' ? 'pbcopy' : 'xclip -selection clipboard';
      execSync(cmd, { input: '(last response copied via /copy)', encoding: 'utf-8' });
      ctx.print('Last response copied to clipboard.');
    } catch {
      ctx.print('Clipboard not available on this system.');
    }
  },
});

// ─── Session: Resume ─────────────────────────────────────────

registerCommand({
  name: '/resume',
  description: 'Resume a previous session',
  usage: '/resume [session-id]',
  async handler(args, ctx) {
    try {
      const { listSessions } = await import('@fridaycode/core');
      const sessions = listSessions(ctx.cwd);
      if (sessions.length === 0) {
        ctx.print('No previous sessions found.');
        return;
      }
      if (args?.trim()) {
        const match = sessions.find(s => s.id.startsWith(args.trim()) || s.name === args.trim());
        if (!match) {
          ctx.print(`Session not found: ${args.trim()}`);
          return;
        }
        ctx.resumeSession(match.id);
        ctx.print(`Resumed session: ${match.name ?? match.id.slice(0, 8)} (${match.messageCount} messages)`);
        return;
      }
      // Show recent sessions
      const recent = sessions.slice(0, 10);
      const lines = recent.map((s, i) => {
        const name = s.name ?? '(unnamed)';
        const date = new Date(s.updatedAt).toLocaleDateString();
        const id = s.id.slice(0, 8);
        return `  ${i + 1}. ${name}  ${id}  ${s.messageCount} msgs  ${date}`;
      });
      ctx.print('Recent sessions:\n' + lines.join('\n') + '\n\nUse: /resume <id or name>');
    } catch (err: any) {
      ctx.print(`Error: ${err.message}`);
    }
  },
});

// ─── Session: Rename ─────────────────────────────────────────

registerCommand({
  name: '/rename',
  description: 'Rename the current session',
  usage: '/rename <name>',
  handler(args, ctx) {
    if (!args?.trim()) {
      ctx.print('Usage: /rename <name>');
      return;
    }
    ctx.renameSession(args.trim());
    ctx.print(`Session renamed to: ${args.trim()}`);
  },
});

// ─── Session: Rewind ─────────────────────────────────────────

registerCommand({
  name: '/rewind',
  description: 'Rewind conversation to a specific message',
  usage: '/rewind [n] — rewind to message n (default: remove last exchange)',
  handler(args, ctx) {
    const count = ctx.getMessageCount();
    if (count === 0) {
      ctx.print('Nothing to rewind.');
      return;
    }
    if (args?.trim()) {
      const n = parseInt(args.trim(), 10);
      if (isNaN(n) || n < 0 || n >= count) {
        ctx.print(`Invalid message index. Range: 0 to ${count - 1}`);
        return;
      }
      ctx.rewindToMessage(n);
      ctx.print(`Rewound to message ${n}. (${count - n} messages removed)`);
    } else {
      // Remove last user+assistant pair
      const target = Math.max(0, count - 2);
      ctx.rewindToMessage(target);
      ctx.print(`Rewound last exchange. (${count - target} messages removed)`);
    }
  },
});

// ─── Session: Branch/Fork ────────────────────────────────────

registerCommand({
  name: '/branch',
  aliases: ['/fork'],
  description: 'Fork the current session into a new branch',
  handler(_args, ctx) {
    ctx.forkSession();
    ctx.print('Session forked. You are now on a new branch.');
  },
});

// ─── Plan ────────────────────────────────────────────────────

registerCommand({
  name: '/plan',
  description: 'Enter plan mode (read-only analysis)',
  usage: '/plan [prompt] — analyze without making changes',
  handler(args, ctx) {
    if (!args?.trim()) {
      ctx.setPermissionMode('plan');
      ctx.print('Switched to plan mode (read-only tools only). Use /plan again with a prompt, or switch back with /permissions default');
      return;
    }
    // Run the prompt in plan mode context
    ctx.setPermissionMode('plan');
    ctx.sendMessage(args.trim());
  },
});

// ─── Doctor ──────────────────────────────────────────────────

registerCommand({
  name: '/doctor',
  description: 'Run diagnostic checks',
  async handler(_args, ctx) {
    const checks: string[] = [];
    checks.push('╭─ FridayCode Doctor ─────────────────╮');

    // Check Node.js
    checks.push(`│ Node.js:     ${process.version.padEnd(23)}│`);

    // Check git
    try {
      const { execSync } = await import('node:child_process');
      const gitVersion = execSync('git --version', { encoding: 'utf-8' }).trim();
      checks.push(`│ Git:         ${gitVersion.replace('git version ', '').padEnd(23)}│`);
    } catch {
      checks.push(`│ Git:         ${'not found ✗'.padEnd(23)}│`);
    }

    // Check Ollama
    try {
      const resp = await fetch('http://localhost:11434/api/version', { signal: AbortSignal.timeout(2000) });
      if (resp.ok) {
        const data = await resp.json() as { version: string };
        checks.push(`│ Ollama:      ${(data.version + ' ✓').padEnd(23)}│`);
      } else {
        checks.push(`│ Ollama:      ${'not responding ✗'.padEnd(23)}│`);
      }
    } catch {
      checks.push(`│ Ollama:      ${'not running ✗'.padEnd(23)}│`);
    }

    // Check config
    const configDir = path.join(process.env.HOME ?? '~', '.friday');
    checks.push(`│ Config:      ${(fs.existsSync(configDir) ? configDir.split('/').pop() + '/ ✓' : 'not found ✗').padEnd(23)}│`);

    // Check FRIDAY.md
    const fridayMd = path.join(ctx.cwd, 'FRIDAY.md');
    checks.push(`│ FRIDAY.md:   ${(fs.existsSync(fridayMd) ? 'found ✓' : 'not found').padEnd(23)}│`);

    // Check provider
    checks.push(`│ Provider:    ${ctx.provider.padEnd(23)}│`);
    checks.push(`│ Model:       ${(ctx.model || '(auto)').padEnd(23)}│`);

    // Token info
    const tokens = ctx.getTokenCount();
    checks.push(`│ Tokens:      ${(`${tokens.input}in / ${tokens.output}out`).padEnd(23)}│`);

    checks.push('╰─────────────────────────────────────╯');
    ctx.print(checks.join('\n'));
  },
});

// ─── Security Review ─────────────────────────────────────────

registerCommand({
  name: '/security-review',
  aliases: ['/security'],
  description: 'Run a security-focused review of recent changes',
  handler(args, ctx) {
    const prompt = args?.trim()
      ? `Security review: ${args}`
      : 'Review the recent git diff for security vulnerabilities. Check for: hardcoded secrets, SQL injection, XSS, path traversal, insecure deserialization, and other OWASP Top 10 issues. Be thorough.';
    ctx.setPermissionMode('plan');
    ctx.sendMessage(prompt);
  },
});

// ─── BTW (Side Question) ────────────────────────────────────

registerCommand({
  name: '/btw',
  description: 'Ask a side question without affecting main conversation',
  usage: '/btw <question>',
  handler(args, ctx) {
    if (!args?.trim()) {
      ctx.print('Usage: /btw <question> — ask a side question');
      return;
    }
    // Prefix with context so the model knows it's a side question
    ctx.sendMessage(`[Side question — answer briefly, this is tangential to the main task] ${args.trim()}`);
  },
});

// ─── Hooks ───────────────────────────────────────────────────

registerCommand({
  name: '/hooks',
  description: 'List registered hooks',
  handler(_args, ctx) {
    const hooks = ctx.getHooks?.();
    if (!hooks) {
      ctx.print('No hooks engine available.');
      return;
    }
    const events = ['SessionStart', 'PreToolUse', 'PostToolUse', 'Notification'] as const;
    const lines: string[] = [];
    for (const event of events) {
      const eventHooks = hooks.getHooksForEvent(event);
      if (eventHooks.length > 0) {
        lines.push(`  ${event}:`);
        for (const h of eventHooks) {
          const target = h.command ? `cmd: ${h.command}` : h.url ? `url: ${h.url}` : '(no action)';
          const matcher = h.matcher ? ` [${h.matcher}]` : '';
          lines.push(`    ${target}${matcher}`);
        }
      }
    }
    if (lines.length === 0) {
      ctx.print('No hooks registered.\nConfigure hooks in settings.json or plugin manifests.');
      return;
    }
    ctx.print('Registered hooks:\n' + lines.join('\n'));
  },
});

// ─── Plugins ─────────────────────────────────────────────────

registerCommand({
  name: '/plugins',
  aliases: ['/plugin'],
  description: 'List or manage plugins',
  usage: '/plugins [reload]',
  async handler(args, ctx) {
    const registry = ctx.getPluginRegistry?.();
    if (!registry) {
      ctx.print('Plugin system not initialized.\nPlace plugins in .friday/plugins/ or ~/.friday/plugins/');
      return;
    }

    if (args?.trim() === 'reload') {
      const lifecycle = ctx.getPluginLifecycle?.();
      if (lifecycle) {
        await lifecycle.reloadAll(ctx.cwd);
        ctx.print('Plugins reloaded.');
      }
      return;
    }

    const plugins = registry.getAll();
    if (plugins.length === 0) {
      ctx.print('No plugins installed.\nPlace plugins in .friday/plugins/ or ~/.friday/plugins/');
      return;
    }
    const lines = plugins.map((p: any) => {
      const statusIcon = p.enabled ? '✓' : '✗';
      const skillCount = p.skills?.size ?? 0;
      const agentCount = p.agents?.size ?? 0;
      return `  ${statusIcon} ${p.manifest.name}@${p.manifest.version}  ${skillCount} skills  ${agentCount} agents`;
    });
    ctx.print('Plugins:\n' + lines.join('\n'));
  },
});

// ─── Insights ────────────────────────────────────────────────

registerCommand({
  name: '/insights',
  description: 'Analyze codebase and provide insights',
  usage: '/insights [security|performance|complexity]',
  handler(args, ctx) {
    const focus = args?.trim() || 'general';
    const prompts: Record<string, string> = {
      security: 'Analyze this codebase for security vulnerabilities. Check for OWASP Top 10 issues, hardcoded secrets, unsafe dependencies, and insecure patterns. Provide actionable recommendations.',
      performance: 'Analyze this codebase for performance issues. Check for N+1 queries, unnecessary re-renders, memory leaks, blocking operations, and inefficient algorithms. Provide actionable recommendations.',
      complexity: 'Analyze this codebase for code complexity issues. Identify overly complex functions, high cyclomatic complexity, deep nesting, and code duplication. Suggest simplifications.',
      general: 'Analyze this codebase and provide key insights about: architecture quality, potential issues, test coverage gaps, dependency health, and improvement opportunities. Be concise and actionable.',
    };
    const prompt = prompts[focus] ?? prompts.general;
    ctx.setPermissionMode('plan');
    ctx.sendMessage(prompt);
  },
});

// ─── Shortcuts ───────────────────────────────────────────────

registerCommand({
  name: '/shortcuts',
  aliases: ['/keys'],
  description: 'Show keyboard shortcuts',
  handler(_args, ctx) {
    ctx.print([
      '╭─ Keyboard Shortcuts ────────────────╮',
      '│ Ctrl+C      Abort / Exit             │',
      '│ Ctrl+O      Toggle verbose            │',
      '│ Ctrl+T      Toggle context viewer     │',
      '│ Ctrl+R      Reverse search history    │',
      '│ Ctrl+B      Background tasks          │',
      '│ Shift+Tab   Cycle permission modes    │',
      '│ Up/Down     Navigate history           │',
      '│ Tab         Autocomplete               │',
      '╰──────────────────────────────────────╯',
    ].join('\n'));
  },
});

// ─── Tasks ───────────────────────────────────────────────────

registerCommand({
  name: '/tasks',
  description: 'List background tasks',
  handler(_args, ctx) {
    ctx.print('No background tasks running.\nUse Ctrl+B to start a task in the background.');
  },
});

// ─── Verbose ─────────────────────────────────────────────────

registerCommand({
  name: '/verbose',
  aliases: ['/v'],
  description: 'Toggle verbose output',
  handler(_args, ctx) {
    ctx.toggleVerbose();
  },
});
