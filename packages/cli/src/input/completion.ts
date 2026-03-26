import { readdir, stat } from 'node:fs/promises';
import { join, resolve, dirname, basename } from 'node:path';

/**
 * Tab completion engine.
 * Supports slash commands, file paths, and model names.
 */

export interface CompletionResult {
  items: string[];
  prefix: string;
}

const SLASH_COMMANDS = [
  '/model', '/provider', '/clear', '/compact', '/fork', '/rewind', '/export',
  '/diff', '/cost', '/permissions', '/config', '/memory', '/skills', '/agents',
  '/plugin', '/theme', '/vim', '/status', '/help', '/exit', '/quit',
  '/init', '/resume', '/context', '/mcp',
];

/**
 * Get completions for the current input.
 */
export async function getCompletions(
  input: string,
  workingDir: string,
  availableModels?: string[],
): Promise<CompletionResult> {
  const trimmed = input.trimStart();

  // Slash command completion
  if (trimmed.startsWith('/')) {
    const matches = SLASH_COMMANDS.filter((cmd) =>
      cmd.startsWith(trimmed.split(/\s/)[0]),
    );
    return { items: matches, prefix: trimmed.split(/\s/)[0] };
  }

  // File path completion (when input looks like a path)
  const words = trimmed.split(/\s+/);
  const lastWord = words[words.length - 1] ?? '';

  if (
    lastWord.includes('/') ||
    lastWord.includes('.') ||
    lastWord.startsWith('~')
  ) {
    return getFileCompletions(lastWord, workingDir);
  }

  // Model name completion (after /model command)
  if (trimmed.startsWith('/model ') && availableModels) {
    const query = trimmed.slice('/model '.length);
    const matches = availableModels.filter((m) =>
      m.toLowerCase().includes(query.toLowerCase()),
    );
    return { items: matches, prefix: query };
  }

  return { items: [], prefix: '' };
}

async function getFileCompletions(
  partial: string,
  workingDir: string,
): Promise<CompletionResult> {
  try {
    const absPartial = resolve(workingDir, partial);
    const dir = partial.endsWith('/') ? absPartial : dirname(absPartial);
    const prefix = partial.endsWith('/') ? '' : basename(absPartial);

    const entries = await readdir(dir, { withFileTypes: true });
    const matches = entries
      .filter((e) => e.name.startsWith(prefix))
      .filter((e) => !e.name.startsWith('.'))
      .map((e) => (e.isDirectory() ? e.name + '/' : e.name))
      .slice(0, 20);

    return { items: matches, prefix };
  } catch {
    return { items: [], prefix: partial };
  }
}
