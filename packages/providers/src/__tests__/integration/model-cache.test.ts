import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@fridaycode/shared', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { getCachedModels, setCachedModels, clearModelCache } from '../../model-cache.js';
import type { ModelInfo } from '../../types.js';

const sampleModels: ModelInfo[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    contextWindow: 128000,
    inputPricePerMToken: 2.5,
    outputPricePerMToken: 10.0,
    supportsVision: true,
    supportsToolCalling: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    contextWindow: 128000,
    inputPricePerMToken: 0.15,
    outputPricePerMToken: 0.60,
    supportsVision: true,
    supportsToolCalling: true,
  },
];

describe('ModelCache Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearModelCache();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearModelCache();
  });

  describe('cache miss', () => {
    it('returns null when provider has no cached models', () => {
      expect(getCachedModels('openai')).toBeNull();
    });

    it('returns null for different provider name', () => {
      setCachedModels('openai', sampleModels);
      expect(getCachedModels('anthropic')).toBeNull();
    });
  });

  describe('cache hit', () => {
    it('returns models after they are cached', () => {
      setCachedModels('openai', sampleModels);
      const result = getCachedModels('openai');

      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
      expect(result![0].id).toBe('gpt-4o');
      expect(result![1].id).toBe('gpt-4o-mini');
    });

    it('caches multiple providers independently', () => {
      const anthropicModels: ModelInfo[] = [
        {
          id: 'claude-3',
          name: 'Claude 3',
          contextWindow: 200000,
          inputPricePerMToken: 3.0,
          outputPricePerMToken: 15.0,
          supportsVision: true,
          supportsToolCalling: true,
        },
      ];

      setCachedModels('openai', sampleModels);
      setCachedModels('anthropic', anthropicModels);

      expect(getCachedModels('openai')).toHaveLength(2);
      expect(getCachedModels('anthropic')).toHaveLength(1);
    });

    it('overwrites existing cache on re-set', () => {
      setCachedModels('openai', sampleModels);
      const newModels: ModelInfo[] = [sampleModels[0]];
      setCachedModels('openai', newModels);

      const result = getCachedModels('openai');
      expect(result).toHaveLength(1);
    });
  });

  describe('cache expiry', () => {
    it('returns models within the TTL window', () => {
      setCachedModels('openai', sampleModels);

      // Advance 30 minutes (within 1-hour TTL)
      vi.advanceTimersByTime(30 * 60 * 1000);

      expect(getCachedModels('openai')).not.toBeNull();
    });

    it('returns null after TTL expires', () => {
      setCachedModels('openai', sampleModels);

      // Advance 61 minutes (past 1-hour TTL)
      vi.advanceTimersByTime(61 * 60 * 1000);

      expect(getCachedModels('openai')).toBeNull();
    });

    it('returns null exactly after TTL boundary', () => {
      setCachedModels('openai', sampleModels);

      // Advance exactly 1 hour + 1ms
      vi.advanceTimersByTime(60 * 60 * 1000 + 1);

      expect(getCachedModels('openai')).toBeNull();
    });
  });

  describe('clearModelCache', () => {
    it('clears cache for a specific provider', () => {
      setCachedModels('openai', sampleModels);
      setCachedModels('anthropic', [sampleModels[0]]);

      clearModelCache('openai');

      expect(getCachedModels('openai')).toBeNull();
      expect(getCachedModels('anthropic')).not.toBeNull();
    });

    it('clears entire cache when no provider specified', () => {
      setCachedModels('openai', sampleModels);
      setCachedModels('anthropic', [sampleModels[0]]);

      clearModelCache();

      expect(getCachedModels('openai')).toBeNull();
      expect(getCachedModels('anthropic')).toBeNull();
    });

    it('is safe to call on empty cache', () => {
      expect(() => clearModelCache()).not.toThrow();
      expect(() => clearModelCache('nonexistent')).not.toThrow();
    });
  });
});
