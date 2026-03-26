/**
 * Dynamic pricing manager that can load pricing from provider ModelInfo objects,
 * support manual overrides, and estimate pricing for unknown models based on
 * name patterns.
 */

export interface PricingEntry {
  provider: string;
  model: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
  lastUpdated: string;
}

interface ProviderDescriptor {
  name: string;
  models: Array<{
    id: string;
    pricing?: { inputCostPer1M: number; outputCostPer1M: number };
  }>;
}

function makeKey(provider: string, model: string): string {
  return `${provider}::${model}`;
}

export class PricingManager {
  private prices: Map<string, PricingEntry>;

  constructor() {
    this.prices = new Map();
  }

  /**
   * Load pricing from provider ModelInfo objects.
   * Each provider supplies a name and a list of models with optional pricing.
   */
  loadFromProviders(providers: ProviderDescriptor[]): void {
    const now = new Date().toISOString();
    for (const provider of providers) {
      for (const model of provider.models) {
        if (model.pricing) {
          const key = makeKey(provider.name, model.id);
          this.prices.set(key, {
            provider: provider.name,
            model: model.id,
            inputCostPer1M: model.pricing.inputCostPer1M,
            outputCostPer1M: model.pricing.outputCostPer1M,
            lastUpdated: now,
          });
        }
      }
    }
  }

  /** Manual override for a specific provider + model. */
  setPrice(provider: string, model: string, input: number, output: number): void {
    const key = makeKey(provider, model);
    this.prices.set(key, {
      provider,
      model,
      inputCostPer1M: input,
      outputCostPer1M: output,
      lastUpdated: new Date().toISOString(),
    });
  }

  /** Exact lookup. Returns null when no entry is found. */
  getPrice(provider: string, model: string): PricingEntry | null {
    return this.prices.get(makeKey(provider, model)) ?? null;
  }

  /**
   * Returns the exact price if available, otherwise falls back to a
   * pattern-based estimate derived from the model name.
   */
  getPriceOrEstimate(provider: string, model: string): PricingEntry {
    const exact = this.getPrice(provider, model);
    if (exact) return exact;

    // Try matching by model id alone across all providers
    for (const entry of this.prices.values()) {
      if (entry.model === model) return entry;
    }

    return this.estimatePricing(model);
  }

  /** Calculate cost in dollars for a given token usage. */
  calculateCost(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const pricing = this.getPriceOrEstimate(provider, model);
    return (
      (inputTokens * pricing.inputCostPer1M + outputTokens * pricing.outputCostPer1M) / 1_000_000
    );
  }

  /** Export all stored pricing entries (useful for caching to disk). */
  exportPricing(): PricingEntry[] {
    return [...this.prices.values()];
  }

  /** Import previously-exported pricing entries. */
  importPricing(entries: PricingEntry[]): void {
    for (const entry of entries) {
      const key = makeKey(entry.provider, entry.model);
      this.prices.set(key, { ...entry });
    }
  }

  /**
   * Heuristic estimation based on well-known model name patterns.
   * Returns a sensible default so callers never get null.
   */
  estimatePricing(model: string): PricingEntry {
    const m = model.toLowerCase();

    let inputCost: number;
    let outputCost: number;

    if (matchesAny(m, ['gpt-4o-mini', 'gpt-4o mini'])) {
      // GPT-4o-mini — cheap tier
      inputCost = 0.15;
      outputCost = 0.60;
    } else if (matchesAny(m, ['gpt-4-turbo'])) {
      inputCost = 10.0;
      outputCost = 30.0;
    } else if (matchesAny(m, ['gpt-4o'])) {
      inputCost = 2.5;
      outputCost = 10.0;
    } else if (matchesAny(m, ['gpt-4'])) {
      // GPT-4 family — expensive tier
      inputCost = 10.0;
      outputCost = 30.0;
    } else if (matchesAny(m, ['gpt-3.5', 'gpt-35'])) {
      inputCost = 0.5;
      outputCost = 1.5;
    } else if (matchesAny(m, ['o3-mini', 'o1-mini'])) {
      inputCost = 1.1;
      outputCost = 4.4;
    } else if (matchesAny(m, ['o3', 'o1'])) {
      inputCost = 10.0;
      outputCost = 40.0;
    } else if (matchesAny(m, ['claude-3-opus', 'claude-opus'])) {
      inputCost = 15.0;
      outputCost = 75.0;
    } else if (matchesAny(m, ['claude-3-haiku', 'claude-haiku'])) {
      inputCost = 0.25;
      outputCost = 1.25;
    } else if (matchesAny(m, ['claude-3-sonnet', 'claude-sonnet', 'claude-3.5-sonnet'])) {
      inputCost = 3.0;
      outputCost = 15.0;
    } else if (m.includes('claude')) {
      // Generic Claude fallback — mid tier
      inputCost = 3.0;
      outputCost = 15.0;
    } else if (matchesAny(m, ['gemini-pro', 'gemini-2.5-pro', 'gemini-1.5-pro'])) {
      inputCost = 1.25;
      outputCost = 5.0;
    } else if (matchesAny(m, ['gemini-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'])) {
      inputCost = 0.15;
      outputCost = 0.6;
    } else if (m.includes('gemini')) {
      inputCost = 1.25;
      outputCost = 5.0;
    } else if (matchesAny(m, ['deepseek'])) {
      inputCost = 0.14;
      outputCost = 0.28;
    } else if (matchesAny(m, ['llama', 'mixtral', 'mistral-small', 'qwen'])) {
      // Open-source / cheap tier
      inputCost = 0.1;
      outputCost = 0.5;
    } else if (matchesAny(m, ['mistral-large', 'mistral-medium'])) {
      inputCost = 2.0;
      outputCost = 6.0;
    } else if (m.includes('mistral')) {
      inputCost = 0.5;
      outputCost = 1.5;
    } else if (matchesAny(m, ['command-r-plus', 'command-a'])) {
      inputCost = 2.5;
      outputCost = 10.0;
    } else if (m.includes('command')) {
      inputCost = 0.15;
      outputCost = 0.6;
    } else if (m.includes('mini') || m.includes('micro') || m.includes('lite') || m.includes('nano')) {
      // Generic small-model heuristic
      inputCost = 0.15;
      outputCost = 0.6;
    } else {
      // Safe default
      inputCost = 1.0;
      outputCost = 3.0;
    }

    return {
      provider: 'estimate',
      model,
      inputCostPer1M: inputCost,
      outputCostPer1M: outputCost,
      lastUpdated: new Date().toISOString(),
    };
  }
}

/** Returns true if `value` contains any of the given substrings. */
function matchesAny(value: string, patterns: string[]): boolean {
  return patterns.some((p) => value.includes(p));
}
