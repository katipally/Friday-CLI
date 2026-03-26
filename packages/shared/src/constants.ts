// ─── Color Palette ────────────────────────────────────────────
export const COLORS = {
  deepViolet: '#8B5CF6',
  violetLight: '#A78BFA',
  violetDark: '#6D28D9',
  starkRose: '#F43F5E',
  acidicPistachio: '#A3E635',
  icySlate: '#F8FAFC',
  midnightSlate: '#334155',
  amber: '#FBBF24',
  cyan: '#22D3EE',
  sky: '#38BDF8',
  orange: '#FB923C',
  pink: '#F472B6',
  teal: '#2DD4BF',
  indigo: '#818CF8',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1E293B',
  slate900: '#0F172A',
} as const;

export const ANSI_COLORS = {
  deepViolet: 99,
  starkRose: 204,
  acidicPistachio: 149,
  icySlate: 255,
  midnightSlate: 237,
  amber: 214,
  cyan: 87,
  sky: 75,
  orange: 215,
  pink: 212,
  teal: 86,
  indigo: 105,
  slate: 244,
} as const;

// ─── App Constants ───────────────────────────────────────────
export const APP_NAME = 'FridayCode';
export const CLI_COMMAND = 'friday';
export const CONFIG_DIR = '.friday';
export const USER_CONFIG_DIR = '.friday';
export const MEMORY_FILE = 'FRIDAY.md';

export const DEFAULT_CONFIG_PATH = `~/${USER_CONFIG_DIR}/config.json`;
export const DEFAULT_SETTINGS_PATH = `~/${USER_CONFIG_DIR}/settings.json`;
export const DEFAULT_HISTORY_PATH = `~/${USER_CONFIG_DIR}/history`;

// ─── Provider Defaults ───────────────────────────────────────
export const PROVIDER_DEFAULTS = {
  ollama: {
    baseUrl: 'http://localhost:11434',
    modelsEndpoint: '/api/tags',
    chatEndpoint: '/api/chat',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    chatEndpoint: '/v1/messages',
    apiVersion: '2023-06-01',
  },
  openai: {
    baseUrl: 'https://api.openai.com',
    modelsEndpoint: '/v1/models',
    chatEndpoint: '/v1/chat/completions',
  },
} as const;

// ─── Limits ──────────────────────────────────────────────────
export const CONTEXT_COMPACTION_THRESHOLD = 0.95;
export const MODEL_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const DEFAULT_MAX_TURNS = 100;
export const DEFAULT_MAX_TOKENS = 8192;
export const DEFAULT_TOOL_TIMEOUT_MS = 30_000;
export const DEFAULT_HOOK_TIMEOUT_MS = 5_000;

// ─── Session ─────────────────────────────────────────────────
export const SESSION_TRANSCRIPT_EXT = '.jsonl';
export const SESSION_DIR = 'sessions';
export const SUBAGENT_DIR = 'subagents';
export const MEMORY_DIR = 'memory';
export const RULES_DIR = 'rules';
export const SKILLS_DIR = 'skills';
export const AGENTS_DIR = 'agents';
export const PLUGINS_DIR = 'plugins';

// ─── Permission Modes ────────────────────────────────────────
export const PERMISSION_MODES = ['default', 'acceptAll', 'plan'] as const;

// ─── Hook Events ─────────────────────────────────────────────
export const HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'Stop',
  'SessionStart',
  'SubagentStart',
  'SubagentStop',
  'Notification',
  'InstructionsLoaded',
  'WorktreeCreate',
  'WorktreeRemove',
] as const;
