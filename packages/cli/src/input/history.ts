import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { getUserConfigDir } from '@fridaycode/shared';

const HISTORY_FILE = 'history';
const MAX_HISTORY = 1000;

/**
 * Command history manager with persistence.
 */
export class History {
  private items: string[] = [];
  private cursor = -1;
  private filePath: string;

  constructor() {
    this.filePath = join(getUserConfigDir(), HISTORY_FILE);
  }

  /**
   * Load history from disk.
   */
  async load(): Promise<void> {
    try {
      const content = await readFile(this.filePath, 'utf-8');
      this.items = content
        .split('\n')
        .filter(Boolean)
        .slice(-MAX_HISTORY);
    } catch {
      this.items = [];
    }
  }

  /**
   * Save history to disk.
   */
  async save(): Promise<void> {
    try {
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(this.filePath, this.items.join('\n') + '\n', 'utf-8');
    } catch {
      // Silently fail
    }
  }

  /**
   * Add an entry to history.
   */
  push(entry: string): void {
    // Avoid duplicates of the most recent entry
    if (this.items.length > 0 && this.items[this.items.length - 1] === entry) {
      return;
    }
    this.items.push(entry);
    if (this.items.length > MAX_HISTORY) {
      this.items = this.items.slice(-MAX_HISTORY);
    }
    this.cursor = -1;
  }

  /**
   * Navigate up in history (older).
   */
  up(): string | undefined {
    if (this.items.length === 0) return undefined;
    if (this.cursor < this.items.length - 1) {
      this.cursor++;
    }
    return this.items[this.items.length - 1 - this.cursor];
  }

  /**
   * Navigate down in history (newer).
   */
  down(): string | undefined {
    if (this.cursor <= 0) {
      this.cursor = -1;
      return '';
    }
    this.cursor--;
    return this.items[this.items.length - 1 - this.cursor];
  }

  /**
   * Reset cursor position.
   */
  resetCursor(): void {
    this.cursor = -1;
  }

  /**
   * Search history (reverse search like Ctrl+R).
   */
  search(query: string): string[] {
    if (!query) return [];
    const lower = query.toLowerCase();
    return this.items
      .filter((item) => item.toLowerCase().includes(lower))
      .reverse()
      .slice(0, 10);
  }

  getAll(): string[] {
    return [...this.items];
  }
}
