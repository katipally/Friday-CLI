import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createLogger } from '@fridaycode/shared';
import type { ProjectRules, RulesConfig } from './types.js';

const logger = createLogger('rules');

const DEFAULT_MAX_TOKENS = 2000;
// Rough approximation: 1 token ≈ 4 characters
const CHARS_PER_TOKEN = 4;

export class RulesLoader {
  private config: RulesConfig;

  constructor(config: RulesConfig) {
    this.config = config;
  }

  /** Load all project rules */
  async load(): Promise<ProjectRules> {
    const [fridayMd, ruleFiles] = await Promise.all([
      this.loadFridayMd(),
      this.loadRuleFiles(),
    ]);

    const combined = this.combine(fridayMd, ruleFiles);

    logger.debug('Loaded project rules', {
      hasFridayMd: fridayMd !== null,
      ruleFileCount: ruleFiles.length,
      combinedLength: combined.length,
    });

    return { fridayMd, ruleFiles, combined };
  }

  /** Load FRIDAY.md from project root (case-insensitive) */
  private async loadFridayMd(): Promise<string | null> {
    const candidates = ['FRIDAY.md', 'friday.md'];

    for (const filename of candidates) {
      const filePath = path.join(this.config.projectRoot, filename);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        logger.info(`Loaded ${filename}`);
        return content;
      } catch {
        // File doesn't exist, try next candidate
      }
    }

    logger.debug('No FRIDAY.md found');
    return null;
  }

  /** Load .friday/rules/*.md files */
  private async loadRuleFiles(): Promise<Array<{ name: string; content: string }>> {
    const rulesDir = path.join(this.config.projectRoot, '.friday', 'rules');
    const results: Array<{ name: string; content: string }> = [];

    let entries: string[];
    try {
      entries = await fs.readdir(rulesDir);
    } catch {
      logger.debug('No .friday/rules/ directory found');
      return results;
    }

    const mdFiles = entries.filter((f) => f.endsWith('.md')).sort();

    for (const file of mdFiles) {
      try {
        const content = await fs.readFile(path.join(rulesDir, file), 'utf-8');
        results.push({ name: file, content });
      } catch (err) {
        logger.warn(`Failed to read rule file: ${file}`, { error: String(err) });
      }
    }

    logger.info(`Loaded ${results.length} rule file(s) from .friday/rules/`);
    return results;
  }

  /** Combine all rules into a single string, respecting token budget */
  private combine(
    fridayMd: string | null,
    ruleFiles: Array<{ name: string; content: string }>,
  ): string {
    const maxChars = (this.config.maxTokens ?? DEFAULT_MAX_TOKENS) * CHARS_PER_TOKEN;
    const parts: string[] = [];

    if (fridayMd) {
      parts.push(`## Project Rules (from FRIDAY.md)\n\n${fridayMd}`);
    }

    if (ruleFiles.length > 0) {
      parts.push('## Additional Rules');
      for (const { name, content } of ruleFiles) {
        parts.push(`### ${name}\n\n${content}`);
      }
    }

    let combined = parts.join('\n\n');

    if (combined.length > maxChars) {
      logger.warn('Rules exceeded token budget, truncating', {
        totalChars: combined.length,
        maxChars,
      });
      combined =
        combined.slice(0, maxChars) +
        '\n\n<!-- Rules truncated due to token budget -->';
    }

    return combined;
  }

  /** Check if FRIDAY.md exists */
  async hasFridayMd(): Promise<boolean> {
    const candidates = ['FRIDAY.md', 'friday.md'];
    for (const filename of candidates) {
      try {
        await fs.access(path.join(this.config.projectRoot, filename));
        return true;
      } catch {
        // Not found, try next
      }
    }
    return false;
  }

  /** Generate a template FRIDAY.md for /init command */
  static generateTemplate(projectType?: string): string {
    const lines = [
      '# Project Rules',
      '',
      '## Code Style',
      '- Use consistent formatting',
      '- Prefer named exports over default exports',
      '- Keep functions small and focused',
      '',
      '## Testing',
      '- Write tests for new modules',
      '- Place tests next to source files',
      '',
      '## Git',
      '- Use conventional commits (feat:, fix:, chore:, docs:, test:, refactor:)',
      '- Keep commits atomic and well-described',
      '',
      '## Architecture',
      '- Follow established project patterns',
      '- Keep modules loosely coupled',
    ];

    if (projectType === 'typescript') {
      lines.push(
        '',
        '## TypeScript',
        '- Enable strict mode',
        '- Use ESM imports with .js extensions',
        '- Prefer interfaces over type aliases for object shapes',
      );
    } else if (projectType === 'python') {
      lines.push(
        '',
        '## Python',
        '- Use type hints consistently',
        '- Follow PEP 8 style guidelines',
        '- Use virtual environments for dependencies',
      );
    }

    return lines.join('\n') + '\n';
  }
}
