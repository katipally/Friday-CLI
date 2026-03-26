#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import { createProvider } from '@fridaycode/providers';
import { AgentLoop, PermissionSystem, SessionManager, CostTracker } from '@fridaycode/core';
import { App } from '@fridaycode/tui';
import { createDefaultRegistry } from '@fridaycode/tools';
import { MCPServerManager } from '@fridaycode/mcp';
import { createCommandRegistry } from '../commands/index.js';
import { loadConfig, loadProjectRules, ensureConfigDir } from '../config/loader.js';
import { needsOnboarding, runOnboarding } from '../onboarding/wizard.js';
import { getCurrentVersion } from '../config/version.js';
import type { AgentEvent, AgentMode } from '@fridaycode/core';
import type { CommandContext, CommandResult } from '../commands/types.js';
import type { Session } from '@fridaycode/core';

function detectProjectType(cwd: string): string | undefined {
  if (existsSync(join(cwd, 'package.json'))) return 'Node.js';
  if (existsSync(join(cwd, 'Cargo.toml'))) return 'Rust';
  if (existsSync(join(cwd, 'go.mod'))) return 'Go';
  if (existsSync(join(cwd, 'pyproject.toml'))) return 'Python';
  if (existsSync(join(cwd, 'requirements.txt'))) return 'Python';
  if (existsSync(join(cwd, 'pom.xml'))) return 'Java';
  if (existsSync(join(cwd, 'build.gradle'))) return 'Java';
  if (existsSync(join(cwd, 'Gemfile'))) return 'Ruby';
  if (existsSync(join(cwd, 'mix.exs'))) return 'Elixir';
  return undefined;
}

const VERSION = getCurrentVersion();

const program = new Command();

program
  .name('friday')
  .description('Friday CLI — Open-source multi-provider AI coding agent')
  .version(VERSION)
  .option('-m, --model <model>', 'LLM model to use')
  .option('-p, --provider <provider>', 'LLM provider (openai, anthropic, ollama, etc.)')
  .option('--mode <mode>', 'Agent mode (code, chat, review, plan, debug)', 'code')
  .option('--no-interactive', 'Run in non-interactive mode')
  .option('--theme <theme>', 'UI theme (dark, light)')
  .option('--max-iterations <n>', 'Maximum agent iterations', '50')
  .option('-c, --config <path>', 'Path to config file')
  .option('--resume', 'Resume the most recent session')
  .option('--session-id <id>', 'Resume a specific session by ID')
  .option('--non-interactive', 'Run without TUI (pipe mode)')
  .action(async (options) => {
    try {
      ensureConfigDir();

      // First-run onboarding
      if (needsOnboarding() && !options.nonInteractive) {
        await runOnboarding();
      }

      // Load config with CLI overrides
      const config = loadConfig({
        ...(options.model && { defaultModel: options.model }),
        ...(options.provider && { defaultProvider: options.provider }),
        ...(options.theme && { theme: options.theme }),
        ...(options.maxIterations && { maxIterations: parseInt(options.maxIterations, 10) }),
      });

      // Load project rules
      const projectRules = loadProjectRules();

      // Create provider
      const providerConfig = config.providers[config.defaultProvider] || {};
      const provider = createProvider({
        provider: config.defaultProvider,
        apiKey: providerConfig.apiKey,
        baseUrl: providerConfig.baseUrl,
        model: config.defaultModel,
      });

      // Set up permission system
      const workspacePath = process.cwd();
      const permissionSystem = new PermissionSystem(workspacePath);

      // Create tool registry with permission checking
      const toolRegistry = createDefaultRegistry({
        workspaceRoot: workspacePath,
        cwd: workspacePath,
        checkPermission: async (action: string, target: string) => {
          const decision = await permissionSystem.check(action, { path: target });
          return decision.allowed;
        },
      });

      // Set up MCP server manager and register MCP tools
      const mcpManager = new MCPServerManager();
      const mcpServers = config.mcp?.servers ?? [];
      if (mcpServers.length > 0) {
        await mcpManager.startAll(mcpServers.map((s) => ({
          ...s,
          transport: (s.transport === 'http-sse' ? 'http-sse' : 'stdio') as 'stdio' | 'http-sse',
        })));

        const mcpClient = mcpManager.getUnderlyingClient();
        for (const { server, tool } of mcpClient.listTools()) {
          toolRegistry.registerMCPTools(server, [tool], (sName, tName, args) =>
            mcpManager.callTool(sName, tName, args),
          );
        }
      }

      // Mutable state for mode/model switching via slash commands
      let currentMode = (options.mode || 'code') as AgentMode;
      let currentModel = config.defaultModel;
      let currentProvider = config.defaultProvider;

      // ── Session management ──────────────────────────────────────
      const sessionManager = new SessionManager();
      let session: Session;

      if (options.sessionId) {
        const resumed = await sessionManager.resume(options.sessionId);
        if (!resumed) {
          console.error(`\n❌ Session "${options.sessionId}" not found.\n`);
          process.exit(1);
        }
        session = resumed.session;
        currentMode = (session.mode || currentMode) as AgentMode;
        currentModel = session.model || currentModel;
        currentProvider = session.provider || currentProvider;
      } else if (options.resume) {
        const recent = await sessionManager.list(1);
        if (recent.length === 0) {
          console.error('\n❌ No previous sessions found.\n');
          process.exit(1);
        }
        const resumed = await sessionManager.resume(recent[0].id);
        if (!resumed) {
          console.error('\n❌ Failed to resume the most recent session.\n');
          process.exit(1);
        }
        session = resumed.session;
        currentMode = (session.mode || currentMode) as AgentMode;
        currentModel = session.model || currentModel;
        currentProvider = session.provider || currentProvider;
      } else {
        session = sessionManager.create({
          projectPath: workspacePath,
          mode: currentMode,
          provider: currentProvider,
          model: currentModel,
        });
      }

      // Create cost tracker
      const costTracker = new CostTracker(null);

      // Detect project type
      const projectType = detectProjectType(workspacePath);

      // Create agent with tools, permissions, and cost tracking
      const agent = new AgentLoop(provider, {
        provider: currentProvider,
        model: currentModel,
        mode: currentMode,
        maxIterations: config.maxIterations,
        projectRules: projectRules || undefined,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      }, toolRegistry, {
        permissionSystem,
        costTracker,
      });

      // Slash command registry
      const commandRegistry = createCommandRegistry();

      // Track cost
      let totalCostAmount = session.totalCost;
      let totalInputTok = session.totalInputTokens;
      let totalOutputTok = session.totalOutputTokens;

      // Build command context (used by slash commands)
      const buildCommandContext = (): CommandContext => ({
        currentProvider,
        currentModel,
        currentMode,
        sessionId: session.id,
        workspacePath,
        setProvider: (p: string) => { currentProvider = p; },
        setModel: (m: string) => { currentModel = m; },
        setMode: (m: string) => { currentMode = m as AgentMode; },
        clearHistory: () => agent.reset(),
        getHistory: () => agent.getHistory(),
        getCostSummary: () => ({
          totalCost: totalCostAmount,
          inputTokens: totalInputTok,
          outputTokens: totalOutputTok,
        }),
      });

      // Message handler — connects user input to agent loop
      const handleMessage = (message: string): AsyncGenerator<AgentEvent> => {
        return agent.run(message);
      };

      // Slash command handler — returns result to TUI
      const handleSlashCommand = async (command: string, args: string): Promise<CommandResult | null> => {
        const input = `/${command}${args ? ' ' + args : ''}`;
        const context = buildCommandContext();
        return commandRegistry.execute(input, context);
      };

      // Save session on exit
      const saveSessionOnExit = async () => {
        session.messages = agent.getHistory();
        session.mode = currentMode;
        session.model = currentModel;
        session.provider = currentProvider;
        session.totalCost = totalCostAmount;
        session.totalInputTokens = totalInputTok;
        session.totalOutputTokens = totalOutputTok;

        await sessionManager.save(session);
        await mcpManager.stopAll();
      };

      process.on('SIGINT', async () => {
        await saveSessionOnExit();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        await saveSessionOnExit();
        process.exit(0);
      });

      // Non-interactive / headless mode (for piped input or CI/CD)
      if (options.nonInteractive || !process.stdin.isTTY) {
        // Read from stdin and process each line
        const readline = await import('node:readline');
        const rl = readline.createInterface({ input: process.stdin });
        
        for await (const line of rl) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          // Handle slash commands
          if (trimmed.startsWith('/')) {
            const parts = trimmed.slice(1).split(' ');
            const cmd = parts[0];
            const args = parts.slice(1).join(' ');
            const result = await handleSlashCommand(cmd, args);
            if (result) {
              console.log(result.output);
              if (result.exit) break;
            }
            continue;
          }
          
          // Send to agent
          for await (const event of agent.run(trimmed)) {
            if (event.type === 'text_delta') {
              process.stdout.write((event as any).content || '');
            } else if (event.type === 'error') {
              console.error(`\nError: ${(event as any).error}`);
            }
          }
          console.log(); // newline after response
        }
        
        await saveSessionOnExit();
        return;
      }

      // Render TUI
      const { waitUntilExit } = render(
        React.createElement(App, {
          version: VERSION,
          model: currentModel,
          provider: currentProvider,
          mode: currentMode,
          projectType,
          onMessage: handleMessage,
          onSlashCommand: handleSlashCommand,
        }),
      );

      await waitUntilExit();
      await saveSessionOnExit();
    } catch (error) {
      console.error(`\n❌ Fatal error: ${(error as Error).message}\n`);
      process.exit(1);
    }
  });

program.parse();
