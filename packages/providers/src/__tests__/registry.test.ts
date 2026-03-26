import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the shared package before importing registry
vi.mock('@fridaycode/shared', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  FridayError: class FridayError extends Error {
    code: string;
    details?: Record<string, unknown>;
    constructor(message: string, code: string, details?: Record<string, unknown>) {
      super(message);
      this.name = 'FridayError';
      this.code = code;
      this.details = details;
    }
  },
}));

import { registerProvider, createProvider, listProviders, hasProvider } from '../registry.js';
import type { LLMProvider, ProviderConfig } from '../types.js';

function makeMockProvider(name: string): LLMProvider {
  return {
    name,
    displayName: name.toUpperCase(),
    generate: vi.fn(),
    stream: vi.fn(),
    generateWithTools: vi.fn(),
    streamWithTools: vi.fn(),
    capabilities: vi.fn(() => ({
      streaming: true,
      toolCalling: true,
      vision: false,
      embeddings: false,
      jsonMode: false,
      maxContextWindow: 128000,
    })),
    listModels: vi.fn(async () => []),
    validateApiKey: vi.fn(async () => true),
  };
}

describe('provider registry', () => {
  // The registry module keeps a global Map, so we register unique names per test
  // to avoid cross-test pollution.

  describe('registerProvider', () => {
    it('registers a provider factory', () => {
      const factory = vi.fn(() => makeMockProvider('test-reg'));
      registerProvider('test-reg', factory);
      expect(hasProvider('test-reg')).toBe(true);
    });
  });

  describe('listProviders', () => {
    it('returns an array of registered provider names', () => {
      registerProvider('list-a', () => makeMockProvider('list-a'));
      registerProvider('list-b', () => makeMockProvider('list-b'));
      const list = listProviders();
      expect(list).toContain('list-a');
      expect(list).toContain('list-b');
    });
  });

  describe('hasProvider', () => {
    it('returns true for registered provider', () => {
      registerProvider('has-test', () => makeMockProvider('has-test'));
      expect(hasProvider('has-test')).toBe(true);
    });

    it('returns false for unknown provider', () => {
      expect(hasProvider('does-not-exist')).toBe(false);
    });
  });

  describe('createProvider', () => {
    it('calls the factory with the config and returns a provider', () => {
      const mockProvider = makeMockProvider('create-test');
      const factory = vi.fn(() => mockProvider);
      registerProvider('create-test', factory);

      const config: ProviderConfig = { provider: 'create-test', apiKey: 'sk-123' };
      const result = createProvider(config);

      expect(factory).toHaveBeenCalledWith(config);
      expect(result).toBe(mockProvider);
    });

    it('throws FridayError for unknown provider', () => {
      const config: ProviderConfig = { provider: 'nonexistent-provider' };
      expect(() => createProvider(config)).toThrow('Unknown provider');
      expect(() => createProvider(config)).toThrow('nonexistent-provider');
    });
  });

  describe('new provider adapters registration', () => {
    it('registers aws-bedrock provider', () => {
      const factory = vi.fn(() => makeMockProvider('aws-bedrock'));
      registerProvider('aws-bedrock', factory);
      expect(hasProvider('aws-bedrock')).toBe(true);
      const config: ProviderConfig = { provider: 'aws-bedrock' };
      const provider = createProvider(config);
      expect(provider.name).toBe('aws-bedrock');
      expect(factory).toHaveBeenCalledWith(config);
    });

    it('registers azure-openai provider', () => {
      const factory = vi.fn(() => makeMockProvider('azure-openai'));
      registerProvider('azure-openai', factory);
      expect(hasProvider('azure-openai')).toBe(true);
      const config: ProviderConfig = { provider: 'azure-openai' };
      const provider = createProvider(config);
      expect(provider.name).toBe('azure-openai');
      expect(factory).toHaveBeenCalledWith(config);
    });

    it('registers cohere provider', () => {
      const factory = vi.fn(() => makeMockProvider('cohere'));
      registerProvider('cohere', factory);
      expect(hasProvider('cohere')).toBe(true);
      const config: ProviderConfig = { provider: 'cohere' };
      const provider = createProvider(config);
      expect(provider.name).toBe('cohere');
      expect(factory).toHaveBeenCalledWith(config);
    });

    it('registers together provider', () => {
      const factory = vi.fn(() => makeMockProvider('together'));
      registerProvider('together', factory);
      expect(hasProvider('together')).toBe(true);
      const config: ProviderConfig = { provider: 'together' };
      const provider = createProvider(config);
      expect(provider.name).toBe('together');
      expect(factory).toHaveBeenCalledWith(config);
    });

    it('lists all new providers', () => {
      const list = listProviders();
      expect(list).toContain('aws-bedrock');
      expect(list).toContain('azure-openai');
      expect(list).toContain('cohere');
      expect(list).toContain('together');
    });
  });
});
