import * as fs from 'node:fs';
import * as path from 'node:path';
import type { MemoryFile, Rule } from '@fridaycode/shared';
import {
  MEMORY_FILE,
  CONFIG_DIR,
  RULES_DIR,
  MEMORY_DIR,
  readTextFile,
  getUserConfigDir,
  getProjectConfigDir,
  ensureDir,
  parseFrontmatter,
} from '@fridaycode/shared';

/**
 * Load all FRIDAY.md memory files for a project.
 * Priority: organization (future) → user → project root → .friday/
 * Resolves @import references.
 */
export function loadMemoryFiles(projectPath: string): MemoryFile[] {
  const files: MemoryFile[] = [];

  // User-level memory
  const userFile = path.join(getUserConfigDir(), MEMORY_FILE);
  const userContent = readTextFile(userFile);
  if (userContent) {
    files.push({
      path: userFile,
      scope: 'user',
      content: userContent,
      imports: extractImports(userContent, path.dirname(userFile)),
    });
  }

  // Project root FRIDAY.md
  const projectFile = path.join(projectPath, MEMORY_FILE);
  const projectContent = readTextFile(projectFile);
  if (projectContent) {
    files.push({
      path: projectFile,
      scope: 'project',
      content: projectContent,
      imports: extractImports(projectContent, projectPath),
    });
  }

  // .friday/FRIDAY.md
  const dotFridayFile = path.join(getProjectConfigDir(projectPath), MEMORY_FILE);
  const dotFridayContent = readTextFile(dotFridayFile);
  if (dotFridayContent && dotFridayFile !== projectFile) {
    files.push({
      path: dotFridayFile,
      scope: 'project',
      content: dotFridayContent,
      imports: extractImports(dotFridayContent, getProjectConfigDir(projectPath)),
    });
  }

  return files;
}

/**
 * Resolve all imported file contents from @path references.
 */
export function resolveImports(memoryFiles: MemoryFile[]): string {
  const parts: string[] = [];

  for (const file of memoryFiles) {
    parts.push(`# Memory: ${file.scope} (${path.basename(file.path)})\n`);
    parts.push(file.content);

    for (const importPath of file.imports) {
      const importContent = readTextFile(importPath);
      if (importContent) {
        parts.push(`\n# Imported: ${path.basename(importPath)}\n`);
        parts.push(importContent);
      }
    }
    parts.push('\n');
  }

  return parts.join('\n');
}

/**
 * Load auto-memory (AI-written learnings) for a project.
 */
export function loadAutoMemory(projectPath: string): string | undefined {
  const memoryDir = path.join(getUserConfigDir(), 'projects', hashPath(projectPath), MEMORY_DIR);
  const memoryFile = path.join(memoryDir, 'MEMORY.md');
  return readTextFile(memoryFile);
}

/**
 * Save auto-memory content.
 */
export function saveAutoMemory(projectPath: string, content: string): void {
  const memoryDir = path.join(getUserConfigDir(), 'projects', hashPath(projectPath), MEMORY_DIR);
  ensureDir(memoryDir);
  fs.writeFileSync(path.join(memoryDir, 'MEMORY.md'), content, 'utf-8');
}

/**
 * Load rules from .friday/rules/ directory.
 * Returns rules with their path-scoping patterns.
 */
export function loadRules(projectPath: string): Rule[] {
  const rulesDir = path.join(getProjectConfigDir(projectPath), RULES_DIR);
  if (!fs.existsSync(rulesDir)) return [];

  const rules: Rule[] = [];
  const entries = fs.readdirSync(rulesDir).filter((f) => f.endsWith('.md'));

  for (const entry of entries) {
    const filePath = path.join(rulesDir, entry);
    const content = readTextFile(filePath);
    if (!content) continue;

    const { data, content: body } = parseFrontmatter(content);
    const paths = (data.paths as string[]) ?? ['**'];

    rules.push({
      path: filePath,
      paths,
      content: body.trim(),
    });
  }

  return rules;
}

/**
 * Get rules that apply to a specific file path.
 */
export function getApplicableRules(rules: Rule[], filePath: string): Rule[] {
  return rules.filter((rule) =>
    rule.paths.some((pattern) => {
      if (pattern.startsWith('!')) return false;
      // Simple glob matching — could use micromatch for full glob support
      const regex = new RegExp(
        '^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$',
      );
      return regex.test(filePath);
    }),
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function extractImports(content: string, basePath: string): string[] {
  const imports: string[] = [];
  const regex = /^@(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const importPath = path.resolve(basePath, match[1].trim());
    imports.push(importPath);
  }
  return imports;
}

function hashPath(p: string): string {
  // Simple hash for project path → directory name
  let hash = 0;
  for (let i = 0; i < p.length; i++) {
    const chr = p.charCodeAt(i);
    hash = ((hash << 5) - hash + chr) | 0;
  }
  return Math.abs(hash).toString(36);
}
