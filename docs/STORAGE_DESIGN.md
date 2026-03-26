# SQLite Storage & Analytics Design

Design document for migrating FridayCode from JSON file storage to SQLite.

---

## 1. Current State

Sessions are stored as individual JSON files in `~/.friday/sessions/`, one file per session. This approach has significant limitations:

- **No search**: Finding a previous conversation requires opening each file individually.
- **No indexing**: There is no way to quickly locate sessions by content, tool usage, or model.
- **No cross-session queries**: Aggregating data (e.g., total cost, most-used tools) requires scanning every file.
- **Configuration**: Stored in separate JSON files (`~/.friday/config.json`, per-project `.friday/config.json`), with no transactional guarantees.
- **Scale issues**: As sessions accumulate, performance degrades linearly with file count.

---

## 2. Why SQLite

SQLite is the ideal storage backend for a local-first CLI tool like FridayCode:

| Property                    | Benefit                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Single-file database**    | One `~/.friday/friday.db` file replaces an entire directory of JSON files. Easy to back up, move, or reset.   |
| **Zero setup**              | No server process, no configuration, no ports. Embedded directly in the Node.js process via `better-sqlite3`. |
| **Full-text search (FTS5)** | The FTS5 extension enables instant search across all conversation content with ranking and snippet support.   |
| **ACID transactions**       | Guarantees data integrity even on crash or power loss. No more half-written JSON files.                       |
| **Structured queries**      | SQL enables complex cross-session queries that are impossible with flat files.                                |
| **Performance**             | 10–100x faster than JSON file scanning for search and aggregation operations.                                 |
| **Mature ecosystem**        | `better-sqlite3` is synchronous, fast, well-maintained, and widely used in the Node.js ecosystem.             |

---

## 3. Database Schema

### 3.1 `sessions`

Primary table for conversation sessions.

```sql
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,
  title         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  model         TEXT,
  provider      TEXT,
  workspace_path TEXT,
  summary       TEXT,
  total_tokens  INTEGER DEFAULT 0,
  total_cost    REAL DEFAULT 0.0
);

CREATE INDEX idx_sessions_updated ON sessions(updated_at DESC);
CREATE INDEX idx_sessions_workspace ON sessions(workspace_path);
```

### 3.2 `messages`

Individual messages within a session.

```sql
CREATE TABLE messages (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content     TEXT,
  tokens      INTEGER DEFAULT 0,
  cost        REAL DEFAULT 0.0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_messages_session ON messages(session_id, created_at);
```

### 3.3 `tool_calls`

Tool invocations attached to assistant messages.

```sql
CREATE TABLE tool_calls (
  id          TEXT PRIMARY KEY,
  message_id  TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  tool_name   TEXT NOT NULL,
  parameters  TEXT,  -- JSON blob
  result      TEXT,  -- JSON blob
  duration_ms INTEGER,
  success     INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_tool_calls_message ON tool_calls(message_id);
CREATE INDEX idx_tool_calls_tool ON tool_calls(tool_name);
```

### 3.4 `checkpoints`

Git-backed conversation snapshots for undo/restore.

```sql
CREATE TABLE checkpoints (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  git_sha     TEXT,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  snapshot    TEXT  -- JSON blob of full conversation state
);

CREATE INDEX idx_checkpoints_session ON checkpoints(session_id, created_at);
```

### 3.5 `config`

Unified configuration storage replacing scattered JSON config files.

```sql
CREATE TABLE config (
  key        TEXT NOT NULL,
  value      TEXT,
  scope      TEXT NOT NULL CHECK (scope IN ('global', 'project')) DEFAULT 'global',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (key, scope)
);
```

### 3.6 `skills`

Registry of installed Friday skills/extensions.

```sql
CREATE TABLE skills (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  version      TEXT,
  path         TEXT,
  enabled      INTEGER NOT NULL DEFAULT 1,
  installed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 3.7 `analytics`

Pre-aggregated daily usage metrics.

```sql
CREATE TABLE analytics (
  id               TEXT PRIMARY KEY,
  date             TEXT NOT NULL,
  provider         TEXT,
  model            TEXT,
  tokens_in        INTEGER DEFAULT 0,
  tokens_out       INTEGER DEFAULT 0,
  cost             REAL DEFAULT 0.0,
  tool_calls_count INTEGER DEFAULT 0,
  sessions_count   INTEGER DEFAULT 0
);

CREATE UNIQUE INDEX idx_analytics_day ON analytics(date, provider, model);
```

### 3.8 Full-Text Search (FTS5)

Virtual table for instant search across all message content.

```sql
CREATE VIRTUAL TABLE messages_fts USING fts5(
  content,
  content=messages,
  content_rowid=rowid
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;

CREATE TRIGGER messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
END;

CREATE TRIGGER messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;
```

### 3.9 Code Intelligence Tables (Tree-sitter Integration)

#### `symbols`

```sql
CREATE TABLE symbols (
  id         TEXT PRIMARY KEY,
  file_path  TEXT NOT NULL,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('function', 'class', 'variable', 'interface', 'type', 'method', 'enum', 'constant')),
  start_line INTEGER NOT NULL,
  end_line   INTEGER NOT NULL,
  language   TEXT NOT NULL
);

CREATE INDEX idx_symbols_file ON symbols(file_path, name);
CREATE INDEX idx_symbols_name ON symbols(name);
CREATE INDEX idx_symbols_kind ON symbols(kind);
```

#### `references`

```sql
CREATE TABLE references (
  id        TEXT PRIMARY KEY,
  symbol_id TEXT NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  line      INTEGER NOT NULL,
  col       INTEGER NOT NULL
);

CREATE INDEX idx_references_symbol ON references(symbol_id);
CREATE INDEX idx_references_file ON references(file_path);
```

Code intelligence tables are rebuilt on file change detection. When a file is modified, all symbols and references for that file are deleted and re-parsed via tree-sitter.

---

## 4. Migration Plan

### Phase 1: Add SQLite Infrastructure

- Add `better-sqlite3` as a dependency.
- Create `DatabaseManager` class that initializes the database and runs schema migrations.
- Database location: `~/.friday/friday.db`.
- Schema versioning via a `schema_version` pragma or metadata table.

### Phase 2: Dual-Write (SQLite Primary, JSON Fallback)

- New sessions are written to SQLite.
- Reading attempts SQLite first; if the session is not found, falls back to JSON files.
- This ensures zero data loss during the transition window.

### Phase 3: Migration Script

- `friday migrate` command scans `~/.friday/sessions/*.json` and imports into SQLite.
- Runs inside a single transaction for atomicity.
- Validates each session before and after import.
- Logs progress: `Migrated 142/142 sessions (0 errors)`.
- Original JSON files are preserved (not deleted) until the user explicitly cleans up.

### Phase 4: Remove JSON Backend

- Remove JSON storage code paths.
- SQLite becomes the sole storage backend.
- JSON files can be archived or deleted via `friday cleanup --legacy-json`.

### Backward Compatibility

- On startup, FridayCode detects whether `~/.friday/sessions/` contains unmigrated JSON files.
- If so, it prompts: `Found 42 legacy sessions. Run 'friday migrate' to import them.`
- The CLI continues to function with SQLite-only data in the meantime.

---

## 5. Query Patterns

### Search across all sessions

```sql
SELECT m.session_id, s.title, snippet(messages_fts, 0, '>>>', '<<<', '...', 32) AS match
FROM messages_fts
JOIN messages m ON m.rowid = messages_fts.rowid
JOIN sessions s ON s.id = m.session_id
WHERE messages_fts MATCH ?
ORDER BY rank
LIMIT 20;
```

### Session history

```sql
SELECT id, title, model, provider, total_tokens, total_cost, updated_at
FROM sessions
ORDER BY updated_at DESC
LIMIT 20;
```

### Cost analytics by date

```sql
SELECT date, SUM(cost) AS daily_cost, SUM(tokens_in + tokens_out) AS daily_tokens
FROM analytics
GROUP BY date
ORDER BY date DESC
LIMIT 30;
```

### Most-used tools

```sql
SELECT tool_name, COUNT(*) AS invocations, AVG(duration_ms) AS avg_duration_ms, SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failures
FROM tool_calls
GROUP BY tool_name
ORDER BY invocations DESC;
```

### Cost by provider/model

```sql
SELECT provider, model, SUM(cost) AS total_cost, SUM(tokens_in) AS total_in, SUM(tokens_out) AS total_out
FROM analytics
GROUP BY provider, model
ORDER BY total_cost DESC;
```

---

## 6. Local Analytics (`/stats` Command)

The `/stats` command provides a dashboard of local usage data. All data stays on the user's machine and is never transmitted.

### Metrics

| Metric                      | Source                                 |
| --------------------------- | -------------------------------------- |
| Total tokens (in/out)       | `analytics` table, aggregated          |
| Total cost                  | `analytics` table, aggregated          |
| Cost by provider/model      | `analytics` table, grouped             |
| Most-used tools             | `tool_calls` table, counted            |
| Average tool execution time | `tool_calls.duration_ms`, averaged     |
| Sessions per day/week/month | `sessions.created_at`, bucketed        |
| Cost over time              | ASCII sparkline from daily `analytics` |

### Example Output

```
📊 Friday Usage Stats
─────────────────────────────────────
Sessions:     142 total (12 this week)
Tokens:       1,847,293 in / 923,641 out
Total Cost:   $14.82

By Provider:
  anthropic/claude-sonnet  $11.20 (75.6%)
  openai/gpt-4o            $3.62  (24.4%)

Top Tools:
  edit_file       1,284 calls  avg 45ms
  read_file         891 calls  avg 12ms
  bash              634 calls  avg 2.3s

Cost (last 14 days):
  ▁▃▂▅▇▄▃▆▅▄▂▃▅▄
```

### Privacy

- All analytics data is stored locally in `~/.friday/friday.db`.
- No telemetry, no phone-home, no external reporting.
- Users can reset analytics with `friday stats --reset`.

---

## 7. Code Intelligence Storage

The code intelligence tables (`symbols` and `references`) support tree-sitter–based code navigation within FridayCode.

### Indexing Strategy

1. **Initial index**: On first run in a workspace, parse all supported files with tree-sitter and populate `symbols` and `references`.
2. **Incremental updates**: On file change (detected via filesystem watcher or git diff), delete and re-parse only the affected files.
3. **Indexed on** `file_path + name` for fast "go to definition" and "find references" lookups.

### Supported Queries

- **Go to definition**: `SELECT * FROM symbols WHERE name = ? AND kind = 'function'`
- **Find references**: `SELECT r.* FROM references r JOIN symbols s ON s.id = r.symbol_id WHERE s.name = ?`
- **Symbols in file**: `SELECT * FROM symbols WHERE file_path = ? ORDER BY start_line`
- **Search by name**: `SELECT * FROM symbols WHERE name LIKE ? ORDER BY file_path`

### Rebuild

If the index becomes stale or corrupted, users can rebuild with:

```
friday index --rebuild
```

This drops all rows from `symbols` and `references` and re-parses the entire workspace.

---

## 8. TypeScript Interfaces

```typescript
interface Session {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  model: string;
  provider: string;
  workspacePath: string;
  summary: string;
  totalTokens: number;
  totalCost: number;
}

interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tokens: number;
  cost: number;
  createdAt: Date;
}

interface ToolCall {
  id: string;
  messageId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  result: Record<string, unknown>;
  durationMs: number;
  success: boolean;
}

interface Checkpoint {
  id: string;
  sessionId: string;
  gitSha: string;
  description: string;
  createdAt: Date;
  snapshot: Record<string, unknown>;
}

interface ConfigEntry {
  key: string;
  value: string;
  scope: 'global' | 'project';
  updatedAt: Date;
}

interface Skill {
  id: string;
  name: string;
  version: string;
  path: string;
  enabled: boolean;
  installedAt: Date;
}

interface AnalyticsRecord {
  id: string;
  date: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  toolCallsCount: number;
  sessionsCount: number;
}

interface Symbol {
  id: string;
  filePath: string;
  name: string;
  kind: 'function' | 'class' | 'variable' | 'interface' | 'type' | 'method' | 'enum' | 'constant';
  startLine: number;
  endLine: number;
  language: string;
}

interface Reference {
  id: string;
  symbolId: string;
  filePath: string;
  line: number;
  column: number;
}

/** Core database operations */
interface DatabaseManager {
  initialize(): void;
  close(): void;
  getSchemaVersion(): number;
  migrate(): void;
}

interface SessionStore {
  create(session: Omit<Session, 'createdAt' | 'updatedAt'>): Session;
  getById(id: string): Session | null;
  list(options?: { limit?: number; offset?: number }): Session[];
  update(id: string, data: Partial<Session>): Session;
  delete(id: string): void;
  search(query: string, limit?: number): Array<{ session: Session; snippet: string }>;
}

interface MessageStore {
  create(message: Omit<Message, 'createdAt'>): Message;
  getBySession(sessionId: string): Message[];
  search(query: string, limit?: number): Array<{ message: Message; snippet: string }>;
}

interface ToolCallStore {
  create(toolCall: ToolCall): ToolCall;
  getByMessage(messageId: string): ToolCall[];
  getStats(): Array<{ toolName: string; count: number; avgDuration: number; failureRate: number }>;
}

interface AnalyticsStore {
  record(entry: Omit<AnalyticsRecord, 'id'>): void;
  getByDateRange(start: string, end: string): AnalyticsRecord[];
  getSummary(): {
    totalCost: number;
    totalTokensIn: number;
    totalTokensOut: number;
    totalSessions: number;
  };
  reset(): void;
}

interface MigrationUtility {
  detectLegacyJsonSessions(): string[];
  migrateJsonSession(filePath: string): { success: boolean; sessionId: string; error?: string };
  migrateAll(options?: { dryRun?: boolean }): {
    migrated: number;
    failed: number;
    errors: string[];
  };
}
```
