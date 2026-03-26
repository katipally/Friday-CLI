import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { DatabaseManager } from '../../database.js';
import type { SessionRecord, MessageRecord, UsageRecord } from '../../database.js';

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: 'Test Session',
    provider: 'openai',
    model: 'gpt-4o',
    workingDirectory: '/test/dir',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: 0,
    totalTokens: 0,
    totalCost: 0,
    ...overrides,
  };
}

function makeMessage(sessionId: string, overrides: Partial<MessageRecord> = {}): MessageRecord {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sessionId,
    role: 'user',
    content: 'Hello, world!',
    tokenCount: 10,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('DatabaseManager Integration', () => {
  let db: DatabaseManager;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'friday-db-'));
    db = new DatabaseManager(join(tmpDir, 'test.db'));
    db.initialize();
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('session CRUD', () => {
    it('saves and retrieves a session', () => {
      const session = makeSession({ id: 'sess-1', title: 'My Session' });
      db.saveSession(session);
      const retrieved = db.getSession('sess-1');

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('sess-1');
      expect(retrieved!.title).toBe('My Session');
      expect(retrieved!.provider).toBe('openai');
      expect(retrieved!.model).toBe('gpt-4o');
    });

    it('returns null for nonexistent session', () => {
      expect(db.getSession('nonexistent')).toBeNull();
    });

    it('upserts a session on conflict', () => {
      const session = makeSession({ id: 'sess-up', title: 'Original' });
      db.saveSession(session);
      db.saveSession({ ...session, title: 'Updated' });

      const retrieved = db.getSession('sess-up');
      expect(retrieved!.title).toBe('Updated');
    });

    it('deletes a session', () => {
      const session = makeSession({ id: 'sess-del' });
      db.saveSession(session);
      expect(db.getSession('sess-del')).not.toBeNull();

      db.deleteSession('sess-del');
      expect(db.getSession('sess-del')).toBeNull();
    });

    it('preserves tags as JSON array', () => {
      const session = makeSession({ id: 'sess-tags', tags: ['frontend', 'react'] });
      db.saveSession(session);
      const retrieved = db.getSession('sess-tags');
      expect(retrieved!.tags).toEqual(['frontend', 'react']);
    });

    it('handles sessions without tags', () => {
      const session = makeSession({ id: 'sess-no-tags' });
      delete (session as Record<string, unknown>).tags;
      db.saveSession(session);
      const retrieved = db.getSession('sess-no-tags');
      expect(retrieved!.tags).toBeUndefined();
    });
  });

  describe('message CRUD', () => {
    it('adds and retrieves messages', () => {
      const session = makeSession({ id: 'sess-msg' });
      db.saveSession(session);

      const msg1 = makeMessage('sess-msg', { id: 'msg-1', content: 'Hello', timestamp: '2024-01-01T00:00:01Z' });
      const msg2 = makeMessage('sess-msg', { id: 'msg-2', role: 'assistant', content: 'Hi there!', timestamp: '2024-01-01T00:00:02Z' });

      db.addMessage('sess-msg', msg1);
      db.addMessage('sess-msg', msg2);

      const messages = db.getMessages('sess-msg');
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('Hello');
      expect(messages[0].role).toBe('user');
      expect(messages[1].content).toBe('Hi there!');
      expect(messages[1].role).toBe('assistant');
    });

    it('returns empty array for session with no messages', () => {
      const session = makeSession({ id: 'sess-empty' });
      db.saveSession(session);
      expect(db.getMessages('sess-empty')).toEqual([]);
    });

    it('preserves toolCalls field', () => {
      const session = makeSession({ id: 'sess-tc' });
      db.saveSession(session);
      const msg = makeMessage('sess-tc', {
        id: 'msg-tc',
        role: 'assistant',
        toolCalls: JSON.stringify([{ id: 'call1', name: 'file_read', arguments: {} }]),
      });
      db.addMessage('sess-tc', msg);

      const messages = db.getMessages('sess-tc');
      expect(messages[0].toolCalls).toBeTruthy();
      const parsed = JSON.parse(messages[0].toolCalls!);
      expect(parsed[0].name).toBe('file_read');
    });
  });

  describe('usage recording and stats', () => {
    it('records usage and retrieves stats', () => {
      const session = makeSession({ id: 'sess-usage' });
      db.saveSession(session);

      const usage: UsageRecord = {
        sessionId: 'sess-usage',
        provider: 'openai',
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 500,
        cost: 0.015,
        timestamp: new Date().toISOString(),
      };
      db.recordUsage(usage);

      const stats = db.getUsageStats();
      expect(stats.totalInputTokens).toBe(1000);
      expect(stats.totalOutputTokens).toBe(500);
      expect(stats.totalCost).toBeCloseTo(0.015, 4);
    });

    it('getTotalCost sums all usage costs', () => {
      const session = makeSession({ id: 'sess-cost' });
      db.saveSession(session);

      db.recordUsage({ sessionId: 'sess-cost', provider: 'openai', model: 'gpt-4o', inputTokens: 100, outputTokens: 50, cost: 0.01, timestamp: '2024-01-01T00:00:00Z' });
      db.recordUsage({ sessionId: 'sess-cost', provider: 'openai', model: 'gpt-4o', inputTokens: 200, outputTokens: 100, cost: 0.02, timestamp: '2024-01-01T00:01:00Z' });

      expect(db.getTotalCost()).toBeCloseTo(0.03, 4);
    });

    it('getModelUsage groups by provider and model', () => {
      const session = makeSession({ id: 'sess-mu' });
      db.saveSession(session);

      db.recordUsage({ sessionId: 'sess-mu', provider: 'openai', model: 'gpt-4o', inputTokens: 100, outputTokens: 50, cost: 0.01, timestamp: '2024-01-01T00:00:00Z' });
      db.recordUsage({ sessionId: 'sess-mu', provider: 'anthropic', model: 'claude-3', inputTokens: 200, outputTokens: 100, cost: 0.02, timestamp: '2024-01-01T00:01:00Z' });
      db.recordUsage({ sessionId: 'sess-mu', provider: 'openai', model: 'gpt-4o', inputTokens: 300, outputTokens: 150, cost: 0.03, timestamp: '2024-01-01T00:02:00Z' });

      const modelUsage = db.getModelUsage();
      expect(modelUsage.length).toBe(2);

      const openai = modelUsage.find((m) => m.provider === 'openai');
      expect(openai).toBeDefined();
      expect(openai!.callCount).toBe(2);
    });
  });

  describe('full-text search', () => {
    it('searches sessions by title', () => {
      db.saveSession(makeSession({ id: 'sess-fts-1', title: 'React hooks debugging' }));
      db.saveSession(makeSession({ id: 'sess-fts-2', title: 'Python data analysis' }));

      const results = db.searchSessions('React');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].sessionId).toBe('sess-fts-1');
    });

    it('searches messages by content', () => {
      const session = makeSession({ id: 'sess-fts-msg' });
      db.saveSession(session);
      db.addMessage('sess-fts-msg', makeMessage('sess-fts-msg', { id: 'msg-fts-1', content: 'How do I implement authentication?' }));
      db.addMessage('sess-fts-msg', makeMessage('sess-fts-msg', { id: 'msg-fts-2', content: 'Use JWT tokens for auth' }));

      const results = db.searchMessages('authentication');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty array when no matches found', () => {
      db.saveSession(makeSession({ id: 'sess-fts-none', title: 'Hello world' }));
      const results = db.searchSessions('zyxwvutsrqp');
      expect(results).toEqual([]);
    });
  });

  describe('pagination and ordering', () => {
    it('lists sessions with limit and offset', () => {
      for (let i = 0; i < 5; i++) {
        db.saveSession(makeSession({
          id: `sess-page-${i}`,
          title: `Session ${i}`,
          createdAt: new Date(Date.now() + i * 1000).toISOString(),
          updatedAt: new Date(Date.now() + i * 1000).toISOString(),
        }));
      }

      const page1 = db.listSessions({ limit: 2, offset: 0 });
      expect(page1).toHaveLength(2);

      const page2 = db.listSessions({ limit: 2, offset: 2 });
      expect(page2).toHaveLength(2);

      const page3 = db.listSessions({ limit: 2, offset: 4 });
      expect(page3).toHaveLength(1);
    });

    it('orders sessions ascending', () => {
      db.saveSession(makeSession({ id: 'sess-ord-a', title: 'First', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' }));
      db.saveSession(makeSession({ id: 'sess-ord-b', title: 'Second', createdAt: '2024-02-01T00:00:00Z', updatedAt: '2024-02-01T00:00:00Z' }));

      const asc = db.listSessions({ orderBy: 'createdAt', direction: 'asc' });
      expect(asc[0].id).toBe('sess-ord-a');
      expect(asc[1].id).toBe('sess-ord-b');
    });

    it('orders sessions descending (default)', () => {
      db.saveSession(makeSession({ id: 'sess-ord-c', title: 'First', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' }));
      db.saveSession(makeSession({ id: 'sess-ord-d', title: 'Second', createdAt: '2024-02-01T00:00:00Z', updatedAt: '2024-02-01T00:00:00Z' }));

      const desc = db.listSessions({ orderBy: 'createdAt', direction: 'desc' });
      expect(desc[0].id).toBe('sess-ord-d');
      expect(desc[1].id).toBe('sess-ord-c');
    });
  });

  describe('cascade deletes', () => {
    it('deleting a session cascades to messages', () => {
      const session = makeSession({ id: 'sess-cascade' });
      db.saveSession(session);
      db.addMessage('sess-cascade', makeMessage('sess-cascade', { id: 'msg-cascade-1' }));
      db.addMessage('sess-cascade', makeMessage('sess-cascade', { id: 'msg-cascade-2' }));

      expect(db.getMessages('sess-cascade')).toHaveLength(2);

      db.deleteSession('sess-cascade');
      expect(db.getMessages('sess-cascade')).toHaveLength(0);
    });
  });
});
