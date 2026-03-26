import { createLogger } from '@fridaycode/shared';
import type { Message, ToolResult } from '@fridaycode/shared';
import type { LLMProvider, GenerateResponse, StreamChunk } from '@fridaycode/providers';
import type { AgentState, AgentConfig, AgentEvent, AgentToolRegistry } from './agent-types.js';
import { getModeSystemPrompt } from './modes/index.js';
import { PermissionSystem } from '../permissions/index.js';
import { CostTracker } from '../cost/tracker.js';

const logger = createLogger('agent-loop');

export interface AgentLoopOptions {
  permissionSystem?: PermissionSystem;
  costTracker?: CostTracker;
}

export class AgentLoop {
  private state: AgentState = 'IDLE';
  private history: Message[] = [];
  private iteration = 0;
  private config: AgentConfig;
  private provider: LLMProvider;
  private toolRegistry: AgentToolRegistry | null;
  private permissionSystem: PermissionSystem | null;
  private costTracker: CostTracker | null;

  constructor(
    provider: LLMProvider,
    config: AgentConfig,
    toolRegistry: AgentToolRegistry | null = null,
    options?: AgentLoopOptions,
  ) {
    this.provider = provider;
    this.config = config;
    this.toolRegistry = toolRegistry;
    this.permissionSystem = options?.permissionSystem ?? null;
    this.costTracker = options?.costTracker ?? null;
  }

  getState(): AgentState {
    return this.state;
  }

  getHistory(): Message[] {
    return [...this.history];
  }

  getIteration(): number {
    return this.iteration;
  }

  private setState(newState: AgentState): AgentEvent {
    const from = this.state;
    this.state = newState;
    return { type: 'state_change', from, to: newState };
  }

  private buildSystemPrompt(): string {
    const parts: string[] = [];

    // Mode-specific system prompt
    parts.push(getModeSystemPrompt(this.config.mode));

    // Custom system prompt override
    if (this.config.systemPrompt) {
      parts.push(this.config.systemPrompt);
    }

    // Project rules (from FRIDAY.md)
    if (this.config.projectRules) {
      parts.push(`\n## Project Rules\n${this.config.projectRules}`);
    }

    return parts.join('\n\n');
  }

  async *run(userMessage: string): AsyncGenerator<AgentEvent> {
    this.history.push({ role: 'user', content: userMessage });
    this.iteration = 0;

    yield this.setState('THINKING');

    while (this.state !== 'TERMINATED' && this.state !== 'ERROR') {
      if (this.iteration >= this.config.maxIterations) {
        logger.warn('Max iterations reached', { max: this.config.maxIterations });
        yield { type: 'error', error: new Error(`Max iterations (${this.config.maxIterations}) reached`) };
        yield this.setState('TERMINATED');
        break;
      }

      try {
        // THINK: Send to LLM
        const systemPrompt = this.buildSystemPrompt();
        const tools = this.toolRegistry?.getToolDefinitions();
        const hasTools = tools && tools.length > 0;

        yield { type: 'iteration', current: this.iteration + 1, max: this.config.maxIterations };

        if (hasTools) {
          // Use streaming with tools
          let responseText = '';
          const pendingToolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];
          let currentToolCall: { id: string; name: string; argBuffer: string } | null = null;
          let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

          const stream = this.provider.streamWithTools({
            messages: this.history,
            model: this.config.model,
            systemPrompt,
            temperature: this.config.temperature,
            maxTokens: this.config.maxTokens,
            tools,
          });

          for await (const chunk of stream) {
            switch (chunk.type) {
              case 'text_delta':
                responseText += chunk.content || '';
                yield { type: 'text_delta', content: chunk.content || '' };
                break;
              case 'tool_call_start':
                currentToolCall = {
                  id: chunk.toolCall?.id || '',
                  name: chunk.toolCall?.name || '',
                  argBuffer: '',
                };
                break;
              case 'tool_call_delta':
                if (currentToolCall) {
                  currentToolCall.argBuffer += chunk.content || '';
                }
                break;
              case 'tool_call_end':
                if (chunk.toolCall) {
                  pendingToolCalls.push({
                    id: chunk.toolCall.id || currentToolCall?.id || '',
                    name: chunk.toolCall.name || currentToolCall?.name || '',
                    arguments: chunk.toolCall.arguments as Record<string, unknown> || {},
                  });
                }
                currentToolCall = null;
                break;
              case 'usage':
                if (chunk.usage) usage = chunk.usage;
                break;
              case 'error':
                yield { type: 'error', error: new Error(chunk.error) };
                break;
            }
          }

          if (this.costTracker) {
            try {
              const entry = this.costTracker.track(this.config.model, this.config.provider, usage);
              yield { type: 'cost_update', entry };
            } catch (error) {
              yield { type: 'error', error: error as Error };
            }
          }

          yield { type: 'done', usage };

          // Add assistant message to history
          this.history.push({
            role: 'assistant',
            content: responseText,
            toolCalls: pendingToolCalls.length > 0 ? pendingToolCalls : undefined,
          });

          if (pendingToolCalls.length > 0) {
            // ACT: Execute tool calls
            yield this.setState('ACTING');

            for (const toolCall of pendingToolCalls) {
              // Permission check before execution
              if (this.permissionSystem) {
                const preCheck = this.permissionSystem.checkRulesOnly(
                  toolCall.name,
                  toolCall.arguments,
                );

                if (preCheck.action === 'deny') {
                  const reason = preCheck.reason;
                  yield { type: 'permission_denied', toolCall, reason };
                  this.history.push({
                    role: 'tool',
                    content: `Permission denied: ${reason}`,
                    toolCallId: toolCall.id,
                  });
                  continue;
                }

                if (preCheck.action === 'prompt') {
                  let resolvePermission!: (
                    choice: 'allow_once' | 'allow_always' | 'deny',
                  ) => void;
                  const permissionPromise = new Promise<
                    'allow_once' | 'allow_always' | 'deny'
                  >((resolve) => {
                    resolvePermission = resolve;
                  });

                  yield {
                    type: 'permission_request',
                    toolCall,
                    reason: preCheck.reason,
                    respond: resolvePermission,
                  };

                  const choice = await permissionPromise;
                  this.permissionSystem.recordChoice(
                    toolCall.name,
                    toolCall.arguments,
                    choice,
                  );

                  if (choice === 'deny') {
                    yield {
                      type: 'permission_denied',
                      toolCall,
                      reason: 'Denied by user',
                    };
                    this.history.push({
                      role: 'tool',
                      content: 'Permission denied by user',
                      toolCallId: toolCall.id,
                    });
                    continue;
                  }

                  yield { type: 'permission_granted', toolCall };
                }
              }

              yield { type: 'tool_start', toolCall };

              if (!this.toolRegistry?.hasTool(toolCall.name)) {
                const result: ToolResult = {
                  success: false,
                  output: `Unknown tool: ${toolCall.name}`,
                };
                this.history.push({ role: 'tool', content: result.output, toolCallId: toolCall.id });
                yield { type: 'tool_result', toolCall, result };
                continue;
              }

              try {
                const result = await this.toolRegistry.execute(toolCall.name, toolCall.arguments);
                this.history.push({ role: 'tool', content: result.output, toolCallId: toolCall.id });
                yield { type: 'tool_result', toolCall, result };
              } catch (error) {
                const result: ToolResult = {
                  success: false,
                  output: `Tool error: ${(error as Error).message}`,
                };
                this.history.push({ role: 'tool', content: result.output, toolCallId: toolCall.id });
                yield { type: 'tool_result', toolCall, result };
              }
            }

            // OBSERVE: Loop back to think
            yield this.setState('OBSERVING');
            this.iteration++;
            yield this.setState('THINKING');
          } else {
            // No tool calls = final response
            if (responseText) {
              yield { type: 'response', content: responseText };
            }
            yield this.setState('TERMINATED');
          }
        } else {
          // No tools available, simple streaming response
          let responseText = '';
          let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

          const stream = this.provider.stream({
            messages: this.history,
            model: this.config.model,
            systemPrompt,
            temperature: this.config.temperature,
            maxTokens: this.config.maxTokens,
          });

          for await (const chunk of stream) {
            if (chunk.type === 'text_delta') {
              responseText += chunk.content || '';
              yield { type: 'text_delta', content: chunk.content || '' };
            } else if (chunk.type === 'usage' && chunk.usage) {
              usage = chunk.usage;
            }
          }

          this.history.push({ role: 'assistant', content: responseText });

          if (this.costTracker) {
            try {
              const entry = this.costTracker.track(this.config.model, this.config.provider, usage);
              yield { type: 'cost_update', entry };
            } catch (error) {
              yield { type: 'error', error: error as Error };
            }
          }

          yield { type: 'done', usage };
          yield { type: 'response', content: responseText };
          yield this.setState('TERMINATED');
        }
      } catch (error) {
        logger.error('Agent loop error', { error: (error as Error).message });
        yield { type: 'error', error: error as Error };
        yield this.setState('ERROR');
      }
    }
  }

  reset(): void {
    this.state = 'IDLE';
    this.history = [];
    this.iteration = 0;
  }

  addSystemMessage(content: string): void {
    this.history.push({ role: 'system', content });
  }
}
