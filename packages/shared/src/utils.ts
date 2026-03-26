import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import matter from 'gray-matter';
import { CONFIG_DIR, USER_CONFIG_DIR } from './constants.js';

/**
 * Resolve ~ to home directory in paths.
 */
export function expandHome(filepath: string): string {
  if (filepath.startsWith('~')) {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

/**
 * Get the user-level config directory (~/.friday/).
 */
export function getUserConfigDir(): string {
  return path.join(os.homedir(), USER_CONFIG_DIR);
}

/**
 * Get the project-level config directory (.friday/ in project root).
 */
export function getProjectConfigDir(projectPath: string): string {
  return path.join(projectPath, CONFIG_DIR);
}

/**
 * Ensure a directory exists, creating it recursively if needed.
 */
export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Read a JSON file, returning undefined if it doesn't exist.
 */
export function readJsonFile<T>(filePath: string): T | undefined {
  const resolved = expandHome(filePath);
  try {
    const content = fs.readFileSync(resolved, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return undefined;
  }
}

/**
 * Write a JSON file, creating directories as needed.
 */
export function writeJsonFile(filePath: string, data: unknown): void {
  const resolved = expandHome(filePath);
  ensureDir(path.dirname(resolved));
  fs.writeFileSync(resolved, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/**
 * Read a file as string, returning undefined if it doesn't exist.
 */
export function readTextFile(filePath: string): string | undefined {
  const resolved = expandHome(filePath);
  try {
    return fs.readFileSync(resolved, 'utf-8');
  } catch {
    return undefined;
  }
}

/**
 * Parse a Markdown file with YAML frontmatter.
 * Returns { data: frontmatter object, content: markdown body }.
 */
export function parseFrontmatter(content: string): { data: Record<string, unknown>; content: string } {
  const result = matter(content);
  return { data: result.data as Record<string, unknown>, content: result.content };
}

/**
 * Generate a unique ID (nanoid-style but using crypto).
 */
export function generateId(length = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

/**
 * Format a timestamp for display.
 */
export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

/**
 * Truncate a string with ellipsis.
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

/**
 * Deep merge objects (settings merge).
 */
export function deepMerge<T extends Record<string, unknown>>(base: T, ...overrides: Partial<T>[]): T {
  const result = { ...base };
  for (const override of overrides) {
    for (const key of Object.keys(override) as (keyof T)[]) {
      const val = override[key];
      if (val !== undefined) {
        if (
          typeof val === 'object' &&
          val !== null &&
          !Array.isArray(val) &&
          typeof result[key] === 'object' &&
          result[key] !== null &&
          !Array.isArray(result[key])
        ) {
          result[key] = deepMerge(
            result[key] as Record<string, unknown>,
            val as Record<string, unknown>,
          ) as T[keyof T];
        } else {
          result[key] = val as T[keyof T];
        }
      }
    }
  }
  return result;
}

/**
 * Match a tool pattern like "Bash(git*)" against a tool name and input.
 */
export function matchToolPattern(pattern: string, toolName: string, command?: string): boolean {
  const match = pattern.match(/^(\w+)(?:\((.+)\))?$/);
  if (!match) return false;

  const [, patternTool, patternArg] = match;
  if (patternTool !== toolName) return false;
  if (!patternArg) return true;

  if (!command) return false;
  const regex = new RegExp('^' + patternArg.replace(/\*/g, '.*') + '$');
  return regex.test(command);
}
