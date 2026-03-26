# Claude Code Feature Audit (as of March 2026)

## Overview
Claude Code is an agentic coding tool (v2.1.84, 83.2k GitHub stars) that lives in the terminal, understands codebases, and helps code faster via natural language. Available in terminal, VS Code, JetBrains, Desktop app, and Web.

---

## CORE TOOLS (Built-in tools available to the AI)

| Tool | Purpose | Requires Permission |
|------|---------|-------------------|
| **Agent** | Spawns a subagent with its own context window | No |
| **AskUserQuestion** | Asks multiple-choice questions to gather requirements | No |
| **Bash** | Executes shell commands | Yes |
| **CronCreate** | Schedules recurring prompts within session | No |
| **CronDelete** | Cancels a scheduled task | No |
| **CronList** | Lists scheduled tasks | No |
| **Edit** | Makes targeted edits to specific files | Yes |
| **EnterPlanMode** | Switches to plan mode | No |
| **EnterWorktree** | Creates isolated git worktree | No |
| **ExitPlanMode** | Presents plan for approval | Yes |
| **ExitWorktree** | Exits worktree session | No |
| **Glob** | Finds files by pattern matching | No |
| **Grep** | Searches patterns in file contents | No |
| **ListMcpResourcesTool** | Lists MCP server resources | No |
| **LSP** | Code intelligence via language servers | No |
| **NotebookEdit** | Modifies Jupyter notebook cells | Yes |
| **PowerShell** | Executes PowerShell commands (Windows) | Yes |
| **Read** | Reads file contents | No |
| **ReadMcpResourceTool** | Reads MCP resource by URI | No |
| **Skill** | Executes a skill in main conversation | Yes |
| **TaskCreate** | Creates task in task list | No |
| **TaskGet** | Retrieves task details | No |
| **TaskList** | Lists all tasks with status | No |
| **TaskOutput** | Retrieves background task output (deprecated) | No |
| **TaskStop** | Kills background task | No |
| **TaskUpdate** | Updates task status/details | No |
| **TodoWrite** | Manages session task checklist (non-interactive) | No |
| **ToolSearch** | Searches for/loads deferred tools | No |
| **WebFetch** | Fetches content from URLs | Yes |
| **WebSearch** | Performs web searches | Yes |
| **Write** | Creates or overwrites files | Yes |

---

## BUILT-IN SLASH COMMANDS

| Command | Purpose |
|---------|---------|
| /add-dir | Add working directory to session |
| /agents | Manage agent configurations |
| /btw | Quick side question (ephemeral, no tool access) |
| /chrome | Configure Chrome integration |
| /clear | Clear conversation, free context. Aliases: /reset, /new |
| /color | Set prompt bar color |
| /compact | Compact conversation with optional focus |
| /config | Open Settings interface. Alias: /settings |
| /context | Visualize current context usage |
| /copy | Copy last response to clipboard |
| /cost | Show token usage statistics |
| /desktop | Continue session in Desktop app |
| /diff | Interactive diff viewer |
| /doctor | Diagnose installation and settings |
| /effort | Set model effort level (low/medium/high/max/auto) |
| /exit | Exit CLI. Alias: /quit |
| /export | Export conversation as plain text |
| /extra-usage | Configure extra usage for rate limits |
| /fast | Toggle fast mode |
| /feedback | Submit feedback. Alias: /bug |
| /branch | Branch conversation. Alias: /fork |
| /help | Show help |
| /hooks | View hook configurations |
| /ide | Manage IDE integrations |
| /init | Initialize project with CLAUDE.md |
| /insights | Generate usage report |
| /install-github-app | Set up GitHub Actions integration |
| /install-slack-app | Install Slack app |
| /keybindings | Open keybindings config |
| /login | Sign in |
| /logout | Sign out |
| /mcp | Manage MCP server connections |
| /memory | Edit CLAUDE.md memory files |
| /mobile | QR code for mobile app |
| /model | Select/change AI model |
| /passes | Share free week |
| /permissions | View/update permissions |
| /plan | Enter plan mode with optional description |
| /plugin | Manage plugins |
| /pr-comments | Fetch GitHub PR comments |
| /privacy-settings | View/update privacy settings |
| /release-notes | View changelog |
| /reload-plugins | Reload active plugins |
| /remote-control | Make session available for remote control |
| /remote-env | Configure remote environment |
| /rename | Rename session |
| /resume | Resume session. Alias: /continue |
| /review | Deprecated - use code-review plugin |
| /rewind | Rewind conversation/code. Alias: /checkpoint |
| /sandbox | Toggle sandbox mode |
| /schedule | Create/manage cloud scheduled tasks |
| /security-review | Analyze changes for security vulnerabilities |
| /skills | List available skills |
| /stats | Visualize usage stats |
| /status | Show version, model, account info |
| /statusline | Configure status line |
| /stickers | Order stickers |
| /tasks | List/manage background tasks |
| /terminal-setup | Configure terminal keybindings |
| /theme | Change color theme |
| /upgrade | Open upgrade page |
| /usage | Show plan usage limits |
| /vim | Toggle Vim editing mode |
| /voice | Toggle push-to-talk voice dictation |

---

## BUNDLED SKILLS (Prompt-based, can spawn agents)

| Skill | Purpose |
|-------|---------|
| /batch | Orchestrate large-scale parallel changes across codebase |
| /claude-api | Load Claude API reference material |
| /debug | Enable debug logging and troubleshoot |
| /loop | Run prompt repeatedly on interval |
| /simplify | Review changed files for quality, fix issues |

---

## BUILT-IN SUBAGENTS

| Agent | Purpose | Model |
|-------|---------|-------|
| **Explore** | Fast read-only codebase exploration | Haiku (fast) |
| **Plan** | Design approach before coding | Configurable |
| **General-purpose** | Default for delegated tasks | Configurable |

---

## KEY FEATURES

### 1. Memory System
- **CLAUDE.md files**: User-written persistent instructions (project, user, org levels)
- **Auto Memory**: Claude-written learnings (~/.claude/projects/<project>/memory/)
- **Rules system**: .claude/rules/ with path-specific scoping
- **Imports**: @path/to/file syntax for referencing other files
- **AGENTS.md**: Compatibility with other tools

### 2. Subagent System
- Custom subagents as Markdown + YAML frontmatter
- Scopes: CLI flag > project > user > plugin
- Fields: name, description, tools, disallowedTools, model, permissionMode, maxTurns, skills, mcpServers, hooks, memory, background, effort, isolation, initialPrompt
- Foreground (blocking) and background (concurrent) execution
- Auto-compaction at ~95% capacity
- Resume capability with SendMessage
- Persistent transcripts in ~/.claude/projects/{project}/{sessionId}/subagents/
- Worktree isolation per subagent

### 3. Plugin System
- Structure: .claude-plugin/plugin.json + commands/ + agents/ + skills/ + hooks/ + .mcp.json + .lsp.json + settings.json
- Marketplace distribution
- Namespaced skills (plugin-name:skill-name)
- LSP server support for code intelligence

### 4. Hooks System
- Events: PreToolUse, PostToolUse, Stop, SubagentStart, SubagentStop, SessionStart, Notification, InstructionsLoaded, WorktreeCreate, WorktreeRemove
- Command and HTTP hook types
- Matchers for targeting specific tools

### 5. Permission System
- Modes: default, acceptEdits, dontAsk, bypassPermissions, plan, auto
- Scoped settings: Managed > CLI > Local > Project > User
- Permission rules: allow, ask, deny with tool-specific patterns
- Sandboxing: filesystem and network isolation

### 6. Model Configuration
- Extended thinking with adaptive reasoning
- Effort levels: low, medium, high, max
- Model selection and override
- Fast mode toggle

### 7. Session Management
- Named sessions with /rename
- Resume by ID, name, or picker
- Fork/branch conversations
- Session persistence with .jsonl transcripts
- Context compaction with /compact

### 8. Git Integration
- Worktrees for parallel sessions
- Attribution for commits and PRs
- Branch-aware session filtering
- PR review status display

### 9. Accessibility & UX
- Vim mode
- Voice input (push-to-talk)
- Customizable themes (light, dark, colorblind-accessible)
- Reduced motion setting (prefersReducedMotion)
- Custom keybindings
- Prompt suggestions
- Task list with Ctrl+T toggle
- Side questions with /btw
- Background bash commands with Ctrl+B
- Image paste support

### 10. Enterprise Features
- Managed settings (MDM, server, file-based)
- Organization-wide CLAUDE.md
- MCP server allow/deny lists
- Plugin marketplace restrictions
- Sandboxing enforcement
- Custom API key helpers
- OpenTelemetry support

### 11. Third-Party Integrations
- MCP (Model Context Protocol) servers
- GitHub Actions / GitLab CI/CD
- Slack integration
- Chrome browser integration
- Remote Control from claude.ai
- Channels (Telegram, Discord, iMessage, webhooks)
- IDE extensions (VS Code, JetBrains)

### 12. CLI Features
- Piping support (cat file | claude -p "query")
- Output formats: text, json, stream-json
- JSON schema validation for structured output
- Max budget and max turns limits
- Session IDs for programmatic control
- Bare mode for scripted calls
