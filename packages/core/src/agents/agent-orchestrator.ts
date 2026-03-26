import type { LLMProvider, ProviderConfig } from '@fridaycode/providers';
import { createLogger } from '@fridaycode/shared';
import type { AgentToolRegistry } from '../agent/agent-types.js';
import type { AgentRole, SubAgentConfig, AgentTask, AgentResult } from './agent-types.js';
import { AGENT_PRESETS, getAgentPreset } from './presets.js';
import { SubAgent } from './sub-agent.js';

const logger = createLogger('orchestrator');

export type ProviderFactory = (config: ProviderConfig) => LLMProvider;

export interface OrchestratorOptions {
  /** Default LLM provider for sub-agents that don't specify their own */
  defaultProvider: LLMProvider;
  /** Default model name for sub-agents that don't specify their own */
  defaultModel: string;
  /** Tool registry shared with sub-agents */
  toolRegistry?: AgentToolRegistry | null;
  /** Factory to create providers when a sub-agent requests a different one */
  providerFactory?: ProviderFactory;
}

/**
 * Orchestrates sub-agent lifecycle: creation, execution, and result collection.
 *
 * Supports single delegation, parallel fan-out, and sequential pipelines.
 * Each sub-agent is isolated with its own conversation history and token tracking.
 */
export class AgentOrchestrator {
  private readonly defaultProvider: LLMProvider;
  private readonly defaultModel: string;
  private readonly toolRegistry: AgentToolRegistry | null;
  private readonly providerFactory: ProviderFactory | null;

  constructor(options: OrchestratorOptions) {
    this.defaultProvider = options.defaultProvider;
    this.defaultModel = options.defaultModel;
    this.toolRegistry = options.toolRegistry ?? null;
    this.providerFactory = options.providerFactory ?? null;
  }

  /**
   * Run a single sub-agent to complete a task.
   */
  async delegateTask(task: AgentTask, config: SubAgentConfig): Promise<AgentResult> {
    logger.info(`Delegating task "${task.id}" to ${config.name} (${config.role})`);
    const agent = this.createSubAgent(config);
    return agent.execute(task);
  }

  /**
   * Run multiple sub-agents in parallel, all using the same config.
   * Individual failures are captured in each AgentResult — one failing agent
   * does not prevent others from completing.
   */
  async delegateParallel(
    tasks: AgentTask[],
    config: SubAgentConfig,
  ): Promise<AgentResult[]> {
    logger.info(`Delegating ${tasks.length} tasks in parallel to ${config.name} (${config.role})`);

    const promises = tasks.map((task) => {
      const agent = this.createSubAgent(config);
      return agent.execute(task).catch((err): AgentResult => {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Parallel task "${task.id}" failed unexpectedly: ${message}`);
        return {
          taskId: task.id,
          agentRole: config.role,
          success: false,
          output: '',
          toolCalls: 0,
          tokensUsed: { input: 0, output: 0 },
          duration: 0,
          error: message,
        };
      });
    });

    return Promise.all(promises);
  }

  /**
   * Run tasks sequentially as a pipeline. Each task can use a different config.
   * If configs.length < tasks.length, the last config is reused for remaining tasks.
   * Execution stops early if a task fails (unless the error is non-critical).
   */
  async delegateSequential(
    tasks: AgentTask[],
    configs: SubAgentConfig[],
  ): Promise<AgentResult[]> {
    logger.info(`Delegating ${tasks.length} tasks sequentially`);

    const results: AgentResult[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const config = configs[Math.min(i, configs.length - 1)];

      logger.info(`Sequential step ${i + 1}/${tasks.length}: "${task.id}" → ${config.name}`);

      try {
        const agent = this.createSubAgent(config);
        const result = await agent.execute(task);
        results.push(result);

        if (!result.success) {
          logger.warn(
            `Sequential pipeline stopping: task "${task.id}" failed — ${result.error}`,
          );
          // Mark remaining tasks as not executed
          for (let j = i + 1; j < tasks.length; j++) {
            const remainingConfig = configs[Math.min(j, configs.length - 1)];
            results.push({
              taskId: tasks[j].id,
              agentRole: remainingConfig.role,
              success: false,
              output: '',
              toolCalls: 0,
              tokensUsed: { input: 0, output: 0 },
              duration: 0,
              error: `Skipped: previous task "${task.id}" failed`,
            });
          }
          break;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Sequential task "${task.id}" failed unexpectedly: ${message}`);
        results.push({
          taskId: task.id,
          agentRole: config.role,
          success: false,
          output: '',
          toolCalls: 0,
          tokensUsed: { input: 0, output: 0 },
          duration: 0,
          error: message,
        });
        break;
      }
    }

    return results;
  }

  /**
   * Get a built-in preset for a given role. Throws for 'custom' role.
   */
  getPreset(role: Exclude<AgentRole, 'custom'>): SubAgentConfig {
    return getAgentPreset(role);
  }

  /**
   * List all available preset roles.
   */
  getAvailablePresets(): Array<Exclude<AgentRole, 'custom'>> {
    return Object.keys(AGENT_PRESETS) as Array<Exclude<AgentRole, 'custom'>>;
  }

  private createSubAgent(config: SubAgentConfig): SubAgent {
    const provider = this.resolveProvider(config);
    const model = config.model ?? this.defaultModel;
    return new SubAgent(config, provider, model, this.toolRegistry);
  }

  private resolveProvider(config: SubAgentConfig): LLMProvider {
    if (config.provider && this.providerFactory) {
      try {
        return this.providerFactory({ provider: config.provider, model: config.model });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn(
          `Failed to create provider "${config.provider}" for sub-agent "${config.name}", ` +
            `falling back to default: ${message}`,
        );
      }
    }
    return this.defaultProvider;
  }
}
