# fridaycode — Architecture Deep Dive

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Provider Abstraction Layer](#provider-abstraction-layer)
3. [Agent Loop (ReAct State Machine)](#agent-loop-react-state-machine)
4. [Tool System & MCP](#tool-system--mcp)
5. [Context & Memory Management](#context--memory-management)
6. [TUI Architecture](#tui-architecture)
7. [Security Model](#security-model)
8. [Data Flow Diagrams](#data-flow-diagrams)

---

## System Architecture

fridaycode follows a **layered architecture** with three main tiers:

```
┌───────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                         │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │  Ink TUI     │  │  Headless    │  │  SDK API            │ │
│  │  (Interactive)│  │  (CI/CD)     │  │  (Programmatic)     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬──────────────┘ │
├─────────┼─────────────────┼─────────────────┼────────────────┤
│         │      ORCHESTRATION LAYER          │                │
│  ┌──────▼──────────────────▼────────────────▼──────────────┐ │
│  │                  Agent Orchestrator                      │ │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐ │ │
│  │  │  ReAct   │ │  Mode    │ │  Sub-Agent│ │  Session   │ │ │
│  │  │  Loop    │ │  Manager │ │  Delegator│ │  Manager   │ │ │
│  │  └──────────┘ └──────────┘ └───────────┘ └───────────┘ │ │
│  └─────────────────────┬───────────────────────────────────┘ │
├─────────────────────────┼────────────────────────────────────┤
│         SERVICES LAYER  │                                    │
│  ┌──────────────────────▼──────────────────────────────────┐ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ │ │
│  │  │ Provider │ │  Tool    │ │ Context  │ │Permission │ │ │
│  │  │ Manager  │ │ Registry │ │ Manager  │ │ System    │ │ │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────────┘ │ │
│  │  ┌────▼─────┐ ┌────▼─────┐ ┌────▼─────┐ ┌───────────┐ │ │
│  │  │ Cost     │ │  MCP     │ │ Indexer  │ │ Memory    │ │ │
│  │  │ Tracker  │ │  Client  │ │(TreeSit.)│ │ Store     │ │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └───────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│                    INFRASTRUCTURE LAYER                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │  Logger  │ │  Config  │ │  i18n    │ │  Telemetry     │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Design Principles
1. **Separation of Concerns** — Each package owns one domain
2. **Dependency Inversion** — Core depends on interfaces, not implementations
3. **Plugin Architecture** — New providers/tools added without modifying core
4. **Fail Gracefully** — Degrade features, never crash

---

## Provider Abstraction Layer

### Interface Design (Factory + Adapter Pattern)

```
                    ┌─────────────────┐
                    │  LLMProvider    │ (Interface)
                    │  Interface      │
                    ├─────────────────┤
                    │ generate()      │
                    │ stream()        │
                    │ generateWith    │
                    │   Tools()       │
                    │ capabilities()  │
                    │ listModels()    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼───┐  ┌──────▼─────┐  ┌─────▼──────┐
     │  OpenAI    │  │ Anthropic  │  │  Gemini    │  ...
     │  Adapter   │  │ Adapter    │  │  Adapter   │
     └────────────┘  └────────────┘  └────────────┘
```

### Message Normalization

Every provider receives and returns the same types:

```typescript
// Universal message format
interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

// Each adapter translates to/from provider-specific format
// OpenAI: messages[].role + messages[].content
// Anthropic: system is separate, messages[].role + messages[].content
// Gemini: contents[].role + contents[].parts
```

### Provider Capability Matrix

| Provider | Streaming | Tool Calling | Vision | JSON Mode | Max Context |
|----------|-----------|-------------|--------|-----------|-------------|
| OpenAI | ✅ | ✅ | ✅ | ✅ | 128K-200K |
| Anthropic | ✅ | ✅ | ✅ | ✅ | 200K |
| Gemini | ✅ | ✅ | ✅ | ✅ | 1M-2M |
| Ollama | ✅ | ✅* | ✅* | ❌ | varies |
| Mistral | ✅ | ✅ | ✅ | ✅ | 128K |
| Groq | ✅ | ✅ | ❌ | ✅ | 128K |
| DeepSeek | ✅ | ✅ | ❌ | ✅ | 128K |
| Bedrock | ✅ | ✅ | ✅ | ✅ | varies |
| Azure | ✅ | ✅ | ✅ | ✅ | same as OAI |
| Cohere | ✅ | ✅ | ❌ | ✅ | 128K |

*Depends on model

### Model Selection Strategy

```
User says: "use the best model"
  → Check provider capabilities
  → Route to highest-capability model in current provider

User says: "use a fast model"  
  → Route to cheapest/fastest model (e.g., Haiku, Flash, Mini)

User says: "use claude-sonnet-4-20250514"
  → Direct model specification
  → Validate model exists in provider
```

---

## Agent Loop (ReAct State Machine)

### State Machine Definition

```
                         ┌─────────────────────────────────┐
                         │         INITIALIZE              │
                         │  • Load system prompt           │
                         │  • Load FRIDAY.md rules         │
                         │  • Load project context         │
                         │  • Load persistent memory       │
                         └──────────┬──────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
           ┌──────►│           THINK                │
           │       │  • Send history to LLM         │
           │       │  • Include tool definitions    │
           │       │  • Manage token budget         │
           │       └───────────┬────────────────────┘
           │                   │
           │          ┌────────┴────────┐
           │          │                 │
           │    Has tool calls?    No tool calls
           │          │                 │
           │          ▼                 ▼
           │   ┌──────────┐    ┌──────────────┐
           │   │   ACT    │    │  TERMINATE   │
           │   │ For each │    │  • Yield     │
           │   │ tool call│    │    final     │
           │   │ :        │    │    response  │
           │   │ • Check  │    │  • Update    │
           │   │   perms  │    │    memory    │
           │   │ • Execute│    │  • Save      │
           │   │   tool   │    │    session   │
           │   │ • Capture│    └──────────────┘
           │   │   result │
           │   └────┬─────┘
           │        │
           │        ▼
           │   ┌──────────┐
           │   │ OBSERVE  │
           │   │ • Add    │
           │   │   results│
           │   │   to     │
           │   │   history│
           │   │ • Check  │
           │   │   iter   │
           │   │   limit  │
           └───┤          │
               └──────────┘
```

### Event System

The agent loop emits events that the TUI consumes:

```typescript
type AgentEvent =
  | { type: 'thinking'; content: string }          // LLM reasoning text
  | { type: 'streaming'; delta: string }           // Streaming token
  | { type: 'tool_start'; tool: string; args: any } // Tool execution starting
  | { type: 'tool_result'; tool: string; result: ToolResult }
  | { type: 'permission_request'; tool: string; args: any }
  | { type: 'permission_granted' | 'permission_denied' }
  | { type: 'sub_agent_spawn'; task: string }
  | { type: 'sub_agent_result'; result: any }
  | { type: 'response'; content: string }          // Final response
  | { type: 'error'; error: Error }
  | { type: 'cost_update'; cost: CostEntry }
  | { type: 'context_summary'; message: string }   // Context was summarized
```

### Iteration Safety

```
Max iterations: 50 (configurable)
Stuck detection: If same tool called 3x with same args → warn user
Error recovery: Tool failure → report to LLM, let it decide next action
Budget guard: If cost exceeds budget → pause and ask user
```

---

## Tool System & MCP

### Built-in Tool Lifecycle

```
1. Tool Registration (startup)
   ┌──────────────────┐
   │  ToolRegistry    │
   │  .register(tool) │◄── file_read, file_write, shell_exec, ...
   └────────┬─────────┘
            │
2. Tool Discovery (agent loop)
            │
   ┌────────▼─────────┐
   │  getDefinitions() │──► JSON Schema for LLM tool calling
   └────────┬─────────┘
            │
3. Tool Execution (agent acts)
            │
   ┌────────▼─────────┐     ┌──────────────┐
   │  execute(name,   │────►│  Permission  │──► allow/deny/prompt
   │    args)         │     │  System      │
   └────────┬─────────┘     └──────────────┘
            │
   ┌────────▼─────────┐
   │  Tool.execute()  │──► ToolResult { success, output }
   └──────────────────┘
```

### MCP Integration Architecture

```
fridaycode (MCP Client)
    │
    ├── STDIO Transport ──► Local MCP Server (subprocess)
    │   (spawn process,      e.g., filesystem, database
    │    communicate via
    │    stdin/stdout)
    │
    └── HTTP/SSE Transport ──► Remote MCP Server
        (HTTP POST for         e.g., cloud APIs,
         requests, SSE         SaaS integrations
         for streaming)

Tool Discovery Flow:
1. On startup, read MCP server configs from ~/.friday/config.json
2. For each server: connect transport → send initialize → list_tools
3. Merge MCP tools into ToolRegistry alongside built-in tools
4. LLM sees unified tool list (doesn't know MCP vs built-in)
```

---

## Context & Memory Management

### Token Budget Strategy

```
Total Context Window (e.g., 128K tokens)
├── System Prompt (fixed)                    ~2K tokens
├── FRIDAY.md + Rules (fixed per project)    ~1K tokens
├── Repo Map / Code Context (dynamic)        ~5-10K tokens
├── Persistent Memory (dynamic)              ~1K tokens
├── Conversation History                     ~remaining
│   ├── Recent messages (always kept)        last 10 messages
│   └── Older messages (summarized)          compressed
└── Reserved for Response                    4K tokens
```

### Summarization Pipeline

```
Full History: [msg1, msg2, msg3, ..., msg50, msg51, ..., msg60]
                                              ▲
                                              │ keep intact
                    ┌─────────────────────────┘
                    │
              ┌─────┴──────┐
              │ Summarizer │
              │ (uses LLM) │
              └─────┬──────┘
                    │
Old messages ───────┘
[msg1..msg50] → "Summary: User asked to refactor auth module.
                 We modified src/auth.ts, src/middleware.ts.
                 Added JWT validation. Tests pass."
```

### Persistent Memory (SQLite)

```sql
-- Sessions table
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  project_path TEXT,
  messages TEXT,        -- JSON blob
  summary TEXT,
  created_at DATETIME,
  updated_at DATETIME
);

-- Cross-session memory
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  project_path TEXT,    -- NULL = global memory
  key TEXT,
  value TEXT,
  created_at DATETIME
);

-- Indexed facts about the codebase
CREATE TABLE codebase_facts (
  id TEXT PRIMARY KEY,
  project_path TEXT,
  fact_type TEXT,       -- 'architecture', 'convention', 'dependency'
  content TEXT,
  source TEXT,          -- where this was learned
  created_at DATETIME
);
```

---

## TUI Architecture

### Component Tree

```
<App>
  ├── <ThemeProvider theme={currentTheme}>
  │   ├── <Header>
  │   │   ├── <Logo /> (fridaycode branding)
  │   │   ├── <ModelIndicator /> (current model/provider)
  │   │   └── <ModeIndicator /> (current mode)
  │   │
  │   ├── <ChatView>
  │   │   ├── <MessageList>
  │   │   │   ├── <MessageBubble role="user" />
  │   │   │   ├── <MessageBubble role="assistant">
  │   │   │   │   ├── <StreamingText /> (real-time tokens)
  │   │   │   │   ├── <MarkdownRenderer />
  │   │   │   │   │   ├── <CodeBlock language="ts" />
  │   │   │   │   │   ├── <Table />
  │   │   │   │   │   └── <ImageRenderer />
  │   │   │   │   └── <DiffView />
  │   │   │   ├── <ToolOutput tool="shell_exec" />
  │   │   │   └── <PermissionPrompt />
  │   │   └── <ScrollIndicator />
  │   │
  │   ├── <InputBox>
  │   │   ├── <TextInput /> (user typing)
  │   │   └── <SlashCommandAutocomplete />
  │   │
  │   └── <StatusBar>
  │       ├── <CostIndicator />
  │       ├── <TokenCounter />
  │       ├── <Spinner /> (when agent is working)
  │       └── <KeyboardShortcuts />
  │
  └── <AccessibilityLayer />
```

### Theme System

```typescript
interface FridayTheme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    error: string;
    warning: string;
    success: string;
    muted: string;
    border: string;
    // Semantic
    userMessage: string;
    assistantMessage: string;
    toolOutput: string;
    codeBlock: string;
    diff: { added: string; removed: string; };
  };
  borders: {
    style: 'single' | 'double' | 'round' | 'bold';
  };
  icons: {
    thinking: string;    // e.g., '🤔' or '⏳'
    success: string;     // e.g., '✅' or '✓'
    error: string;       // e.g., '❌' or '✗'
    warning: string;     // e.g., '⚠️' or '!'
    tool: string;        // e.g., '🔧' or '⚙'
  };
}
```

---

## Security Model

### Permission Tiers

```
Tier 1: AUTO-ALLOW (no prompt)
  ├── Read files in workspace
  ├── List directory contents
  ├── Search/grep in workspace
  ├── Git status/diff/log (read-only)
  └── View project structure

Tier 2: PROMPT (ask user)
  ├── Write/modify files
  ├── Create new files
  ├── Execute shell commands
  ├── Git commit/push/branch
  ├── Network requests (fetch URLs)
  └── Install packages (npm/pip/etc.)

Tier 3: ALWAYS-DENY (blocked)
  ├── Access files outside workspace
  ├── Run as sudo/root
  ├── Modify system files (/etc, ~/)
  ├── Delete critical files
  └── Exfiltrate data to external URLs
```

### Permission Decision Flow

```
Tool Call Received
      │
      ▼
┌─────────────┐     ┌───────────┐
│ Match Rules │────►│ AUTO-     │──► Execute
│ (tier 1?)   │ yes │ ALLOW     │
└──────┬──────┘     └───────────┘
       │ no
       ▼
┌─────────────┐     ┌───────────┐
│ Match Rules │────►│ ALWAYS-   │──► Block + notify
│ (tier 3?)   │ yes │ DENY      │
└──────┬──────┘     └───────────┘
       │ no
       ▼
┌─────────────┐     ┌───────────┐
│ Check       │────►│ Execute   │
│ always-allow│ yes │ (cached)  │
│ cache?      │     └───────────┘
└──────┬──────┘
       │ no
       ▼
┌─────────────┐
│ PROMPT USER │
│ [Allow]     │
│ [Allow All] │──► Cache + Execute
│ [Deny]      │──► Block
└─────────────┘
```

---

## Data Flow Diagrams

### Complete Request Flow

```
User types message
      │
      ▼
┌──────────┐  slash cmd?  ┌──────────────┐
│  InputBox │────────────►│ SlashCommand │──► Execute directly
└─────┬────┘              │ Handler      │
      │ regular message   └──────────────┘
      ▼
┌──────────┐
│  Agent   │
│  Loop    │
│  .run()  │
└─────┬────┘
      │
      ▼
┌──────────────┐
│ Context      │
│ Manager      │
│ .prepare()   │──► Token counting, summarization, context packing
└─────┬────────┘
      │
      ▼
┌──────────────┐
│ Provider     │
│ Manager      │
│ .stream()    │──► API call to LLM provider
└─────┬────────┘
      │
      ▼ (streaming response)
┌──────────────┐
│ Response     │
│ Parser       │──► Detect text vs tool calls
└─────┬────────┘
      │
      ├── Text tokens ──► TUI StreamingText component
      │
      └── Tool calls ──► Permission System ──► Tool Registry ──► Execute
                                                                    │
                                                              ToolResult
                                                                    │
                                                              Back to THINK
```

### Configuration Loading Flow

```
CLI starts
    │
    ▼
┌──────────────────┐
│ Load defaults    │ (packages/cli/src/config/defaults.ts)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Load global      │ (~/.friday/config.json)
│ config           │ Merge over defaults
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Load project     │ (.friday/config.json)
│ config           │ Merge over global
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Load env vars    │ (FRIDAY_API_KEY, FRIDAY_MODEL, etc.)
│                  │ Override specific values
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Apply CLI flags  │ (--model, --provider, etc.)
│                  │ Highest precedence
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Validate with    │ (Zod schema validation)
│ schema           │
└────────┬─────────┘
         │
         ▼
   Final Config Object
```
