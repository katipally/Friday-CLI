import type { LLMProvider, ToolDefinition, TokenUsage } from '@fridaycode/providers';
import type { Message, ToolCall } from '@fridaycode/shared';
import { createLogger } from '@fridaycode/shared';
import type { AgentToolRegistry } from '../agent/agent-types.js';
import type { SubAgentConfig, AgentTask, AgentResult } from './agent-types.js';

const logger = createLogger('sub-agent');

const DEFAULT_MAX_TURNS = 10;

/**
 * A lightweight agent that runs a simplified think-act loop.
 *
 * Unlike the full AgentLoop, SubAgent uses non-streaming generation,
 * has no permission system, and is designed to be short-lived and task-focused.
 */
export class SubAgent {
  private history: Message[] = [];
  private totalToolCalls = 0;
  private tokensUsed = { input: 0, output: 0 };

  constructor(
    private readonly config: SubAgentConfig,
    private readonly provider: LLMProvider,
    private readonly model: string,
    private readonly toolRegistry: AgentToolRegistry | null = null,
  ) {}

  /**
   * Execute the assigned task through a simplified agent loop.
   * Returns an AgentResult with the output, metrics, and status.
   */
  async execute(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();
    const maxTurns = this.config.maxTurns ?? DEFAULT_MAX_TURNS;

    logger.debug(`SubAgent "${this.config.name}" starting task ${task.id}`, {
      role: this.config.role,
      maxTurns,
    });

    const userMessage = this.buildUserMessage(task);
    this.history.push({ role: 'user', content: userMessage });

    try {
      for (let turn = 0; turn < maxTurns; turn++) {
        const tools = this.getFilteredTools();

        const response = await this.provider.generateWithTools({
          messages: this.history,
          model: this.model,
          systemPrompt: this.config.systemPrompt,
          tools: tools.length > 0 ? tools : undefined,
          maxTokens: this.config.maxTokens,
        });

        this.trackUsage(response.usage);

        // Map provider tool calls to shared ToolCall type for Message compatibility
        const toolCalls: ToolCall[] | undefined = response.toolCalls?.length
          ? response.toolCalls.map((tc) => ({
              id: tc.id,
              name: tc.name,
              arguments: tc.arguments,
            }))
          : undefined;

        this.history.push({
          role: 'assistant',
          content: response.content,
          toolCalls,
        });

        if (!response.toolCalls?.length) {
          logger.debug(`SubAgent "${this.config.name}" completed on turn ${turn + 1}`);
          return this.buildResult(task, true, response.content, startTime);
        }

        await this.executeToolCalls(response.toolCalls);
      }

      // Max turns reached — return the last assistant output
      logger.warn(`SubAgent "${this.config.name}" hit max turns (${maxTurns})`);
      const lastOutput = this.getLastAssistantContent();
      return this.buildResult(task, true, lastOutput, startTime);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`SubAgent "${this.config.name}" failed: ${message}`);
      return this.buildResult(task, false, '', startTime, message);
    }
  }

  private buildUserMessage(task: AgentTask): string {
    const parts: string[] = [];
    if (task.context) {
      parts.push(`Context:\n${task.context}`);
    }
    if (task.files?.length) {
      parts.push(`Relevant files:\n${task.files.join('\n')}`);
    }
    parts.push(task.instruction);
    return parts.join('\n\n');
  }

  private getFilteredTools(): ToolDefinition[] {
    if (!this.toolRegistry) return [];
    const allTools = this.toolRegistry.getToolDefinitions();
    if (!this.config.tools?.length) return allTools;
    return allTools.filter((t) => this.config.tools!.includes(t.name));
  }

  private async executeToolCalls(
    toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>,
  ): Promise<void> {
    if (!this.toolRegistry) return;

    for (const tc of toolCalls) {
      try {
        if (!this.toolRegistry.hasTool(tc.name)) {
          this.history.push({
            role: 'tool',
            content: `Error: Tool "${tc.name}" is not available`,
            toolCallId: tc.id,
          });
          this.totalToolCalls++;
          continue;
        }

        const result = await this.toolRegistry.execute(tc.name, tc.arguments);
        this.history.push({
          role: 'tool',
          content: result.output,
          toolCallId: tc.id,
        });
        this.totalToolCalls++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.history.push({
          role: 'tool',
          content: `Error executing ${tc.name}: ${message}`,
          toolCallId: tc.id,
        });
        this.totalToolCalls++;
      }
    }
  }

  private trackUsage(usage: TokenUsage): void {
    this.tokensUsed.input += usage.inputTokens;
    this.tokensUsed.output += usage.outputTokens;
  }

  private getLastAssistantContent(): string {
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].role === 'assistant') {
        return this.history[i].content;
      }
    }
    return '';
  }

  private buildResult(
    task: AgentTask,
    success: boolean,
    output: string,
    startTime: number,
    error?: string,
  ): AgentResult {
    return {
      taskId: task.id,
      agentRole: this.config.role,
      success,
      output,
      toolCalls: this.totalToolCalls,
      tokensUsed: { ...this.tokensUsed },
      duration: Date.now() - startTime,
      error,
    };
  }
}
