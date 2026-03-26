import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

vi.mock('@fridaycode/shared', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { CheckpointManager } from '../../checkpoint/checkpoint-manager.js';

function git(cwd: string, cmd: string): string {
  return execSync(`git ${cmd}`, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

describe('CheckpointManager Integration', () => {
  let tmpDir: string;
  let manager: CheckpointManager;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'friday-cp-'));

    // Initialize a git repo with an initial commit
    git(tmpDir, 'init');
    git(tmpDir, 'config user.email "test@test.com"');
    git(tmpDir, 'config user.name "Test"');
    writeFileSync(join(tmpDir, 'README.md'), '# Hello');
    git(tmpDir, 'add -A');
    git(tmpDir, 'commit -m "initial"');

    manager = new CheckpointManager({
      workspaceRoot: tmpDir,
      sessionId: 'test-session-1',
    });
  });

  afterEach(() => {
    try {
      manager.cleanup();
    } catch {
      // ignore
    }
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('isGitAvailable', () => {
    it('returns true in a git repo', () => {
      expect(manager.isGitAvailable()).toBe(true);
    });

    it('returns false outside a git repo', () => {
      const nonGitDir = mkdtempSync(join(tmpdir(), 'friday-nogit-'));
      const mgr = new CheckpointManager({
        workspaceRoot: nonGitDir,
        sessionId: 'test',
      });
      expect(mgr.isGitAvailable()).toBe(false);
      rmSync(nonGitDir, { recursive: true, force: true });
    });
  });

  describe('createCheckpoint', () => {
    it('returns null when there are no changes', async () => {
      const result = await manager.createCheckpoint('no changes');
      expect(result).toBeNull();
    });

    it('creates a checkpoint when files are modified', async () => {
      writeFileSync(join(tmpDir, 'file.txt'), 'hello');
      const checkpoint = await manager.createCheckpoint('test checkpoint');

      expect(checkpoint).not.toBeNull();
      expect(checkpoint!.message).toBe('test checkpoint');
      expect(checkpoint!.type).toBe('manual');
      expect(checkpoint!.filesChanged.length).toBeGreaterThan(0);
      expect(checkpoint!.sha).toBeTruthy();
      expect(checkpoint!.id).toContain('friday-checkpoint');
      expect(checkpoint!.timestamp).toBeInstanceOf(Date);
    });

    it('creates an auto checkpoint with type "auto"', async () => {
      writeFileSync(join(tmpDir, 'auto.txt'), 'auto content');
      const checkpoint = await manager.createCheckpoint('auto save', 'auto');
      expect(checkpoint).not.toBeNull();
      expect(checkpoint!.type).toBe('auto');
    });
  });

  describe('listCheckpoints', () => {
    it('returns empty array when no checkpoints exist', () => {
      expect(manager.listCheckpoints()).toEqual([]);
    });

    it('lists all created checkpoints', async () => {
      writeFileSync(join(tmpDir, 'a.txt'), 'a');
      await manager.createCheckpoint('first');
      writeFileSync(join(tmpDir, 'b.txt'), 'b');
      await manager.createCheckpoint('second');

      const checkpoints = manager.listCheckpoints();
      expect(checkpoints).toHaveLength(2);
      expect(checkpoints[0].message).toBe('first');
      expect(checkpoints[1].message).toBe('second');
    });

    it('returns a copy (not the internal array)', () => {
      const list1 = manager.listCheckpoints();
      const list2 = manager.listCheckpoints();
      expect(list1).not.toBe(list2);
    });
  });

  describe('getCheckpoint', () => {
    it('returns null for invalid index', () => {
      expect(manager.getCheckpoint(0)).toBeNull();
    });

    it('returns most recent checkpoint at index 0', async () => {
      writeFileSync(join(tmpDir, 'a.txt'), 'a');
      await manager.createCheckpoint('first');
      writeFileSync(join(tmpDir, 'b.txt'), 'b');
      await manager.createCheckpoint('second');

      const cp = manager.getCheckpoint(0);
      expect(cp).not.toBeNull();
      expect(cp!.message).toBe('second');
    });
  });

  describe('autoSave', () => {
    it('creates auto checkpoint when autoCheckpoint is enabled', async () => {
      writeFileSync(join(tmpDir, 'auto.txt'), 'content');
      const cp = await manager.autoSave();
      expect(cp).not.toBeNull();
      expect(cp!.type).toBe('auto');
    });

    it('returns null when autoCheckpoint is disabled', async () => {
      const mgr = new CheckpointManager({
        workspaceRoot: tmpDir,
        sessionId: 'test-session-no-auto',
        autoCheckpoint: false,
      });
      writeFileSync(join(tmpDir, 'auto2.txt'), 'content');
      const cp = await mgr.autoSave();
      expect(cp).toBeNull();
    });
  });

  describe('rewindTo', () => {
    it('returns false for unknown checkpoint id', async () => {
      const result = await manager.rewindTo('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('rewindLast', () => {
    it('returns false when no checkpoints exist', async () => {
      const result = await manager.rewindLast();
      expect(result).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('clears the checkpoints list', async () => {
      writeFileSync(join(tmpDir, 'c.txt'), 'c');
      await manager.createCheckpoint('to cleanup');
      expect(manager.listCheckpoints().length).toBeGreaterThan(0);

      manager.cleanup();
      expect(manager.listCheckpoints()).toEqual([]);
    });
  });

  describe('getDiff', () => {
    it('returns "Checkpoint not found" for unknown id', () => {
      const result = manager.getDiff('nonexistent');
      expect(result).toBe('Checkpoint not found');
    });
  });
});
