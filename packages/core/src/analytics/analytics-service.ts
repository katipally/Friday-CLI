import Database from 'better-sqlite3';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';
import type {
  ApiCallRecord,
  ToolExecutionRecord,
  SessionEvent,
  SessionReport,
  DailyReport,
  WeeklyReport,
  MonthlyReport,
  ProviderBreakdown,
  ModelBreakdown,
  ToolUsageStats,
  CostTimelineEntry,
  StatsSummary,
} from './analytics-types.js';

export class AnalyticsService {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? join(homedir(), '.friday', 'friday.db');
    mkdirSync(join(resolvedPath, '..'), { recursive: true });
    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initTables();
  }

  // ── Schema ──────────────────────────────────────────────────────────

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS api_calls (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id  TEXT    NOT NULL,
        provider    TEXT    NOT NULL,
        model       TEXT    NOT NULL,
        input_tokens  INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cost        REAL    NOT NULL DEFAULT 0,
        latency_ms  INTEGER NOT NULL DEFAULT 0,
        success     INTEGER NOT NULL DEFAULT 1,
        error       TEXT,
        timestamp   TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tool_executions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id  TEXT    NOT NULL,
        tool_name   TEXT    NOT NULL,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        success     INTEGER NOT NULL DEFAULT 1,
        error       TEXT,
        timestamp   TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS session_events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id  TEXT    NOT NULL,
        type        TEXT    NOT NULL,
        metadata    TEXT,
        timestamp   TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_api_calls_session   ON api_calls(session_id);
      CREATE INDEX IF NOT EXISTS idx_api_calls_timestamp  ON api_calls(timestamp);
      CREATE INDEX IF NOT EXISTS idx_api_calls_provider   ON api_calls(provider);
      CREATE INDEX IF NOT EXISTS idx_tool_exec_session    ON tool_executions(session_id);
      CREATE INDEX IF NOT EXISTS idx_tool_exec_timestamp  ON tool_executions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_session_events_sid   ON session_events(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_events_ts    ON session_events(timestamp);
    `);
  }

  // ── Recording ───────────────────────────────────────────────────────

  recordApiCall(data: ApiCallRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO api_calls (session_id, provider, model, input_tokens, output_tokens, cost, latency_ms, success, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      data.sessionId,
      data.provider,
      data.model,
      data.inputTokens,
      data.outputTokens,
      data.cost,
      data.latencyMs,
      data.success ? 1 : 0,
      data.error ?? null,
    );
  }

  recordToolExecution(data: ToolExecutionRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO tool_executions (session_id, tool_name, duration_ms, success, error)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      data.sessionId,
      data.toolName,
      data.durationMs,
      data.success ? 1 : 0,
      data.error ?? null,
    );
  }

  recordSessionEvent(event: SessionEvent): void {
    const stmt = this.db.prepare(`
      INSERT INTO session_events (session_id, type, metadata)
      VALUES (?, ?, ?)
    `);
    stmt.run(
      event.sessionId,
      event.type,
      event.metadata ? JSON.stringify(event.metadata) : null,
    );
  }

  // ── Reporting ───────────────────────────────────────────────────────

  getSessionReport(sessionId: string): SessionReport {
    const apiRow = this.db
      .prepare(
        `SELECT
           COUNT(*)              AS api_calls,
           COALESCE(SUM(input_tokens), 0)  AS total_input,
           COALESCE(SUM(output_tokens), 0) AS total_output,
           COALESCE(SUM(cost), 0)          AS total_cost
         FROM api_calls WHERE session_id = ?`,
      )
      .get(sessionId) as {
      api_calls: number;
      total_input: number;
      total_output: number;
      total_cost: number;
    };

    const toolRow = this.db
      .prepare(
        `SELECT COUNT(*) AS tool_executions FROM tool_executions WHERE session_id = ?`,
      )
      .get(sessionId) as { tool_executions: number };

    const events = this.db
      .prepare(
        `SELECT type, timestamp FROM session_events WHERE session_id = ? ORDER BY timestamp ASC`,
      )
      .all(sessionId) as { type: string; timestamp: string }[];

    const startEvent = events.find((e) => e.type === 'start');
    const endEvent = [...events].reverse().find((e) => e.type === 'end');
    let duration = 0;
    if (startEvent && endEvent) {
      duration =
        new Date(endEvent.timestamp).getTime() -
        new Date(startEvent.timestamp).getTime();
    }

    const messageCount = events.length;

    const topTools = this.db
      .prepare(
        `SELECT tool_name AS name, COUNT(*) AS count
         FROM tool_executions WHERE session_id = ?
         GROUP BY tool_name ORDER BY count DESC LIMIT 5`,
      )
      .all(sessionId) as { name: string; count: number }[];

    return {
      sessionId,
      duration,
      messageCount,
      apiCalls: apiRow.api_calls,
      toolExecutions: toolRow.tool_executions,
      totalInputTokens: apiRow.total_input,
      totalOutputTokens: apiRow.total_output,
      totalCost: apiRow.total_cost,
      topTools,
    };
  }

  getDailyReport(date?: string): DailyReport {
    const targetDate = date ?? new Date().toISOString().slice(0, 10);

    const row = this.db
      .prepare(
        `SELECT
           COUNT(DISTINCT session_id) AS sessions,
           COUNT(*)                   AS api_calls,
           COALESCE(SUM(input_tokens + output_tokens), 0) AS total_tokens,
           COALESCE(SUM(cost), 0)     AS total_cost
         FROM api_calls
         WHERE date(timestamp) = ?`,
      )
      .get(targetDate) as {
      sessions: number;
      api_calls: number;
      total_tokens: number;
      total_cost: number;
    };

    const topModels = this.db
      .prepare(
        `SELECT model, COUNT(*) AS calls
         FROM api_calls WHERE date(timestamp) = ?
         GROUP BY model ORDER BY calls DESC LIMIT 5`,
      )
      .all(targetDate) as { model: string; calls: number }[];

    return {
      date: targetDate,
      sessions: row.sessions,
      apiCalls: row.api_calls,
      totalTokens: row.total_tokens,
      totalCost: row.total_cost,
      topModels,
    };
  }

  getWeeklyReport(): WeeklyReport {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const startDate = startOfWeek.toISOString().slice(0, 10);
    const endDate = endOfWeek.toISOString().slice(0, 10);

    const days: DailyReport[] = [];
    const totals = { sessions: 0, apiCalls: 0, tokens: 0, cost: 0 };

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dayReport = this.getDailyReport(d.toISOString().slice(0, 10));
      days.push(dayReport);
      totals.sessions += dayReport.sessions;
      totals.apiCalls += dayReport.apiCalls;
      totals.tokens += dayReport.totalTokens;
      totals.cost += dayReport.totalCost;
    }

    return { startDate, endDate, days, totals };
  }

  getMonthlyReport(): MonthlyReport {
    const now = new Date();
    const month = now.toISOString().slice(0, 7); // YYYY-MM
    const year = now.getFullYear();
    const monthIdx = now.getMonth();

    const firstDay = new Date(year, monthIdx, 1);
    const lastDay = new Date(year, monthIdx + 1, 0);

    const weeks: WeeklyReport[] = [];
    const totals = { sessions: 0, apiCalls: 0, tokens: 0, cost: 0 };

    let weekStart = new Date(firstDay);
    while (weekStart <= lastDay) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const actualEnd = weekEnd > lastDay ? lastDay : weekEnd;

      const days: DailyReport[] = [];
      const weekTotals = { sessions: 0, apiCalls: 0, tokens: 0, cost: 0 };
      const current = new Date(weekStart);
      while (current <= actualEnd) {
        const dayReport = this.getDailyReport(
          current.toISOString().slice(0, 10),
        );
        days.push(dayReport);
        weekTotals.sessions += dayReport.sessions;
        weekTotals.apiCalls += dayReport.apiCalls;
        weekTotals.tokens += dayReport.totalTokens;
        weekTotals.cost += dayReport.totalCost;
        current.setDate(current.getDate() + 1);
      }

      weeks.push({
        startDate: weekStart.toISOString().slice(0, 10),
        endDate: actualEnd.toISOString().slice(0, 10),
        days,
        totals: weekTotals,
      });

      totals.sessions += weekTotals.sessions;
      totals.apiCalls += weekTotals.apiCalls;
      totals.tokens += weekTotals.tokens;
      totals.cost += weekTotals.cost;

      weekStart = new Date(actualEnd);
      weekStart.setDate(weekStart.getDate() + 1);
    }

    return { month, weeks, totals };
  }

  getProviderBreakdown(): ProviderBreakdown[] {
    return this.db
      .prepare(
        `SELECT
           provider,
           COUNT(*)                                      AS calls,
           COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens,
           COALESCE(SUM(cost), 0)                        AS cost,
           COALESCE(AVG(latency_ms), 0)                  AS avgLatencyMs,
           CASE WHEN COUNT(*) = 0 THEN 0
                ELSE CAST(SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*)
           END AS errorRate
         FROM api_calls
         GROUP BY provider
         ORDER BY calls DESC`,
      )
      .all() as ProviderBreakdown[];
  }

  getModelBreakdown(): ModelBreakdown[] {
    return this.db
      .prepare(
        `SELECT
           provider,
           model,
           COUNT(*)                                      AS calls,
           COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens,
           COALESCE(SUM(cost), 0)                        AS cost
         FROM api_calls
         GROUP BY provider, model
         ORDER BY calls DESC`,
      )
      .all() as ModelBreakdown[];
  }

  getToolUsageStats(): ToolUsageStats[] {
    return this.db
      .prepare(
        `SELECT
           tool_name AS toolName,
           COUNT(*)  AS executionCount,
           COALESCE(AVG(duration_ms), 0) AS avgDurationMs,
           CASE WHEN COUNT(*) = 0 THEN 0
                ELSE CAST(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*)
           END AS successRate
         FROM tool_executions
         GROUP BY tool_name
         ORDER BY executionCount DESC`,
      )
      .all() as ToolUsageStats[];
  }

  getCostTimeline(days: number): CostTimelineEntry[] {
    return this.db
      .prepare(
        `SELECT
           date(timestamp) AS date,
           COALESCE(SUM(cost), 0)                        AS cost,
           COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens,
           COUNT(DISTINCT session_id)                     AS sessions
         FROM api_calls
         WHERE timestamp >= datetime('now', ?)
         GROUP BY date(timestamp)
         ORDER BY date ASC`,
      )
      .all(`-${days} days`) as CostTimelineEntry[];
  }

  getStatsSummary(): StatsSummary {
    const overall = this.db
      .prepare(
        `SELECT
           COUNT(DISTINCT session_id) AS totalSessions,
           COUNT(*)                   AS totalApiCalls,
           COALESCE(SUM(input_tokens + output_tokens), 0) AS totalTokens,
           COALESCE(SUM(cost), 0)     AS totalCost
         FROM api_calls`,
      )
      .get() as {
      totalSessions: number;
      totalApiCalls: number;
      totalTokens: number;
      totalCost: number;
    };

    const favoriteModelRow = this.db
      .prepare(
        `SELECT model FROM api_calls GROUP BY model ORDER BY COUNT(*) DESC LIMIT 1`,
      )
      .get() as { model: string } | undefined;

    const favoriteProviderRow = this.db
      .prepare(
        `SELECT provider FROM api_calls GROUP BY provider ORDER BY COUNT(*) DESC LIMIT 1`,
      )
      .get() as { provider: string } | undefined;

    const avgDurationRow = this.db
      .prepare(
        `SELECT AVG(duration) AS avg FROM (
           SELECT
             se_start.session_id,
             (strftime('%s', se_end.timestamp) - strftime('%s', se_start.timestamp)) * 1000 AS duration
           FROM session_events se_start
           JOIN session_events se_end ON se_start.session_id = se_end.session_id
           WHERE se_start.type = 'start' AND se_end.type = 'end'
         )`,
      )
      .get() as { avg: number | null };

    const topTools = this.db
      .prepare(
        `SELECT tool_name AS name, COUNT(*) AS count
         FROM tool_executions
         GROUP BY tool_name ORDER BY count DESC LIMIT 5`,
      )
      .all() as { name: string; count: number }[];

    const last7Row = this.db
      .prepare(
        `SELECT COALESCE(SUM(cost), 0) AS cost FROM api_calls WHERE timestamp >= datetime('now', '-7 days')`,
      )
      .get() as { cost: number };

    const last30Row = this.db
      .prepare(
        `SELECT COALESCE(SUM(cost), 0) AS cost FROM api_calls WHERE timestamp >= datetime('now', '-30 days')`,
      )
      .get() as { cost: number };

    return {
      totalSessions: overall.totalSessions,
      totalApiCalls: overall.totalApiCalls,
      totalTokens: overall.totalTokens,
      totalCost: overall.totalCost,
      favoriteModel: favoriteModelRow?.model ?? 'N/A',
      favoriteProvider: favoriteProviderRow?.provider ?? 'N/A',
      avgSessionDuration: avgDurationRow.avg ?? 0,
      topTools,
      last7DaysCost: last7Row.cost,
      last30DaysCost: last30Row.cost,
    };
  }
}
