import { createProvider } from '@fridaycode/providers';
import { createLogger, BudgetExceededError } from '@fridaycode/shared';
import { AgentLoop } from '../agent/agent-loop.js';
import { CostTracker } from '../cost/tracker.js';
import { PermissionSystem } from '../permissions/index.js';
import type { AgentEvent, AgentToolRegistry } from '../agent/agent-types.js';

const logger = createLogger('ci-runner');

export interface CIRunnerOptions {
  provider: string;
  model: string;
  apiKey: string;
  instruction: string;
  workingDirectory: string;
  maxTurns?: number;
  maxCost?: number;
  timeout?: number;
  allowedTools?: string[];
  outputFormat?: 'json' | 'text' | 'markdown';
  verbose?: boolean;
  /** Pre-built tool registry. If omitted the runner operates without tools. */
  toolRegistry?: AgentToolRegistry;
}

export interface CIToolCall {
  tool: string;
  result: string;
}

export interface CIResult {
  success: boolean;
  output: string;
  toolCalls: CIToolCall[];
  tokensUsed: { input: number; output: number };
  cost: number;
  duration: number;
  turns: number;
  error?: string;
}

/** Exit codes for CI mode */
export const CI_EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  TIMEOUT: 2,
  BUDGET_EXCEEDED: 3,
} as const;

export type CIExitCode = (typeof CI_EXIT_CODES)[keyof typeof CI_EXIT_CODES];

const NO_TOOLS: AgentToolRegistry = {
  getToolDefinitions: () => [],
  execute: async () => ({ success: false, output: 'No tools available' }),
  hasTool: () => false,
};

/**
 * Non-interactive runner for CI/CD environments.
 * No TUI, no interactive prompts — pure headless execution.
 */
export class CIRunner {
  private options: Required<
    Pick<CIRunnerOptions, 'maxTurns' | 'maxCost' | 'timeout' | 'outputFormat' | 'verbose'>
  > &
    CIRunnerOptions;
  private aborted = false;
  private abortController: AbortController;

  constructor(options: CIRunnerOptions) {
    this.options = {
      maxTurns: 50,
      maxCost: Infinity,
      timeout: 0,
      outputFormat: 'json',
      verbose: false,
      ...options,
    };
    this.abortController = new AbortController();
  }

  async run(): Promise<CIResult> {
    const startTime = Date.now();
    const toolCalls: CIToolCall[] = [];
    const outputChunks: string[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let turns = 0;
    let exitCode: CIExitCode = CI_EXIT_CODES.SUCCESS;

    // Set up timeout
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (this.options.timeout > 0) {
      timeoutId = setTimeout(() => {
        this.aborted = true;
        this.abortController.abort();
      }, this.options.timeout * 1000);
    }

    try {
      // Create provider
      const provider = createProvider({
        provider: this.options.provider,
        apiKey: this.options.apiKey,
        model: this.options.model,
      });

      // Create cost tracker with budget
      const budget = Number.isFinite(this.options.maxCost) ? this.options.maxCost : null;
      const costTracker = new CostTracker(budget);

      // Create permission system that auto-allows everything in CI
      const permissionSystem = new PermissionSystem(this.options.workingDirectory);
      permissionSystem.addRule({
        tool: '*',
        scope: 'workspace',
        action: 'allow',
      });

      // Resolve tool registry (caller provides it, or fall back to no-tools)
      const toolRegistry: AgentToolRegistry = this.options.toolRegistry ?? NO_TOOLS;

      // Create agent loop
      const agent = new AgentLoop(
        provider,
        {
          provider: this.options.provider,
          model: this.options.model,
          mode: 'code',
          maxIterations: this.options.maxTurns,
        },
        toolRegistry,
        {
          permissionSystem,
          costTracker,
        },
      );

      // Run the agent loop
      const eventStream: AsyncGenerator<AgentEvent> = agent.run(this.options.instruction);

      for await (const event of eventStream) {
        if (this.aborted) break;

        switch (event.type) {
          case 'text_delta':
            outputChunks.push(event.content);
            if (this.options.verbose) {
              process.stderr.write(event.content);
            }
            break;

          case 'response':
            break;

          case 'tool_start':
            if (this.options.verbose) {
              process.stderr.write(`\n🔧 [${event.toolCall.name}]\n`);
            }
            break;

          case 'tool_result':
            toolCalls.push({
              tool: event.toolCall.name,
              result: event.result.output,
            });
            if (this.options.verbose) {
              const preview = event.result.output.slice(0, 200);
              process.stderr.write(`   → ${event.result.success ? '✓' : '✗'} ${preview}\n`);
            }
            break;

          case 'permission_request':
            // Auto-allow in CI mode
            event.respond('allow_once');
            break;

          case 'cost_update':
            if (this.options.verbose) {
              process.stderr.write(`   💰 $${event.entry.cost.toFixed(6)}\n`);
            }
            break;

          case 'done':
            totalInputTokens += event.usage.inputTokens;
            totalOutputTokens += event.usage.outputTokens;
            break;

          case 'iteration':
            turns = event.current;
            break;

          case 'error':
            if (event.error instanceof BudgetExceededError) {
              exitCode = CI_EXIT_CODES.BUDGET_EXCEEDED;
              this.aborted = true;
            }
            if (this.options.verbose) {
              process.stderr.write(`\n❌ ${event.error.message}\n`);
            }
            break;

          case 'state_change':
            if (event.to === 'ERROR') {
              exitCode = CI_EXIT_CODES.ERROR;
            }
            break;
        }
      }

      if (timeoutId) clearTimeout(timeoutId);

      // Determine final exit code
      if (this.aborted && exitCode === CI_EXIT_CODES.SUCCESS) {
        exitCode = CI_EXIT_CODES.TIMEOUT;
      }

      const duration = (Date.now() - startTime) / 1000;
      const totalCost = costTracker.getTotalCost();
      const output = outputChunks.join('');

      const result: CIResult = {
        success: exitCode === CI_EXIT_CODES.SUCCESS,
        output,
        toolCalls,
        tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
        cost: totalCost,
        duration,
        turns,
      };

      if (exitCode === CI_EXIT_CODES.TIMEOUT) {
        result.error = `Timeout after ${this.options.timeout}s`;
        result.success = false;
      } else if (exitCode === CI_EXIT_CODES.BUDGET_EXCEEDED) {
        result.error = `Budget cap of $${this.options.maxCost} exceeded`;
        result.success = false;
      }

      return result;
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      const duration = (Date.now() - startTime) / 1000;

      let errorMessage = (error as Error).message;
      if (error instanceof BudgetExceededError) {
        exitCode = CI_EXIT_CODES.BUDGET_EXCEEDED;
        errorMessage = `Budget cap of $${this.options.maxCost} exceeded`;
      }

      return {
        success: false,
        output: outputChunks.join(''),
        toolCalls,
        tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
        cost: 0,
        duration,
        turns,
        error: errorMessage,
      };
    }
  }

  /** Force stop the runner */
  abort(): void {
    this.aborted = true;
    this.abortController.abort();
  }
}
