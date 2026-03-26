export interface ApiCallRecord {
  sessionId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  latencyMs: number;
  success: boolean;
  error?: string;
}

export interface ToolExecutionRecord {
  sessionId: string;
  toolName: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface SessionEvent {
  sessionId: string;
  type: 'start' | 'end' | 'error' | 'checkpoint' | 'rewind';
  metadata?: Record<string, unknown>;
}

export interface SessionReport {
  sessionId: string;
  duration: number;
  messageCount: number;
  apiCalls: number;
  toolExecutions: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  topTools: { name: string; count: number }[];
}

export interface DailyReport {
  date: string;
  sessions: number;
  apiCalls: number;
  totalTokens: number;
  totalCost: number;
  topModels: { model: string; calls: number }[];
}

export interface WeeklyReport {
  startDate: string;
  endDate: string;
  days: DailyReport[];
  totals: { sessions: number; apiCalls: number; tokens: number; cost: number };
}

export interface MonthlyReport {
  month: string;
  weeks: WeeklyReport[];
  totals: { sessions: number; apiCalls: number; tokens: number; cost: number };
}

export interface ProviderBreakdown {
  provider: string;
  calls: number;
  tokens: number;
  cost: number;
  avgLatencyMs: number;
  errorRate: number;
}

export interface ModelBreakdown {
  provider: string;
  model: string;
  calls: number;
  tokens: number;
  cost: number;
}

export interface ToolUsageStats {
  toolName: string;
  executionCount: number;
  avgDurationMs: number;
  successRate: number;
}

export interface CostTimelineEntry {
  date: string;
  cost: number;
  tokens: number;
  sessions: number;
}

export interface StatsSummary {
  totalSessions: number;
  totalApiCalls: number;
  totalTokens: number;
  totalCost: number;
  favoriteModel: string;
  favoriteProvider: string;
  avgSessionDuration: number;
  topTools: { name: string; count: number }[];
  last7DaysCost: number;
  last30DaysCost: number;
}
