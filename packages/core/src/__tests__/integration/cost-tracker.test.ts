import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@fridaycode/shared', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  BudgetExceededError: class BudgetExceededError extends Error {
    code: string;
    currentCost: number;
    budget: number;
    constructor(currentCost: number, budget: number) {
      super(`Budget exceeded: $${currentCost.toFixed(4)} spent, budget is $${budget.toFixed(2)}`);
      this.name = 'BudgetExceededError';
      this.code = 'BUDGET_EXCEEDED';
      this.currentCost = currentCost;
      this.budget = budget;
    }
  },
}));

import { CostTracker } from '../../cost/tracker.js';

describe('CostTracker Integration', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  describe('recording costs across multiple providers', () => {
    it('tracks costs for OpenAI models', () => {
      const entry = tracker.track('gpt-4o', 'openai', {
        inputTokens: 500_000,
        outputTokens: 200_000,
        totalTokens: 700_000,
      });
      // gpt-4o: input $2.50/M, output $10.00/M
      // 500k * 2.50/1M + 200k * 10.00/1M = 1.25 + 2.00 = 3.25
      expect(entry.cost).toBeCloseTo(3.25, 2);
      expect(entry.provider).toBe('openai');
    });

    it('tracks costs for Anthropic models', () => {
      const entry = tracker.track('claude-sonnet-4-20250514', 'anthropic', {
        inputTokens: 100_000,
        outputTokens: 50_000,
        totalTokens: 150_000,
      });
      // claude-sonnet-4: input $3.00/M, output $15.00/M
      // 100k * 3/1M + 50k * 15/1M = 0.30 + 0.75 = 1.05
      expect(entry.cost).toBeCloseTo(1.05, 2);
    });

    it('tracks costs for Google models', () => {
      const entry = tracker.track('gemini-2.5-flash', 'google', {
        inputTokens: 1_000_000,
        outputTokens: 500_000,
        totalTokens: 1_500_000,
      });
      // gemini-2.5-flash: input $0.15/M, output $0.60/M
      // 1M * 0.15/1M + 500k * 0.60/1M = 0.15 + 0.30 = 0.45
      expect(entry.cost).toBeCloseTo(0.45, 2);
    });

    it('accumulates total cost across providers', () => {
      tracker.track('gpt-4o-mini', 'openai', { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });
      tracker.track('claude-sonnet-4-20250514', 'anthropic', { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });
      tracker.track('deepseek-chat', 'deepseek', { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });

      expect(tracker.getTotalCost()).toBeGreaterThan(0);
      expect(tracker.getEntries()).toHaveLength(3);
    });

    it('returns zero cost for unknown/local models', () => {
      const entry = tracker.track('my-local-model', 'ollama', {
        inputTokens: 1_000_000,
        outputTokens: 500_000,
        totalTokens: 1_500_000,
      });
      expect(entry.cost).toBe(0);
    });
  });

  describe('budget checking', () => {
    it('checkBudget does not throw when no budget is set', () => {
      expect(() => tracker.checkBudget(100)).not.toThrow();
    });

    it('checkBudget does not throw when within budget', () => {
      tracker.setBudget(10.0);
      expect(() => tracker.checkBudget(5.0)).not.toThrow();
    });

    it('checkBudget throws when estimated cost exceeds budget', () => {
      tracker.setBudget(1.0);
      expect(() => tracker.checkBudget(2.0)).toThrow('Budget exceeded');
    });

    it('checkBudget considers already-spent cost', () => {
      tracker.setBudget(5.0);
      tracker.track('gpt-4o', 'openai', {
        inputTokens: 1_000_000,
        outputTokens: 0,
        totalTokens: 1_000_000,
      });
      // Already spent $2.50, budget is $5.00
      // Requesting $3.00 more → $5.50 > $5.00
      expect(() => tracker.checkBudget(3.0)).toThrow('Budget exceeded');
    });

    it('track throws BudgetExceededError when cost pushes over budget', () => {
      const budgetTracker = new CostTracker(0.001);
      expect(() =>
        budgetTracker.track('gpt-4o', 'openai', {
          inputTokens: 1_000_000,
          outputTokens: 1_000_000,
          totalTokens: 2_000_000,
        }),
      ).toThrow('Budget exceeded');
    });
  });

  describe('remaining budget', () => {
    it('returns null when no budget is set', () => {
      expect(tracker.getRemainingBudget()).toBeNull();
    });

    it('returns full budget when nothing spent', () => {
      tracker.setBudget(10.0);
      expect(tracker.getRemainingBudget()).toBe(10.0);
    });

    it('returns remaining after spending', () => {
      tracker.setBudget(10.0);
      tracker.track('gpt-4o-mini', 'openai', {
        inputTokens: 1_000_000,
        outputTokens: 0,
        totalTokens: 1_000_000,
      });
      // gpt-4o-mini input: $0.15/M → spent $0.15
      const remaining = tracker.getRemainingBudget()!;
      expect(remaining).toBeCloseTo(9.85, 2);
    });

    it('returns 0 when budget is fully consumed', () => {
      tracker.setBudget(0.0);
      expect(tracker.getRemainingBudget()).toBe(0);
    });
  });

  describe('cost estimation', () => {
    it('estimates cost for known models', () => {
      const cost = tracker.estimateCost('gpt-4o', 1_000_000, 500_000);
      // 1M * 2.50/1M + 500k * 10.00/1M = 2.50 + 5.00 = 7.50
      expect(cost).toBeCloseTo(7.5, 2);
    });

    it('returns zero estimate for unknown models', () => {
      const cost = tracker.estimateCost('ollama-llama', 1_000_000, 500_000);
      expect(cost).toBe(0);
    });

    it('estimation does not affect actual cost tracking', () => {
      tracker.estimateCost('gpt-4o', 1_000_000, 500_000);
      expect(tracker.getTotalCost()).toBe(0);
      expect(tracker.getEntries()).toHaveLength(0);
    });
  });

  describe('reset and formatCostSummary', () => {
    it('reset clears all state', () => {
      tracker.track('gpt-4o', 'openai', { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });
      tracker.reset();
      expect(tracker.getTotalCost()).toBe(0);
      expect(tracker.getEntries()).toEqual([]);
      expect(tracker.getTotalTokens()).toEqual({ input: 0, output: 0 });
    });

    it('formatCostSummary reflects tracked usage', () => {
      tracker.track('gpt-4o', 'openai', { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });
      tracker.track('gpt-4o', 'openai', { inputTokens: 2000, outputTokens: 1000, totalTokens: 3000 });
      const summary = tracker.formatCostSummary();
      expect(summary).toContain('Session Cost');
      expect(summary).toContain('Tokens');
      expect(summary).toContain('API Calls: 2');
    });
  });

  describe('totalSessionCost field', () => {
    it('each entry records the running total', () => {
      const e1 = tracker.track('gpt-4o', 'openai', { inputTokens: 1_000_000, outputTokens: 0, totalTokens: 1_000_000 });
      const e2 = tracker.track('gpt-4o', 'openai', { inputTokens: 1_000_000, outputTokens: 0, totalTokens: 1_000_000 });
      expect(e1.totalSessionCost).toBeCloseTo(2.5, 2);
      expect(e2.totalSessionCost).toBeCloseTo(5.0, 2);
    });
  });
});
