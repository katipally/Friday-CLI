import { readdir, stat, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { CodeParser } from './parser.js';
import type { ParsedFile, CodeSymbol } from './parser.js';

// ── Public interfaces ──────────────────────────────────────────────

export interface IndexOptions {
  /** Glob-style patterns to include (matched against relative paths). */
  include?: string[];
  /** Glob-style patterns to exclude (matched against relative paths). */
  exclude?: string[];
  /** Skip files larger than this size in bytes (default 1 MB). */
  maxFileSize?: number;
  /** Maximum number of files to index. */
  maxFiles?: number;
}

export interface CodeIndex {
  files: Map<string, ParsedFile>;
  symbols: Map<string, CodeSymbol[]>;
  totalFiles: number;
  totalSymbols: number;
  indexedAt: string;
}

export interface Reference {
  filePath: string;
  line: number;
  kind: 'definition' | 'import' | 'usage';
}

export interface ProjectStructure {
  files: string[];
  directories: string[];
  languages: Record<string, number>;
  totalSymbols: number;
}

// ── Defaults ───────────────────────────────────────────────────────

const DEFAULT_EXCLUDE = new Set([
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

const DEFAULT_MAX_FILE_SIZE = 1024 * 1024; // 1 MB

// ── CodeIndexer ────────────────────────────────────────────────────

export class CodeIndexer {
  private index: CodeIndex = emptyIndex();

  constructor(private parser: CodeParser) {}

  /**
   * Walk `dirPath` and parse every supported source file into an index.
   */
  async indexDirectory(
    dirPath: string,
    options?: IndexOptions,
  ): Promise<CodeIndex> {
    this.index = emptyIndex();
    const maxFileSize = options?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
    const maxFiles = options?.maxFiles ?? Infinity;
    const excludePatterns = buildExcludeSet(options?.exclude);
    const includePatterns = options?.include ?? null;

    await this.walk(dirPath, dirPath, excludePatterns, includePatterns, maxFileSize, maxFiles);

    this.index.totalFiles = this.index.files.size;
    this.index.totalSymbols = countSymbols(this.index.symbols);
    this.index.indexedAt = new Date().toISOString();
    return this.index;
  }

  /**
   * Parse a single file and merge it into the current index.
   */
  async indexFile(filePath: string): Promise<ParsedFile> {
    const parsed = await this.parser.parseFile(filePath);
    this.mergeFile(parsed);
    return parsed;
  }

  // ── Queries ────────────────────────────────────────────────────

  /** Find all symbols with the given name across indexed files. */
  findSymbol(name: string): CodeSymbol[] {
    return this.index.symbols.get(name) ?? [];
  }

  /**
   * Find references to `symbolName` – definitions, imports, and usages.
   */
  findReferences(symbolName: string): Reference[] {
    const refs: Reference[] = [];

    for (const [filePath, parsed] of this.index.files) {
      // Definitions
      for (const sym of parsed.symbols) {
        if (sym.name === symbolName) {
          refs.push({ filePath, line: sym.startLine, kind: 'definition' });
        }
      }

      // Imports
      for (const imp of parsed.imports) {
        if (imp.specifiers.includes(symbolName) || imp.source.endsWith(symbolName)) {
          refs.push({ filePath, line: imp.line, kind: 'import' });
        }
      }
    }

    return refs;
  }

  /** Get all symbols declared in a specific file. */
  getFileSymbols(filePath: string): CodeSymbol[] {
    return this.index.files.get(filePath)?.symbols ?? [];
  }

  /** Summarise the project's file & language breakdown. */
  getProjectStructure(): ProjectStructure {
    const files: string[] = [];
    const dirSet = new Set<string>();
    const languages: Record<string, number> = {};

    for (const [filePath, parsed] of this.index.files) {
      files.push(filePath);
      const parts = filePath.split('/');
      if (parts.length > 1) {
        dirSet.add(parts.slice(0, -1).join('/'));
      }
      languages[parsed.language] = (languages[parsed.language] ?? 0) + 1;
    }

    return {
      files,
      directories: [...dirSet].sort(),
      languages,
      totalSymbols: this.index.totalSymbols,
    };
  }

  // ── Internals ──────────────────────────────────────────────────

  private async walk(
    rootDir: string,
    currentDir: string,
    excludePatterns: Set<string>,
    includePatterns: string[] | null,
    maxFileSize: number,
    maxFiles: number,
  ): Promise<void> {
    if (this.index.files.size >= maxFiles) return;

    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (this.index.files.size >= maxFiles) return;
      if (entry.name.startsWith('.')) continue;
      if (excludePatterns.has(entry.name)) continue;

      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await this.walk(rootDir, fullPath, excludePatterns, includePatterns, maxFileSize, maxFiles);
        continue;
      }

      // Only index files the parser supports
      const language = this.parser.detectLanguage(entry.name);
      if (!language) continue;

      const relPath = relative(rootDir, fullPath);

      // Include filter
      if (includePatterns && !matchesAny(relPath, includePatterns)) continue;

      // Size filter
      try {
        const s = await stat(fullPath);
        if (s.size > maxFileSize) continue;
      } catch {
        continue;
      }

      try {
        const content = await readFile(fullPath, 'utf-8');
        const parsed = await this.parser.parseFile(fullPath, content);
        // Store with relative path for portability
        parsed.filePath = relPath;
        this.mergeFile(parsed);
      } catch {
        // skip unreadable files
      }
    }
  }

  private mergeFile(parsed: ParsedFile): void {
    this.index.files.set(parsed.filePath, parsed);
    for (const sym of parsed.symbols) {
      const list = this.index.symbols.get(sym.name);
      if (list) {
        list.push(sym);
      } else {
        this.index.symbols.set(sym.name, [sym]);
      }
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function emptyIndex(): CodeIndex {
  return {
    files: new Map(),
    symbols: new Map(),
    totalFiles: 0,
    totalSymbols: 0,
    indexedAt: '',
  };
}

function buildExcludeSet(extra?: string[]): Set<string> {
  const set = new Set(DEFAULT_EXCLUDE);
  if (extra) {
    for (const p of extra) set.add(p);
  }
  return set;
}

function countSymbols(map: Map<string, CodeSymbol[]>): number {
  let n = 0;
  for (const list of map.values()) n += list.length;
  return n;
}

/** Simple wildcard matcher (supports `*` and `**`). */
function matchesAny(path: string, patterns: string[]): boolean {
  return patterns.some((p) => simpleGlob(p, path));
}

function simpleGlob(pattern: string, str: string): boolean {
  // Convert glob to regex
  const re = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '§§')
    .replace(/\*/g, '[^/]*')
    .replace(/§§/g, '.*');
  return new RegExp(`^${re}$`).test(str);
}
