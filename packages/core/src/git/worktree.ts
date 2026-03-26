import { execSync, execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Git worktree management for subagent isolation.
 */

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
}

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim();
}

export function isGitRepo(cwd: string): boolean {
  try {
    git(['rev-parse', '--git-dir'], cwd);
    return true;
  } catch {
    return false;
  }
}

export function getCurrentBranch(cwd: string): string | undefined {
  try {
    return git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  } catch {
    return undefined;
  }
}

export function getRepoRoot(cwd: string): string | undefined {
  try {
    return git(['rev-parse', '--show-toplevel'], cwd);
  } catch {
    return undefined;
  }
}

/**
 * Create a git worktree for agent isolation.
 */
export function createWorktree(
  cwd: string,
  worktreePath: string,
  branch?: string,
): WorktreeInfo {
  const absPath = resolve(cwd, worktreePath);

  if (branch) {
    // Create a new branch in the worktree
    git(['worktree', 'add', '-b', branch, absPath], cwd);
  } else {
    // Detached HEAD worktree from current commit
    git(['worktree', 'add', '--detach', absPath], cwd);
  }

  const head = git(['rev-parse', 'HEAD'], absPath);
  const actualBranch = branch ?? 'HEAD (detached)';

  return { path: absPath, branch: actualBranch, head };
}

/**
 * Remove a git worktree.
 */
export function removeWorktree(cwd: string, worktreePath: string): void {
  const absPath = resolve(cwd, worktreePath);
  git(['worktree', 'remove', '--force', absPath], cwd);
}

/**
 * List all worktrees for the repository.
 */
export function listWorktrees(cwd: string): WorktreeInfo[] {
  const output = git(['worktree', 'list', '--porcelain'], cwd);
  const worktrees: WorktreeInfo[] = [];
  let current: Partial<WorktreeInfo> = {};

  for (const line of output.split('\n')) {
    if (line.startsWith('worktree ')) {
      current.path = line.slice('worktree '.length);
    } else if (line.startsWith('HEAD ')) {
      current.head = line.slice('HEAD '.length);
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).replace('refs/heads/', '');
    } else if (line === '') {
      if (current.path) {
        worktrees.push({
          path: current.path,
          branch: current.branch ?? 'detached',
          head: current.head ?? '',
        });
      }
      current = {};
    }
  }

  // Handle last entry
  if (current.path) {
    worktrees.push({
      path: current.path,
      branch: current.branch ?? 'detached',
      head: current.head ?? '',
    });
  }

  return worktrees;
}
