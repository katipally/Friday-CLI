export {
  isGitRepo,
  getCurrentBranch,
  getRepoRoot,
  createWorktree,
  removeWorktree,
  listWorktrees,
} from './worktree.js';
export type { WorktreeInfo } from './worktree.js';

export {
  commitWithAttribution,
  isAIGenerated,
  getRecentCommits,
  getDiff,
  getStatus,
} from './attribution.js';

export {
  getCurrentCommit,
  listBranches,
  hasUncommittedChanges,
  getChangedFiles,
} from './branch.js';

export {
  getPRDiff,
  getPRFullDiff,
  getPRFileDiff,
  getPRCommits,
} from './pr.js';
export type { PRInfo } from './pr.js';
