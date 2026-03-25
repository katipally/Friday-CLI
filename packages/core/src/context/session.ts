import type { Message } from '@anthropic-ai/friday-shared';
import { createLogger, getDataDir } from '@anthropic-ai/friday-shared';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

const logger = createLogger('session');

export interface Session {
  id: string;
  projectPath: string;
  messages: Message[];
  mode: string;
  provider: string;
  model: string;
  startedAt: string;
  lastActiveAt: string;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export interface SessionSummary {
  id: string;
  projectPath: string;
  startedAt: string;
  lastActiveAt: string;
  messageCount: number;
  summary: string;
}

export class SessionManager {
  private sessionsDir: string;

  constructor() {
    this.sessionsDir = path.join(getDataDir(), 'sessions');
  }

  /** Generate a date-based session ID with random suffix: YYYY-MM-DD_HHmmss_XXXX */
  generateId(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const time = now.toTimeString().slice(0, 8).replace(/:/g, ''); // HHmmss
    const suffix = crypto.randomBytes(2).toString('hex'); // 4 hex chars
    return `${date}_${time}_${suffix}`;
  }

  /** Save a session to disk as JSON */
  async save(session: Session): Promise<void> {
    await fs.mkdir(this.sessionsDir, { recursive: true });
    const filePath = path.join(this.sessionsDir, `${session.id}.json`);
    const data = JSON.stringify(session, null, 2);
    await fs.writeFile(filePath, data, 'utf-8');
    logger.debug(`Session saved: ${session.id}`);
  }

  /** Load a session by ID, returns null if not found */
  async load(id: string): Promise<Session | null> {
    const filePath = path.join(this.sessionsDir, `${id}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as Session;
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return null;
      }
      logger.error(`Failed to load session ${id}: ${error}`);
      return null;
    }
  }

  /** List recent sessions sorted by lastActiveAt descending */
  async listRecent(limit: number = 20): Promise<SessionSummary[]> {
    try {
      await fs.mkdir(this.sessionsDir, { recursive: true });
      const entries = await fs.readdir(this.sessionsDir);
      const jsonFiles = entries.filter((f) => f.endsWith('.json'));

      const summaries: SessionSummary[] = [];

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.sessionsDir, file);
          const data = await fs.readFile(filePath, 'utf-8');
          const session = JSON.parse(data) as Session;

          const firstUserMessage = session.messages.find(
            (m) => m.role === 'user',
          );
          const summary = firstUserMessage
            ? firstUserMessage.content.slice(0, 100)
            : '(no user messages)';

          summaries.push({
            id: session.id,
            projectPath: session.projectPath,
            startedAt: session.startedAt,
            lastActiveAt: session.lastActiveAt,
            messageCount: session.messages.length,
            summary,
          });
        } catch {
          logger.warn(`Skipping corrupt session file: ${file}`);
        }
      }

      // Sort by lastActiveAt descending
      summaries.sort(
        (a, b) =>
          new Date(b.lastActiveAt).getTime() -
          new Date(a.lastActiveAt).getTime(),
      );

      return summaries.slice(0, limit);
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return [];
      }
      logger.error(`Failed to list sessions: ${error}`);
      return [];
    }
  }

  /** Delete a session by ID */
  async delete(id: string): Promise<void> {
    const filePath = path.join(this.sessionsDir, `${id}.json`);
    try {
      await fs.unlink(filePath);
      logger.debug(`Session deleted: ${id}`);
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return;
      }
      logger.error(`Failed to delete session ${id}: ${error}`);
    }
  }

  /** Delete sessions older than maxAgeDays (default 30). Returns count of deleted sessions. */
  async cleanup(maxAgeDays: number = 30): Promise<number> {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    try {
      await fs.mkdir(this.sessionsDir, { recursive: true });
      const entries = await fs.readdir(this.sessionsDir);
      const jsonFiles = entries.filter((f) => f.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.sessionsDir, file);
          const data = await fs.readFile(filePath, 'utf-8');
          const session = JSON.parse(data) as Session;
          const lastActive = new Date(session.lastActiveAt).getTime();

          if (lastActive < cutoff) {
            await fs.unlink(filePath);
            deletedCount++;
          }
        } catch {
          logger.warn(`Skipping file during cleanup: ${file}`);
        }
      }
    } catch (error: unknown) {
      logger.error(`Session cleanup failed: ${error}`);
    }

    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} old session(s)`);
    }

    return deletedCount;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
