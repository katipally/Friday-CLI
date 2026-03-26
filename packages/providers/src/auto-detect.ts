import { createLogger } from '@fridaycode/shared';
import type { LLMProvider } from './types.js';
import { createProvider } from './registry.js';
import { OpenAICompatibleProvider } from './adapters/openai-compatible.js';

const logger = createLogger('auto-detect');

export interface DetectedProvider {
  name: string;
  provider: LLMProvider;
  source: 'env' | 'config' | 'local';
}

/**
 * Maps well-known environment variable names to their provider identifiers
 * used by the registry.
 */
const ENV_KEY_TO_PROVIDER: Record<string, string> = {
  OPENAI_API_KEY: 'openai',
  ANTHROPIC_API_KEY: 'anthropic',
  GOOGLE_API_KEY: 'google-gemini',
  GEMINI_API_KEY: 'google-gemini',
  MISTRAL_API_KEY: 'mistral',
  GROQ_API_KEY: 'groq',
  DEEPSEEK_API_KEY: 'deepseek',
  TOGETHER_API_KEY: 'together',
  COHERE_API_KEY: 'cohere',
  OPENROUTER_API_KEY: 'openrouter',
  XAI_API_KEY: 'xai',
};

/** Well-known base URLs for providers that use OpenAI-compatible endpoints */
const PROVIDER_BASE_URLS: Record<string, string> = {
  groq: 'https://api.groq.com/openai/v1',
  deepseek: 'https://api.deepseek.com/v1',
  together: 'https://api.together.xyz/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  xai: 'https://api.x.ai/v1',
};

/** Priority order for picking the best provider (lower index = higher priority) */
const PROVIDER_PRIORITY = [
  'anthropic',
  'openai',
  'google-gemini',
  'deepseek',
  'mistral',
  'groq',
  'openrouter',
  'together',
  'cohere',
  'xai',
  'ollama',
];

const CUSTOM_PREFIX = 'FRIDAY_CUSTOM_PROVIDER_';

/**
 * Map an environment variable key to the provider name it activates.
 * Returns `null` if the key is not a recognized provider env var.
 */
export function getProviderForKey(envKey: string): string | null {
  return ENV_KEY_TO_PROVIDER[envKey] ?? null;
}

/**
 * Synchronously list all provider names that can be activated based on
 * currently-set environment variables.
 * Does NOT include Ollama (requires a network probe).
 */
export function getAvailableProviders(): string[] {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const [envKey, providerName] of Object.entries(ENV_KEY_TO_PROVIDER)) {
    if (process.env[envKey] && !seen.has(providerName)) {
      seen.add(providerName);
      names.push(providerName);
    }
  }

  // Detect custom providers from FRIDAY_CUSTOM_PROVIDER_* env vars
  for (const customName of parseCustomProviderNames()) {
    const name = `custom-${customName.toLowerCase()}`;
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }

  return names;
}

/**
 * Return the single best detected provider, preferring
 * Anthropic → OpenAI → others in priority order.
 * Synchronous — skips the Ollama network probe.
 */
export function getBestProvider(): DetectedProvider | null {
  for (const providerName of PROVIDER_PRIORITY) {
    const detected = detectKnownProviderSync(providerName);
    if (detected) return detected;
  }

  // Fall back to any custom provider
  const customNames = parseCustomProviderNames();
  if (customNames.length > 0) {
    const detected = detectCustomProvider(customNames[0]);
    if (detected) return detected;
  }

  return null;
}

/**
 * Fully detect all available providers, including an async Ollama probe
 * with a 1-second timeout.
 */
export async function detectProviders(
  config?: Record<string, unknown>,
): Promise<DetectedProvider[]> {
  const detected: DetectedProvider[] = [];
  const seen = new Set<string>();

  // 1. Detect from config if provided
  if (config) {
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'object' && value !== null && 'provider' in value) {
        const cfg = value as Record<string, unknown>;
        const providerName = cfg.provider as string;
        if (!seen.has(providerName)) {
          try {
            const provider = createProvider({
              provider: providerName,
              apiKey: cfg.apiKey as string | undefined,
              baseUrl: cfg.baseUrl as string | undefined,
              model: cfg.model as string | undefined,
            });
            seen.add(providerName);
            detected.push({ name: key, provider, source: 'config' });
          } catch (err) {
            logger.debug(`Failed to create provider from config key "${key}": ${(err as Error).message}`);
          }
        }
      }
    }
  }

  // 2. Detect known providers from environment variables
  for (const [envKey, providerName] of Object.entries(ENV_KEY_TO_PROVIDER)) {
    const apiKey = process.env[envKey];
    if (!apiKey || seen.has(providerName)) continue;

    try {
      const provider = createProvider({
        provider: providerName,
        apiKey,
        baseUrl: PROVIDER_BASE_URLS[providerName],
      });
      seen.add(providerName);
      detected.push({ name: providerName, provider, source: 'env' });
    } catch (err) {
      logger.debug(`Failed to create ${providerName} from ${envKey}: ${(err as Error).message}`);
    }
  }

  // 3. Detect custom FRIDAY_CUSTOM_PROVIDER_* providers
  for (const customName of parseCustomProviderNames()) {
    const name = `custom-${customName.toLowerCase()}`;
    if (seen.has(name)) continue;

    const result = detectCustomProvider(customName);
    if (result) {
      seen.add(name);
      detected.push(result);
    }
  }

  // 4. Probe Ollama on localhost (1-second timeout)
  if (!seen.has('ollama')) {
    const ollamaDetected = await probeOllama();
    if (ollamaDetected) {
      detected.push(ollamaDetected);
    }
  }

  return detected;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract unique custom provider group names from environment variables.
 * For `FRIDAY_CUSTOM_PROVIDER_MYAPI_URL` the group name is "MYAPI".
 */
function parseCustomProviderNames(): string[] {
  const names = new Set<string>();
  for (const key of Object.keys(process.env)) {
    if (!key.startsWith(CUSTOM_PREFIX)) continue;
    const rest = key.slice(CUSTOM_PREFIX.length);
    // Expected suffixes: _URL, _KEY, _MODEL, _HEADER_*
    const separatorIdx = rest.indexOf('_');
    if (separatorIdx > 0) {
      names.add(rest.slice(0, separatorIdx));
    }
  }
  return [...names];
}

function detectCustomProvider(groupName: string): DetectedProvider | null {
  const prefix = `${CUSTOM_PREFIX}${groupName}_`;
  const url = process.env[`${prefix}URL`];
  if (!url) return null;

  const apiKey = process.env[`${prefix}KEY`] || 'not-needed';
  const model = process.env[`${prefix}MODEL`];

  // Collect extra headers from FRIDAY_CUSTOM_PROVIDER_<NAME>_HEADER_<H>=value
  const headers: Record<string, string> = {};
  const headerPrefix = `${prefix}HEADER_`;
  for (const key of Object.keys(process.env)) {
    if (key.startsWith(headerPrefix)) {
      const headerName = key.slice(headerPrefix.length).toLowerCase().replace(/_/g, '-');
      const headerValue = process.env[key];
      if (headerValue) {
        headers[headerName] = headerValue;
      }
    }
  }

  const name = `custom-${groupName.toLowerCase()}`;
  try {
    const provider = new OpenAICompatibleProvider({
      name,
      apiKey,
      baseURL: url,
      defaultModel: model,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
    return { name, provider, source: 'env' };
  } catch (err) {
    logger.debug(`Failed to create custom provider "${name}": ${(err as Error).message}`);
    return null;
  }
}

function detectKnownProviderSync(providerName: string): DetectedProvider | null {
  // Find the env key(s) that activate this provider
  for (const [envKey, name] of Object.entries(ENV_KEY_TO_PROVIDER)) {
    if (name !== providerName) continue;
    const apiKey = process.env[envKey];
    if (!apiKey) continue;

    try {
      const provider = createProvider({
        provider: providerName,
        apiKey,
        baseUrl: PROVIDER_BASE_URLS[providerName],
      });
      return { name: providerName, provider, source: 'env' };
    } catch (err) {
      logger.debug(`Failed to create ${providerName}: ${(err as Error).message}`);
    }
  }
  return null;
}

async function probeOllama(): Promise<DetectedProvider | null> {
  const ollamaUrl = process.env.OLLAMA_HOST || 'http://localhost:11434';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);

    const response = await fetch(`${ollamaUrl}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const provider = createProvider({
        provider: 'ollama',
        baseUrl: ollamaUrl,
      });
      return { name: 'ollama', provider, source: 'local' };
    }
  } catch {
    logger.debug('Ollama not detected on localhost');
  }
  return null;
}
