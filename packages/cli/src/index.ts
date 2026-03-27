import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import { APP_NAME, CLI_COMMAND } from '@fridaycode/shared';
import { loadSettings } from '@fridaycode/core';
import { App } from './app.js';

export interface CliOptions {
  model?: string;
  provider?: string;
  agent?: string;
  skill?: string;
  session?: string;
  resume?: boolean;
  pipe?: boolean;
  json?: boolean;
  maxTurns?: number;
  verbose?: boolean;
  acceptAll?: boolean;
  plan?: boolean;
}

export async function main(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name(CLI_COMMAND)
    .description(`${APP_NAME} — AI coding assistant in your terminal`)
    .version('0.1.0')
    .option('-m, --model <model>', 'Model to use (e.g., claude-sonnet-4-20250514)')
    .option('--provider <provider>', 'Provider to use (ollama, anthropic, openai)')
    .option('--agent <name>', 'Use a named agent')
    .option('--skill <name>', 'Run a skill')
    .option('-s, --session <id>', 'Resume a specific session')
    .option('-r, --resume', 'Resume the last session')
    .option('-p, --pipe', 'Pipe mode: read stdin, output plain text')
    .option('--json', 'Output JSON (for pipe mode)')
    .option('--max-turns <n>', 'Maximum conversation turns', parseInt)
    .option('-v, --verbose', 'Enable verbose output')
    .option('-y, --accept-all', 'Accept all tool permissions automatically')
    .option('--plan', 'Plan mode: read-only tools only')
    .argument('[prompt...]', 'Initial prompt (if provided, runs non-interactively)');

  program.parse(['node', CLI_COMMAND, ...argv]);

  const opts = program.opts<CliOptions>();
  const promptArgs = program.args;

  // Load user settings
  const settings = loadSettings(process.cwd());

  // Override settings with CLI flags
  if (opts.model) settings.activeModel = opts.model;
  if (opts.provider) settings.activeProvider = opts.provider;
  if (opts.acceptAll) settings.permissionMode = 'acceptAll';
  if (opts.plan) settings.permissionMode = 'plan';
  if (opts.maxTurns) settings.compactMessageThreshold = opts.maxTurns;

  // Handle session resume — validate session exists but let app.tsx handle actual resume
  if (opts.session) {
    const { resumeSession } = await import('@fridaycode/core');
    const session = resumeSession(process.cwd(), opts.session);
    if (!session) {
      console.error(`Session "${opts.session}" not found.`);
      process.exit(1);
    }
  } else if (opts.resume) {
    const { listSessions } = await import('@fridaycode/core');
    const sessions = listSessions(process.cwd());
    if (sessions.length === 0) {
      console.error('No previous sessions found.');
      process.exit(1);
    }
    // Pass the most recent session ID to app
    opts.session = sessions[0].id;
  }

  // Pipe mode: non-interactive
  if (opts.pipe) {
    await runPipeMode(promptArgs.join(' '), settings, opts);
    return;
  }

  // Skill mode: run a named skill (requires interactive mode for full context)
  if (opts.skill) {
    const { discoverSkills } = await import('@fridaycode/core');
    const skills = await discoverSkills(process.cwd());
    const skill = skills.find((s) => s.name === opts.skill);
    if (!skill) {
      console.error(`Skill "${opts.skill}" not found. Available: ${skills.map((s) => s.name).join(', ')}`);
      process.exit(1);
    }
    // Pass skill as initial prompt with skill flag to the interactive app
    const initialPrompt = promptArgs.length > 0 ? promptArgs.join(' ') : undefined;
    const { waitUntilExit } = render(
      React.createElement(App, {
        settings,
        initialPrompt: initialPrompt ?? `Run skill: ${opts.skill}`,
        options: opts,
      }),
    );
    await waitUntilExit();
    return;
  }

  // If prompt provided as argument, run one-shot
  const initialPrompt = promptArgs.length > 0 ? promptArgs.join(' ') : undefined;

  // Interactive mode: render Ink app
  const { waitUntilExit } = render(
    React.createElement(App, {
      settings,
      initialPrompt,
      options: opts,
    }),
  );

  await waitUntilExit();
}

async function runPipeMode(
  prompt: string,
  settings: import('@fridaycode/shared').Settings,
  opts: CliOptions,
): Promise<void> {
  // Read stdin if available
  let stdinContent = '';
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    stdinContent = Buffer.concat(chunks).toString('utf-8');
  }

  const fullPrompt = stdinContent
    ? `${prompt}\n\n<stdin>\n${stdinContent}\n</stdin>`
    : prompt;

  if (!fullPrompt.trim()) {
    console.error('No prompt provided. Use: echo "code" | friday -p "explain"');
    process.exit(1);
  }

  // Create provider and run single turn
  const {
    createProvider,
    createDefaultToolRegistry,
    PermissionEngine,
    HookEngineImpl,
  } = await import('@fridaycode/core');

  const typedSettings = settings;
  const providerConfig = typedSettings.providers[typedSettings.activeProvider];
  if (!providerConfig) {
    console.error(`Provider "${typedSettings.activeProvider}" not configured.`);
    process.exit(1);
  }

  const provider = createProvider(providerConfig);
  const toolRegistry = createDefaultToolRegistry();
  const permissionRules = [
    ...typedSettings.permissions.allow.map((t: string) => ({ action: 'allow' as const, tool: t })),
    ...typedSettings.permissions.deny.map((t: string) => ({ action: 'deny' as const, tool: t })),
  ];
  const permissions = new PermissionEngine(typedSettings.permissionMode, permissionRules);
  const hooks = new HookEngineImpl();

  let output = '';
  const chatOptions: import('@fridaycode/shared').ChatOptions = {
    model: typedSettings.activeModel,
    provider: providerConfig.type,
    messages: [{ role: 'user', content: fullPrompt }],
    tools: toolRegistry.getDefinitions(),
    stream: true,
    maxTokens: typedSettings.maxTokens,
  };

  for await (const chunk of provider.chat(chatOptions)) {
    if (chunk.type === 'text' && chunk.content) {
      output += chunk.content;
      if (!opts.json) {
        process.stdout.write(chunk.content);
      }
    }
  }

  if (opts.json) {
    console.log(JSON.stringify({ content: output }));
  } else {
    console.log(); // Final newline
  }
}
