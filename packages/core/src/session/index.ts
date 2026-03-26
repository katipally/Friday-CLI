import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Session, Message } from '@fridaycode/shared';
import {
  SESSION_DIR,
  SESSION_TRANSCRIPT_EXT,
  getUserConfigDir,
  ensureDir,
  generateId,
  readTextFile,
} from '@fridaycode/shared';

function getSessionDir(projectPath: string): string {
  const hash = hashPath(projectPath);
  return path.join(getUserConfigDir(), 'projects', hash, SESSION_DIR);
}

function hashPath(p: string): string {
  let hash = 0;
  for (let i = 0; i < p.length; i++) {
    hash = ((hash << 5) - hash + p.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Create a new session.
 */
export function createSession(projectPath: string, name?: string): Session {
  const now = Date.now();
  const session: Session = {
    id: generateId(),
    name,
    projectPath,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };

  saveSession(session);
  return session;
}

/**
 * Save session transcript as JSONL.
 */
export function saveSession(session: Session): void {
  const dir = getSessionDir(session.projectPath);
  ensureDir(dir);

  // Save metadata
  const metaFile = path.join(dir, `${session.id}.meta.json`);
  const meta = {
    id: session.id,
    name: session.name,
    projectPath: session.projectPath,
    branch: session.branch,
    createdAt: session.createdAt,
    updatedAt: Date.now(),
    parentSessionId: session.parentSessionId,
    forkPoint: session.forkPoint,
    messageCount: session.messages.length,
  };
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2), 'utf-8');

  // Save messages as JSONL (append-friendly)
  const transcriptFile = path.join(dir, `${session.id}${SESSION_TRANSCRIPT_EXT}`);
  const lines = session.messages.map((m) => JSON.stringify(m)).join('\n') + '\n';
  fs.writeFileSync(transcriptFile, lines, 'utf-8');
}

/**
 * Resume an existing session by ID.
 */
export function resumeSession(projectPath: string, sessionId: string): Session | undefined {
  const dir = getSessionDir(projectPath);
  const metaFile = path.join(dir, `${sessionId}.meta.json`);
  const metaContent = readTextFile(metaFile);
  if (!metaContent) return undefined;

  const meta = JSON.parse(metaContent) as Record<string, unknown>;
  const transcriptFile = path.join(dir, `${sessionId}${SESSION_TRANSCRIPT_EXT}`);
  const transcriptContent = readTextFile(transcriptFile);

  const messages: Message[] = [];
  if (transcriptContent) {
    for (const line of transcriptContent.split('\n')) {
      if (line.trim()) {
        messages.push(JSON.parse(line) as Message);
      }
    }
  }

  return {
    id: meta.id as string,
    name: meta.name as string | undefined,
    projectPath: meta.projectPath as string,
    branch: meta.branch as string | undefined,
    createdAt: meta.createdAt as number,
    updatedAt: meta.updatedAt as number,
    messages,
    parentSessionId: meta.parentSessionId as string | undefined,
    forkPoint: meta.forkPoint as number | undefined,
  };
}

/**
 * Fork a session at a specific message index.
 */
export function forkSession(session: Session, atMessage?: number): Session {
  const forkPoint = atMessage ?? session.messages.length;
  const forked = createSession(session.projectPath, session.name ? `${session.name} (fork)` : undefined);
  forked.messages = session.messages.slice(0, forkPoint);
  forked.parentSessionId = session.id;
  forked.forkPoint = forkPoint;
  saveSession(forked);
  return forked;
}

/**
 * Rewind a session to a specific message index.
 */
export function rewindSession(session: Session, toMessage: number): Session {
  session.messages = session.messages.slice(0, toMessage);
  session.updatedAt = Date.now();
  saveSession(session);
  return session;
}

/**
 * List all sessions for a project.
 */
export function listSessions(projectPath: string): Array<{
  id: string;
  name?: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}> {
  const dir = getSessionDir(projectPath);
  if (!fs.existsSync(dir)) return [];

  const metaFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.meta.json'));
  return metaFiles
    .map((f) => {
      const content = readTextFile(path.join(dir, f));
      if (!content) return null;
      return JSON.parse(content) as {
        id: string;
        name?: string;
        createdAt: number;
        updatedAt: number;
        messageCount: number;
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Append a message to a session transcript.
 */
export function appendMessage(session: Session, message: Message): void {
  session.messages.push(message);
  session.updatedAt = Date.now();

  // Append to JSONL file
  const dir = getSessionDir(session.projectPath);
  ensureDir(dir);
  const transcriptFile = path.join(dir, `${session.id}${SESSION_TRANSCRIPT_EXT}`);
  fs.appendFileSync(transcriptFile, JSON.stringify(message) + '\n', 'utf-8');
}

/**
 * Export a session as plain text.
 */
export function exportSession(session: Session): string {
  const lines: string[] = [];
  lines.push(`# Session: ${session.name ?? session.id}`);
  lines.push(`# Created: ${new Date(session.createdAt).toISOString()}`);
  lines.push('');

  for (const msg of session.messages) {
    const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
    const content = typeof msg.content === 'string' ? msg.content : msg.content.map((b) => b.text ?? '').join('');
    lines.push(`## ${role}`);
    lines.push(content);
    lines.push('');
  }

  return lines.join('\n');
}
