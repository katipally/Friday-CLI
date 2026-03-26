import { execFileSync } from 'node:child_process';

/**
 * Branch-aware session management helpers.
 */

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim();
}

/**
 * Get current branch name.
 */
export function getCurrentBranch(cwd: string): string | undefined {
  try {
    return git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  } catch {
    return undefined;
  }
}

/**
 * Get current commit hash (short).
 */
export function getCurrentCommit(cwd: string): string | undefined {
  try {
    return git(['rev-parse', '--short', 'HEAD'], cwd);
  } catch {
    return undefined;
  }
}

/**
 * List local branches.
 */
export function listBranches(cwd: string): string[] {
  try {
    const output = git(['branch', '--format=%(refname:short)'], cwd);
    return output.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Check if there are uncommitted changes.
 */
export function hasUncommittedChanges(cwd: string): boolean {
  try {
    const status = git(['status', '--porcelain'], cwd);
    return status.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get files changed between commits or branches.
 */
export function getChangedFiles(cwd: string, from: string, to: string = 'HEAD'): string[] {
  try {
    const output = git(['diff', '--name-only', from, to], cwd);
    return output.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}
