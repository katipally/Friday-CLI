# FridayCode — Architecture Plan

## Plan: Open-Source Agentic Coding CLI (Full Claude Code Parity)

**TL;DR**: Build FridayCode as a TypeScript monorepo using Ink (React for terminal) + raw ANSI for the spider mascot. Full Claude Code feature parity with model-agnostic provider layer (Ollama, Anthropic, OpenAI, OpenAI-compatible). Distributed via npm as `friday` CLI. MIT licensed.

---

## Monorepo Structure

```
fridaycode/
├── packages/
│   ├── core/              # Provider abstraction, tool system, agent engine
│   │   ├── src/
│   │   │   ├── providers/       # Model provider adapters
│   │   │   │   ├── base.ts            # Abstract ModelProvider interface
│   │   │   │   ├── ollama.ts          # Ollama adapter (GET /api/tags, POST /api/chat)
│   │   │   │   ├── anthropic.ts       # Anthropic adapter (Messages API)
│   │   │   │   ├── openai.ts          # OpenAI adapter (Chat Completions)
│   │   │   │   └── openai-compat.ts   # Generic OpenAI-compatible adapter
│   │   │   ├── tools/           # All 25+ tool implementations
│   │   │   │   ├── registry.ts        # Tool registry + ToolSearch
│   │   │   │   ├── bash.ts            # Shell execution (child_process)
│   │   │   │   ├── read.ts            # File reading
│   │   │   │   ├── write.ts           # File creation/overwrite
│   │   │   │   ├── edit.ts            # Targeted file edits
│   │   │   │   ├── glob.ts            # File pattern matching
│   │   │   │   ├── grep.ts            # Content search (ripgrep or native)
│   │   │   │   ├── agent.ts           # Subagent spawning (foreground)
│   │   │   │   ├── task-*.ts          # TaskCreate/Get/List/Stop/Update
│   │   │   │   ├── web-fetch.ts       # URL fetching
│   │   │   │   ├── web-search.ts      # Web search
│   │   │   │   ├── ask-user.ts        # Interactive questions
│   │   │   │   ├── todo-write.ts      # Session task checklist
│   │   │   │   ├── cron-*.ts          # CronCreate/Delete/List
│   │   │   │   ├── lsp.ts             # Language Server Protocol
│   │   │   │   ├── mcp.ts             # MCP resource tools
│   │   │   │   ├── notebook-edit.ts   # Jupyter notebook edits
│   │   │   │   ├── skill.ts           # Skill invocation
│   │   │   │   └── send-message.ts    # Resume background agent
│   │   │   ├── agents/          # Subagent engine
│   │   │   │   ├── engine.ts          # Agent lifecycle manager
│   │   │   │   ├── context.ts         # Context window management + compaction
│   │   │   │   ├── worktree.ts        # Git worktree isolation
│   │   │   │   └── built-in/          # Explore, Plan, General-purpose agents
│   │   │   ├── skills/          # Skills engine
│   │   │   │   ├── loader.ts          # SKILL.md parser (YAML frontmatter + MD body)
│   │   │   │   ├── runner.ts          # Skill execution with $ARGUMENTS substitution
│   │   │   │   └── built-in/          # /batch, /debug, /loop, /simplify
│   │   │   ├── plugins/         # Plugin system
│   │   │   │   ├── loader.ts          # Plugin discovery + manifest parsing
│   │   │   │   ├── registry.ts        # Namespaced resource registry
│   │   │   │   └── lifecycle.ts       # Activation/deactivation/reload
│   │   │   ├── memory/          # Memory system
│   │   │   │   ├── friday-md.ts       # FRIDAY.md loader (project/user/org scopes)
│   │   │   │   ├── auto-memory.ts     # AI-written learnings persistence
│   │   │   │   └── rules.ts           # .friday/rules/ path-scoped rules
│   │   │   ├── session/         # Session management
│   │   │   │   ├── manager.ts         # Create/resume/fork/rewind sessions
│   │   │   │   ├── transcript.ts      # JSONL transcript persistence
│   │   │   │   └── compaction.ts      # Context summarization
│   │   │   ├── settings/        # Settings system
│   │   │   │   ├── loader.ts          # 4-scope settings merge (managed > local > project > user)
│   │   │   │   ├── schema.ts          # Settings schema + validation
│   │   │   │   └── permissions.ts     # 3-mode permission engine (default/acceptAll/plan)
│   │   │   ├── hooks/           # Hook system
│   │   │   │   ├── engine.ts          # Event dispatch + matcher
│   │   │   │   └── events.ts          # PreToolUse, PostToolUse, Stop, SessionStart, etc.
│   │   │   ├── git/             # Git integration
│   │   │   │   ├── worktree.ts        # Worktree create/remove
│   │   │   │   ├── attribution.ts     # Commit attribution
│   │   │   │   ├── branch.ts          # Branch-aware sessions
│   │   │   │   └── pr.ts             # PR review features
│   │   │   └── telemetry/       # Opt-in anonymous stats
│   │   │       └── collector.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── cli/               # Terminal UI + command routing
│   │   ├── src/
│   │   │   ├── index.ts         # Entry point: `friday` command
│   │   │   ├── app.tsx          # Root Ink component
│   │   │   ├── components/      # Ink React components
│   │   │   │   ├── Prompt.tsx         # Input area with vim mode
│   │   │   │   ├── Output.tsx         # AI response renderer (markdown)
│   │   │   │   ├── StatusBar.tsx      # Bottom status line
│   │   │   │   ├── TaskList.tsx       # Background task panel (Ctrl+T)
│   │   │   │   ├── DiffViewer.tsx     # Interactive diff display
│   │   │   │   ├── ModelSwitcher.tsx  # Model selection UI
│   │   │   │   ├── PermissionPrompt.tsx # Tool permission dialogs
│   │   │   │   ├── SettingsUI.tsx     # Interactive settings editor
│   │   │   │   └── ContextViewer.tsx  # Context usage visualization
│   │   │   ├── mascot/          # Spider "Friday" — raw ANSI
│   │   │   │   ├── renderer.ts        # ASCII art rendering engine
│   │   │   │   ├── expressions.ts     # 7 expression states
│   │   │   │   ├── animations.ts      # Web-spinning, crawling, blinking
│   │   │   │   ├── welcome.ts         # Large welcome screen spider
│   │   │   │   └── prompt-spider.ts   # Small prompt-area spider
│   │   │   ├── themes/          # Theming system
│   │   │   │   ├── engine.ts          # Theme loader + switcher
│   │   │   │   ├── dark.ts            # Dark theme (default)
│   │   │   │   └── light.ts           # Light theme
│   │   │   ├── input/           # Input handling
│   │   │   │   ├── vim-mode.ts        # Full vi keybindings
│   │   │   │   ├── readline.ts        # Standard readline editing
│   │   │   │   ├── history.ts         # Command history + reverse search
│   │   │   │   └── completion.ts      # Tab completion (commands, files)
│   │   │   ├── commands/        # Slash command handlers
│   │   │   │   ├── router.ts          # Command parser + dispatch
│   │   │   │   └── [50+ command files matching Claude Code's list]
│   │   │   └── onboarding/      # First-run experience
│   │   │       └── wizard.ts          # Provider selection + API key setup
│   │   ├── bin/
│   │   │   └── friday.ts         # CLI entry (#!/usr/bin/env node)
│   │   ├── package.json          # name: "fridaycode", bin: { "friday": "..." }
│   │   └── tsconfig.json
│   │
│   └── shared/            # Shared types, utils, constants
│       ├── src/
│       │   ├── types.ts         # Message, Tool, Model, Provider, Session interfaces
│       │   ├── constants.ts     # Color palette, ANSI codes, defaults
│       │   └── utils.ts         # Path helpers, YAML parsing, etc.
│       └── package.json
│
├── plugins/               # First-party plugins (shipped separately)
│   └── code-review/
│       └── .friday-plugin/
│
├── .github/
│   └── workflows/
│       ├── ci.yml              # Lint + test on every PR
│       ├── release.yml         # npm publish on tag
│       └── e2e.yml             # End-to-end tests
│
├── Ref_files/             # Research docs (current)
├── package.json           # Root workspace config
├── tsconfig.base.json     # Shared TypeScript config
├── vitest.config.ts       # Test configuration
├── .eslintrc.js           # Linting
├── .prettierrc            # Formatting
├── FRIDAY.md              # Project memory file
├── LICENSE                # MIT
└── README.md
```

---

## Phase 1: Foundation (Steps 1-6)

### Step 1: Project Scaffolding
- Initialize monorepo with npm workspaces
- Create `packages/core`, `packages/cli`, `packages/shared`
- Set up TypeScript configs (base + per-package)
- Set up ESLint, Prettier, Vitest
- Create GitHub Actions CI workflow
- **Files**: Root `package.json`, `tsconfig.base.json`, per-package configs

### Step 2: Shared Types & Constants
- Define all core interfaces: `ModelProvider`, `Tool`, `Message`, `Session`, `Agent`, `Skill`, `Plugin`, `Settings`
- Define color palette as ANSI constants
- Utility functions for YAML frontmatter parsing, path resolution
- **Files**: `packages/shared/src/types.ts`, `constants.ts`, `utils.ts`

### Step 3: Provider Abstraction Layer
- Abstract `ModelProvider` interface with: `listModels()`, `chat()`, `supportsToolUse()`, `supportsStreaming()`
- Ollama adapter: `/api/tags` for models, `/api/chat` for completion, streaming SSE
- Anthropic adapter: Messages API with `x-api-key`, extended thinking support
- OpenAI adapter: Chat Completions with function calling
- OpenAI-compatible adapter: Configurable base URL, same interface as OpenAI
- Live model fetching with caching (5-min TTL)
- Tool use format translation layer (Anthropic format ↔ OpenAI format)
- **Files**: `packages/core/src/providers/*.ts`
- **Tests**: Unit tests for each provider with mocked HTTP, format translation tests

### Step 4: Settings System
- 4-scope settings loader: managed > local (.friday/local-settings.json) > project (.friday/settings.json) > user (~/.friday/settings.json)
- Settings schema with validation (Zod)
- Permission engine: 3 modes (default, acceptAll, plan)
- Permission rules: allow/deny patterns per tool (e.g., `Bash(git*)`)
- Config file watcher for live reload
- **Files**: `packages/core/src/settings/*.ts`
- **Tests**: Scope merging, permission matching, validation

### Step 5: Memory System
- FRIDAY.md loader: project root, .friday/, user ~/.friday/, imports via @path syntax
- Auto-memory: AI-written learnings to ~/.friday/projects/<project>/memory/MEMORY.md
- Rules system: .friday/rules/ directory with path-scoped rules (YAML frontmatter with `paths`)
- **Files**: `packages/core/src/memory/*.ts`
- **Tests**: Import resolution, path scoping, scope precedence

### Step 6: Session Management
- Session create/resume/fork/rewind
- JSONL transcript persistence (~/.friday/projects/<project>/sessions/)
- Context window tracking and auto-compaction
- Named sessions, branch-aware filtering
- **Files**: `packages/core/src/session/*.ts`
- **Tests**: Transcript read/write, fork/rewind state management

---

## Phase 2: Tool Engine (Steps 7-9) — *depends on Phase 1*

### Step 7: Tool Registry & Core Tools
- Tool registry with deferred loading (ToolSearch)
- Permission checking before tool execution (hooks into settings)
- Implement core tools:
  - **Bash**: child_process.spawn with streaming stdout/stderr, timeout, Ctrl+C
  - **Read**: fs.readFile with line range support
  - **Write**: fs.writeFile with directory creation
  - **Edit**: Targeted string replacement with context matching
  - **Glob**: fast-glob for pattern matching
  - **Grep**: ripgrep (if available) or native regex search
  - **WebFetch**: node-fetch with content extraction (HTML → text)
  - **WebSearch**: Provider-dependent (API or scraping)
  - **AskUserQuestion**: Ink component for interactive Q/A
  - **TodoWrite**: Session-scoped task checklist
- **Files**: `packages/core/src/tools/*.ts`
- **Tests**: Each tool individually, permission integration

### Step 8: Advanced Tools
- **CronCreate/Delete/List**: node-cron for scheduled prompts
- **LSP**: Language Server Protocol client (vscode-languageclient)
- **MCP**: MCP client for external server resources (ListMcpResources, ReadMcpResource)
- **NotebookEdit**: Jupyter .ipynb JSON manipulation
- **Skill**: Skill invocation tool (delegates to skills engine)
- **Files**: `packages/core/src/tools/*.ts`

### Step 9: Hook System
- Event-driven hook dispatch: PreToolUse, PostToolUse, Stop, SessionStart, SubagentStart/Stop, Notification, InstructionsLoaded
- Matcher system for targeting specific tools
- Command hooks (shell execution) and HTTP hooks (fetch)
- Timeout handling for hook execution
- **Files**: `packages/core/src/hooks/*.ts`
- **Tests**: Event dispatch, matcher logic, timeout behavior

---

## Phase 3: Agent Engine (Steps 10-11) — *depends on Phase 2*

### Step 10: Subagent System
- Agent engine: spawn independent AI instances with their own context windows
- Foreground agents: blocking, parent waits for result
- Background agents: non-blocking, managed via TaskCreate/Get/List/Stop/Update
- SendMessage for resuming background agents
- Agent definition loader: Markdown + YAML frontmatter from .friday/agents/ and ~/.friday/agents/
- Built-in agents: Explore (read-only, fast model), Plan (configurable), General-purpose
- Per-agent model override, tool whitelisting/blacklisting, maxTurns
- Auto-compaction at 95% context capacity
- Transcript persistence for all subagent conversations
- **Files**: `packages/core/src/agents/*.ts`
- **Tests**: Lifecycle management, context limits, tool restrictions

### Step 11: Git Integration + Worktrees
- Git worktree creation/removal for subagent isolation
- Commit attribution (AI-generated code tagging)
- Branch-aware session filtering
- PR review: fetch PR comments, diff analysis, security review
- EnterWorktree/ExitWorktree tools
- **Files**: `packages/core/src/git/*.ts`
- **Tests**: Worktree lifecycle, attribution formatting

---

## Phase 4: Skills & Plugins (Steps 12-13) — *depends on Phase 3*

### Step 12: Skills Engine
- SKILL.md parser: YAML frontmatter (name, description, allowed-tools, model, effort, context, agent, hooks, paths, shell) + Markdown body
- $ARGUMENTS substitution in skill body
- Skill locations: CLI flag > .friday/skills/ > ~/.friday/skills/ > plugin skills
- Built-in skills: /batch (parallel subagents), /debug, /loop, /simplify
- `context: fork` support (run in isolated subagent)
- **Files**: `packages/core/src/skills/*.ts`
- **Tests**: YAML parsing, argument substitution, skill resolution order

### Step 13: Plugin System
- Plugin manifest: .friday-plugin/plugin.json
- Plugin discovery from project and user directories
- Namespaced resources (plugin-name:skill-name, plugin-name:agent-name)
- Plugin lifecycle: discover → load → activate → runtime → deactivate → reload
- MCP/LSP server management per plugin
- /plugin and /reload-plugins commands
- **Files**: `packages/core/src/plugins/*.ts`
- **Tests**: Manifest validation, namespace conflicts, lifecycle

---

## Phase 5: Terminal UI (Steps 14-18) — *parallel with Phases 2-4 for some components*

### Step 14: CLI Entry + Ink App Shell
- `friday` CLI entry point with commander.js or yargs
- CLI flags: --model, --provider, --agent, --skill, --session, --resume, -p (pipe mode), --json, --max-turns, --max-budget
- Root Ink App component with layout: output area + status bar + prompt
- Pipe mode: `cat file | friday -p "query"` with text/json/stream-json output
- **Files**: `packages/cli/src/index.ts`, `app.tsx`, `bin/friday.ts`

### Step 15: Spider Mascot "Friday"
- Raw ANSI rendering engine (bypasses Ink for precise character placement)
- 7 expression states: idle (- -), thinking (• •), success (^ ^), error (O O), working (> <), greeting (◕ ◕), confused (? ?)
- Large welcome screen spider (8-12 lines, Unicode box-drawing + braille)
- Small prompt spider (3 lines, changes with state)
- Animations: web-spinning (thinking), blinking (idle), crawling (loading)
- `prefersReducedMotion` setting disables animations
- Unicode fallback detection for basic ASCII terminals
- **Files**: `packages/cli/src/mascot/*.ts`
- **Tests**: Expression rendering, animation frames, fallback detection

### Step 16: Input System
- Full vim mode: Normal/Insert/Visual, hjkl, i/a/o, dd, yy, p, :w (submit), Esc
- Standard readline mode: Ctrl+A/E, Ctrl+W, Ctrl+U, Ctrl+K
- Command history with persistence (~/.friday/history)
- Reverse search (Ctrl+R)
- Tab completion: slash commands, file paths, model names
- Multi-line input, Ctrl+Enter or configurable submit key
- !bash mode for direct shell execution
- **Files**: `packages/cli/src/input/*.ts`
- **Tests**: Vim mode state machine, completion logic, history persistence

### Step 17: Slash Command Router
- Command parser: `/command arg1 arg2` → handler dispatch
- All 50+ commands from Claude Code adapted for FridayCode
- Key commands: /model, /provider, /compact, /fork, /rewind, /export, /diff, /cost, /permissions, /config, /memory, /skills, /agents, /plugin, /mcp, /theme, /vim, /status, /help, /init, /resume, /clear, /context
- FridayCode-specific: /provider (switch provider), /pull (Ollama model download)
- **Files**: `packages/cli/src/commands/*.ts`

### Step 18: UI Components
- **Output.tsx**: Markdown rendering (code blocks, tables, lists) with syntax highlighting
- **StatusBar.tsx**: Model, provider, tokens, cost, session, git branch
- **TaskList.tsx**: Background agent panel (Ctrl+T toggle)
- **DiffViewer.tsx**: Interactive diff with approve/reject per hunk
- **ModelSwitcher.tsx**: Provider-grouped model selection with fuzzy search
- **PermissionPrompt.tsx**: Tool permission dialogs with Shift+Tab cycling
- **ContextViewer.tsx**: Context usage breakdown visualization
- **SettingsUI.tsx**: Interactive settings editor
- **Theming**: Dark + Light themes using color palette constants
- **Files**: `packages/cli/src/components/*.tsx`, `packages/cli/src/themes/*.ts`

---

## Phase 6: Onboarding & Polish (Steps 19-21) — *depends on all above*

### Step 19: First-Run Onboarding Wizard
- Detect first run (no ~/.friday/ exists)
- Welcome screen with large Friday spider
- Provider selection: show available providers, test connections
- API key entry for cloud providers
- Ollama auto-detection (check localhost:11434)
- Model selection from live-fetched list
- Create ~/.friday/config.json and ~/.friday/settings.json
- **Files**: `packages/cli/src/onboarding/wizard.ts`

### Step 20: Telemetry (Opt-in)
- Anonymous usage stats: command frequency, model usage, error rates, session duration
- Explicit opt-in during onboarding or via /config
- No PII, no code content, no prompts
- **Files**: `packages/core/src/telemetry/collector.ts`

### Step 21: Documentation & README
- Comprehensive README.md with installation, quickstart, features
- API documentation for plugin/skill/agent authors
- Contributing guide
- **Files**: Root `README.md`, `CONTRIBUTING.md`, `docs/`

---

## Phase 7: Testing & Release (Steps 22-24) — *depends on all above*

### Step 22: Unit Tests (80%+ coverage)
- Every tool: mocked filesystem, child_process, HTTP
- Every provider: mocked API responses, streaming
- Settings: scope merging, permission matching
- Session: transcript persistence, fork/rewind
- Skills/Plugins: YAML parsing, lifecycle
- **Framework**: Vitest

### Step 23: Integration Tests
- Provider → Tool → Agent pipeline end-to-end
- Session lifecycle: create → tools → compact → fork → resume
- Plugin load → skill invoke → agent spawn chain
- Git integration with test repos

### Step 24: E2E Tests + Release
- Full CLI interaction tests (spawn process, send input, assert output)
- GitHub Actions: CI on PR, release on tag
- npm publish workflow
- Changelog generation

---

## Key Dependencies

| Package | Purpose |
|---------|---------|
| ink + react | Terminal UI framework |
| @anthropic-ai/sdk | Anthropic API |
| openai | OpenAI API |
| ollama | Ollama API |
| commander/yargs | CLI argument parsing |
| zod | Settings schema validation |
| fast-glob | File pattern matching |
| gray-matter | YAML frontmatter parsing |
| marked/marked-terminal | Markdown rendering |
| chalk | ANSI color support |
| node-pty | PTY for bash tool (interactive commands) |
| simple-git | Git operations |
| vitest | Testing |
| @vscode/lsp-client | LSP integration |
| @modelcontextprotocol/sdk | MCP client |

---

## Verification Plan

1. **Unit tests**: `npm test` — 80%+ coverage across all packages
2. **Lint**: `npm run lint` — zero warnings
3. **Type check**: `npm run typecheck` — zero errors
4. **E2E smoke test**: `friday --help` exits cleanly, `echo "hello" | friday -p "echo back"` responds
5. **Provider test**: Each provider connects and lists models (requires API keys / running Ollama)
6. **Tool test**: Each tool executes in a sandboxed test directory
7. **Spider test**: Mascot renders correctly in 80-column and 120-column terminals
8. **Theme test**: Dark and light themes render without color clashes
9. **Cross-platform**: CI runs on ubuntu-latest, macos-latest, windows-latest
10. **npm publish dry-run**: `npm pack` produces valid tarball

---

## Scope Boundaries

### Included in v1
- All 25+ tools matching Claude Code
- 4 model providers (Ollama, Anthropic, OpenAI, OpenAI-compatible)
- Full subagent system (foreground + background)
- Skills + Plugins
- Full conversation management (fork, rewind, compact, export, resume)
- Git integration (worktrees, attribution, PR review)
- Spider mascot "Friday" with 7 expressions + animations
- Vim mode, Dark + Light themes
- 50+ slash commands
- Settings system (4 scopes)
- Hook system
- Memory system (FRIDAY.md + auto-memory + rules)
- npm distribution
- Full test suite + GitHub Actions CI

### Excluded from v1 (future)
- Voice input (push-to-talk)
- Image paste/analysis
- Web UI mode
- IDE extensions (VS Code, JetBrains)
- Colorblind-accessible themes (v2)
- Plugin marketplace/registry
- Docker distribution
- brew/curl installers
- Enterprise managed settings (MDM)
- Slack/Discord/Telegram integrations
- Chrome browser integration
- Remote control from web
