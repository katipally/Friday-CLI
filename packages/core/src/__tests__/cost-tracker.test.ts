import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock shared package
vi.mock('@anthropic-ai/friday-shared', () => ({
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

import { CostTracker } from '../cost/tracker.js';

describe('CostTracker', () => {
  describe('track', () => {
    it('calculates cost for a known model', () => {
      const tracker = new CostTracker();
      const entry = tracker.track('gpt-4o', 'openai', {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        totalTokens: 2_000_000,
      });
      // gpt-4o: input $2.50/M, output $10.00/M → $2.50 + $10.00 = $12.50
      expect(entry.cost).toBeCloseTo(12.5, 2);
    });

    it('returns zero cost for unknown/local models', () => {
      const tracker = new CostTracker();
      const entry = tracker.track('llama-local', 'ollama', {
        inputTokens: 10000,
        outputTokens: 5000,
        totalTokens: 15000,
      });
      expect(entry.cost).toBe(0);
    });

    it('matches models by prefix', () => {
      const tracker = new CostTracker();
      const entry = tracker.track('gpt-4o-2024-05-13', 'openai', {
        inputTokens: 1_000_000,
        outputTokens: 0,
        totalTokens: 1_000_000,
      });
      // Should match gpt-4o pricing: $2.50 per 1M input
      expect(entry.cost).toBeCloseTo(2.5, 2);
    });

    it('returns a CostEntry with all expected fields', () => {
      const tracker = new CostTracker();
      const entry = tracker.track('gpt-4o-mini', 'openai', {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      });
      expect(entry.model).toBe('gpt-4o-mini');
      expect(entry.provider).toBe('openai');
      expect(entry.inputTokens).toBe(100);
      expect(entry.outputTokens).toBe(50);
      expect(entry.cost).toBeGreaterThanOrEqual(0);
      expect(entry.totalSessionCost).toBeGreaterThanOrEqual(0);
      expect(entry.timestamp).toBeInstanceOf(Date);
    });

    it('accumulates total cost across multiple calls', () => {
      const tracker = new CostTracker();
      tracker.track('gpt-4o', 'openai', { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });
      tracker.track('gpt-4o', 'openai', { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });
      const total = tracker.getTotalCost();
      // Each call: (1000 * 2.5 + 500 * 10) / 1M = 0.0075
      expect(total).toBeCloseTo(0.015, 4);
    });
  });

  describe('budget enforcement', () => {
    it('throws BudgetExceededError when budget is exceeded', () => {
      const tracker = new CostTracker(0.001);
      expect(() =>
        tracker.track('gpt-4o', 'openai', {
          inputTokens: 1_000_000,
          outputTokens: 1_000_000,
          totalTokens: 2_000_000,
        }),
      ).toThrow('Budget exceeded');
    });

    it('does not throw when cost is within budget', () => {
      const tracker = new CostTracker(100.0);
      expect(() =>
        tracker.track('gpt-4o-mini', 'openai', {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        }),
      ).not.toThrow();
    });

    it('allows setting budget after construction', () => {
      const tracker = new CostTracker();
      // Track a big usage — no budget set, should not throw
      tracker.track('gpt-4o', 'openai', {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        totalTokens: 2_000_000,
      });

      // Now set a tight budget
      tracker.setBudget(0.001);
      expect(() =>
        tracker.track('gpt-4o', 'openai', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
        }),
      ).toThrow('Budget exceeded');
    });
  });

  describe('getEntries', () => {
    it('returns a copy of all entries', () => {
      const tracker = new CostTracker();
      tracker.track('gpt-4o', 'openai', { inputTokens: 100, outputTokens: 50, totalTokens: 150 });
      tracker.track('claude-sonnet-4-20250514', 'anthropic', {
        inputTokens: 200,
        outputTokens: 100,
        totalTokens: 300,
      });
      const entries = tracker.getEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0].model).toBe('gpt-4o');
      expect(entries[1].model).toBe('claude-sonnet-4-20250514');
    });

    it('returns a copy, not the internal array', () => {
      const tracker = new CostTracker();
      tracker.track('gpt-4o', 'openai', { inputTokens: 100, outputTokens: 50, totalTokens: 150 });
      const entries1 = tracker.getEntries();
      const entries2 = tracker.getEntries();
      expect(entries1).not.toBe(entries2);
      expect(entries1).toEqual(entries2);
    });
  });

  describe('getTotalTokens', () => {
    it('sums input and output tokens across all entries', () => {
      const tracker = new CostTracker();
      tracker.track('gpt-4o', 'openai', { inputTokens: 100, outputTokens: 50, totalTokens: 150 });
      tracker.track('gpt-4o', 'openai', { inputTokens: 200, outputTokens: 100, totalTokens: 300 });
      const tokens = tracker.getTotalTokens();
      expect(tokens.input).toBe(300);
      expect(tokens.output).toBe(150);
    });

    it('returns zeros when no entries', () => {
      const tracker = new CostTracker();
      const tokens = tracker.getTotalTokens();
      expect(tokens.input).toBe(0);
      expect(tokens.output).toBe(0);
    });
  });

  describe('reset', () => {
    it('clears all entries and cost', () => {
      const tracker = new CostTracker();
      tracker.track('gpt-4o', 'openai', { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });
      expect(tracker.getTotalCost()).toBeGreaterThan(0);

      tracker.reset();
      expect(tracker.getTotalCost()).toBe(0);
      expect(tracker.getEntries()).toEqual([]);
      expect(tracker.getTotalTokens()).toEqual({ input: 0, output: 0 });
    });
  });

  describe('formatCostSummary', () => {
    it('includes cost, tokens, and API call count', () => {
      const tracker = new CostTracker();
      tracker.track('gpt-4o', 'openai', { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });
      tracker.track('gpt-4o', 'openai', { inputTokens: 2000, outputTokens: 1000, totalTokens: 3000 });

      const summary = tracker.formatCostSummary();
      expect(summary).toContain('Session Cost');
      expect(summary).toContain('Tokens');
      expect(summary).toContain('API Calls: 2');
    });

    it('includes budget line when budget is set', () => {
      const tracker = new CostTracker(10.0);
      tracker.track('gpt-4o', 'openai', { inputTokens: 100, outputTokens: 50, totalTokens: 150 });
      const summary = tracker.formatCostSummary();
      expect(summary).toContain('Budget');
      expect(summary).toContain('$10.00');
    });

    it('omits budget line when no budget is set', () => {
      const tracker = new CostTracker();
      tracker.track('gpt-4o', 'openai', { inputTokens: 100, outputTokens: 50, totalTokens: 150 });
      const summary = tracker.formatCostSummary();
      expect(summary).not.toContain('Budget');
    });
  });
});
