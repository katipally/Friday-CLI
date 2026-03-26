import type {
  AgentDefinition,
  AgentInstance,
  AgentStatus,
  Message,
  Settings,
  ToolContext,
  StreamChunk,
  ChatOptions,
  ModelProvider,
} from '@fridaycode/shared';
import { generateId, CONTEXT_COMPACTION_THRESHOLD, DEFAULT_MAX_TURNS } from '@fridaycode/shared';
import type { ToolRegistry } from '../tools/registry.js';

export interface AgentEngineOptions {
  provider: ModelProvider;
  toolRegistry: ToolRegistry;
  settings: Settings;
  onStream?: (chunk: StreamChunk, agentId: string) => void;
  onMessage?: (message: Message, agentId: string) => void;
  askUser?: (question: string, options?: string[]) => Promise<string>;
  compact?: (messages: Message[], topic?: string) => Promise<Message[]>;
}

export class AgentEngine {
  private agents = new Map<string, AgentRuntime>();
  private options: AgentEngineOptions;

  constructor(options: AgentEngineOptions) {
    this.options = options;
  }

  /**
   * Run a foreground agent. Blocks until completion.
   */
  async runForeground(
    definition: AgentDefinition,
    prompt: string,
    parentContext: ToolContext,
  ): Promise<string> {
    const runtime = new AgentRuntime(definition, this.options, parentContext);
    this.agents.set(runtime.instance.id, runtime);

    try {
      const result = await runtime.run(prompt);
      runtime.instance.status = 'completed';
      runtime.instance.result = result;
      return result;
    } catch (err) {
      runtime.instance.status = 'failed';
      runtime.instance.result = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  /**
   * Start a background agent. Returns immediately with the instance.
   */
  async startBackground(
    definition: AgentDefinition,
    prompt: string,
    parentContext: ToolContext,
  ): Promise<AgentInstance> {
    const runtime = new AgentRuntime(
      { ...definition, background: true },
      this.options,
      parentContext,
    );
    this.agents.set(runtime.instance.id, runtime);

    // Run in background (don't await)
    runtime.run(prompt).then(
      (result) => {
        runtime.instance.status = 'completed';
        runtime.instance.result = result;
      },
      (err) => {
        runtime.instance.status = 'failed';
        runtime.instance.result = err instanceof Error ? err.message : String(err);
      },
    );

    return runtime.instance;
  }

  getInstance(id: string): AgentInstance | undefined {
    return this.agents.get(id)?.instance;
  }

  getAllInstances(): AgentInstance[] {
    return [...this.agents.values()].map((r) => r.instance);
  }

  async stop(id: string): Promise<void> {
    const runtime = this.agents.get(id);
    if (runtime) {
      runtime.abort();
    }
  }

  async sendMessage(id: string, message: string): Promise<void> {
    const runtime = this.agents.get(id);
    if (runtime) {
      runtime.enqueueMessage(message);
    }
  }
}

class AgentRuntime {
  instance: AgentInstance;
  private definition: AgentDefinition;
  private options: AgentEngineOptions;
  private parentContext: ToolContext;
  private messages: Message[] = [];
  private abortController = new AbortController();
  private pendingMessages: string[] = [];
  private totalInputTokens = 0;
  private totalOutputTokens = 0;

  constructor(
    definition: AgentDefinition,
    options: AgentEngineOptions,
    parentContext: ToolContext,
  ) {
    this.definition = definition;
    this.options = options;
    this.parentContext = parentContext;

    this.instance = {
      id: generateId(),
      definition,
      mode: definition.background ? 'background' : 'foreground',
      status: 'running' as AgentStatus,
      sessionId: parentContext.sessionId,
      createdAt: Date.now(),
    };
  }

  abort(): void {
    this.instance.status = 'stopped';
    this.abortController.abort();
  }

  enqueueMessage(message: string): void {
    this.pendingMessages.push(message);
  }

  async run(prompt: string): Promise<string> {
    const maxTurns = this.definition.maxTurns ?? DEFAULT_MAX_TURNS;

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt();

    // Add initial user message
    this.messages.push({ role: 'user', content: prompt, timestamp: Date.now() });

    // Get allowed tools
    const toolDefs = this.getFilteredToolDefinitions();

    let turn = 0;
    let lastAssistantContent = '';

    while (turn < maxTurns && this.instance.status === 'running') {
      // Check for abort
      if (this.abortController.signal.aborted) break;

      // Check for pending messages
      while (this.pendingMessages.length > 0) {
        const msg = this.pendingMessages.shift()!;
        this.messages.push({ role: 'user', content: msg, timestamp: Date.now() });
      }

      // Build chat options
      const chatOptions: ChatOptions = {
        model: this.definition.model ?? this.options.settings.activeModel,
        provider: this.options.provider.type,
        messages: [...this.messages],
        tools: toolDefs.length > 0 ? toolDefs : undefined,
        systemPrompt,
        stream: true,
        maxTokens: this.options.settings.maxTokens,
      };

      // Call the provider
      let assistantContent = '';
      let toolCalls: Message['toolCalls'] = [];

      for await (const chunk of this.options.provider.chat(chatOptions)) {
        if (this.abortController.signal.aborted) break;

        this.options.onStream?.(chunk, this.instance.id);

        switch (chunk.type) {
          case 'text':
            assistantContent += chunk.content ?? '';
            break;
          case 'tool_use':
            if (chunk.toolCall) {
              toolCalls = toolCalls ?? [];
              toolCalls.push(chunk.toolCall);
            }
            break;
          case 'done':
            if (chunk.usage) {
              this.totalInputTokens += chunk.usage.inputTokens;
              this.totalOutputTokens += chunk.usage.outputTokens;
            }
            break;
        }
      }

      // Add assistant message
      const assistantMessage: Message = {
        role: 'assistant',
        content: assistantContent,
        toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
        timestamp: Date.now(),
      };
      this.messages.push(assistantMessage);
      this.options.onMessage?.(assistantMessage, this.instance.id);
      lastAssistantContent = assistantContent;

      // If no tool calls, we're done
      if (!toolCalls || toolCalls.length === 0) {
        break;
      }

      // Execute tool calls
      for (const toolCall of toolCalls) {
        if (this.abortController.signal.aborted) break;

        const toolContext: ToolContext = {
          ...this.parentContext,
          sessionId: this.instance.sessionId,
          abortSignal: this.abortController.signal,
        };

        const result = await this.options.toolRegistry.execute(
          toolCall.name,
          toolCall.input,
          toolContext,
        );
        result.toolCallId = toolCall.id;

        // Add tool result message
        const toolMessage: Message = {
          role: 'tool',
          content: result.content,
          toolCallId: toolCall.id,
          timestamp: Date.now(),
        };
        this.messages.push(toolMessage);
        this.options.onMessage?.(toolMessage, this.instance.id);
      }

      turn++;

      // Check context window usage and compact if needed
      if (this.options.compact && this.shouldCompact()) {
        this.messages = await this.options.compact(this.messages);
      }
    }

    return lastAssistantContent;
  }

  private buildSystemPrompt(): string {
    const parts: string[] = [];

    if (this.definition.instructions) {
      parts.push(this.definition.instructions);
    }

    parts.push(
      `You are ${this.definition.name ?? 'an AI assistant'}.` +
        (this.definition.description ? ` ${this.definition.description}` : ''),
    );

    if (this.instance.mode) {
      parts.push(`Mode: ${this.instance.mode}`);
    }

    return parts.join('\n\n');
  }

  private getFilteredToolDefinitions() {
    const allDefs = this.options.toolRegistry.getDefinitions();

    if (this.definition.tools && this.definition.tools.length > 0) {
      // Whitelist: only include specified tools
      return allDefs.filter((d) => this.definition.tools!.includes(d.name));
    }

    if (this.definition.disallowedTools && this.definition.disallowedTools.length > 0) {
      // Blacklist: exclude specified tools
      return allDefs.filter((d) => !this.definition.disallowedTools!.includes(d.name));
    }

    return allDefs;
  }

  private shouldCompact(): boolean {
    // Simple heuristic: check total message character count
    const totalChars = this.messages.reduce((sum, m) => {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return sum + content.length;
    }, 0);

    // Rough estimate: 4 chars per token, compare against model context
    const estimatedTokens = totalChars / 4;
    const contextLimit = 128_000; // Default assumption
    return estimatedTokens / contextLimit > CONTEXT_COMPACTION_THRESHOLD;
  }
}
