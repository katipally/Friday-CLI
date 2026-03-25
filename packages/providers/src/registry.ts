import { type LLMProvider, type ProviderConfig } from './types.js';
import { createLogger, FridayError } from '@anthropic-ai/friday-shared';

const logger = createLogger('providers');

type ProviderFactory = (config: ProviderConfig) => LLMProvider;

const providers = new Map<string, ProviderFactory>();

export function registerProvider(name: string, factory: ProviderFactory): void {
  providers.set(name, factory);
  logger.debug(`Registered provider: ${name}`);
}

export function createProvider(config: ProviderConfig): LLMProvider {
  const factory = providers.get(config.provider);
  if (!factory) {
    const available = Array.from(providers.keys()).join(', ');
    throw new FridayError(
      `Unknown provider: "${config.provider}". Available: ${available}`,
      'UNKNOWN_PROVIDER',
    );
  }
  return factory(config);
}

export function listProviders(): string[] {
  return Array.from(providers.keys());
}

export function hasProvider(name: string): boolean {
  return providers.has(name);
}
