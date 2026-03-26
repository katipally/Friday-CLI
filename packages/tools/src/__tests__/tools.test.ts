import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

// Mock the logger used by ToolRegistry
vi.mock('@fridaycode/shared', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  ToolError: class ToolError extends Error {
    code: string;
    constructor(message: string, public toolName: string) {
      super(message);
      this.name = 'ToolError';
      this.code = 'TOOL_ERROR';
    }
  },
}));

import type { ToolContext } from '../types.js';
import { fileReadTool } from '../built-in/file-read.js';
import { fileWriteTool } from '../built-in/file-write.js';
import { fileEditTool } from '../built-in/file-edit.js';
import { directoryTreeTool } from '../built-in/directory-tree.js';
import { globTool } from '../built-in/glob.js';
import { grepTool } from '../built-in/grep.js';
import { shellExecTool } from '../built-in/shell-exec.js';
import { askUserTool } from '../built-in/ask-user.js';
import { ToolRegistry } from '../registry.js';
import { createDefaultRegistry } from '../index.js';

let tempDir: string;
let ctx: ToolContext;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'friday-tools-test-'));
  ctx = { workspaceRoot: tempDir, cwd: tempDir };
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// file_read
// ---------------------------------------------------------------------------
describe('file_read tool', () => {
  it('reads a file and includes line numbers', async () => {
    await fs.writeFile(path.join(tempDir, 'hello.txt'), 'line1\nline2\nline3');
    const result = await fileReadTool.execute({ path: 'hello.txt' }, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toContain('1. line1');
    expect(result.output).toContain('2. line2');
    expect(result.output).toContain('3. line3');
  });

  it('reads a range with startLine/endLine', async () => {
    await fs.writeFile(path.join(tempDir, 'range.txt'), 'a\nb\nc\nd\ne');
    const result = await fileReadTool.execute(
      { path: 'range.txt', startLine: 2, endLine: 4 },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain('2. b');
    expect(result.output).toContain('4. d');
    expect(result.output).not.toContain('1. a');
    expect(result.output).not.toContain('5. e');
  });

  it('returns error for non-existent file', async () => {
    const result = await fileReadTool.execute({ path: 'nope.txt' }, ctx);
    expect(result.success).toBe(false);
    expect(result.output).toContain('Failed to read file');
  });
});

// ---------------------------------------------------------------------------
// file_write
// ---------------------------------------------------------------------------
describe('file_write tool', () => {
  it('writes a file with correct content', async () => {
    const result = await fileWriteTool.execute(
      { path: 'out.txt', content: 'hello world' },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain('Successfully wrote');
    const written = await fs.readFile(path.join(tempDir, 'out.txt'), 'utf-8');
    expect(written).toBe('hello world');
  });

  it('creates nested directories', async () => {
    const result = await fileWriteTool.execute(
      { path: 'a/b/c/deep.txt', content: 'nested' },
      ctx,
    );
    expect(result.success).toBe(true);
    const written = await fs.readFile(
      path.join(tempDir, 'a', 'b', 'c', 'deep.txt'),
      'utf-8',
    );
    expect(written).toBe('nested');
  });

  it('blocks writing outside workspace (path traversal)', async () => {
    await expect(
      fileWriteTool.execute(
        { path: '../../../etc/passwd', content: 'pwned' },
        ctx,
      ),
    ).rejects.toThrow(/outside the workspace/);
  });
});

// ---------------------------------------------------------------------------
// file_edit
// ---------------------------------------------------------------------------
describe('file_edit tool', () => {
  it('edits a file with old_str/new_str', async () => {
    await fs.writeFile(path.join(tempDir, 'edit.txt'), 'foo bar baz');
    const result = await fileEditTool.execute(
      { path: 'edit.txt', old_str: 'bar', new_str: 'qux' },
      ctx,
    );
    expect(result.success).toBe(true);
    const content = await fs.readFile(path.join(tempDir, 'edit.txt'), 'utf-8');
    expect(content).toBe('foo qux baz');
  });

  it('returns error when old_str is not found', async () => {
    await fs.writeFile(path.join(tempDir, 'edit2.txt'), 'hello world');
    const result = await fileEditTool.execute(
      { path: 'edit2.txt', old_str: 'missing', new_str: 'x' },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain('old_str not found');
  });

  it('returns error when old_str appears multiple times', async () => {
    await fs.writeFile(path.join(tempDir, 'edit3.txt'), 'aaa aaa');
    const result = await fileEditTool.execute(
      { path: 'edit3.txt', old_str: 'aaa', new_str: 'bbb' },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain('found 2 times');
  });
});

// ---------------------------------------------------------------------------
// directory_tree
// ---------------------------------------------------------------------------
describe('directory_tree tool', () => {
  it('lists files in a directory', async () => {
    await fs.writeFile(path.join(tempDir, 'file1.txt'), '');
    await fs.mkdir(path.join(tempDir, 'subdir'));
    await fs.writeFile(path.join(tempDir, 'subdir', 'file2.txt'), '');
    const result = await directoryTreeTool.execute({}, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toContain('file1.txt');
    expect(result.output).toContain('subdir');
    expect(result.output).toContain('file2.txt');
  });

  it('respects depth limiting', async () => {
    await fs.mkdir(path.join(tempDir, 'a'));
    await fs.mkdir(path.join(tempDir, 'a', 'b'));
    await fs.writeFile(path.join(tempDir, 'a', 'b', 'deep.txt'), '');
    const result = await directoryTreeTool.execute({ depth: 0 }, ctx);
    expect(result.success).toBe(true);
    // At depth 0, we should only see the root level entries
    expect(result.output).toContain('a/');
    expect(result.output).not.toContain('deep.txt');
  });
});

// ---------------------------------------------------------------------------
// glob
// ---------------------------------------------------------------------------
describe('glob tool', () => {
  it('matches files by pattern', async () => {
    await fs.writeFile(path.join(tempDir, 'app.ts'), '');
    await fs.writeFile(path.join(tempDir, 'app.js'), '');
    await fs.writeFile(path.join(tempDir, 'readme.md'), '');
    const result = await globTool.execute({ pattern: '*.ts' }, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toContain('app.ts');
    expect(result.output).not.toContain('readme.md');
    expect(result.metadata?.count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// grep
// ---------------------------------------------------------------------------
describe('grep tool', () => {
  it('finds matches in files', async () => {
    await fs.writeFile(path.join(tempDir, 'code.ts'), 'const x = 42;\nconst y = 99;\n');
    const result = await grepTool.execute({ pattern: '42' }, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toContain('42');
    expect(result.metadata?.matchCount).toBe(1);
  });

  it('supports case-insensitive search', async () => {
    await fs.writeFile(path.join(tempDir, 'text.txt'), 'Hello World\nhello again\n');
    const result = await grepTool.execute(
      { pattern: 'hello', ignoreCase: true },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.metadata?.matchCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// shell_exec
// ---------------------------------------------------------------------------
describe('shell_exec tool', () => {
  it('runs echo and returns output', async () => {
    const result = await shellExecTool.execute({ command: 'echo hello' }, ctx);
    expect(result.success).toBe(true);
    expect(result.output.trim()).toBe('hello');
  });

  it('returns error for failing command', async () => {
    const result = await shellExecTool.execute(
      { command: 'exit 1' },
      ctx,
    );
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ask_user
// ---------------------------------------------------------------------------
describe('ask_user tool', () => {
  it('returns the question with requiresInput metadata', async () => {
    const result = await askUserTool.execute(
      { question: 'What color?' },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain('What color?');
    expect(result.metadata?.requiresInput).toBe(true);
    expect(result.metadata?.question).toBe('What color?');
  });

  it('includes choices when provided', async () => {
    const result = await askUserTool.execute(
      { question: 'Pick one', choices: ['A', 'B', 'C'] },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain('A');
    expect(result.output).toContain('B');
    expect(result.output).toContain('C');
  });
});

// ---------------------------------------------------------------------------
// ToolRegistry
// ---------------------------------------------------------------------------
describe('ToolRegistry', () => {
  it('createDefaultRegistry registers all built-in tools', () => {
    const registry = createDefaultRegistry(ctx);
    const tools = registry.getRegisteredTools();
    expect(tools).toHaveLength(16);
    expect(tools).toContain('file_read');
    expect(tools).toContain('file_write');
    expect(tools).toContain('file_edit');
    expect(tools).toContain('shell_exec');
    expect(tools).toContain('grep');
    expect(tools).toContain('glob');
    expect(tools).toContain('directory_tree');
    expect(tools).toContain('git');
    expect(tools).toContain('git_commit');
    expect(tools).toContain('git_stash');
    expect(tools).toContain('git_checkout');
    expect(tools).toContain('git_status');
    expect(tools).toContain('ask_user');
    expect(tools).toContain('web_fetch');
    expect(tools).toContain('browser');
    expect(tools).toContain('notebook_edit');
  });

  it('getToolDefinitions returns proper schemas', () => {
    const registry = createDefaultRegistry(ctx);
    const defs = registry.getToolDefinitions();
    expect(defs.length).toBe(16);
    for (const def of defs) {
      expect(def).toHaveProperty('name');
      expect(def).toHaveProperty('description');
      expect(def).toHaveProperty('parameters');
    }
  });

  it('execute() works for a known tool', async () => {
    const registry = createDefaultRegistry(ctx);
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'registry test');
    const result = await registry.execute('file_read', { path: 'test.txt' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('registry test');
  });

  it('execute() throws for unknown tool', async () => {
    const registry = createDefaultRegistry(ctx);
    await expect(
      registry.execute('nonexistent_tool', {}),
    ).rejects.toThrow(/Unknown tool/);
  });

  it('hasTool() works correctly', () => {
    const registry = createDefaultRegistry(ctx);
    expect(registry.hasTool('file_read')).toBe(true);
    expect(registry.hasTool('nonexistent')).toBe(false);
  });
});
