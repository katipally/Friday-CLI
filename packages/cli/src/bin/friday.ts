#!/usr/bin/env node

import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import { createProvider } from '@anthropic-ai/friday-providers';
import { AgentLoop } from '@anthropic-ai/friday-core';
import { App } from '@anthropic-ai/friday-tui';
import { loadConfig, loadProjectRules, ensureConfigDir } from '../config/loader.js';
import type { AgentEvent, AgentMode } from '@anthropic-ai/friday-core';

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

      // Create agent
      const agent = new AgentLoop(provider, {
        provider: config.defaultProvider,
        model: config.defaultModel,
        mode: (options.mode || 'code') as AgentMode,
        maxIterations: config.maxIterations,
        projectRules: projectRules || undefined,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });

      // Message handler
      const handleMessage = (message: string): AsyncGenerator<AgentEvent> => {
        return agent.run(message);
      };

      // Render TUI
      const { waitUntilExit } = render(
        React.createElement(App, {
          version: VERSION,
          model: config.defaultModel,
          provider: config.defaultProvider,
          mode: (options.mode || 'code') as AgentMode,
          onMessage: handleMessage,
        }),
      );

      await waitUntilExit();
    } catch (error) {
      console.error(`\n❌ Fatal error: ${(error as Error).message}\n`);
      process.exit(1);
    }
  });

program.parse();
