import { execFileSync } from 'node:child_process';

/**
 * PR review helpers — fetch PR info, analyze diffs, etc.
 */

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim();
}

export interface PRInfo {
  baseBranch: string;
  headBranch: string;
  diffFiles: string[];
  diffStat: string;
}

/**
 * Get PR-like diff info between two branches.
 */
export function getPRDiff(
  cwd: string,
  baseBranch: string,
  headBranch: string = 'HEAD',
): PRInfo {
  const diffFiles = git(
    ['diff', '--name-only', `${baseBranch}...${headBranch}`],
    cwd,
  )
    .split('\n')
    .filter(Boolean);

  const diffStat = git(
    ['diff', '--stat', `${baseBranch}...${headBranch}`],
    cwd,
  );

  return {
    baseBranch,
    headBranch,
    diffFiles,
    diffStat,
  };
}

/**
 * Get the full diff for PR review.
 */
export function getPRFullDiff(
  cwd: string,
  baseBranch: string,
  headBranch: string = 'HEAD',
): string {
  return git(['diff', `${baseBranch}...${headBranch}`], cwd);
}

/**
 * Get file diff for a specific file in PR context.
 */
export function getPRFileDiff(
  cwd: string,
  baseBranch: string,
  filePath: string,
  headBranch: string = 'HEAD',
): string {
  return git(
    ['diff', `${baseBranch}...${headBranch}`, '--', filePath],
    cwd,
  );
}

/**
 * Get commit log between branches (PR commits).
 */
export function getPRCommits(
  cwd: string,
  baseBranch: string,
  headBranch: string = 'HEAD',
): Array<{ hash: string; message: string; author: string }> {
  try {
    const output = git(
      ['log', '--format=%H|%s|%an', `${baseBranch}..${headBranch}`],
      cwd,
    );

    return output
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, message, author] = line.split('|');
        return { hash, message, author };
      });
  } catch {
    return [];
  }
}
