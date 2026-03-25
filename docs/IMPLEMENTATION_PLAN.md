# Friday CLI — Complete Implementation Plan

## Vision
**Friday CLI** is an open-source, multi-provider AI coding agent for the terminal — a direct competitor to Claude Code, Gemini CLI, and GitHub Copilot CLI. It supports 15+ LLM providers, features a beautiful Ink-based TUI, a full ReAct agent loop with sub-agent delegation, MCP plugin support, and ships as npm package, Homebrew formula, and standalone binary.

**License:** MIT | **Language:** TypeScript | **Runtime:** Node.js | **TUI:** Ink (React for terminal)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Friday CLI                          │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  TUI Layer   │  │  CLI Parser  │  │  SDK (@friday/ │  │
│  │  (Ink/React) │  │  (Commander) │  │   sdk)        │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘  │
│         │                 │                  │           │
│  ┌──────▼─────────────────▼──────────────────▼────────┐ │
│  │              Agent Orchestrator                     │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │ │
│  │  │  Main    │  │  Sub-    │  │  Session/Memory   │  │ │
│  │  │  Agent   │  │  Agents  │  │  Manager          │  │ │
│  │  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │ │
│  └───────┼──────────────┼─────────────────┼────────────┘ │
│          │              │                 │              │
│  ┌───────▼──────────────▼─────────────────▼────────────┐ │
│  │              Core Services Layer                     │ │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐ │ │
│  │  │Provider│ │ Tool   │ │Context │ │ Permission   │ │ │
│  │  │Manager │ │Registry│ │Manager │ │ System       │ │ │
│  │  └───┬────┘ └───┬────┘ └───┬────┘ └──────────────┘ │ │
│  └──────┼──────────┼──────────┼────────────────────────┘ │
│         │          │          │                           │
│  ┌──────▼──┐ ┌─────▼────┐ ┌──▼──────────────────────┐   │
│  │Providers│ │  Tools   │ │  Indexer (Tree-sitter)  │   │
│  │ OpenAI  │ │ File R/W │ │  + Context Window Mgmt  │   │
│  │Anthropic│ │ Shell    │ │                          │   │
│  │ Gemini  │ │ Grep/Glob│ └──────────────────────────┘   │
│  │ Ollama  │ │ Git      │                                │
│  │ Mistral │ │ Web Fetch│                                │
│  │ DeepSeek│ │ MCP Ext  │                                │
│  │ Groq    │ │          │                                │
│  │ Bedrock │ │          │                                │
│  │ Azure   │ │          │                                │
│  │ Cohere  │ │          │                                │
│  │ +more   │ │          │                                │
│  └─────────┘ └──────────┘                                │
└──────────────────────────────────────────────────────────┘
```

---

## Monorepo Structure

```
friday-cli/
├── packages/
│   ├── cli/                    # CLI entry point, commander setup
│   │   ├── src/
│   │   │   ├── index.ts        # Main entry, arg parsing
│   │   │   ├── commands/       # Slash command handlers
│   │   │   │   ├── help.ts
│   │   │   │   ├── model.ts
│   │   │   │   ├── mode.ts
│   │   │   │   ├── clear.ts
│   │   │   │   ├── compact.ts
│   │   │   │   ├── cost.ts
│   │   │   │   ├── history.ts
│   │   │   │   ├── init.ts
│   │   │   │   ├── tools.ts
│   │   │   │   ├── mcp.ts
│   │   │   │   └── update.ts
│   │   │   ├── onboarding/     # First-run wizard
│   │   │   │   ├── wizard.tsx
│   │   │   │   └── demo.ts
│   │   │   └── config/         # Config loading/merging
│   │   │       ├── loader.ts
│   │   │       ├── schema.ts
│   │   │       └── defaults.ts
│   │   ├── bin/
│   │   │   └── friday.ts       # Shebang entry point
│   │   └── package.json
│   │
│   ├── core/                   # Agent loop, orchestration
│   │   ├── src/
│   │   │   ├── agent/
│   │   │   │   ├── agent-loop.ts       # ReAct state machine
│   │   │   │   ├── agent-types.ts      # State, Action, Observation types
│   │   │   │   ├── planner.ts          # Plan mode logic
│   │   │   │   ├── delegator.ts        # Sub-agent spawning
│   │   │   │   └── modes/
│   │   │   │       ├── code.ts         # Code mode system prompt
│   │   │   │       ├── chat.ts         # Chat mode (no tools)
│   │   │   │       ├── review.ts       # Review mode
│   │   │   │       ├── plan.ts         # Plan mode
│   │   │   │       └── debug.ts        # Debug mode
│   │   │   ├── context/
│   │   │   │   ├── context-manager.ts  # Token budget management
│   │   │   │   ├── message-history.ts  # Conversation history
│   │   │   │   ├── summarizer.ts       # Old message summarization
│   │   │   │   ├── memory-store.ts     # Persistent memory (SQLite)
│   │   │   │   └── session.ts          # Session save/restore
│   │   │   ├── permissions/
│   │   │   │   ├── permission-system.ts # Allow/deny logic
│   │   │   │   ├── rules.ts            # Default permission rules
│   │   │   │   └── prompt.ts           # User confirmation prompts
│   │   │   ├── cost/
│   │   │   │   ├── tracker.ts          # Token counting
│   │   │   │   ├── pricing.ts          # Per-provider pricing tables
│   │   │   │   └── budget.ts           # Budget limits
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── providers/              # LLM provider abstraction
│   │   ├── src/
│   │   │   ├── types.ts        # LLMProvider interface, LLMResponse, etc.
│   │   │   ├── factory.ts      # createProvider() factory
│   │   │   ├── registry.ts     # Provider registration/discovery
│   │   │   ├── capabilities.ts # Capability matrix (streaming, vision, etc.)
│   │   │   ├── adapters/
│   │   │   │   ├── openai.ts
│   │   │   │   ├── anthropic.ts
│   │   │   │   ├── google-gemini.ts
│   │   │   │   ├── ollama.ts
│   │   │   │   ├── mistral.ts
│   │   │   │   ├── aws-bedrock.ts
│   │   │   │   ├── azure-openai.ts
│   │   │   │   ├── groq.ts
│   │   │   │   ├── deepseek.ts
│   │   │   │   ├── cohere.ts
│   │   │   │   ├── openai-compatible.ts  # Generic OpenAI-compat adapter
│   │   │   │   └── lm-studio.ts
│   │   │   ├── streaming/
│   │   │   │   ├── stream-handler.ts     # Unified streaming interface
│   │   │   │   └── sse-parser.ts         # Server-Sent Events parser
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── tools/                  # Built-in tools
│   │   ├── src/
│   │   │   ├── types.ts        # Tool interface, ToolResult
│   │   │   ├── registry.ts     # Tool registration
│   │   │   ├── built-in/
│   │   │   │   ├── file-read.ts
│   │   │   │   ├── file-write.ts
│   │   │   │   ├── file-edit.ts       # Surgical edit (old_str → new_str)
│   │   │   │   ├── shell-exec.ts      # Shell command execution
│   │   │   │   ├── grep.ts            # Ripgrep-based search
│   │   │   │   ├── glob.ts            # File pattern matching
│   │   │   │   ├── git.ts             # Git operations
│   │   │   │   ├── web-fetch.ts       # HTTP fetch
│   │   │   │   ├── directory-tree.ts  # Directory listing
│   │   │   │   └── ask-user.ts        # User input tool
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── mcp/                    # MCP client implementation
│   │   ├── src/
│   │   │   ├── client.ts       # MCP client (connect to servers)
│   │   │   ├── discovery.ts    # Tool discovery from MCP servers
│   │   │   ├── transport/
│   │   │   │   ├── stdio.ts    # STDIO transport
│   │   │   │   └── http-sse.ts # HTTP + SSE transport
│   │   │   ├── server-manager.ts # Lifecycle management
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── tui/                    # Terminal UI (Ink components)
│   │   ├── src/
│   │   │   ├── app.tsx         # Root Ink app component
│   │   │   ├── components/
│   │   │   │   ├── Chat.tsx           # Main chat view
│   │   │   │   ├── MessageBubble.tsx  # Individual message rendering
│   │   │   │   ├── StreamingText.tsx  # Streaming token display
│   │   │   │   ├── MarkdownRenderer.tsx # Markdown → terminal
│   │   │   │   ├── CodeBlock.tsx      # Syntax-highlighted code
│   │   │   │   ├── ToolOutput.tsx     # Tool execution output
│   │   │   │   ├── StatusBar.tsx      # Bottom status bar
│   │   │   │   ├── InputBox.tsx       # User input area
│   │   │   │   ├── PermissionPrompt.tsx # Permission confirmation
│   │   │   │   ├── DiffView.tsx       # File diff display
│   │   │   │   ├── CostIndicator.tsx  # Token/cost display
│   │   │   │   ├── Spinner.tsx        # Loading states
│   │   │   │   ├── ProgressBar.tsx    # Progress indicators
│   │   │   │   ├── Table.tsx          # Table rendering
│   │   │   │   └── ImageRenderer.tsx  # Sixel/kitty image display
│   │   │   ├── themes/
│   │   │   │   ├── theme-types.ts
│   │   │   │   ├── dark.ts
│   │   │   │   ├── light.ts
│   │   │   │   ├── monokai.ts
│   │   │   │   ├── dracula.ts
│   │   │   │   └── theme-loader.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useAgent.ts        # Agent interaction hook
│   │   │   │   ├── useStreaming.ts     # Streaming state hook
│   │   │   │   ├── useTheme.ts        # Theme context hook
│   │   │   │   └── useKeyboard.ts     # Keyboard shortcut hook
│   │   │   ├── accessibility/
│   │   │   │   ├── screen-reader.ts
│   │   │   │   └── high-contrast.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── indexer/                # Codebase indexing
│   │   ├── src/
│   │   │   ├── tree-sitter/
│   │   │   │   ├── parser.ts         # Tree-sitter AST parsing
│   │   │   │   ├── chunker.ts        # Semantic code chunking
│   │   │   │   └── languages.ts      # Language grammar registry
│   │   │   ├── repo-map.ts           # Repository structure map
│   │   │   ├── symbol-index.ts       # Symbol table (functions, classes)
│   │   │   ├── project-detector.ts   # Detect project type/framework
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── sdk/                    # Programmatic SDK (@friday/sdk)
│   │   ├── src/
│   │   │   ├── friday.ts       # Main SDK class
│   │   │   ├── types.ts        # Public API types
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── i18n/                   # Internationalization
│   │   ├── src/
│   │   │   ├── i18n.ts         # i18n engine
│   │   │   └── index.ts
│   │   ├── locales/
│   │   │   ├── en.json
│   │   │   ├── es.json
│   │   │   ├── ja.json
│   │   │   └── zh.json
│   │   └── package.json
│   │
│   └── shared/                 # Shared utilities
│       ├── src/
│       │   ├── logger.ts       # Structured logging
│       │   ├── errors.ts       # Error types
│       │   ├── crypto.ts       # API key encryption
│       │   ├── platform.ts     # OS detection utilities
│       │   ├── telemetry.ts    # Anonymous telemetry
│       │   └── index.ts
│       └── package.json
│
├── extensions/
│   └── vscode/                 # VS Code extension
│       ├── src/
│       │   ├── extension.ts
│       │   ├── inline-provider.ts
│       │   └── terminal-agent.ts
│       └── package.json
│
├── docs/                       # Documentation site
│   ├── docusaurus.config.ts
│   ├── docs/
│   │   ├── getting-started.md
│   │   ├── configuration.md
│   │   ├── providers/
│   │   ├── tools/
│   │   ├── mcp/
│   │   ├── sdk/
│   │   └── contributing/
│   └── package.json
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml              # Lint + Test + Build
│   │   ├── release.yml         # npm publish + binary builds
│   │   └── docs.yml            # Deploy docs site
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml
│   │   ├── feature_request.yml
│   │   └── provider_request.yml
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── CODE_OF_CONDUCT.md
│
├── FRIDAY.md                   # Friday's own project rules
├── CONTRIBUTING.md
├── LICENSE                     # MIT
├── README.md
├── pnpm-workspace.yaml
├── tsconfig.json               # Base TS config
├── vitest.config.ts
├── .eslintrc.json
├── .prettierrc
└── .gitignore
```

---

## Detailed Component Design

### 1. Provider Abstraction Layer

```typescript
// packages/providers/src/types.ts

export interface LLMProvider {
  readonly name: string;
  readonly displayName: string;

  // Core capabilities
  generate(request: GenerateRequest): Promise<GenerateResponse>;
  stream(request: GenerateRequest): AsyncGenerator<StreamChunk>;

  // Tool calling
  generateWithTools(request: ToolCallRequest): Promise<ToolCallResponse>;
  streamWithTools(request: ToolCallRequest): AsyncGenerator<ToolStreamChunk>;

  // Introspection
  capabilities(): ProviderCapabilities;
  listModels(): Promise<ModelInfo[]>;
  validateApiKey(): Promise<boolean>;
}

export interface GenerateRequest {
  messages: Message[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stopSequences?: string[];
}

export interface ProviderCapabilities {
  streaming: boolean;
  toolCalling: boolean;
  vision: boolean;
  embeddings: boolean;
  jsonMode: boolean;
  maxContextWindow: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  inputPricePerMToken: number;
  outputPricePerMToken: number;
  supportsVision: boolean;
  supportsToolCalling: boolean;
}
```

**Provider Registration Pattern:**
```typescript
// Each provider self-registers
// packages/providers/src/adapters/openai.ts
export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  readonly displayName = 'OpenAI';

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    // Translate GenerateRequest → OpenAI API format
    // Call OpenAI API
    // Translate response → GenerateResponse
  }

  async *stream(request: GenerateRequest): AsyncGenerator<StreamChunk> {
    // Same but streaming via SSE
  }
}
```

### 2. Agent Loop (ReAct State Machine)

```
States: THINK → ACT → OBSERVE → (loop or TERMINATE)

┌──────────┐     ┌────────┐     ┌──────────┐
│  THINK   │────►│  ACT   │────►│ OBSERVE  │
│ (LLM     │     │ (Tool  │     │ (Capture │
│  reasons) │     │  exec) │     │  result) │
└─────▲────┘     └────────┘     └────┬─────┘
      │                              │
      └──────────────────────────────┘
      │
      ▼ (when done)
┌──────────┐
│TERMINATE │
│ (final   │
│  answer) │
└──────────┘
```

```typescript
// packages/core/src/agent/agent-loop.ts

type AgentState = 'THINK' | 'ACT' | 'OBSERVE' | 'TERMINATE';

export class AgentLoop {
  private state: AgentState = 'THINK';
  private history: Message[] = [];
  private maxIterations = 50;
  private iteration = 0;

  async run(userMessage: string): AsyncGenerator<AgentEvent> {
    this.history.push({ role: 'user', content: userMessage });

    while (this.state !== 'TERMINATE' && this.iteration < this.maxIterations) {
      switch (this.state) {
        case 'THINK': {
          // Send history to LLM with tool definitions
          const response = await this.provider.generateWithTools({
            messages: this.contextManager.prepare(this.history),
            model: this.config.model,
            tools: this.toolRegistry.getToolDefinitions(),
            systemPrompt: this.modePrompt,
          });

          if (response.toolCalls.length > 0) {
            this.state = 'ACT';
            yield { type: 'thinking', content: response.reasoning };
          } else {
            this.state = 'TERMINATE';
            yield { type: 'response', content: response.content };
          }
          break;
        }

        case 'ACT': {
          // Execute each tool call (with permission checks)
          for (const toolCall of response.toolCalls) {
            const permitted = await this.permissionSystem.check(toolCall);
            if (!permitted) {
              yield { type: 'permission_denied', toolCall };
              continue;
            }
            const result = await this.toolRegistry.execute(toolCall);
            yield { type: 'tool_result', toolCall, result };
            this.history.push({ role: 'tool', id: toolCall.id, content: result });
          }
          this.state = 'OBSERVE';
          break;
        }

        case 'OBSERVE': {
          // Feed results back into the loop
          this.iteration++;
          this.state = 'THINK';
          break;
        }
      }
    }
  }
}
```

### 3. Sub-Agent Delegation

```typescript
// packages/core/src/agent/delegator.ts

export class AgentDelegator {
  async spawn(config: SubAgentConfig): Promise<SubAgentResult> {
    const subAgent = new AgentLoop({
      provider: config.provider || this.defaultProvider,
      model: config.model || 'fast', // Use cheaper/faster model for sub-tasks
      tools: config.tools,
      systemPrompt: config.systemPrompt,
      maxIterations: config.maxIterations || 10,
    });

    return subAgent.run(config.task);
  }

  // Parallel sub-agents for independent tasks
  async spawnParallel(tasks: SubAgentConfig[]): Promise<SubAgentResult[]> {
    return Promise.all(tasks.map(t => this.spawn(t)));
  }
}
```

### 4. Context Management

```typescript
// packages/core/src/context/context-manager.ts

export class ContextManager {
  private tokenBudget: number;
  private reservedForResponse: number = 4096;

  prepare(history: Message[]): Message[] {
    const available = this.tokenBudget - this.reservedForResponse;
    const systemTokens = this.countTokens(this.systemPrompt);
    const remaining = available - systemTokens;

    // Strategy:
    // 1. Always include system prompt
    // 2. Always include last N messages (recent context)
    // 3. Summarize older messages if needed
    // 4. Include relevant repo context (from indexer)

    if (this.totalTokens(history) <= remaining) {
      return history; // Everything fits
    }

    // Summarize older messages
    const summarized = await this.summarizer.summarize(
      history.slice(0, -10) // Keep last 10 messages intact
    );

    return [
      { role: 'system', content: summarized },
      ...history.slice(-10),
    ];
  }
}
```

### 5. Permission System

```typescript
// packages/core/src/permissions/permission-system.ts

export class PermissionSystem {
  private rules: PermissionRule[] = DEFAULT_RULES;
  private alwaysAllow: Set<string> = new Set();

  async check(toolCall: ToolCall): Promise<boolean> {
    const rule = this.findMatchingRule(toolCall);

    switch (rule.action) {
      case 'allow': return true;
      case 'deny': return false;
      case 'prompt': {
        if (this.alwaysAllow.has(toolCall.signature)) return true;
        const decision = await this.promptUser(toolCall);
        if (decision === 'always') this.alwaysAllow.add(toolCall.signature);
        return decision !== 'deny';
      }
    }
  }
}

// Default rules
const DEFAULT_RULES: PermissionRule[] = [
  { tool: 'file_read', scope: 'workspace', action: 'allow' },
  { tool: 'file_write', scope: 'workspace', action: 'prompt' },
  { tool: 'shell_exec', pattern: /^(ls|cat|grep|find|git)/, action: 'allow' },
  { tool: 'shell_exec', pattern: /^(rm|sudo|chmod|curl)/, action: 'prompt' },
  { tool: 'file_*', scope: 'outside_workspace', action: 'deny' },
];
```

### 6. Tool System

```typescript
// packages/tools/src/types.ts

export interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}

// Example: File Read Tool
// packages/tools/src/built-in/file-read.ts
export const fileReadTool: Tool = {
  name: 'file_read',
  description: 'Read the contents of a file',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to read' },
      startLine: { type: 'number', description: 'Optional start line' },
      endLine: { type: 'number', description: 'Optional end line' },
    },
    required: ['path'],
  },
  async execute({ path, startLine, endLine }) {
    const content = await fs.readFile(resolvePath(path), 'utf-8');
    if (startLine || endLine) {
      const lines = content.split('\n');
      return {
        success: true,
        output: lines.slice(startLine - 1, endLine).join('\n'),
      };
    }
    return { success: true, output: content };
  },
};
```

### 7. MCP Client

```typescript
// packages/mcp/src/client.ts

export class MCPClient {
  private servers: Map<string, MCPServerConnection> = new Map();

  async connect(config: MCPServerConfig): Promise<void> {
    const transport = config.transport === 'stdio'
      ? new StdioTransport(config.command, config.args)
      : new HttpSSETransport(config.url);

    const connection = new MCPServerConnection(transport);
    await connection.initialize();

    // Discover tools from this server
    const tools = await connection.listTools();
    this.registerExternalTools(config.name, tools);

    this.servers.set(config.name, connection);
  }

  async executeToolOnServer(serverName: string, toolName: string, args: any): Promise<any> {
    const server = this.servers.get(serverName);
    return server.callTool(toolName, args);
  }
}
```

### 8. Configuration System

```typescript
// Configuration hierarchy (lowest to highest precedence):
// 1. Built-in defaults
// 2. Global config (~/.friday/config.json)
// 3. Project config (.friday/config.json)
// 4. Environment variables (FRIDAY_*)
// 5. CLI flags (--model, --provider)

// ~/.friday/config.json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-20250514",
  "providers": {
    "openai": { "apiKey": "sk-..." },
    "anthropic": { "apiKey": "sk-ant-..." },
    "ollama": { "baseUrl": "http://localhost:11434" }
  },
  "permissions": {
    "autoApproveRead": true,
    "autoApproveWrite": false,
    "blockedCommands": ["rm -rf", "sudo"]
  },
  "theme": "dark",
  "language": "en",
  "telemetry": true,
  "maxIterations": 50,
  "tokenBudget": {
    "warningThreshold": 0.8,
    "hardLimit": null
  },
  "costBudget": {
    "perSession": 5.00,
    "perDay": 20.00
  },
  "mcp": {
    "servers": [
      {
        "name": "github",
        "command": "npx",
        "args": ["@friday/mcp-github"],
        "transport": "stdio"
      }
    ]
  }
}
```

### 9. FRIDAY.md + Rules System

```markdown
<!-- FRIDAY.md (placed in project root) -->
# Project Rules for Friday

## Code Style
- Use TypeScript strict mode
- Prefer functional patterns over classes
- Use named exports, not default exports

## Testing
- Write unit tests for every new function
- Use Vitest for testing
- Tests go in __tests__/ directories next to source

## Git
- Use conventional commits (feat:, fix:, chore:)
- Never commit to main directly

## Architecture
- Database queries go through the repository pattern
- API routes in src/routes/
- Business logic in src/services/
```

```
.friday/
├── rules/
│   ├── coding-style.md
│   ├── testing.md
│   └── architecture.md
└── config.json
```

### 10. Session Persistence & Memory

```typescript
// packages/core/src/context/memory-store.ts

// Uses SQLite for persistent memory across sessions
export class MemoryStore {
  private db: Database; // better-sqlite3

  // Store session
  async saveSession(session: Session): Promise<void> {
    this.db.prepare(`
      INSERT INTO sessions (id, project_path, messages, summary, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(session.id, session.projectPath, JSON.stringify(session.messages),
           session.summary, session.createdAt, session.updatedAt);
  }

  // Restore session
  async loadSession(id: string): Promise<Session | null> { ... }

  // List recent sessions for a project
  async listSessions(projectPath: string, limit: number): Promise<SessionSummary[]> { ... }

  // Persistent memory (cross-session knowledge)
  async remember(key: string, value: string, projectPath?: string): Promise<void> { ... }
  async recall(key: string, projectPath?: string): Promise<string | null> { ... }
}
```

### 11. Cost Tracking

```typescript
// packages/core/src/cost/pricing.ts

export const PRICING: Record<string, ModelPricing> = {
  'gpt-4o': { input: 2.50, output: 10.00 },         // per 1M tokens
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-haiku-3.5': { input: 0.80, output: 4.00 },
  'gemini-2.5-pro': { input: 1.25, output: 10.00 },
  'gemini-2.5-flash': { input: 0.15, output: 0.60 },
  // ... all other models
};

export class CostTracker {
  private sessionCost = 0;

  track(model: string, inputTokens: number, outputTokens: number): CostEntry {
    const pricing = PRICING[model];
    const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
    this.sessionCost += cost;

    if (this.budget && this.sessionCost > this.budget) {
      throw new BudgetExceededError(this.sessionCost, this.budget);
    }

    return { inputTokens, outputTokens, cost, totalSessionCost: this.sessionCost };
  }
}
```

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-3)
1. Initialize monorepo (pnpm, tsconfig, eslint, prettier, vitest)
2. Build `packages/shared` — logger, errors, platform utils
3. Build `packages/providers` — Provider interface + OpenAI adapter (first provider)
4. Build basic `packages/core` — Simple agent loop (no tools yet)
5. Build basic `packages/cli` — Entry point, commander setup
6. Build basic `packages/tui` — Ink app with chat view + streaming text
7. **Milestone: Can chat with OpenAI in the terminal**

### Phase 2: Tool System (Weeks 3-5)
8. Build `packages/tools` — Tool interface + registry
9. Implement core tools: file_read, file_write, file_edit, shell_exec, grep, glob, directory_tree
10. Integrate tools into agent loop (full ReAct cycle)
11. Build `packages/core/permissions` — Permission system with prompts
12. **Milestone: Agent can read/write files and run commands with permission**

### Phase 3: Multi-Provider (Weeks 5-7)
13. Add Anthropic provider adapter
14. Add Google Gemini provider adapter
15. Add Ollama provider adapter (local models)
16. Add remaining providers (Mistral, Groq, DeepSeek, Cohere, Bedrock, Azure)
17. Add OpenAI-compatible generic adapter (covers LM Studio, vLLM, etc.)
18. Implement `/model` and `/provider` slash commands
19. Build provider capability matrix and model switching
20. **Milestone: Can switch between all major providers seamlessly**

### Phase 4: Intelligence Layer (Weeks 7-9)
21. Build `packages/indexer` — Tree-sitter AST parsing
22. Implement repo-map generation (symbol table, function/class index)
23. Build project detector (Node.js, Python, Rust, Go, etc.)
24. Implement context manager with smart truncation + summarization
25. Build session persistence (SQLite memory store)
26. Implement persistent memory across sessions
27. Build git integration tools (diff, commit, branch, status)
28. **Milestone: Agent understands codebases and remembers across sessions**

### Phase 5: Agent Modes & Sub-Agents (Weeks 9-10)
29. Implement agent modes (code, chat, review, plan, debug)
30. Build sub-agent delegation system
31. Implement parallel sub-agent execution
32. Build `/mode` command and mode switching
33. **Milestone: Full multi-mode agent with delegation**

### Phase 6: MCP & Extensibility (Weeks 10-11)
34. Build `packages/mcp` — MCP client (STDIO + HTTP/SSE transport)
35. Implement tool discovery from MCP servers
36. Build `/mcp` command for server management
37. Implement FRIDAY.md + `.friday/rules/` loading
38. **Milestone: External tools work via MCP protocol**

### Phase 7: Polish & Advanced Features (Weeks 11-13)
39. Build cost tracking and `/cost` command
40. Implement theme system with built-in themes
41. Build onboarding wizard (first-run experience)
42. Add slash commands (/help, /clear, /compact, /history, /init, /tools, /update)
43. Implement auto-update notification system
44. Build `packages/i18n` — i18n with English strings extracted
45. Implement accessibility features (screen reader, high contrast, keyboard nav)
46. Rich output: image rendering (sixel/kitty), tables, charts
47. **Milestone: Fully polished, feature-complete CLI**

### Phase 8: SDK & Distribution (Weeks 13-14)
48. Build `packages/sdk` — Programmatic API (@friday/sdk)
49. Implement non-interactive/headless mode for CI/CD
50. Build standalone binary (Node.js SEA)
51. Set up Homebrew formula
52. Set up npm publishing pipeline
53. **Milestone: Available via npm, npx, brew, and binary download**

### Phase 9: IDE Extension (Weeks 14-16)
54. Build VS Code extension scaffolding
55. Implement terminal-based agent in VS Code
56. Add inline suggestion provider
57. Implement code action provider
58. **Milestone: VS Code extension with full agent + inline suggestions**

### Phase 10: Documentation & Community (Weeks 16-17)
59. Build documentation site (Docusaurus/VitePress)
60. Write getting-started guide, configuration reference, provider guides
61. Build interactive playground/demo
62. Set up community infrastructure (issue templates, PR templates, CONTRIBUTING.md, Code of Conduct)
63. Anonymous telemetry implementation
64. **Milestone: Public launch ready**

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | TypeScript | Industry standard for CLI agents |
| Runtime | Node.js | Most stable, widest compatibility |
| TUI | Ink (React) | Used by Claude Code, Gemini CLI, Copilot CLI |
| Package Manager | pnpm | Fast, disk efficient, monorepo support |
| Test Framework | Vitest | Fast, native TS, modern |
| Linting | ESLint + Prettier | Industry standard |
| CI/CD | GitHub Actions | Recommended |
| Database | better-sqlite3 | For session persistence, memory, config |
| MCP | Full client | STDIO + HTTP/SSE transports |
| Agent Pattern | ReAct FSM | THINK → ACT → OBSERVE → TERMINATE |
| Provider Pattern | Factory + Adapter | Single interface, pluggable backends |
| Config Format | JSON | ~/.friday/config.json + .friday/config.json |
| License | MIT | Maximum adoption |

---

## Dependencies (Key Packages)

| Purpose | Package | Why |
|---------|---------|-----|
| TUI Framework | `ink` + `react` | React components for terminal |
| CLI Parser | `commander` | Arg parsing, subcommands |
| Markdown | `marked` + `marked-terminal` | Render markdown in terminal |
| Syntax Highlighting | `shiki` | Code block highlighting |
| Streaming | `eventsource-parser` | Parse SSE streams |
| Database | `better-sqlite3` | Session persistence, memory |
| AST Parsing | `tree-sitter` + grammars | Codebase indexing |
| File Search | `@ripgrep/ripgrep` | Fast code search |
| Git | `simple-git` | Git operations |
| Token Counting | `tiktoken` / `@anthropic-ai/tokenizer` | Accurate token counts |
| Image Rendering | `terminal-image` | Sixel/kitty protocol |
| HTTP Client | `undici` / native fetch | API calls |
| Schema Validation | `zod` | Config + API validation |
| Key Management | `keytar` | OS keychain for API keys |
| i18n | `i18next` | Internationalization |
| Testing | `vitest` | Unit + integration tests |
| Build | `tsup` | Fast TS bundling |
| Monorepo | `turborepo` | Build orchestration |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Provider API changes | Abstract behind interface; version-specific adapters |
| Token limit management | Smart summarization + truncation; user-visible token counter |
| Security (shell execution) | Permission system + workspace scoping + command blocklist |
| Large codebase perf | Tree-sitter incremental parsing; lazy loading; cache |
| MCP server reliability | Timeout handling; graceful degradation if server down |
| Cross-platform compat | CI matrix (macOS, Linux, Windows); platform abstraction layer |
| Contributor complexity | Clear CONTRIBUTING.md; module boundaries; good test coverage |

---

## Success Metrics

1. **Functional parity** with Claude Code's core features
2. **15+ provider support** out of the box
3. **<500ms** startup time
4. **<2s** time to first streamed token
5. **90%+** test coverage on core modules
6. **Seamless** provider switching mid-conversation
7. **Active community** with contributor-friendly architecture
