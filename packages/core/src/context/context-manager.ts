import type { Message } from '@fridaycode/shared';
import type { ToolDefinition } from '@fridaycode/providers';
import { MessageHistory } from './message-history.js';
import { Summarizer } from './summarizer.js';

export interface ContextManagerConfig {
  /** Max tokens for the entire context window */
  maxContextTokens: number;
  /** Tokens reserved for the model's response (default 4096) */
  reservedForResponse: number;
  /** Tokens reserved for tool definitions (default 2048) */
  reservedForTools: number;
  /** Fraction of context used before triggering summarization (default 0.8) */
  summarizationThreshold: number;
}

const DEFAULT_CONFIG: ContextManagerConfig = {
  maxContextTokens: 128_000,
  reservedForResponse: 4096,
  reservedForTools: 2048,
  summarizationThreshold: 0.8,
};

export class ContextManager {
  private config: ContextManagerConfig;
  private history: MessageHistory;
  private summaryPrefix: string | null = null;

  constructor(config: Partial<ContextManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.history = new MessageHistory();
  }

  addMessage(message: Message): void {
    this.history.add(message);
  }

  /**
   * Prepare messages to send to the LLM, fitting within the token budget.
   * Accounts for the system prompt and tool definitions.
   */
  prepare(
    systemPrompt: string,
    toolDefinitions?: ToolDefinition[],
  ): Message[] {
    const systemTokens = this.estimateTokens(systemPrompt);
    const toolTokens = toolDefinitions
      ? this.estimateTokens(JSON.stringify(toolDefinitions))
      : 0;

    const availableTokens =
      this.config.maxContextTokens -
      this.config.reservedForResponse -
      systemTokens -
      toolTokens;

    // Account for summary prefix if it exists
    let budget = availableTokens;
    if (this.summaryPrefix) {
      budget -= this.estimateTokens(this.summaryPrefix);
    }

    return this.history.getWithinBudget(Math.max(budget, 0), {
      alwaysIncludeLast: 2,
      includeSystem: true,
    });
  }

  /** Estimate tokens for a string (~4 chars per token) */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /** Get current context usage statistics */
  getUsageStats(): {
    totalMessages: number;
    estimatedTokens: number;
    budgetUsed: number;
    budgetRemaining: number;
  } {
    const allMessages = this.history.getAll();
    const estimatedTokens = allMessages.reduce(
      (sum, m) => sum + this.estimateTokens(m.content),
      0,
    );
    const totalBudget =
      this.config.maxContextTokens - this.config.reservedForResponse;
    const budgetUsed =
      totalBudget > 0
        ? Math.min(1, estimatedTokens / totalBudget)
        : 1;
    const budgetRemaining = Math.max(0, totalBudget - estimatedTokens);

    return {
      totalMessages: allMessages.length,
      estimatedTokens,
      budgetUsed,
      budgetRemaining,
    };
  }

  /**
   * Summarize older messages to free up context space.
   * Keeps the most recent messages and replaces older ones with a summary.
   */
  async summarize(): Promise<string> {
    const allMessages = this.history.getAll();
    if (allMessages.length <= 4) {
      return this.summaryPrefix ?? '';
    }

    // Keep the last 4 messages, summarize the rest
    const toSummarize = allMessages.slice(0, -4);
    const toKeep = allMessages.slice(-4);

    const summary = Summarizer.summarize(toSummarize);
    this.summaryPrefix = this.summaryPrefix
      ? `${this.summaryPrefix}\n\n${summary}`
      : summary;

    // Rebuild history with only the kept messages
    this.history.clear();
    for (const msg of toKeep) {
      this.history.add(msg);
    }

    return this.summaryPrefix;
  }

  /** Check if summarization should be triggered based on usage threshold */
  shouldSummarize(): boolean {
    const { budgetUsed } = this.getUsageStats();
    return budgetUsed >= this.config.summarizationThreshold;
  }

  /** Get the accumulated summary of older messages */
  getSummary(): string | null {
    return this.summaryPrefix;
  }

  clear(): void {
    this.history.clear();
    this.summaryPrefix = null;
  }

  /** Access to the underlying message history */
  getHistory(): MessageHistory {
    return this.history;
  }
}
