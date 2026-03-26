import type { ModelProvider, ProviderConfig, ProviderType, Model } from '@fridaycode/shared';
import { OllamaProvider } from './ollama.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { OpenAICompatibleProvider } from './openai-compat.js';

export { BaseProvider } from './base.js';
export { OllamaProvider } from './ollama.js';
export { AnthropicProvider } from './anthropic.js';
export { OpenAIProvider } from './openai.js';
export { OpenAICompatibleProvider } from './openai-compat.js';

/**
 * Create a provider instance from config.
 */
export function createProvider(config: ProviderConfig): ModelProvider {
  switch (config.type) {
    case 'ollama':
      return new OllamaProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    case 'openai-compatible':
      return new OpenAICompatibleProvider(config);
    default:
      throw new Error(`Unknown provider type: ${config.type satisfies never}`);
  }
}

/**
 * Manages multiple providers and provides unified model listing.
 */
export class ProviderRegistry {
  private providers = new Map<string, ModelProvider>();

  register(name: string, config: ProviderConfig): void {
    if (!config.enabled) return;
    this.providers.set(name, createProvider(config));
  }

  get(name: string): ModelProvider | undefined {
    return this.providers.get(name);
  }

  getByType(type: ProviderType): ModelProvider | undefined {
    for (const provider of this.providers.values()) {
      if (provider.type === type) return provider;
    }
    return undefined;
  }

  list(): Map<string, ModelProvider> {
    return this.providers;
  }

  /**
   * Get all available models across all providers.
   */
  async listAllModels(): Promise<Model[]> {
    const results: Model[] = [];
    const promises = Array.from(this.providers.entries()).map(async ([, provider]) => {
      try {
        const models = await provider.listModels();
        results.push(...models);
      } catch {
        // Provider unavailable — skip silently
      }
    });
    await Promise.all(promises);
    return results;
  }

  /**
   * Find the provider that owns a given model ID.
   */
  async findProviderForModel(modelId: string): Promise<ModelProvider | undefined> {
    for (const [, provider] of this.providers) {
      try {
        const models = await provider.listModels();
        if (models.some((m) => m.id === modelId)) return provider;
      } catch {
        continue;
      }
    }
    return undefined;
  }
}
