import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@anthropic-ai/friday-shared', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { PermissionSystem } from '../permissions/permission-system.js';
import type { PermissionPromptCallback } from '../permissions/types.js';

const WORKSPACE = '/test/workspace';

describe('PermissionSystem', () => {
  let ps: PermissionSystem;

  beforeEach(() => {
    ps = new PermissionSystem(WORKSPACE);
  });

  // -----------------------------------------------------------------------
  // Default rules
  // -----------------------------------------------------------------------
  it('allows file_read within workspace by default', async () => {
    const decision = await ps.check('file_read', { path: 'src/index.ts' });
    expect(decision.allowed).toBe(true);
  });

  it('denies file_read outside workspace by default', async () => {
    const decision = await ps.check('file_read', { path: '/etc/passwd' });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('outside workspace');
  });

  it('allows file_write in workspace without callback (default workspace-allow)', async () => {
    const decision = await ps.check('file_write', { path: 'src/new.ts' });
    // Without a callback, workspace-scoped operations are allowed by default
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toContain('workspace scope');
  });

  it('denies dangerous shell commands (rm -rf /)', async () => {
    const decision = await ps.check('shell_exec', { command: 'rm -rf /' });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('Dangerous');
  });

  it('allows safe shell commands (ls)', async () => {
    const decision = await ps.check('shell_exec', { command: 'ls -la' });
    expect(decision.allowed).toBe(true);
  });

  it('allows safe shell commands (git status)', async () => {
    const decision = await ps.check('shell_exec', { command: 'git status' });
    expect(decision.allowed).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Custom rules
  // -----------------------------------------------------------------------
  it('custom rules override defaults', async () => {
    ps.addRule({ tool: 'file_read', action: 'deny', reason: 'Custom deny' });
    const decision = await ps.check('file_read', { path: 'src/index.ts' });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('Custom deny');
  });

  // -----------------------------------------------------------------------
  // Always-allow via prompt callback
  // -----------------------------------------------------------------------
  it('always-allow works after user grants permission', async () => {
    const callback: PermissionPromptCallback = vi.fn().mockResolvedValue('allow_always');
    ps.setPromptCallback(callback);

    const d1 = await ps.check('file_write', { path: 'foo.ts', content: 'x' });
    expect(d1.allowed).toBe(true);
    expect(d1.userChoice).toBe('allow_always');

    // Second check with same args should be auto-allowed without prompting again
    const d2 = await ps.check('file_write', { path: 'foo.ts', content: 'x' });
    expect(d2.allowed).toBe(true);
    // Callback should have been called only once
    expect(callback).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // resetSessionPermissions
  // -----------------------------------------------------------------------
  it('resetSessionPermissions clears always-allow set', async () => {
    const callback: PermissionPromptCallback = vi.fn().mockResolvedValue('allow_always');
    ps.setPromptCallback(callback);

    await ps.check('file_write', { path: 'foo.ts', content: 'x' });
    ps.resetSessionPermissions();

    // After reset, callback should be invoked again
    await ps.check('file_write', { path: 'foo.ts', content: 'x' });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  // -----------------------------------------------------------------------
  // Prompt without callback
  // -----------------------------------------------------------------------
  it('without prompt callback, workspace-scoped prompt rules default to allow', async () => {
    const decision = await ps.check('file_edit', { path: 'src/x.ts' });
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toContain('workspace scope');
  });

  // -----------------------------------------------------------------------
  // Allow once
  // -----------------------------------------------------------------------
  it('allow_once does not persist', async () => {
    const callback: PermissionPromptCallback = vi.fn().mockResolvedValue('allow_once');
    ps.setPromptCallback(callback);

    const d1 = await ps.check('file_write', { path: 'bar.ts', content: 'y' });
    expect(d1.allowed).toBe(true);
    expect(d1.userChoice).toBe('allow_once');

    // Second call should prompt again
    await ps.check('file_write', { path: 'bar.ts', content: 'y' });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  // -----------------------------------------------------------------------
  // Deny choice
  // -----------------------------------------------------------------------
  it('user deny returns not allowed', async () => {
    const callback: PermissionPromptCallback = vi.fn().mockResolvedValue('deny');
    ps.setPromptCallback(callback);

    const decision = await ps.check('file_write', { path: 'bad.ts', content: 'z' });
    expect(decision.allowed).toBe(false);
    expect(decision.userChoice).toBe('deny');
  });
});
