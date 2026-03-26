# FridayCode — Usage Guide

Complete guide to using FridayCode in your daily workflow.

---

## Table of Contents

- [Installation](#installation)
- [First Run & Configuration](#first-run--configuration)
- [Interactive Mode](#interactive-mode)
- [Slash Commands Reference](#slash-commands-reference)
- [Provider Setup](#provider-setup)
- [Model Selection](#model-selection)
- [Pipe Mode (Non-interactive)](#pipe-mode-non-interactive)
- [Agent System](#agent-system)
- [Skills](#skills)
- [Session Management](#session-management)
- [Vim Mode](#vim-mode)
- [Themes](#themes)
- [Permission Modes](#permission-modes)
- [Memory & Context](#memory--context)
- [Plugins](#plugins)
- [Configuration File](#configuration-file)
- [Environment Variables](#environment-variables)
- [Tips & Recipes](#tips--recipes)

---

## Installation

### From npm (Once Published)

```bash
npm install -g fridaycode-cli
```

### From Source (Development)

```bash
git clone https://github.com/katipally/Friday-CLI.git
cd Friday-CLI
npm install
npm run build
npm link --workspace=packages/cli
```

Verify installation:

```bash
friday --version
friday --help
```

---

## First Run & Configuration

When you run `friday` for the first time, the **onboarding wizard** launches:

1. It detects if Ollama is running locally
2. Recommends a default provider (Ollama for free local, or Anthropic/OpenAI)
3. Sets up your configuration at `~/.friday/settings.json`

You can re-run setup anytime with:

```bash
friday /init
```

---

## Interactive Mode

Start a conversation:

```bash
# Start in current directory
friday

# Start with a prompt
friday "explain this codebase"

# Start with a specific provider and model
friday --provider anthropic --model claude-sonnet-4-20250514
```

### Interface Overview

```
┌──────────────────────────────────────────────┐
│  🕷️ FridayCode v0.1.0                       │
│  Provider: ollama | Model: llama3.1          │
├──────────────────────────────────────────────┤
│                                              │
│  [AI response with syntax highlighting]      │
│                                              │
│  Tool: read [src/index.ts] ✓                │
│  Tool: edit [src/app.ts] ✓                  │
│                                              │
├──────────────────────────────────────────────┤
│  friday> _                                   │
└──────────────────────────────────────────────┘
```

### Key Concepts

- **Prompt**: Type your message at the `friday>` prompt
- **Streaming**: Responses stream in real-time
- **Tool Calls**: The AI can use tools (file read/write, bash, etc.)
- **Permissions**: Sensitive tools require your approval
- **History**: Use ↑/↓ arrows to navigate previous prompts

---

## Slash Commands Reference

Type `/` followed by the command name. All 20+ built-in commands:

### Navigation & Info

| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/status` | Show current model, provider, token usage |
| `/context` | View token usage and context window stats |
| `/cost` | Show estimated API cost for this session |

### Model & Provider

| Command | Description |
|---------|-------------|
| `/model [name]` | Switch model (shows picker if no name given) |
| `/provider [name]` | Switch AI provider |

### Session

| Command | Description |
|---------|-------------|
| `/clear` | Clear conversation history |
| `/compact` | Summarize conversation to free context space |
| `/memory` | View/edit project memory (FRIDAY.md) |

### Tools & Permissions

| Command | Description |
|---------|-------------|
| `/permissions` | View/change permission mode |
| `/diff` | Show pending file changes |
| `/config` | View/edit settings |

### Extensions

| Command | Description |
|---------|-------------|
| `/skills` | List available skills |
| `/agents` | List available agents |
| `/mcp` | Show MCP server status |
| `/init` | Re-run project setup / onboarding |

### Appearance

| Command | Description |
|---------|-------------|
| `/theme [name]` | Switch theme (dark/light) |
| `/vim` | Toggle Vim mode keybindings |

### Exit

| Command | Description |
|---------|-------------|
| `/exit` or `/quit` | Exit FridayCode |

---

## Provider Setup

### Ollama (Free, Local)

```bash
# Install Ollama (macOS)
brew install ollama

# Start the server
ollama serve

# Pull a model
ollama pull llama3.1
ollama pull codellama
ollama pull deepseek-coder-v2

# Use in FridayCode
friday --provider ollama --model llama3.1
```

### Anthropic (Claude)

```bash
# Set API key
export ANTHROPIC_API_KEY="sk-ant-..."

# Use in FridayCode
friday --provider anthropic --model claude-sonnet-4-20250514
```

### OpenAI

```bash
# Set API key
export OPENAI_API_KEY="sk-..."

# Use in FridayCode
friday --provider openai --model gpt-4o
```

### OpenAI-Compatible (Together, Groq, LM Studio, etc.)

```bash
# Set base URL and API key
export OPENAI_API_BASE="https://api.together.xyz/v1"
export OPENAI_API_KEY="your-key"

# Use in FridayCode
friday --provider openai-compatible --model meta-llama/Llama-3-70b-chat-hf
```

You can also configure these in `~/.friday/settings.json`:

```json
{
  "providers": {
    "anthropic": {
      "apiKey": "sk-ant-..."
    },
    "openai": {
      "apiKey": "sk-..."
    },
    "openai-compatible": {
      "apiKey": "your-key",
      "baseUrl": "https://api.together.xyz/v1"
    }
  },
  "activeProvider": "ollama",
  "defaultModel": "llama3.1"
}
```

---

## Model Selection

### Interactive Model Switcher

```
friday> /model
```

This opens the model picker — use arrow keys to select, Enter to confirm, Escape to cancel.

### Command-line

```bash
friday --model claude-sonnet-4-20250514
```

### In Conversation

```
friday> /model gpt-4o
Switched to gpt-4o
```

---

## Pipe Mode (Non-interactive)

Pipe mode is for scripting and automation — no TUI, single turn, outputs directly to stdout:

```bash
# Explain code
cat src/index.ts | friday -p "explain what this does"

# Generate code
echo "Write a Python fibonacci function" | friday -p "write it"

# Code review
git diff | friday -p "review these changes"

# With a specific model
cat file.ts | friday -p "add types" --provider anthropic --model claude-sonnet-4-20250514
```

Pipe mode:
- Reads from stdin
- Sends a single prompt with the piped content
- Outputs the response to stdout
- Exits immediately (no persistent session)

---

## Agent System

Agents are specialized modes of operation with different capabilities.

### Built-in Agents

| Agent | Purpose | Tools | Max Turns |
|-------|---------|-------|-----------|
| **General** | Full coding assistant | All tools | 50 |
| **Explore** | Read-only codebase analysis | Read-only tools | 20 |
| **Plan** | Planning & architecture | Read-only tools | 30 |

### Using an Agent

```bash
# Launch with explore agent
friday --agent explore "how is auth implemented?"

# Launch with plan agent
friday --agent plan "design a caching layer"
```

### In Conversation

```
friday> /agents
Available agents: General, Explore, Plan
```

### Custom Agents

Create agent definitions in `.friday/agents/`:

```yaml
# .friday/agents/reviewer.yaml
name: code-reviewer
description: Reviews code for quality and bugs
systemPrompt: |
  You are a code reviewer. Analyze code for:
  - Bugs and logic errors
  - Performance issues
  - Security vulnerabilities
  - Style and readability
tools:
  - read
  - glob
  - grep
maxTurns: 15
```

---

## Skills

Skills are reusable prompt templates for common tasks.

### Built-in Skills

| Skill | Description |
|-------|-------------|
| `batch` | Apply changes across multiple files |
| `debug` | Systematic debugging workflow |
| `loop` | Iterative test-fix-verify cycle |
| `simplify` | Reduce code complexity |

### Using a Skill

```bash
# Run a skill
friday --skill debug "the login page crashes on submit"
```

### Custom Skills

Create skills as Markdown files with YAML frontmatter in `.friday/skills/`:

```markdown
---
name: test
description: Generate tests for a module
arguments:
  - name: file
    description: The file to test
    required: true
---

Write comprehensive tests for {{file}}:

1. Read the source file
2. Identify all exported functions and classes
3. Write tests covering happy paths, edge cases, and error handling
4. Use the project's existing test framework
```

---

## Session Management

Sessions persist your conversation across restarts.

### Resume a Session

```bash
# List recent sessions
friday --session

# Resume a specific session
friday --resume <session-id>
```

Sessions are stored in `.friday/sessions/`.

---

## Vim Mode

Toggle vim keybindings for the input prompt:

```
friday> /vim
Vim mode: ON
```

Or enable permanently in settings:

```json
{
  "vimMode": true
}
```

### Vim Mode Keys

| Mode | Key | Action |
|------|-----|--------|
| Normal | `i` | Enter insert mode |
| Normal | `a` | Enter insert mode (after cursor) |
| Normal | `A` | Enter insert mode (end of line) |
| Normal | `I` | Enter insert mode (start of line) |
| Normal | `h/l` | Move left/right |
| Normal | `0/$` | Jump to start/end of line |
| Normal | `w/b` | Jump forward/backward by word |
| Normal | `x` | Delete character |
| Normal | `dd` | Delete entire line |
| Normal | `v` | Enter visual mode |
| Insert | `Escape` | Return to normal mode |
| Visual | `y` | Yank (copy) selection |
| Visual | `d` | Delete selection |

---

## Themes

### Switching Themes

```
friday> /theme dark
friday> /theme light
```

### Available Themes

- **dark** (default) — Deep Violet & Acidic Pistachio on dark background
- **light** — Adapted palette for light terminals

### FridayCode Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Deep Violet | `#8B5CF6` | Primary, accents, decorative |
| Stark Rose | `#F43F5E` | Errors, warnings, destructive |
| Acidic Pistachio | `#A3E635` | Success, confirmations |
| Icy Slate | `#F8FAFC` | Primary text |
| Midnight Slate | `#334155` | Backgrounds, borders |

---

## Permission Modes

Control how much autonomy the AI has:

| Mode | Behavior |
|------|----------|
| `default` | Asks permission for sensitive operations (file writes, bash, etc.) |
| `acceptAll` | Auto-approves all tool calls (use with caution) |
| `plan` | Read-only — AI can only view files, not modify them |

### Setting Permission Mode

```bash
# Via CLI flag (when supported)
friday --mode plan

# In conversation
friday> /permissions
Current mode: default
```

### In Settings

```json
{
  "permissions": {
    "mode": "default",
    "allow": ["read", "glob", "grep", "list_dir"],
    "deny": ["bash"]
  }
}
```

---

## Memory & Context

### Project Memory (FRIDAY.md)

Place a `FRIDAY.md` file in your project root to give the AI persistent context:

```markdown
# Project: MyApp

## Tech Stack
- React + TypeScript frontend
- Node.js + Express backend
- PostgreSQL database

## Conventions
- Use functional components with hooks
- All API responses follow { data, error, meta } shape
- Tests use vitest

## Important Notes
- Never modify migration files directly
- Auth tokens are stored in httpOnly cookies
```

### Auto-memory

FridayCode automatically discovers `.friday/rules/` files for project-level instructions.

### Context Management

```
friday> /context
Context: 12,450 / 128,000 tokens (9.7%)
Messages: 24

friday> /compact
Compacting conversation...
Reduced from 24 messages to 4 (summary + recent)
```

---

## Plugins

Extend FridayCode with plugins.

### Plugin Structure

```
.friday/plugins/my-plugin/
├── manifest.json
├── tools/
│   └── my-tool.ts
├── agents/
│   └── my-agent.yaml
└── skills/
    └── my-skill.md
```

### manifest.json

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "A custom plugin",
  "tools": ["tools/my-tool.ts"],
  "agents": ["agents/my-agent.yaml"],
  "skills": ["skills/my-skill.md"],
  "hooks": {
    "beforeToolCall": "hooks/before-tool.ts"
  }
}
```

---

## Configuration File

Full config reference (`~/.friday/settings.json`):

```json
{
  "activeProvider": "ollama",
  "defaultModel": "llama3.1",
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434"
    },
    "anthropic": {
      "apiKey": "sk-ant-..."
    },
    "openai": {
      "apiKey": "sk-..."
    },
    "openai-compatible": {
      "apiKey": "...",
      "baseUrl": "https://api.together.xyz/v1"
    }
  },
  "permissions": {
    "mode": "default",
    "allow": [],
    "deny": []
  },
  "theme": "dark",
  "vimMode": false,
  "hooks": {},
  "mcpServers": {},
  "telemetryOptIn": false
}
```

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_API_BASE` | Custom OpenAI-compatible base URL |
| `FRIDAY_DEBUG` | Set to `1` to enable debug logging |
| `FRIDAY_CONFIG_DIR` | Override config directory (default: `~/.friday`) |

---

## Tips & Recipes

### Code Review Workflow

```bash
# Review staged changes
git diff --staged | friday -p "review these changes for bugs and improvements"
```

### Explain a Codebase

```bash
friday "explore this repo and explain the architecture"
```

### Fix a Bug

```bash
friday "the login form shows a blank page when I click submit. Debug this."
```

### Batch Operations

```bash
friday --skill batch "add JSDoc comments to all exported functions in src/utils/"
```

### Generate Tests

```bash
friday "write tests for src/auth/login.ts using vitest"
```

### Refactoring

```bash
friday "refactor src/api/routes.ts to use the repository pattern"
```

### Git Workflow

```bash
# Get a commit message
git diff --staged | friday -p "write a conventional commit message for these changes"
```
