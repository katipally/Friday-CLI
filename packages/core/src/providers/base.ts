import type {
  ModelProvider,
  ProviderType,
  ProviderConfig,
  Model,
  ChatOptions,
  StreamChunk,
} from '@fridaycode/shared';
import { MODEL_CACHE_TTL_MS } from '@fridaycode/shared';

/**
 * Abstract base class for model providers.
 * Handles model caching and common patterns.
 */
export abstract class BaseProvider implements ModelProvider {
  abstract readonly type: ProviderType;
  abstract readonly name: string;

  protected config: ProviderConfig;
  private cachedModels: Model[] | null = null;
  private cacheTimestamp = 0;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async listModels(): Promise<Model[]> {
    const now = Date.now();
    if (this.cachedModels && now - this.cacheTimestamp < MODEL_CACHE_TTL_MS) {
      return this.cachedModels;
    }

    const models = await this.fetchModels();
    this.cachedModels = models;
    this.cacheTimestamp = now;
    return models;
  }

  abstract fetchModels(): Promise<Model[]>;
  abstract chat(options: ChatOptions): AsyncIterable<StreamChunk>;
  abstract supportsToolUse(): boolean;
  abstract supportsVision(): boolean;
  abstract supportsStreaming(): boolean;
  abstract isAvailable(): Promise<boolean>;

  clearModelCache(): void {
    this.cachedModels = null;
    this.cacheTimestamp = 0;
  }

  protected getBaseUrl(): string {
    return this.config.baseUrl.replace(/\/+$/, '');
  }

  /**
   * Convert internal tool definitions to provider-specific format.
   */
  protected abstract formatTools(
    tools: ChatOptions['tools'],
  ): unknown[] | undefined;

  /**
   * Parse a streaming response line into a StreamChunk.
   */
  protected abstract parseStreamLine(line: string): StreamChunk | null;
}
