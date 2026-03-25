import fs from 'node:fs';
import path from 'node:path';
import { createLogger, getConfigDir, ConfigError } from '@anthropic-ai/friday-shared';
import { fridayConfigSchema, type FridayConfig } from './schema.js';

const logger = createLogger('config');

export function loadConfig(overrides?: Partial<FridayConfig>): FridayConfig {
  const configs: Array<Partial<FridayConfig>> = [];

  // 1. Global config
  const globalConfigPath = path.join(getConfigDir(), 'config.json');
  const globalConfig = loadConfigFile(globalConfigPath);
  if (globalConfig) configs.push(globalConfig);

  // 2. Project config
  const projectConfigPath = findProjectConfig();
  if (projectConfigPath) {
    const projectConfig = loadConfigFile(projectConfigPath);
    if (projectConfig) configs.push(projectConfig);
  }

  // 3. Environment variables
  const envConfig = loadEnvConfig();
  if (Object.keys(envConfig).length > 0) configs.push(envConfig);

  // 4. CLI overrides
  if (overrides) configs.push(overrides);

  // Merge all configs
  const merged = configs.reduce<Record<string, unknown>>(
    (acc, config) => deepMerge(acc, config as Record<string, unknown>),
    {},
  );

  // Validate with Zod
  const result = fridayConfigSchema.safeParse(merged);
  if (!result.success) {
    logger.warn('Config validation issues, using defaults for invalid fields', {
      errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
    return fridayConfigSchema.parse({});
  }

  return result.data;
}

function loadConfigFile(filePath: string): Partial<FridayConfig> | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    logger.warn(`Failed to load config from ${filePath}`, { error: (error as Error).message });
    return null;
  }
}

function findProjectConfig(): string | null {
  let dir = process.cwd();
  while (true) {
    const configPath = path.join(dir, '.friday', 'config.json');
    if (fs.existsSync(configPath)) return configPath;

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function loadEnvConfig(): Partial<FridayConfig> {
  const config: Record<string, unknown> = {};

  if (process.env.FRIDAY_PROVIDER) {
    config.defaultProvider = process.env.FRIDAY_PROVIDER;
  }
  if (process.env.FRIDAY_MODEL) {
    config.defaultModel = process.env.FRIDAY_MODEL;
  }
  if (process.env.FRIDAY_THEME) {
    config.theme = process.env.FRIDAY_THEME;
  }

  // Provider API keys
  const providers: Record<string, Record<string, string>> = {};
  if (process.env.OPENAI_API_KEY) {
    providers.openai = { apiKey: process.env.OPENAI_API_KEY };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    providers.anthropic = { apiKey: process.env.ANTHROPIC_API_KEY };
  }
  if (process.env.GOOGLE_API_KEY) {
    providers.gemini = { apiKey: process.env.GOOGLE_API_KEY };
  }
  if (process.env.OLLAMA_HOST) {
    providers.ollama = { baseUrl: process.env.OLLAMA_HOST };
  }
  if (process.env.MISTRAL_API_KEY) {
    providers.mistral = { apiKey: process.env.MISTRAL_API_KEY };
  }
  if (process.env.GROQ_API_KEY) {
    providers.groq = { apiKey: process.env.GROQ_API_KEY };
  }
  if (process.env.DEEPSEEK_API_KEY) {
    providers.deepseek = { apiKey: process.env.DEEPSEEK_API_KEY };
  }
  if (process.env.TOGETHER_API_KEY) {
    providers.together = { apiKey: process.env.TOGETHER_API_KEY };
  }
  if (process.env.COHERE_API_KEY) {
    providers.cohere = { apiKey: process.env.COHERE_API_KEY };
  }
  if (process.env.AZURE_OPENAI_API_KEY) {
    providers.azure = {
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      ...(process.env.AZURE_OPENAI_ENDPOINT && { baseUrl: process.env.AZURE_OPENAI_ENDPOINT }),
    };
  }

  if (Object.keys(providers).length > 0) {
    config.providers = providers;
  }

  return config as Partial<FridayConfig>;
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>,
      );
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export function loadProjectRules(): string | null {
  // Look for FRIDAY.md
  const fridayMdPath = path.join(process.cwd(), 'FRIDAY.md');
  if (fs.existsSync(fridayMdPath)) {
    return fs.readFileSync(fridayMdPath, 'utf-8');
  }

  // Look for .friday/rules/ directory
  const rulesDir = path.join(process.cwd(), '.friday', 'rules');
  if (fs.existsSync(rulesDir) && fs.statSync(rulesDir).isDirectory()) {
    const ruleFiles = fs.readdirSync(rulesDir).filter((f) => f.endsWith('.md'));
    if (ruleFiles.length > 0) {
      return ruleFiles
        .map((f) => fs.readFileSync(path.join(rulesDir, f), 'utf-8'))
        .join('\n\n---\n\n');
    }
  }

  return null;
}

export function ensureConfigDir(): string {
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  return configDir;
}

export function saveConfig(config: Partial<FridayConfig>, global = true): void {
  const configDir = global ? getConfigDir() : path.join(process.cwd(), '.friday');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  const configPath = path.join(configDir, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  logger.info(`Config saved to ${configPath}`);
}
