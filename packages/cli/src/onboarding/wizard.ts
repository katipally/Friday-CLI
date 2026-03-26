/**
 * First-run onboarding wizard for FridayCode.
 * Detects if this is a first run, guides provider/model setup.
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getUserConfigDir } from '@fridaycode/shared';

const ONBOARDING_MARKER = '.onboarded';

export interface OnboardingResult {
  provider: string;
  model: string;
  apiKey?: string;
  ollamaUrl?: string;
  skipped: boolean;
}

/**
 * Check if onboarding has been completed.
 */
export function isOnboarded(): boolean {
  const marker = join(getUserConfigDir(), ONBOARDING_MARKER);
  return existsSync(marker);
}

/**
 * Mark onboarding as complete.
 */
export async function markOnboarded(): Promise<void> {
  const dir = getUserConfigDir();
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, ONBOARDING_MARKER), new Date().toISOString(), 'utf-8');
}

/**
 * Detect if Ollama is running locally.
 */
export async function detectOllama(url: string = 'http://localhost:11434'): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(`${url}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch available Ollama models.
 */
export async function getOllamaModels(url: string = 'http://localhost:11434'): Promise<string[]> {
  try {
    const resp = await fetch(`${url}/api/tags`);
    if (!resp.ok) return [];
    const data = await resp.json() as any;
    return (data.models ?? []).map((m: any) => m.name as string);
  } catch {
    return [];
  }
}

/**
 * Create initial FRIDAY.md project memory file.
 */
export async function createProjectMemory(projectDir: string, projectName: string): Promise<void> {
  const content = `# ${projectName}

## Project Overview
<!-- Describe your project here. FridayCode will use this context. -->

## Tech Stack
<!-- List key technologies, frameworks, and tools -->

## Conventions
<!-- Code style, naming conventions, patterns to follow -->

## Important Files
<!-- Key files and their purposes -->
`;
  await writeFile(join(projectDir, 'FRIDAY.md'), content, 'utf-8');
}

/**
 * Provider configuration templates.
 */
export const PROVIDER_CONFIGS = {
  ollama: {
    name: 'Ollama (Local)',
    envVar: null,
    defaultModel: 'llama3.1:8b',
    description: 'Free, local inference. No API key required.',
  },
  anthropic: {
    name: 'Anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-sonnet-4-20250514',
    description: 'Claude models. Requires API key.',
  },
  openai: {
    name: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o',
    description: 'GPT models. Requires API key.',
  },
  'openai-compatible': {
    name: 'OpenAI-Compatible',
    envVar: null,
    defaultModel: '',
    description: 'Any OpenAI-compatible API (Together, Groq, etc.)',
  },
} as const;

/**
 * Generate the onboarding welcome text.
 */
export function getWelcomeText(): string {
  return `
Welcome to FridayCode! 🕷️

FridayCode is your AI-powered coding assistant that runs right in your terminal.

Let's get you set up. You'll need to choose an AI provider:

  1. Ollama (local, free — recommended for getting started)
  2. Anthropic (Claude models — recommended for best quality)
  3. OpenAI (GPT models)
  4. OpenAI-Compatible (Together, Groq, etc.)

You can always change this later with /provider and /model commands.
`.trim();
}
