import { readdir, stat, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

export interface RepoMapOptions {
  maxDepth?: number;
  respectGitignore?: boolean;
}

const DEFAULT_IGNORE = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '__pycache__',
  '.venv',
  'venv',
  'target',
  '.turbo',
  'coverage',
  '.cache',
]);

export class RepoMap {
  async generate(rootDir: string, options?: RepoMapOptions): Promise<string> {
    const maxDepth = options?.maxDepth ?? 4;
    const respectGitignore = options?.respectGitignore ?? true;

    const ignorePatterns = new Set(DEFAULT_IGNORE);

    if (respectGitignore) {
      const gitignorePatterns = await this.parseGitignore(rootDir);
      for (const pattern of gitignorePatterns) {
        ignorePatterns.add(pattern);
      }
    }

    const lines: string[] = [];
    await this.walk(rootDir, rootDir, 0, maxDepth, ignorePatterns, lines);
    return lines.join('\n');
  }

  private async walk(
    rootDir: string,
    currentDir: string,
    depth: number,
    maxDepth: number,
    ignorePatterns: Set<string>,
    lines: string[],
  ): Promise<void> {
    if (depth > maxDepth) return;

    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    // Sort: directories first, then files, both alphabetical
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.github') continue;
      if (ignorePatterns.has(entry.name)) continue;

      const fullPath = join(currentDir, entry.name);
      const relPath = relative(rootDir, fullPath);
      const indent = '  '.repeat(depth);

      if (entry.isDirectory()) {
        lines.push(`${indent}${entry.name}/`);
        await this.walk(rootDir, fullPath, depth + 1, maxDepth, ignorePatterns, lines);
      } else {
        const fileSize = await this.getFileSize(fullPath);
        const sizeLabel = fileSize !== null ? ` (${this.formatSize(fileSize)})` : '';
        lines.push(`${indent}${entry.name}${sizeLabel}`);
      }
    }
  }

  private async parseGitignore(rootDir: string): Promise<string[]> {
    try {
      const content = await readFile(join(rootDir, '.gitignore'), 'utf-8');
      return content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => line.replace(/\/$/, ''));
    } catch {
      return [];
    }
  }

  private async getFileSize(filePath: string): Promise<number | null> {
    try {
      const s = await stat(filePath);
      return s.size;
    } catch {
      return null;
    }
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
}
