import type { ProviderType, ProviderConfig } from '@fridaycode/shared';
import { OpenAIProvider } from './openai.js';

/**
 * OpenAI-compatible provider for endpoints like LM Studio, vLLM, Together, Groq, etc.
 * Same API shape as OpenAI but with a custom base URL.
 */
export class OpenAICompatibleProvider extends OpenAIProvider {
  readonly type: ProviderType = 'openai-compatible';
  override readonly name: string;

  constructor(config: ProviderConfig) {
    super(config);
    this.name = config.name ?? 'OpenAI-Compatible';
  }
}
