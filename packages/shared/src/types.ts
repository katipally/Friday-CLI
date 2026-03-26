import type { PERMISSION_MODES, HOOK_EVENTS } from './constants.js';

// ─── Model Provider Types ────────────────────────────────────

export type ProviderType = 'ollama' | 'anthropic' | 'openai' | 'openai-compatible';

export interface ProviderConfig {
  type: ProviderType;
  enabled: boolean;
  baseUrl: string;
  apiKey?: string;
  name?: string;
}

export interface Model {
  id: string;
  name: string;
  provider: ProviderType;
  contextWindow?: number;
  supportsToolUse: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  maxOutputTokens?: number;
}

export interface ChatOptions {
  model: string;
  provider: ProviderType;
  messages: Message[];
  tools?: ToolDefinition[];
  systemPrompt?: string;
  stream: boolean;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
}

export interface StreamChunk {
  type: 'text' | 'tool_use' | 'thinking' | 'error' | 'done';
  content?: string;
  toolCall?: ToolCall;
  usage?: TokenUsage;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface ModelProvider {
  readonly type: ProviderType;
  readonly name: string;

  listModels(): Promise<Model[]>;
  chat(options: ChatOptions): AsyncIterable<StreamChunk>;
  supportsToolUse(): boolean;
  supportsVision(): boolean;
  supportsStreaming(): boolean;
  isAvailable(): Promise<boolean>;
}

// ─── Message Types ───────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  role: MessageRole;
  content: string | ContentBlock[];
  toolCalls?: ToolCall[];
  toolCallId?: string;
  timestamp?: number;
}

export interface ContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result' | 'thinking';
  text?: string;
  toolUseId?: string;
  toolName?: string;
  input?: Record<string, unknown>;
  content?: string;
  isError?: boolean;
}

// ─── Tool Types ──────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  requiresPermission: boolean;
  isReadOnly: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError: boolean;
}

export interface Tool {
  definition: ToolDefinition;
  execute(input: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}

export interface ToolContext {
  workingDir: string;
  sessionId: string;
  permissions: PermissionManager;
  hooks: HookEngine;
  settings: Settings;
  abortSignal?: AbortSignal;
}

// ─── Permission Types ────────────────────────────────────────

export type PermissionMode = (typeof PERMISSION_MODES)[number];

export interface PermissionRule {
  action: 'allow' | 'deny';
  tool: string;
  pattern?: string;
}

export interface PermissionManager {
  mode: PermissionMode;
  rules: PermissionRule[];
  check(toolName: string, input?: Record<string, unknown>): Promise<PermissionDecision>;
}

export type PermissionDecision = 'allow' | 'deny' | 'ask';

// ─── Hook Types ──────────────────────────────────────────────

export type HookEvent = (typeof HOOK_EVENTS)[number];

export interface HookDefinition {
  event: HookEvent;
  matcher?: string;
  command?: string;
  url?: string;
  timeout?: number;
}

export interface HookPayload {
  event: HookEvent;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: ToolResult;
  sessionId?: string;
  agentId?: string;
}

export interface HookEngine {
  register(hook: HookDefinition): void;
  dispatch(payload: HookPayload): Promise<void>;
}

// ─── Session Types ───────────────────────────────────────────

export interface Session {
  id: string;
  name?: string;
  projectPath: string;
  branch?: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  parentSessionId?: string;
  forkPoint?: number;
}

export interface SessionManager {
  create(projectPath: string, name?: string): Promise<Session>;
  resume(sessionId: string): Promise<Session>;
  fork(sessionId: string, atMessage?: number): Promise<Session>;
  rewind(sessionId: string, toMessage: number): Promise<Session>;
  list(projectPath?: string): Promise<Session[]>;
  save(session: Session): Promise<void>;
  compact(session: Session, focusTopic?: string): Promise<Session>;
}

// ─── Agent Types ─────────────────────────────────────────────

export type AgentMode = 'foreground' | 'background';

export interface AgentDefinition {
  name: string;
  description?: string;
  tools?: string[];
  disallowedTools?: string[];
  model?: string;
  permissionMode?: PermissionMode;
  maxTurns?: number;
  skills?: string[];
  mcpServers?: string[];
  hooks?: Record<string, HookDefinition[]>;
  memory?: string[];
  background?: boolean;
  effort?: EffortLevel;
  isolation?: 'worktree' | 'none';
  initialPrompt?: string;
  instructions?: string;
}

export interface AgentInstance {
  id: string;
  definition: AgentDefinition;
  mode: AgentMode;
  status: AgentStatus;
  sessionId: string;
  parentAgentId?: string;
  createdAt: number;
  result?: string;
}

export type AgentStatus = 'running' | 'completed' | 'failed' | 'stopped';

export type EffortLevel = 'low' | 'medium' | 'high' | 'max' | 'auto';

// ─── Skill Types ─────────────────────────────────────────────

export interface SkillDefinition {
  name: string;
  description?: string;
  disableModelInvocation?: boolean;
  userInvocable?: boolean;
  allowedTools?: string[];
  model?: string;
  effort?: EffortLevel;
  context?: 'fork' | 'inline';
  agent?: string;
  hooks?: Record<string, HookDefinition[]>;
  paths?: string[];
  shell?: string;
  body: string;
}

// ─── Plugin Types ────────────────────────────────────────────

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  engines?: Record<string, string>;
}

export interface Plugin {
  manifest: PluginManifest;
  path: string;
  skills: Map<string, SkillDefinition>;
  agents: Map<string, AgentDefinition>;
  hooks: HookDefinition[];
  enabled: boolean;
}

// ─── Settings Types ──────────────────────────────────────────

export type SettingsScope = 'managed' | 'local' | 'project' | 'user';

export interface Settings {
  // Provider
  providers: Record<string, ProviderConfig>;
  activeProvider: string;
  activeModel: string;

  // Permissions
  permissionMode: PermissionMode;
  permissions: {
    allow: string[];
    deny: string[];
  };

  // Model
  effort: EffortLevel;
  fastModel?: string;
  maxTokens: number;

  // Session
  disableAutoMemory: boolean;
  disableAutoCompact: boolean;
  compactMessageThreshold: number;

  // UI
  theme: 'dark' | 'light';
  vimMode: boolean;
  prefersReducedMotion: boolean;
  statusLine: boolean;
  showSpider: boolean;

  // Hooks
  hooks: Partial<Record<HookEvent, HookDefinition[]>>;

  // MCP
  mcpServers: Record<string, McpServerConfig>;

  // Telemetry
  telemetryOptIn: boolean;

  // Attribution
  gitAttribution: boolean;
}

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

// ─── Memory Types ────────────────────────────────────────────

export interface MemoryFile {
  path: string;
  scope: 'project' | 'user' | 'organization';
  content: string;
  imports: string[];
}

export interface Rule {
  path: string;
  paths: string[];
  content: string;
}

// ─── Telemetry Types ─────────────────────────────────────────

export interface TelemetryEvent {
  event: string;
  properties?: Record<string, string | number | boolean>;
  timestamp: number;
}

// ─── Spider Expression Types ─────────────────────────────────

export type SpiderExpression =
  | 'idle'
  | 'thinking'
  | 'success'
  | 'error'
  | 'working'
  | 'greeting'
  | 'confused';
