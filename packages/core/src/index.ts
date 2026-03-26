// ─── Providers ───────────────────────────────────────────────
export { BaseProvider } from './providers/base.js';
export { OllamaProvider } from './providers/ollama.js';
export { AnthropicProvider } from './providers/anthropic.js';
export { OpenAIProvider } from './providers/openai.js';
export { OpenAICompatibleProvider } from './providers/openai-compat.js';
export { createProvider, ProviderRegistry } from './providers/index.js';

// ─── Settings ────────────────────────────────────────────────
export { settingsSchema } from './settings/schema.js';
export { loadSettings, saveSettings } from './settings/loader.js';
export { PermissionEngine } from './settings/permissions.js';

// ─── Tools ───────────────────────────────────────────────────
export {
  ToolRegistry,
  createDefaultToolRegistry,
  bashTool,
  readTool,
  writeTool,
  editTool,
  globTool,
  grepTool,
  listDirTool,
  webFetchTool,
  webSearchTool,
  askUserTool,
  todoWriteTool,
  getTodos,
  cronCreateTool,
  cronDeleteTool,
  cronListTool,
  stopAllCronJobs,
  taskCreateTool,
  taskGetTool,
  taskListTool,
  taskStopTool,
  taskUpdateTool,
  getTask,
  getAllTasks,
  setTask,
  agentTool,
  skillTool,
  notebookEditTool,
  lspTool,
  mcpListResourcesTool,
  mcpReadResourceTool,
} from './tools/index.js';

// ─── Agents ──────────────────────────────────────────────────
export { AgentEngine } from './agents/engine.js';
export type { AgentEngineOptions } from './agents/engine.js';
export {
  prepareCompactionPrompt,
  applyCompaction,
  estimateTokenCount,
} from './agents/context.js';
export {
  EXPLORE_AGENT,
  PLAN_AGENT,
  GENERAL_AGENT,
  BUILT_IN_AGENTS,
  getBuiltInAgent,
} from './agents/built-in.js';

// ─── Memory ──────────────────────────────────────────────────
export {
  loadMemoryFiles,
  loadAutoMemory,
  saveAutoMemory,
  loadRules,
  getApplicableRules,
} from './memory/index.js';

// ─── Session ─────────────────────────────────────────────────
export {
  createSession,
  saveSession,
  resumeSession,
  forkSession,
  rewindSession,
  listSessions,
  appendMessage,
  exportSession,
} from './session/index.js';

// ─── Hooks ───────────────────────────────────────────────────
export { HookEngineImpl } from './hooks/index.js';

// ─── Git ─────────────────────────────────────────────────────
export {
  isGitRepo,
  getCurrentBranch,
  getRepoRoot,
  createWorktree,
  removeWorktree,
  listWorktrees,
  commitWithAttribution,
  isAIGenerated,
  getRecentCommits,
  getDiff,
  getStatus,
  getCurrentCommit,
  listBranches,
  hasUncommittedChanges,
  getChangedFiles,
  getPRDiff,
  getPRFullDiff,
  getPRFileDiff,
  getPRCommits,
} from './git/index.js';

// ─── Skills ──────────────────────────────────────────────────
export {
  parseSkillFile,
  discoverSkills,
  executeSkill,
  formatSkillInfo,
  BUILT_IN_SKILLS,
  getBuiltInSkill,
} from './skills/index.js';

// ─── Plugins ─────────────────────────────────────────────────
export {
  loadPluginManifest,
  loadPlugin,
  discoverPlugins,
  PluginRegistry,
  PluginLifecycle,
} from './plugins/index.js';

// ─── Telemetry ───────────────────────────────────────────────
export { TelemetryCollector } from './telemetry/index.js';
