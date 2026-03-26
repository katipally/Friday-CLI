# 🕷️ FridayCode

**Open-source agentic coding CLI — a model-agnostic alternative to Claude Code**

FridayCode is an AI-powered coding assistant that lives in your terminal. It supports multiple AI providers (Ollama, Anthropic, OpenAI, and any OpenAI-compatible API), giving you full control over your model choices — including free local inference.

---

## Features

- **Multi-Provider Support** — Ollama (local/free), Anthropic, OpenAI, OpenAI-compatible (Together, Groq, LM Studio, etc.)
- **25+ Built-in Tools** — File read/write/edit, bash execution, glob, grep, web fetch/search, git integration, background tasks, cron jobs, and more
- **Agentic Loop** — Autonomous tool use with permission controls (default/acceptAll/plan modes)
- **Agent System** — Built-in agents (Explore, Plan, General) + custom agent definitions
- **Skills Engine** — Reusable prompt templates with argument substitution
- **Plugin System** — Extend with custom tools, agents, skills, and hooks
- **Session Management** — Persistent sessions with fork, rewind, and export
- **Memory System** — Project-level `FRIDAY.md`, auto-memory, and `.friday/rules/` files
- **Git Integration** — Worktrees, AI commit attribution, branch management, PR diff analysis
- **Terminal UI** — Ink-based TUI with streaming output, diff viewer, model switcher, task list
- **Spider Mascot** — Meet Friday 🕷️ — animated ASCII spider with 7 expression states
- **Vim Mode** — Optional vi keybindings for input
- **Themes** — Dark and light themes with the FridayCode color palette
- **Slash Commands** — 20+ commands for model switching, context management, and more
- **Pipe Mode** — Non-interactive mode for scripting: `echo "code" | friday -p "explain"`
- **Telemetry** — Optional, anonymous, opt-in only

## Installation

```bash
npm install -g fridaycode
```

Requires Node.js ≥ 20.

## Quick Start

```bash
# Start interactive mode
friday

# One-shot prompt
friday "explain this codebase"

# Pipe mode
cat src/index.ts | friday -p "add error handling"

# Use a specific model
friday --model claude-sonnet-4-20250514 --provider anthropic

# Use local Ollama
friday --model llama3.1:8b --provider ollama

# Plan mode (read-only tools)
friday --plan "analyze this project's architecture"

# Accept all permissions automatically
friday -y "refactor the auth module"
```

## Configuration

### Provider Setup

FridayCode looks for API keys in environment variables:

```bash
# Anthropic
export ANTHROPIC_API_KEY="sk-ant-..."

# OpenAI
export OPENAI_API_KEY="sk-..."

# Ollama (no key needed — just run ollama serve)
```

### Settings

Settings are loaded from multiple scopes (in priority order):

1. **Managed** — `~/.friday/managed-settings.json` (set by organization)
2. **Local** — `.friday/settings.local.json` (gitignored, per-developer)
3. **Project** — `.friday/settings.json` (committed, shared)
4. **User** — `~/.friday/settings.json` (global defaults)

### Project Memory

Create a `FRIDAY.md` in your project root to give FridayCode persistent context:

```markdown
# My Project

## Tech Stack
- TypeScript, React, Node.js

## Conventions
- Use functional components
- Prefer named exports
```

## Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/model <name>` | Switch model |
| `/provider <name>` | Switch provider |
| `/clear` | Clear conversation |
| `/compact` | Compact context window |
| `/status` | Show session status |
| `/theme <dark\|light>` | Switch theme |
| `/vim` | Toggle vim mode |
| `/diff` | Show git diff |
| `/cost` | Show token usage |
| `/permissions` | View/set permission mode |
| `/config` | View/edit configuration |
| `/memory` | Manage memory files |
| `/skills` | List available skills |
| `/agents` | List available agents |
| `/mcp` | List MCP servers |
| `/exit` | Exit FridayCode |

## CLI Flags

| Flag | Description |
|------|-------------|
| `-m, --model <model>` | Model to use |
| `--provider <name>` | Provider to use |
| `--agent <name>` | Use a named agent |
| `--skill <name>` | Run a skill |
| `-s, --session <id>` | Resume a specific session |
| `-r, --resume` | Resume the last session |
| `-p, --pipe` | Pipe mode (non-interactive) |
| `--json` | Output JSON (pipe mode) |
| `--max-turns <n>` | Maximum conversation turns |
| `-y, --accept-all` | Skip permission prompts |
| `--plan` | Read-only plan mode |
| `-v, --verbose` | Verbose output |

## Architecture

```
packages/
├── shared/          # Types, constants, utilities
├── core/            # Engine: providers, tools, agents, sessions, skills, plugins
│   ├── providers/   # Ollama, Anthropic, OpenAI, OpenAI-compatible
│   ├── tools/       # 25+ built-in tools
│   ├── agents/      # Agent engine + built-in agents
│   ├── skills/      # Skill loader + runner
│   ├── plugins/     # Plugin system
│   ├── settings/    # Zod-validated settings with 4-scope merge
│   ├── memory/      # FRIDAY.md, auto-memory, rules
│   ├── session/     # Session CRUD + JSONL transcripts
│   ├── hooks/       # Event hooks (command + HTTP)
│   ├── git/         # Worktrees, attribution, branches, PR analysis
│   └── telemetry/   # Opt-in anonymous stats
└── cli/             # Terminal UI
    ├── components/  # Ink components (Output, Prompt, StatusBar, etc.)
    ├── mascot/      # Friday the spider 🕷️
    ├── input/       # Vim mode, history, tab completion
    ├── themes/      # Dark/light themes
    ├── commands/    # Slash command router + handlers
    └── onboarding/  # First-run setup wizard
```

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Type check
npm run typecheck

# Run tests
npm test

# Run with coverage
npm run test:coverage

# Lint
npm run lint

# Format
npm run format

# Development mode
npm run dev
```

## Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Deep Violet | `#8B5CF6` | Primary brand, user messages |
| Stark Rose | `#F43F5E` | Errors, system messages |
| Acidic Pistachio | `#A3E635` | Success, assistant messages |
| Icy Slate | `#F8FAFC` | Primary text |
| Midnight Slate | `#334155` | Borders, backgrounds |

## License

MIT
