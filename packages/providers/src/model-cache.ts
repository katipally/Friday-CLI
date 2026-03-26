import { createLogger } from '@fridaycode/shared';
import type { ModelInfo } from './types.js';

const logger = createLogger('model-cache');

interface CacheEntry {
  models: ModelInfo[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

export function getCachedModels(providerName: string): ModelInfo[] | null {
  const entry = cache.get(providerName);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(providerName);
    return null;
  }
  return entry.models;
}

export function setCachedModels(providerName: string, models: ModelInfo[]): void {
  cache.set(providerName, { models, fetchedAt: Date.now() });
  logger.debug(`Cached ${models.length} models for ${providerName}`);
}

export function clearModelCache(providerName?: string): void {
  if (providerName) { cache.delete(providerName); } else { cache.clear(); }
}
