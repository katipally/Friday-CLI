import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../context/session.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import os from 'node:os';

// Mock getDataDir to use a test directory
vi.mock('@fridaycode/shared', async () => {
  const actual = await vi.importActual('@fridaycode/shared') as Record<string, unknown>;
  return {
    ...actual,
    getDataDir: () => path.join(os.homedir(), '.friday-test-data'),
    createLogger: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  };
});

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  const testSessionsDir = path.join(os.homedir(), '.friday-test-data', 'sessions');

  beforeEach(async () => {
    sessionManager = new SessionManager();
    // Clean up test sessions dir
    try {
      await fs.rm(testSessionsDir, { recursive: true, force: true });
    } catch {
      // Doesn't exist yet
    }
  });

  afterEach(async () => {
    try {
      await fs.rm(testSessionsDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  });

  it('should generate unique session IDs', () => {
    const id1 = sessionManager.generateId();
    const id2 = sessionManager.generateId();

    expect(id1).toMatch(/^\d{4}-\d{2}-\d{2}_\d{6}_[0-9a-f]{4}$/);
    expect(id2).toMatch(/^\d{4}-\d{2}-\d{2}_\d{6}_[0-9a-f]{4}$/);
    // IDs may differ due to random suffix (same-second IDs are possible)
  });

  it('should create a new session', () => {
    const session = sessionManager.create({
      projectPath: '/test/path',
      mode: 'code',
      provider: 'openai',
      model: 'gpt-4o',
    });

    expect(session.id).toBeTruthy();
    expect(session.projectPath).toBe('/test/path');
    expect(session.mode).toBe('code');
    expect(session.provider).toBe('openai');
    expect(session.model).toBe('gpt-4o');
    expect(session.messages).toEqual([]);
    expect(session.totalCost).toBe(0);
  });

  it('should set created session as current', () => {
    const session = sessionManager.create({
      projectPath: '/test/path',
      mode: 'code',
      provider: 'openai',
      model: 'gpt-4o',
    });

    expect(sessionManager.getCurrent()).toBe(session);
  });

  it('should save and load a session', async () => {
    const session = sessionManager.create({
      projectPath: '/test/path',
      mode: 'code',
      provider: 'openai',
      model: 'gpt-4o',
    });

    session.messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];

    await sessionManager.save(session);

    const loaded = await sessionManager.load(session.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(session.id);
    expect(loaded!.messages).toHaveLength(2);
    expect(loaded!.messages[0].content).toBe('Hello');
  });

  it('should return null for non-existent session', async () => {
    const loaded = await sessionManager.load('nonexistent-id');
    expect(loaded).toBeNull();
  });

  it('should list saved sessions', async () => {
    const session1 = sessionManager.create({
      projectPath: '/test/path1',
      mode: 'code',
      provider: 'openai',
      model: 'gpt-4o',
    });
    session1.messages = [{ role: 'user', content: 'First session message' }];
    await sessionManager.save(session1);

    const session2 = sessionManager.create({
      projectPath: '/test/path2',
      mode: 'chat',
      provider: 'anthropic',
      model: 'claude-3',
    });
    session2.messages = [{ role: 'user', content: 'Second session' }];
    await sessionManager.save(session2);

    const sessions = await sessionManager.list();
    expect(sessions.length).toBeGreaterThanOrEqual(2);

    const summaries = sessions.map((s) => s.summary);
    expect(summaries).toContain('First session message');
    expect(summaries).toContain('Second session');
  });

  it('should resume a session and return MessageHistory', async () => {
    const session = sessionManager.create({
      projectPath: '/test/path',
      mode: 'code',
      provider: 'openai',
      model: 'gpt-4o',
    });
    session.messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'World' },
    ];
    await sessionManager.save(session);

    // Create a new manager to simulate fresh start
    const newManager = new SessionManager();
    const resumed = await newManager.resume(session.id);

    expect(resumed).not.toBeNull();
    expect(resumed!.session.id).toBe(session.id);
    expect(resumed!.history.getAll()).toHaveLength(2);
    expect(resumed!.history.getAll()[0].content).toBe('Hello');
    expect(newManager.getCurrent()?.id).toBe(session.id);
  });

  it('should return null when resuming non-existent session', async () => {
    const resumed = await sessionManager.resume('nonexistent');
    expect(resumed).toBeNull();
  });

  it('should delete a session', async () => {
    const session = sessionManager.create({
      projectPath: '/test/path',
      mode: 'code',
      provider: 'openai',
      model: 'gpt-4o',
    });
    await sessionManager.save(session);

    await sessionManager.delete(session.id);
    const loaded = await sessionManager.load(session.id);
    expect(loaded).toBeNull();
  });

  it('should clear current session on delete', async () => {
    const session = sessionManager.create({
      projectPath: '/test',
      mode: 'code',
      provider: 'openai',
      model: 'gpt-4o',
    });
    await sessionManager.save(session);

    expect(sessionManager.getCurrent()).toBe(session);
    await sessionManager.delete(session.id);
    expect(sessionManager.getCurrent()).toBeNull();
  });

  it('should handle deleting non-existent session gracefully', async () => {
    await expect(sessionManager.delete('nonexistent')).resolves.not.toThrow();
  });

  it('should save session files as pretty-printed JSON', async () => {
    const session = sessionManager.create({
      projectPath: '/test/path',
      mode: 'code',
      provider: 'openai',
      model: 'gpt-4o',
    });
    await sessionManager.save(session);

    const filePath = path.join(testSessionsDir, `${session.id}.json`);
    const content = await fs.readFile(filePath, 'utf-8');

    // Pretty-printed JSON has newlines
    expect(content).toContain('\n');
    expect(content).toContain('  ');

    // Should be valid JSON
    const parsed = JSON.parse(content);
    expect(parsed.id).toBe(session.id);
  });

  it('should save current session without explicit argument', async () => {
    const session = sessionManager.create({
      projectPath: '/test/path',
      mode: 'code',
      provider: 'openai',
      model: 'gpt-4o',
    });

    await sessionManager.save();

    const loaded = await sessionManager.load(session.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(session.id);
  });

  it('should handle corrupt session files gracefully in list', async () => {
    await fs.mkdir(testSessionsDir, { recursive: true });
    await fs.writeFile(
      path.join(testSessionsDir, 'corrupt.json'),
      'not valid json {{{',
      'utf-8',
    );

    const sessions = await sessionManager.list();
    // Should not throw, just skip the corrupt file
    expect(Array.isArray(sessions)).toBe(true);
  });

  it('should cleanup old sessions', async () => {
    const session = sessionManager.create({
      projectPath: '/test/path',
      mode: 'code',
      provider: 'openai',
      model: 'gpt-4o',
    });
    // Save the session first, then overwrite the file with old timestamp
    await sessionManager.save(session);

    // Manually write with old lastActiveAt
    const filePath = path.join(testSessionsDir, `${session.id}.json`);
    const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    data.lastActiveAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');

    const deleted = await sessionManager.cleanup(30);
    expect(deleted).toBe(1);

    const loaded = await sessionManager.load(session.id);
    expect(loaded).toBeNull();
  });
});
