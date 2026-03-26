import { Command } from 'commander';
import { CIRunner, CI_EXIT_CODES } from '@fridaycode/core';
import type { CIRunnerOptions, CIResult } from '@fridaycode/core';
import type { AgentToolRegistry } from '@fridaycode/core';
import { createDefaultRegistry } from '@fridaycode/tools';

function resolveApiKey(provider: string, explicitKey?: string): string {
  if (explicitKey) return explicitKey;

  const envMap: Record<string, string[]> = {
    openai: ['OPENAI_API_KEY'],
    anthropic: ['ANTHROPIC_API_KEY'],
    google: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'],
    groq: ['GROQ_API_KEY'],
    deepseek: ['DEEPSEEK_API_KEY'],
    together: ['TOGETHER_API_KEY'],
    cohere: ['COHERE_API_KEY'],
    mistral: ['MISTRAL_API_KEY'],
    bedrock: ['AWS_ACCESS_KEY_ID'],
    azure: ['AZURE_OPENAI_API_KEY'],
    ollama: [],
  };

  const envVars = envMap[provider] ?? [`${provider.toUpperCase()}_API_KEY`];
  for (const envVar of envVars) {
    const value = process.env[envVar];
    if (value) return value;
  }

  // Ollama and local providers don't require keys
  if (provider === 'ollama') return '';

  throw new Error(
    `No API key found for provider "${provider}". ` +
      `Set ${envVars[0] ?? `${provider.toUpperCase()}_API_KEY`} or use --api-key.`,
  );
}

function buildToolRegistry(
  workingDirectory: string,
  allowedTools?: string[],
): AgentToolRegistry {
  const registry = createDefaultRegistry({
    workspaceRoot: workingDirectory,
    cwd: workingDirectory,
    checkPermission: async () => true,
  });

  if (allowedTools && allowedTools.length > 0) {
    const allowed = new Set(allowedTools);
    return {
      getToolDefinitions: () =>
        registry.getToolDefinitions().filter((t) => allowed.has(t.name)),
      execute: async (name, args) => {
        if (!allowed.has(name)) {
          return { success: false, output: `Tool "${name}" is not in the allowed list` };
        }
        return registry.execute(name, args);
      },
      hasTool: (name) => allowed.has(name) && registry.hasTool(name),
    };
  }

  return registry;
}

function formatResult(result: CIResult, format: string): string {
  switch (format) {
    case 'json':
      return JSON.stringify(result, null, 2);

    case 'markdown': {
      const lines = [
        result.success ? '## ✅ CI Run Succeeded' : '## ❌ CI Run Failed',
        '',
        '### Output',
        result.output || '_No output_',
        '',
        '### Summary',
        `| Metric | Value |`,
        `|--------|-------|`,
        `| Duration | ${result.duration.toFixed(1)}s |`,
        `| Turns | ${result.turns} |`,
        `| Input tokens | ${result.tokensUsed.input.toLocaleString()} |`,
        `| Output tokens | ${result.tokensUsed.output.toLocaleString()} |`,
        `| Cost | $${result.cost.toFixed(4)} |`,
      ];
      if (result.error) {
        lines.push('', `### Error`, result.error);
      }
      if (result.toolCalls.length > 0) {
        lines.push('', '### Tool Calls', '');
        for (const tc of result.toolCalls) {
          const preview = tc.result.length > 200 ? tc.result.slice(0, 200) + '…' : tc.result;
          lines.push(`- **${tc.tool}**: ${preview}`);
        }
      }
      return lines.join('\n');
    }

    case 'text':
    default: {
      const lines = [
        result.success ? '✅ CI run succeeded' : '❌ CI run failed',
        '',
        result.output,
        '',
        `Duration: ${result.duration.toFixed(1)}s | Turns: ${result.turns} | Cost: $${result.cost.toFixed(4)}`,
        `Tokens: ${result.tokensUsed.input.toLocaleString()} in / ${result.tokensUsed.output.toLocaleString()} out`,
      ];
      if (result.error) {
        lines.push(`Error: ${result.error}`);
      }
      return lines.join('\n');
    }
  }
}

function getExitCode(result: CIResult): number {
  if (result.success) return CI_EXIT_CODES.SUCCESS;
  if (result.error?.includes('Timeout')) return CI_EXIT_CODES.TIMEOUT;
  if (result.error?.includes('Budget')) return CI_EXIT_CODES.BUDGET_EXCEEDED;
  return CI_EXIT_CODES.ERROR;
}

export function createCICommand(): Command {
  const cmd = new Command('ci')
    .description('Run fridaycode in CI/CD mode (non-interactive, headless)')
    .requiredOption('-i, --instruction <text>', 'Instruction for the agent')
    .option('-p, --provider <name>', 'LLM provider', 'anthropic')
    .option('-m, --model <name>', 'LLM model')
    .option('--api-key <key>', 'API key (prefer env vars)')
    .option('--max-turns <n>', 'Maximum agent turns', '50')
    .option('--max-cost <dollars>', 'Budget cap in dollars')
    .option('--timeout <seconds>', 'Maximum execution time in seconds')
    .option('--allowed-tools <tools>', 'Comma-separated list of allowed tools')
    .option('--output <format>', 'Output format: json, text, markdown', 'json')
    .option('--verbose', 'Print progress to stderr', false)
    .action(async (opts) => {
      try {
        const provider = opts.provider;

        // Default models per provider
        const defaultModels: Record<string, string> = {
          anthropic: 'claude-sonnet-4-20250514',
          openai: 'gpt-4o',
          google: 'gemini-2.5-pro',
          groq: 'llama-3.1-70b-versatile',
          deepseek: 'deepseek-chat',
          ollama: 'llama3.1',
        };
        const model = opts.model ?? defaultModels[provider] ?? 'gpt-4o';

        const apiKey = resolveApiKey(provider, opts.apiKey);
        const workingDirectory = process.cwd();

        const allowedTools = opts.allowedTools?.split(',').map((s: string) => s.trim());
        const toolRegistry = buildToolRegistry(workingDirectory, allowedTools);

        const runnerOptions: CIRunnerOptions = {
          provider,
          model,
          apiKey,
          instruction: opts.instruction,
          workingDirectory,
          maxTurns: parseInt(opts.maxTurns, 10),
          maxCost: opts.maxCost ? parseFloat(opts.maxCost) : undefined,
          timeout: opts.timeout ? parseInt(opts.timeout, 10) : undefined,
          allowedTools,
          outputFormat: opts.output,
          verbose: opts.verbose,
          toolRegistry,
        };

        const runner = new CIRunner(runnerOptions);

        // Handle SIGINT/SIGTERM for graceful abort
        const onSignal = () => runner.abort();
        process.on('SIGINT', onSignal);
        process.on('SIGTERM', onSignal);

        const result = await runner.run();

        process.removeListener('SIGINT', onSignal);
        process.removeListener('SIGTERM', onSignal);

        // Output result to stdout
        process.stdout.write(formatResult(result, opts.output) + '\n');

        // Exit with appropriate code
        process.exit(getExitCode(result));
      } catch (error) {
        const errorResult: CIResult = {
          success: false,
          output: '',
          toolCalls: [],
          tokensUsed: { input: 0, output: 0 },
          cost: 0,
          duration: 0,
          turns: 0,
          error: (error as Error).message,
        };

        process.stdout.write(formatResult(errorResult, opts.output) + '\n');
        process.exit(CI_EXIT_CODES.ERROR);
      }
    });

  return cmd;
}
