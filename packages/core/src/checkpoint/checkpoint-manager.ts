import { execSync } from 'node:child_process';
import { createLogger } from '@fridaycode/shared';

const logger = createLogger('checkpoint');

export interface Checkpoint {
  id: string;
  sha: string;
  message: string;
  timestamp: Date;
  filesChanged: string[];
  type: 'auto' | 'manual';
}

export interface CheckpointManagerOptions {
  workspaceRoot: string;
  sessionId: string;
  autoCheckpoint?: boolean;
}

export class CheckpointManager {
  private checkpoints: Checkpoint[] = [];
  private workspaceRoot: string;
  private sessionId: string;
  private autoCheckpoint: boolean;
  private branchPrefix = 'friday-checkpoint';

  constructor(options: CheckpointManagerOptions) {
    this.workspaceRoot = options.workspaceRoot;
    this.sessionId = options.sessionId;
    this.autoCheckpoint = options.autoCheckpoint ?? true;
  }

  /**
   * Create a checkpoint by stashing current state or creating a lightweight tag.
   * Uses git stash create to make a commit object without affecting the working tree.
   */
  async createCheckpoint(message?: string, type: 'auto' | 'manual' = 'manual'): Promise<Checkpoint | null> {
    try {
      // Check if there are any changes to checkpoint
      const status = this.exec('git status --porcelain');
      if (!status.trim()) {
        logger.debug('No changes to checkpoint');
        return null;
      }

      const filesChanged = status
        .split('\n')
        .filter(Boolean)
        .map((line) => line.substring(3).trim());

      // Create a stash-like commit without disturbing working directory
      // First, stage everything
      this.exec('git add -A');

      // Create a commit on a detached checkpoint ref
      const checkpointId = `${this.branchPrefix}/${this.sessionId}/${Date.now()}`;
      const commitMessage = message || `Friday checkpoint: ${type} (${filesChanged.length} files)`;

      // Use git stash create to make a commit object without modifying state
      const stashSha = this.exec('git stash create').trim();

      if (!stashSha) {
        // No stash created (nothing to stash) — use current HEAD
        const headSha = this.exec('git rev-parse HEAD').trim();
        const checkpoint: Checkpoint = {
          id: checkpointId,
          sha: headSha,
          message: commitMessage,
          timestamp: new Date(),
          filesChanged,
          type,
        };
        this.checkpoints.push(checkpoint);
        logger.info(`Checkpoint created (HEAD): ${checkpoint.id}`);
        return checkpoint;
      }

      // Store the stash as a named ref so it's not garbage collected
      this.exec(`git update-ref refs/${checkpointId} ${stashSha}`);

      const checkpoint: Checkpoint = {
        id: checkpointId,
        sha: stashSha,
        message: commitMessage,
        timestamp: new Date(),
        filesChanged,
        type,
      };

      this.checkpoints.push(checkpoint);
      logger.info(`Checkpoint created: ${checkpoint.id} (${stashSha.slice(0, 8)})`);
      return checkpoint;
    } catch (error) {
      logger.error('Failed to create checkpoint', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Auto-checkpoint: called before agent makes changes.
   */
  async autoSave(): Promise<Checkpoint | null> {
    if (!this.autoCheckpoint) return null;
    return this.createCheckpoint('Auto-checkpoint before agent changes', 'auto');
  }

  /**
   * Rewind to a specific checkpoint.
   * WARNING: This discards all changes since the checkpoint.
   */
  async rewindTo(checkpointId: string): Promise<boolean> {
    const checkpoint = this.checkpoints.find((cp) => cp.id === checkpointId);
    if (!checkpoint) {
      logger.error(`Checkpoint not found: ${checkpointId}`);
      return false;
    }

    try {
      // Reset working directory to the checkpoint state
      this.exec(`git checkout ${checkpoint.sha} -- .`);
      logger.info(`Rewound to checkpoint: ${checkpoint.id}`);
      return true;
    } catch (error) {
      logger.error('Failed to rewind', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Rewind to the last checkpoint.
   */
  async rewindLast(): Promise<boolean> {
    if (this.checkpoints.length === 0) {
      logger.warn('No checkpoints available to rewind to');
      return false;
    }
    const last = this.checkpoints[this.checkpoints.length - 1];
    return this.rewindTo(last.id);
  }

  /**
   * List all checkpoints for the current session.
   */
  listCheckpoints(): Checkpoint[] {
    return [...this.checkpoints];
  }

  /**
   * Get a specific checkpoint by index (0 = most recent).
   */
  getCheckpoint(index: number): Checkpoint | null {
    const reversed = [...this.checkpoints].reverse();
    return reversed[index] ?? null;
  }

  /**
   * Get diff between two checkpoints or between a checkpoint and current state.
   */
  getDiff(fromCheckpointId: string, toCheckpointId?: string): string {
    const from = this.checkpoints.find((cp) => cp.id === fromCheckpointId);
    if (!from) return 'Checkpoint not found';

    const toSha = toCheckpointId
      ? this.checkpoints.find((cp) => cp.id === toCheckpointId)?.sha ?? 'HEAD'
      : 'HEAD';

    try {
      return this.exec(`git diff ${from.sha} ${toSha}`);
    } catch {
      return 'Failed to generate diff';
    }
  }

  /**
   * Clean up checkpoint refs (call on session end).
   */
  cleanup(): void {
    for (const checkpoint of this.checkpoints) {
      try {
        this.exec(`git update-ref -d refs/${checkpoint.id}`);
      } catch {
        // Ignore cleanup errors
      }
    }
    this.checkpoints = [];
    logger.debug('Checkpoint refs cleaned up');
  }

  /**
   * Check if git is available and we're in a repo.
   */
  isGitAvailable(): boolean {
    try {
      this.exec('git rev-parse --git-dir');
      return true;
    } catch {
      return false;
    }
  }

  private exec(command: string): string {
    return execSync(command, {
      cwd: this.workspaceRoot,
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }
}
