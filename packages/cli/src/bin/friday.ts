#!/usr/bin/env node

import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import { createProvider } from '@anthropic-ai/friday-providers';
import { AgentLoop, PermissionSystem } from '@anthropic-ai/friday-core';
import { App } from '@anthropic-ai/friday-tui';
import { createDefaultRegistry } from '@anthropic-ai/friday-tools';
import { createCommandRegistry } from '../commands/index.js';
import { loadConfig, loadProjectRules, ensureConfigDir } from '../config/loader.js';
import type { AgentEvent, AgentMode } from '@anthropic-ai/friday-core';
import type { CommandContext, CommandResult } from '../commands/types.js';

const VERSION = '0.1.0';

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
  .action(async (options) => {
    try {
      ensureConfigDir();

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

      // Mutable state for mode/model switching via slash commands
      let currentMode = (options.mode || 'code') as AgentMode;
      let currentModel = config.defaultModel;
      let currentProvider = config.defaultProvider;

      // Create agent with tools
      const agent = new AgentLoop(provider, {
        provider: currentProvider,
        model: currentModel,
        mode: currentMode,
        maxIterations: config.maxIterations,
        projectRules: projectRules || undefined,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      }, toolRegistry);

      // Slash command registry
      const commandRegistry = createCommandRegistry();

      // Track cost
      let totalCostAmount = 0;
      let totalInputTok = 0;
      let totalOutputTok = 0;

      // Build command context (used by slash commands)
      const buildCommandContext = (): CommandContext => ({
        currentProvider,
        currentModel,
        currentMode,
        sessionId: `session-${Date.now()}`,
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

      // Render TUI
      const { waitUntilExit } = render(
        React.createElement(App, {
          version: VERSION,
          model: currentModel,
          provider: currentProvider,
          mode: currentMode,
          onMessage: handleMessage,
          onSlashCommand: handleSlashCommand,
        }),
      );

      await waitUntilExit();
    } catch (error) {
      console.error(`\n❌ Fatal error: ${(error as Error).message}\n`);
      process.exit(1);
    }
  });

program.parse();
