import Database from 'better-sqlite3';

// ── Type definitions ────────────────────────────────────────────────

export interface SessionRecord {
  id: string;
  title: string;
  provider: string;
  model: string;
  workingDirectory: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  totalTokens: number;
  totalCost: number;
  tags?: string[];
}

export interface MessageRecord {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tokenCount: number;
  timestamp: string;
  toolCalls?: string; // JSON serialized
}

export interface UsageRecord {
  sessionId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: string;
}

export interface UsageStats {
  totalSessions: number;
  totalMessages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  averageSessionLength: number;
}

export interface ModelUsageStats {
  provider: string;
  model: string;
  callCount: number;
  totalTokens: number;
  totalCost: number;
}

export interface SearchResult {
  sessionId: string;
  sessionTitle: string;
  snippet: string;
  score: number;
}

export interface DateRange {
  from?: string;
  to?: string;
}

export interface ListOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'cost';
  direction?: 'asc' | 'desc';
}

// Maps ListOptions.orderBy values to actual column names
const ORDER_BY_COLUMNS: Record<string, string> = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  cost: 'total_cost',
};

// ── Database Manager ────────────────────────────────────────────────

export class DatabaseManager {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  /** Create tables, indexes, FTS virtual tables, and triggers. */
  initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        working_directory TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        message_count INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        total_cost REAL DEFAULT 0,
        tags TEXT
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        token_count INTEGER DEFAULT 0,
        timestamp TEXT NOT NULL,
        tool_calls TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        cost REAL NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_usage_session_id ON usage(session_id);
      CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage(timestamp);
      CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);
    `);

    // FTS5 tables — created separately so IF NOT EXISTS works cleanly
    this.createFtsTables();
  }

  /** Close the database connection. */
  close(): void {
    this.db.close();
  }

  // ── Sessions ────────────────────────────────────────────────────

  saveSession(session: SessionRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, title, provider, model, working_directory,
                            created_at, updated_at, message_count, total_tokens,
                            total_cost, tags)
      VALUES (@id, @title, @provider, @model, @workingDirectory,
              @createdAt, @updatedAt, @messageCount, @totalTokens,
              @totalCost, @tags)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        provider = excluded.provider,
        model = excluded.model,
        working_directory = excluded.working_directory,
        updated_at = excluded.updated_at,
        message_count = excluded.message_count,
        total_tokens = excluded.total_tokens,
        total_cost = excluded.total_cost,
        tags = excluded.tags
    `);
    stmt.run({
      ...session,
      tags: session.tags ? JSON.stringify(session.tags) : null,
    });
  }

  getSession(id: string): SessionRecord | null {
    const row = this.db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(id) as RawSessionRow | undefined;
    return row ? this.mapSessionRow(row) : null;
  }

  listSessions(options: ListOptions = {}): SessionRecord[] {
    const {
      limit = 50,
      offset = 0,
      orderBy = 'createdAt',
      direction = 'desc',
    } = options;

    const column = ORDER_BY_COLUMNS[orderBy] ?? 'created_at';
    const dir = direction === 'asc' ? 'ASC' : 'DESC';

    const rows = this.db
      .prepare(
        `SELECT * FROM sessions ORDER BY ${column} ${dir} LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as RawSessionRow[];

    return rows.map((r) => this.mapSessionRow(r));
  }

  deleteSession(id: string): void {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  // ── Messages ────────────────────────────────────────────────────

  addMessage(sessionId: string, message: MessageRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO messages (id, session_id, role, content, token_count, timestamp, tool_calls)
      VALUES (@id, @sessionId, @role, @content, @tokenCount, @timestamp, @toolCalls)
    `);
    stmt.run({
      ...message,
      sessionId,
      toolCalls: message.toolCalls ?? null,
    });
  }

  getMessages(sessionId: string): MessageRecord[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC',
      )
      .all(sessionId) as RawMessageRow[];

    return rows.map((r) => this.mapMessageRow(r));
  }

  // ── Analytics ───────────────────────────────────────────────────

  recordUsage(usage: UsageRecord): void {
    this.db
      .prepare(
        `INSERT INTO usage (session_id, provider, model, input_tokens, output_tokens, cost, timestamp)
         VALUES (@sessionId, @provider, @model, @inputTokens, @outputTokens, @cost, @timestamp)`,
      )
      .run(usage);
  }

  getUsageStats(range?: DateRange): UsageStats {
    let whereClause = '';
    const params: string[] = [];

    if (range?.from) {
      whereClause += ' WHERE timestamp >= ?';
      params.push(range.from);
    }
    if (range?.to) {
      whereClause += whereClause ? ' AND timestamp <= ?' : ' WHERE timestamp <= ?';
      params.push(range.to);
    }

    const usageRow = this.db
      .prepare(
        `SELECT
           COUNT(*) as callCount,
           COALESCE(SUM(input_tokens), 0) as totalInputTokens,
           COALESCE(SUM(output_tokens), 0) as totalOutputTokens,
           COALESCE(SUM(cost), 0) as totalCost
         FROM usage${whereClause}`,
      )
      .get(...params) as {
      callCount: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalCost: number;
    };

    const sessionCount = this.db
      .prepare(
        `SELECT COUNT(DISTINCT session_id) as cnt FROM usage${whereClause}`,
      )
      .get(...params) as { cnt: number };

    const messageCount = this.db
      .prepare(
        `SELECT COUNT(*) as cnt FROM messages${whereClause.replace(/timestamp/g, 'timestamp')}`,
      )
      .get(...params) as { cnt: number };

    const totalSessions = sessionCount.cnt;
    const totalMessages = messageCount.cnt;

    return {
      totalSessions,
      totalMessages,
      totalInputTokens: usageRow.totalInputTokens,
      totalOutputTokens: usageRow.totalOutputTokens,
      totalCost: usageRow.totalCost,
      averageSessionLength:
        totalSessions > 0 ? totalMessages / totalSessions : 0,
    };
  }

  getTotalCost(): number {
    const row = this.db
      .prepare('SELECT COALESCE(SUM(cost), 0) as total FROM usage')
      .get() as { total: number };
    return row.total;
  }

  getModelUsage(): ModelUsageStats[] {
    return this.db
      .prepare(
        `SELECT
           provider,
           model,
           COUNT(*) as callCount,
           SUM(input_tokens + output_tokens) as totalTokens,
           SUM(cost) as totalCost
         FROM usage
         GROUP BY provider, model
         ORDER BY totalCost DESC`,
      )
      .all() as ModelUsageStats[];
  }

  // ── Full-text search ────────────────────────────────────────────

  searchSessions(query: string): SearchResult[] {
    const rows = this.db
      .prepare(
        `SELECT
           s.id as sessionId,
           s.title as sessionTitle,
           snippet(sessions_fts, 0, '<b>', '</b>', '...', 32) as snippet,
           rank as score
         FROM sessions_fts
         JOIN sessions s ON s.rowid = sessions_fts.rowid
         WHERE sessions_fts MATCH ?
         ORDER BY rank
         LIMIT 50`,
      )
      .all(query) as SearchResult[];

    return rows;
  }

  searchMessages(query: string): SearchResult[] {
    const rows = this.db
      .prepare(
        `SELECT
           m.session_id as sessionId,
           s.title as sessionTitle,
           snippet(messages_fts, 0, '<b>', '</b>', '...', 64) as snippet,
           rank as score
         FROM messages_fts
         JOIN messages m ON m.rowid = messages_fts.rowid
         JOIN sessions s ON s.id = m.session_id
         WHERE messages_fts MATCH ?
         ORDER BY rank
         LIMIT 50`,
      )
      .all(query) as SearchResult[];

    return rows;
  }

  // ── Private helpers ─────────────────────────────────────────────

  private createFtsTables(): void {
    // Check whether FTS tables already exist before creating
    const hasFts = this.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='messages_fts'",
      )
      .get();

    if (!hasFts) {
      this.db.exec(`
        CREATE VIRTUAL TABLE messages_fts USING fts5(
          content,
          content=messages,
          content_rowid=rowid
        );

        CREATE VIRTUAL TABLE sessions_fts USING fts5(
          title,
          content=sessions,
          content_rowid=rowid
        );

        CREATE TRIGGER messages_fts_ai AFTER INSERT ON messages BEGIN
          INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
        END;

        CREATE TRIGGER messages_fts_ad AFTER DELETE ON messages BEGIN
          INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
        END;

        CREATE TRIGGER messages_fts_au AFTER UPDATE ON messages BEGIN
          INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
          INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
        END;

        CREATE TRIGGER sessions_fts_ai AFTER INSERT ON sessions BEGIN
          INSERT INTO sessions_fts(rowid, title) VALUES (new.rowid, new.title);
        END;

        CREATE TRIGGER sessions_fts_ad AFTER DELETE ON sessions BEGIN
          INSERT INTO sessions_fts(sessions_fts, rowid, title) VALUES ('delete', old.rowid, old.title);
        END;

        CREATE TRIGGER sessions_fts_au AFTER UPDATE ON sessions BEGIN
          INSERT INTO sessions_fts(sessions_fts, rowid, title) VALUES ('delete', old.rowid, old.title);
          INSERT INTO sessions_fts(rowid, title) VALUES (new.rowid, new.title);
        END;
      `);
    }
  }

  private mapSessionRow(row: RawSessionRow): SessionRecord {
    return {
      id: row.id,
      title: row.title,
      provider: row.provider,
      model: row.model,
      workingDirectory: row.working_directory,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messageCount: row.message_count,
      totalTokens: row.total_tokens,
      totalCost: row.total_cost,
      tags: row.tags ? (JSON.parse(row.tags) as string[]) : undefined,
    };
  }

  private mapMessageRow(row: RawMessageRow): MessageRecord {
    return {
      id: row.id,
      sessionId: row.session_id,
      role: row.role as MessageRecord['role'],
      content: row.content,
      tokenCount: row.token_count,
      timestamp: row.timestamp,
      toolCalls: row.tool_calls ?? undefined,
    };
  }
}

// Raw row shapes returned by better-sqlite3 (snake_case columns)
interface RawSessionRow {
  id: string;
  title: string;
  provider: string;
  model: string;
  working_directory: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  total_tokens: number;
  total_cost: number;
  tags: string | null;
}

interface RawMessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  token_count: number;
  timestamp: string;
  tool_calls: string | null;
}
