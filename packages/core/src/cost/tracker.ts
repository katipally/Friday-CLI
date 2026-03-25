import { createLogger, type CostEntry } from '@anthropic-ai/friday-shared';
import { BudgetExceededError } from '@anthropic-ai/friday-shared';
import type { TokenUsage } from '@anthropic-ai/friday-providers';

const logger = createLogger('cost');

interface ModelPricing {
  input: number;  // per 1M tokens
  output: number; // per 1M tokens
}

const PRICING: Record<string, ModelPricing> = {
  // OpenAI
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'o3-mini': { input: 1.10, output: 4.40 },
  // Anthropic
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-haiku-3-5-20241022': { input: 0.80, output: 4.00 },
  'claude-opus-4-20250514': { input: 15.00, output: 75.00 },
  // Google
  'gemini-2.5-pro': { input: 1.25, output: 10.00 },
  'gemini-2.5-flash': { input: 0.15, output: 0.60 },
  // Groq
  'llama-3.1-70b-versatile': { input: 0.59, output: 0.79 },
  // DeepSeek
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-coder': { input: 0.14, output: 0.28 },
};

export class CostTracker {
  private entries: CostEntry[] = [];
  private totalCost = 0;
  private budget: number | null;

  constructor(budget: number | null = null) {
    this.budget = budget;
  }

  track(model: string, provider: string, usage: TokenUsage): CostEntry {
    const pricing = this.getPricing(model);
    const cost =
      (usage.inputTokens * pricing.input + usage.outputTokens * pricing.output) / 1_000_000;

    this.totalCost += cost;

    if (this.budget !== null && this.totalCost > this.budget) {
      throw new BudgetExceededError(this.totalCost, this.budget);
    }

    const entry: CostEntry = {
      model,
      provider,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cost,
      totalSessionCost: this.totalCost,
      timestamp: new Date(),
    };

    this.entries.push(entry);
    logger.debug('Cost tracked', { model, cost: cost.toFixed(6), total: this.totalCost.toFixed(6) });

    return entry;
  }

  getTotalCost(): number {
    return this.totalCost;
  }

  getEntries(): CostEntry[] {
    return [...this.entries];
  }

  getTotalTokens(): { input: number; output: number } {
    return this.entries.reduce(
      (acc, e) => ({
        input: acc.input + e.inputTokens,
        output: acc.output + e.outputTokens,
      }),
      { input: 0, output: 0 },
    );
  }

  setBudget(budget: number | null): void {
    this.budget = budget;
  }

  reset(): void {
    this.entries = [];
    this.totalCost = 0;
  }

  private getPricing(model: string): ModelPricing {
    // Try exact match first
    if (PRICING[model]) return PRICING[model];

    // Try prefix match (e.g., "gpt-4o-2024-05-13" → "gpt-4o")
    for (const [key, pricing] of Object.entries(PRICING)) {
      if (model.startsWith(key)) return pricing;
    }

    // Default: free (local models like Ollama)
    return { input: 0, output: 0 };
  }

  formatCostSummary(): string {
    const tokens = this.getTotalTokens();
    return [
      `💰 Session Cost: $${this.totalCost.toFixed(4)}`,
      `📊 Tokens: ${tokens.input.toLocaleString()} in / ${tokens.output.toLocaleString()} out`,
      `📝 API Calls: ${this.entries.length}`,
      this.budget ? `📋 Budget: $${this.totalCost.toFixed(4)} / $${this.budget.toFixed(2)}` : '',
    ].filter(Boolean).join('\n');
  }
}
