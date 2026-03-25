# 📖 Friday CLI — Complete Guide

> From installation to publishing — everything you need to know about using, configuring, extending, and distributing Friday CLI.

---

## Table of Contents

- [🚀 Quick Start](#-quick-start)
- [📦 Installation](#-installation)
  - [From Source (Development)](#from-source-development)
  - [npm Install (Once Published)](#npm-install-once-published)
- [⚙️ First Run — Onboarding Wizard](#️-first-run--onboarding-wizard)
- [🖥️ Using the CLI](#️-using-the-cli)
  - [Interactive Mode (TUI)](#interactive-mode-tui)
  - [Non-Interactive / Pipe Mode](#non-interactive--pipe-mode)
  - [CLI Flags Reference](#cli-flags-reference)
- [🤖 Providers — Connecting to AI Models](#-providers--connecting-to-ai-models)
  - [Provider Setup Table](#provider-setup-table)
  - [Using Ollama (Free, Local)](#using-ollama-free-local)
  - [Using OpenAI](#using-openai)
  - [Using Anthropic (Claude)](#using-anthropic-claude)
  - [Using Google Gemini](#using-google-gemini)
  - [Using Other Providers](#using-other-providers)
  - [Switching Providers at Runtime](#switching-providers-at-runtime)
- [🎭 Agent Modes](#-agent-modes)
- [🔧 Built-in Tools](#-built-in-tools)
- [💬 Slash Commands](#-slash-commands)
- [🔐 Permissions System](#-permissions-system)
- [📁 Configuration](#-configuration)
  - [Config File Locations](#config-file-locations)
  - [Full Config Schema](#full-config-schema)
  - [Environment Variables](#environment-variables)
  - [Example Configs](#example-configs)
- [📝 Project Rules (FRIDAY.md)](#-project-rules-fridaymd)
- [💾 Sessions](#-sessions)
- [💰 Cost Tracking](#-cost-tracking)
- [🔌 MCP — Model Context Protocol](#-mcp--model-context-protocol)
- [📚 SDK — Programmatic Usage](#-sdk--programmatic-usage)
- [🏗️ Architecture Overview](#️-architecture-overview)
- [🧑‍💻 Development Guide](#-development-guide)
  - [Monorepo Structure](#monorepo-structure)
  - [Building](#building)
  - [Testing](#testing)
  - [Adding a New Provider](#adding-a-new-provider)
  - [Adding a New Tool](#adding-a-new-tool)
  - [Adding a Slash Command](#adding-a-slash-command)
- [📦 Publishing & Distribution](#-publishing--distribution)
  - [Publishing to npm](#publishing-to-npm)
  - [Building a Standalone Binary](#building-a-standalone-binary)
  - [Homebrew Formula](#homebrew-formula)
- [❓ Troubleshooting](#-troubleshooting)
- [🗺️ Roadmap](#️-roadmap)

---

## 🚀 Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/anthropic-ai/friday-cli.git
cd friday-cli

# 2. Install dependencies
pnpm install

# 3. Build all packages
pnpm run build

# 4. Run Friday with Ollama (free, local)
node packages/cli/dist/bin/friday.js -p ollama -m "qwen3:thinking"

# Or pipe a question directly:
echo "Explain this codebase" | node packages/cli/dist/bin/friday.js -p ollama -m "qwen3:thinking"
```

That's it. You're chatting with an AI coding agent in your terminal.

---

## 📦 Installation

### From Source (Development)

**Prerequisites:**
- Node.js ≥ 20.0.0
- pnpm ≥ 9.0.0 (`npm install -g pnpm` if you don't have it)

```bash
# Clone
git clone https://github.com/anthropic-ai/friday-cli.git
cd friday-cli

# Install all workspace dependencies
pnpm install

# Build everything (uses Turborepo for parallelized builds)
pnpm run build

# Verify it works
node packages/cli/dist/bin/friday.js --version
# → 0.1.0

node packages/cli/dist/bin/friday.js --help
```

**Make it available globally (symlink):**

```bash
# From the repo root:
cd packages/cli
pnpm link --global

# Now you can run from anywhere:
friday --version
friday --help
```

### npm Install (Once Published)

```bash
# When published to npm:
npm install -g friday-cli

# Then just:
friday
```

---

## ⚙️ First Run — Onboarding Wizard

The first time you run `friday`, the onboarding wizard will guide you through setup:

1. **Choose a Provider** — pick from 12 supported providers
2. **Enter API Key** — (auto-detected from environment variables if set)
3. **Choose Default Model** — sensible defaults suggested
4. **Pick a Theme** — dark or light

The wizard saves your config to `~/.friday/config.json`. You can re-run setup anytime with `/init`.

**Skip onboarding** (if you've already set env vars):

```bash
# Just set your API key and go:
export OPENAI_API_KEY="sk-..."
friday -p openai -m gpt-4o
```

---

## 🖥️ Using the CLI

### Interactive Mode (TUI)

```bash
# Start with full terminal UI
friday

# With specific provider/model
friday -p anthropic -m claude-sonnet-4-20250514

# In a specific mode
friday --mode review
```

The TUI shows:
- **ASCII art banner** with version, provider, model, mode, project type
- **Input box** — type your message or `/` for commands
- **Response area** — streaming Markdown-rendered AI responses
- **Status bar** — token counts (↑ input, ↓ output) and running cost

**Keyboard shortcuts:**
- `Enter` — send message
- `Ctrl+C` — cancel current generation / exit
- Type `/` to enter slash commands

### Non-Interactive / Pipe Mode

Perfect for scripts, CI/CD, or piping input:

```bash
# Single question
echo "What does this function do?" | friday -p ollama -m qwen3:thinking

# From a file
cat bug-report.txt | friday -p openai -m gpt-4o --mode debug

# Explicit flag
friday --non-interactive -p ollama -m qwen3:thinking <<< "Explain package.json"
```

### CLI Flags Reference

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--provider <name>` | `-p` | From config | LLM provider to use |
| `--model <name>` | `-m` | From config | Model to use |
| `--mode <mode>` | | `code` | Agent mode: `code`, `chat`, `review`, `plan`, `debug` |
| `--max-iterations <n>` | | `50` | Max agent loop iterations |
| `--theme <theme>` | | `dark` | UI theme: `dark` or `light` |
| `--config <path>` | `-c` | Auto-detect | Custom config file path |
| `--resume` | | | Resume most recent session |
| `--session-id <id>` | | | Resume specific session |
| `--non-interactive` | | | Headless pipe mode (no TUI) |
| `--version` | `-V` | | Show version |
| `--help` | `-h` | | Show help |

---

## 🤖 Providers — Connecting to AI Models

Friday supports **12 providers** out of the box. Each provider self-registers — just set the API key and go.

### Provider Setup Table

| Provider | Name (`-p`) | API Key Env Var | Free? | Notes |
|----------|-------------|-----------------|-------|-------|
| **Ollama** | `ollama` | None needed | ✅ Yes | Local models, no internet required |
| **OpenAI** | `openai` | `OPENAI_API_KEY` | ❌ | GPT-4o, GPT-4o-mini, o3-mini |
| **Anthropic** | `anthropic` | `ANTHROPIC_API_KEY` | ❌ | Claude Sonnet 4, Haiku, Opus 4 |
| **Google Gemini** | `google-gemini` | `GOOGLE_API_KEY` or `GEMINI_API_KEY` | Free tier | Gemini 2.5 Pro/Flash |
| **Groq** | `groq` | `GROQ_API_KEY` | Free tier | Ultra-fast inference |
| **DeepSeek** | `deepseek` | `DEEPSEEK_API_KEY` | ❌ | DeepSeek Chat, Coder, Reasoner |
| **Mistral** | `mistral` | `MISTRAL_API_KEY` | ❌ | Mistral Large, Codestral |
| **Together AI** | `together` | `TOGETHER_API_KEY` | Free tier | Llama, Mixtral, Qwen |
| **Cohere** | `cohere` | `COHERE_API_KEY` | Free tier | Command-R, Command-R+ |
| **AWS Bedrock** | `aws-bedrock` | `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` | ❌ | Claude, Nova, Llama on AWS |
| **Azure OpenAI** | `azure-openai` | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT` | ❌ | Enterprise OpenAI |
| **OpenAI Compatible** | `openai-compatible` | `OPENAI_COMPATIBLE_API_KEY` (optional) | Varies | LM Studio, vLLM, any OpenAI-compatible API |

### Using Ollama (Free, Local)

Ollama lets you run AI models locally for free — no API key, no internet, full privacy.

```bash
# 1. Install Ollama: https://ollama.com
# macOS:
brew install ollama

# 2. Start Ollama
ollama serve

# 3. Pull a model
ollama pull qwen3:thinking      # Thinking model (recommended)
ollama pull llama3.1             # Meta's Llama 3.1
ollama pull codellama            # Code-specialized

# 4. Run Friday
friday -p ollama -m qwen3:thinking
```

**Custom Ollama host:**
```bash
export OLLAMA_HOST="http://192.168.1.100:11434"
friday -p ollama -m llama3.1
```

> **Note:** Ollama models don't support tool calling (function calling). Friday will run in chat-only mode — it responds conversationally but won't execute tools like file_read or shell_exec. For full agent capabilities with tools, use OpenAI, Anthropic, or Gemini.

### Using OpenAI

```bash
export OPENAI_API_KEY="sk-proj-..."
friday -p openai -m gpt-4o
```

**Available models:** `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `o3-mini`

### Using Anthropic (Claude)

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
friday -p anthropic -m claude-sonnet-4-20250514
```

**Available models:** `claude-sonnet-4-20250514`, `claude-haiku-3-5-20241022`, `claude-opus-4-20250514`

### Using Google Gemini

```bash
export GOOGLE_API_KEY="AIza..."
# or
export GEMINI_API_KEY="AIza..."

friday -p google-gemini -m gemini-2.5-pro
```

**Available models:** `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.0-flash`

### Using Other Providers

```bash
# Groq (ultra-fast)
export GROQ_API_KEY="gsk_..."
friday -p groq -m llama-3.3-70b-versatile

# DeepSeek
export DEEPSEEK_API_KEY="sk-..."
friday -p deepseek -m deepseek-chat

# Mistral
export MISTRAL_API_KEY="..."
friday -p mistral -m mistral-large-latest

# Together AI
export TOGETHER_API_KEY="..."
friday -p together -m meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo

# Cohere
export COHERE_API_KEY="..."
friday -p cohere -m command-r-plus

# OpenAI-compatible (e.g., LM Studio)
friday -p openai-compatible -m my-model
# Configure base URL in config.json (see Configuration section)
```

### Switching Providers at Runtime

Use the `/model` slash command to switch without restarting:

```
/model gpt-4o-mini           # Switch model
/model list                  # List available models
```

---

## 🎭 Agent Modes

Modes change the AI's system prompt and behavior. Switch with `--mode` flag or `/mode` command.

| Mode | Description | Tool Access | Best For |
|------|-------------|-------------|----------|
| **`code`** | Full coding assistant | ✅ All tools | Writing code, fixing bugs, refactoring |
| **`chat`** | Conversational mode | ❌ No tools | General Q&A, explanations, brainstorming |
| **`review`** | Code reviewer | 📖 Read-only | PR reviews, code quality analysis |
| **`plan`** | Software architect | 📖 Read-only | Architecture planning, implementation plans |
| **`debug`** | Expert debugger | ✅ All tools | Diagnosing bugs, analyzing errors |

```bash
# Start in review mode
friday --mode review

# Switch at runtime
/mode debug
/mode chat
```

---

## 🔧 Built-in Tools

When the agent is in `code` or `debug` mode, it can use these tools:

| Tool | What It Does | Example Use |
|------|--------------|-------------|
| **`file_read`** | Read file contents with line numbers | Read source code, configs |
| **`file_write`** | Create or overwrite files | Generate new files, write configs |
| **`file_edit`** | Surgical text replacement (old → new) | Fix bugs, refactor code |
| **`shell_exec`** | Execute shell commands | Run tests, install packages |
| **`grep`** | Search file contents by pattern | Find function definitions, usages |
| **`glob`** | Find files by name pattern | Discover project structure |
| **`directory_tree`** | Show directory tree | Explore project layout |
| **`git`** | Git operations | Check status, view diffs, commit |
| **`ask_user`** | Ask you a question | Clarify requirements |

The agent decides which tools to use based on your request. You'll be prompted for permission before any write/execute operations (see [Permissions](#-permissions-system)).

---

## 💬 Slash Commands

Type `/` followed by a command name in the input box:

| Command | Aliases | Description |
|---------|---------|-------------|
| `/help [cmd]` | `/h`, `/?` | Show all commands or help for a specific command |
| `/model [name]` | `/m` | Show current model, switch model, or list available models |
| `/mode [mode]` | | Show or switch agent mode |
| `/clear` | `/c` | Clear conversation history |
| `/compact` | | Summarize and compress conversation history |
| `/cost` | | Show token usage and estimated cost |
| `/history [n]` | | Show last N messages |
| `/tools [name]` | `/tool` | List all tools or show details for one tool |
| `/mcp [action]` | `/plugins` | Manage MCP servers (list, status, reload) |
| `/init` | `/setup` | Create FRIDAY.md project rules file |
| `/update` | `/version` | Check for updates / show version |
| `/exit` | `/quit`, `/q` | Exit Friday |

**Examples:**
```
/help model          # Detailed help for /model command
/model list          # List all available models
/mode review         # Switch to review mode
/cost                # See how much you've spent
/tools file_read     # See file_read tool parameters
```

---

## 🔐 Permissions System

Friday uses a layered permission system to keep you safe:

| Action | Default | What Happens |
|--------|---------|--------------|
| Read files (in workspace) | ✅ Auto-allow | Silently allowed |
| Read files (outside workspace) | ❌ Deny | Blocked |
| Write/edit files | ❓ Prompt | You're asked to approve |
| Safe shell commands (`ls`, `cat`, `grep`, `git`, `echo`...) | ✅ Auto-allow | Silently allowed |
| Dangerous commands (`rm -rf /`, `sudo`, `chmod 777`) | ❌ Deny | Blocked |
| Other shell commands | ❓ Prompt | You're asked to approve |
| Git operations | ✅ Auto-allow | Silently allowed |

When prompted, you'll see:
```
🔒 Permission Required: shell_exec
   Command: npm install express
   [y] Allow  [n] Deny  [a] Always Allow
```

Press `y` to allow once, `n` to deny, or `a` to always allow that pattern.

**Configure in config.json:**
```json
{
  "permissions": {
    "autoApproveRead": true,
    "autoApproveWrite": false,
    "blockedCommands": ["rm -rf /", "sudo rm"],
    "workspaceOnly": true
  }
}
```

---

## 📁 Configuration

### Config File Locations

Friday loads config from multiple sources (highest priority first):

1. **CLI flags** — `friday -p openai -m gpt-4o`
2. **Environment variables** — `FRIDAY_PROVIDER=openai`
3. **Project config** — `.friday/config.json` in your project (walks up directories)
4. **Global config** — `~/.friday/config.json`
5. **Built-in defaults**

### Full Config Schema

Create `~/.friday/config.json` (global) or `.friday/config.json` (per-project):

```json
{
  "defaultProvider": "openai",
  "defaultModel": "gpt-4o",
  "theme": "dark",
  "language": "en",
  "telemetry": false,
  "temperature": 0.7,
  "maxTokens": null,
  "maxIterations": 50,

  "providers": {
    "openai": {
      "apiKey": "sk-proj-...",
      "defaultModel": "gpt-4o"
    },
    "anthropic": {
      "apiKey": "sk-ant-..."
    },
    "ollama": {
      "baseUrl": "http://localhost:11434"
    },
    "openai-compatible": {
      "baseUrl": "http://localhost:1234/v1",
      "apiKey": "lm-studio"
    }
  },

  "permissions": {
    "autoApproveRead": true,
    "autoApproveWrite": false,
    "blockedCommands": ["rm -rf /", "sudo rm"],
    "workspaceOnly": true
  },

  "costBudget": {
    "perSession": 5.00,
    "perDay": 20.00
  },

  "mcp": {
    "servers": [
      {
        "name": "filesystem",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"],
        "transport": "stdio"
      }
    ]
  }
}
```

### Environment Variables

| Variable | Maps To | Example |
|----------|---------|---------|
| `FRIDAY_PROVIDER` | `defaultProvider` | `openai` |
| `FRIDAY_MODEL` | `defaultModel` | `gpt-4o` |
| `FRIDAY_THEME` | `theme` | `dark` |
| `OPENAI_API_KEY` | `providers.openai.apiKey` | `sk-proj-...` |
| `ANTHROPIC_API_KEY` | `providers.anthropic.apiKey` | `sk-ant-...` |
| `GOOGLE_API_KEY` | `providers.google-gemini.apiKey` | `AIza...` |
| `GEMINI_API_KEY` | `providers.google-gemini.apiKey` | `AIza...` |
| `OLLAMA_HOST` | `providers.ollama.baseUrl` | `http://localhost:11434` |
| `GROQ_API_KEY` | `providers.groq.apiKey` | `gsk_...` |
| `DEEPSEEK_API_KEY` | `providers.deepseek.apiKey` | `sk-...` |
| `MISTRAL_API_KEY` | `providers.mistral.apiKey` | |
| `TOGETHER_API_KEY` | `providers.together.apiKey` | |
| `COHERE_API_KEY` | `providers.cohere.apiKey` | |
| `AZURE_OPENAI_API_KEY` | `providers.azure-openai.apiKey` | |
| `AZURE_OPENAI_ENDPOINT` | `providers.azure-openai.baseUrl` | |
| `AWS_ACCESS_KEY_ID` | AWS auth | |
| `AWS_SECRET_ACCESS_KEY` | AWS auth | |
| `AWS_REGION` | AWS region | `us-east-1` |

### Example Configs

**Minimal (Ollama only):**
```json
{
  "defaultProvider": "ollama",
  "defaultModel": "qwen3:thinking"
}
```

**Power user (multiple providers):**
```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-20250514",
  "maxIterations": 100,
  "temperature": 0.3,
  "providers": {
    "anthropic": { "apiKey": "sk-ant-..." },
    "openai": { "apiKey": "sk-proj-..." },
    "ollama": { "baseUrl": "http://localhost:11434" },
    "groq": { "apiKey": "gsk_..." }
  },
  "costBudget": {
    "perSession": 2.00
  }
}
```

**Team project (`.friday/config.json` in repo):**
```json
{
  "defaultProvider": "openai",
  "defaultModel": "gpt-4o",
  "maxIterations": 30,
  "permissions": {
    "autoApproveWrite": false,
    "blockedCommands": ["rm -rf", "sudo", "docker rm"]
  }
}
```

---

## 📝 Project Rules (FRIDAY.md)

Create a `FRIDAY.md` file in your project root to give the AI context about your codebase. This is automatically loaded and added to the system prompt.

**Create one automatically:**
```
/init
```

**Or create manually:**

```markdown
# FRIDAY.md — Project Rules

## Project Overview
This is a Next.js e-commerce app with Stripe payments and PostgreSQL.

## Tech Stack
- Next.js 14 (App Router)
- TypeScript (strict mode)
- PostgreSQL + Prisma ORM
- Tailwind CSS
- Stripe for payments

## Conventions
- Use conventional commits (feat:, fix:, chore:)
- All components in src/components/ use PascalCase
- API routes in src/app/api/ use route.ts pattern
- Tests use Vitest with React Testing Library
- Never commit .env files

## Architecture
- src/app/ — Next.js app router pages
- src/components/ — Reusable React components
- src/lib/ — Shared utilities and helpers
- src/server/ — Server-only code (DB queries, auth)
- prisma/ — Database schema and migrations

## Instructions for Friday
- Always run `pnpm test` before suggesting commits
- Use Prisma for all database operations (no raw SQL)
- Follow existing error handling patterns in src/lib/errors.ts
- When creating components, include unit tests
```

You can also put multiple rule files in `.friday/rules/*.md` — they'll all be concatenated.

---

## 💾 Sessions

Friday automatically saves your conversation to disk so you can resume later.

**Session storage:** `~/.friday/sessions/`

**Resume last session:**
```bash
friday --resume
```

**Resume specific session:**
```bash
friday --session-id 2026-03-25_101530_a1b2
```

**What's saved:**
- Full conversation history (all messages)
- Provider, model, and mode state
- Token usage and cost totals
- Project path and timestamps

**View history in-session:**
```
/history        # Last 10 messages
/history 50     # Last 50 messages
```

Sessions auto-save on exit (Ctrl+C or `/exit`). Old sessions are cleaned up after 30 days.

---

## 💰 Cost Tracking

Friday tracks token usage and estimated costs in real-time.

**View current session costs:**
```
/cost
```

**What you'll see:**
```
💰 Session Cost Summary
  Provider: openai / gpt-4o
  Input tokens:  12,500 ($0.0313)
  Output tokens:  3,200 ($0.0320)
  Total cost:    $0.0633
```

**Set a budget cap:**
```json
{
  "costBudget": {
    "perSession": 5.00,
    "perDay": 20.00
  }
}
```

**Pricing:** Ollama is always $0 (local). Cloud providers use their published per-token pricing.

The status bar at the bottom of the TUI shows live cost: `📊 12500↑ 3200↓ 💰 $0.0633`

---

## 🔌 MCP — Model Context Protocol

MCP lets you connect external tool servers to Friday. Any MCP-compatible server adds its tools to the agent automatically.

**Configure in `~/.friday/config.json`:**

```json
{
  "mcp": {
    "servers": [
      {
        "name": "filesystem",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/you/projects"],
        "transport": "stdio"
      },
      {
        "name": "github",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "transport": "stdio"
      },
      {
        "name": "remote-tools",
        "url": "http://localhost:8080/mcp",
        "transport": "http-sse"
      }
    ]
  }
}
```

**Two transport types:**
- **`stdio`** — local process, communicates over stdin/stdout (most common)
- **`http-sse`** — remote server, POST requests + Server-Sent Events

**Manage in-session:**
```
/mcp list       # List connected servers
/mcp status     # Show all available MCP tools
/mcp reload     # Reconnect to all servers
```

MCP tools appear alongside built-in tools and are available to the agent automatically. They're registered with the format `serverName__toolName`.

---

## 📚 SDK — Programmatic Usage

Use Friday as a library in your own Node.js/TypeScript applications:

```bash
npm install @anthropic-ai/friday-sdk
```

### Basic Usage

```typescript
import { Friday } from '@anthropic-ai/friday-sdk';

const friday = new Friday({
  provider: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4o',
  },
  agent: {
    mode: 'code',
    maxIterations: 50,
  },
  workspaceRoot: process.cwd(),
  tools: true, // Enable built-in tools
});

// Simple ask (returns complete response)
const answer = await friday.ask('What does this function do?');
console.log(answer);

// Streaming (for real-time output)
for await (const event of friday.chat('Fix the bug in app.ts')) {
  switch (event.type) {
    case 'text_delta':
      process.stdout.write(event.content);
      break;
    case 'tool_call_start':
      console.log(`\n🔧 Using tool: ${event.name}`);
      break;
    case 'tool_result':
      console.log(`✅ Tool result: ${event.output.slice(0, 100)}`);
      break;
    case 'error':
      console.error(`❌ Error: ${event.error}`);
      break;
    case 'done':
      console.log('\n✅ Complete');
      break;
  }
}
```

### Event Types

| Event | Fields | Description |
|-------|--------|-------------|
| `state_change` | `from`, `to` | Agent state machine transition |
| `text_delta` | `content` | Streaming text chunk |
| `tool_call_start` | `name`, `args` | Agent is calling a tool |
| `tool_result` | `name`, `output`, `success` | Tool execution result |
| `permission_request` | `tool`, `args` | Permission prompt needed |
| `cost_update` | `cost`, `tokens` | Token/cost update |
| `done` | | Generation complete |
| `error` | `error` | Error occurred |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  Ink TUI  │  │  Headless /  │  │  SDK (programmatic)   │ │
│  │ (app.tsx) │  │  Pipe Mode   │  │  (friday-sdk)         │ │
│  └─────┬─────┘  └──────┬───────┘  └──────────┬────────────┘ │
├────────┴───────────────┴──────────────────────┴─────────────┤
│                   Orchestration Layer                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Agent Loop (ReAct Pattern)               │   │
│  │  IDLE → THINKING → ACTING → OBSERVING → TERMINATED   │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                     Services Layer                           │
│  ┌────────────┐ ┌──────────┐ ┌────────────┐ ┌───────────┐  │
│  │  Providers  │ │  Tools   │ │ Permissions│ │  Context   │  │
│  │ (12 adapt.) │ │(9 built) │ │  System    │ │ (Sessions) │  │
│  └────────────┘ └──────────┘ └────────────┘ └───────────┘  │
│  ┌────────────┐ ┌──────────┐ ┌────────────┐ ┌───────────┐  │
│  │    MCP     │ │   Cost   │ │   Config   │ │  Indexer   │  │
│  │  Client    │ │ Tracker  │ │  Loader    │ │ (Project)  │  │
│  └────────────┘ └──────────┘ └────────────┘ └───────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Data flow:**
1. User types message → TUI/Headless sends to Agent Loop
2. Agent Loop sends to Provider (LLM) → gets streaming response
3. If LLM returns tool calls → Agent executes tools (with permission checks)
4. Tool results → fed back to LLM → continues until done
5. Events stream back to TUI for rendering

---

## 🧑‍💻 Development Guide

### Monorepo Structure

```
friday-cli/
├── packages/
│   ├── cli/        # CLI entry point, commands, config, onboarding
│   ├── core/       # Agent loop, permissions, sessions, cost tracker
│   ├── providers/  # 12 LLM provider adapters
│   ├── tools/      # 9 built-in tools (file, shell, git, grep...)
│   ├── tui/        # Terminal UI (React + Ink)
│   ├── mcp/        # Model Context Protocol client
│   ├── sdk/        # TypeScript SDK for programmatic use
│   ├── shared/     # Logger, errors, types, utilities
│   ├── i18n/       # Internationalization (English, Spanish, etc.)
│   └── indexer/    # Project type detection
├── extensions/     # VS Code extension (future)
├── docs/           # Architecture & implementation docs
├── scripts/        # Build & distribution scripts
├── turbo.json      # Turborepo pipeline config
├── pnpm-workspace.yaml
└── package.json
```

### Building

```bash
# Build all packages (parallelized via Turborepo)
pnpm run build

# Build a single package
pnpm run build --filter friday-cli
pnpm run build --filter @anthropic-ai/friday-core

# Watch mode (rebuilds on file changes)
pnpm run dev

# Type check without building
pnpm run typecheck

# Clean all build artifacts
pnpm run clean
```

### Testing

```bash
# Run all tests across all packages
pnpm run test

# Run tests for a specific package
pnpm --filter friday-cli run test
pnpm --filter @anthropic-ai/friday-core run test

# Run with coverage
pnpm run test:coverage

# Run a specific test file
npx vitest run packages/cli/src/__tests__/e2e-ollama.test.ts

# Watch mode
npx vitest packages/core/
```

**Current test count:** 289 tests across 8 packages (all passing ✅)

### Adding a New Provider

1. Create `packages/providers/src/adapters/my-provider.ts`:

```typescript
import type { LLMProvider, GenerateRequest, GenerateResponse, StreamChunk, ProviderCapabilities, ModelInfo, ProviderConfig } from '../types.js';
import { registerProvider } from '../registry.js';

export class MyProvider implements LLMProvider {
  readonly name = 'my-provider';
  readonly displayName = 'My Provider';
  private apiKey: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey || process.env.MY_PROVIDER_API_KEY || '';
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    // Call your API here
    const response = await fetch('https://api.myprovider.com/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    const data = await response.json() as any;
    return {
      content: data.choices[0].message.content,
      toolCalls: [],
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      model: request.model || 'default',
      finishReason: 'stop',
    };
  }

  async *stream(request: GenerateRequest): AsyncGenerator<StreamChunk> {
    // Implement streaming
    yield { type: 'text_delta', content: 'Hello from my provider!' };
    yield { type: 'done' };
  }

  async generateWithTools(request: GenerateRequest): Promise<GenerateResponse> {
    return this.generate(request);
  }

  async *streamWithTools(request: GenerateRequest): AsyncGenerator<StreamChunk> {
    yield* this.stream(request);
  }

  capabilities(): ProviderCapabilities {
    return {
      streaming: true,
      toolCalling: false,
      vision: false,
      embeddings: false,
      jsonMode: false,
      maxContextWindow: 128000,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    return [{ id: 'my-model', name: 'My Model', contextWindow: 128000,
      inputPricePerMToken: 0, outputPricePerMToken: 0,
      supportsVision: false, supportsToolCalling: false }];
  }

  async validateApiKey(): Promise<boolean> {
    return !!this.apiKey;
  }
}

// This line auto-registers the provider!
registerProvider('my-provider', (config) => new MyProvider(config));
```

2. Add the import to `packages/providers/src/index.ts`:
```typescript
import './adapters/my-provider.js';
```

3. Build and test:
```bash
pnpm run build --filter @anthropic-ai/friday-providers
friday -p my-provider -m my-model
```

### Adding a New Tool

1. Create `packages/tools/src/built-in/my-tool.ts`:

```typescript
import type { Tool, ToolResult } from '../types.js';

export const myTool: Tool = {
  name: 'my_tool',
  description: 'Description of what your tool does',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'The input to process' },
    },
    required: ['input'],
  },

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const input = args.input as string;

    try {
      // Do your work here
      const result = `Processed: ${input}`;
      return { success: true, output: result };
    } catch (error) {
      return { success: false, output: `Error: ${(error as Error).message}` };
    }
  },
};
```

2. Register it in `packages/tools/src/index.ts`:
```typescript
import { myTool } from './built-in/my-tool.js';

// In createDefaultRegistry():
registry.register(myTool);
```

### Adding a Slash Command

1. Create `packages/cli/src/commands/my-command.ts`:

```typescript
import type { SlashCommand, CommandContext, CommandResult } from './types.js';

export const myCommand: SlashCommand = {
  name: 'mycommand',
  aliases: ['mc'],
  description: 'Does something cool',
  usage: '/mycommand [options]',

  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    return {
      output: `Hello from ${context.currentProvider}!`,
      type: 'info',
    };
  },
};
```

2. Register it in `packages/cli/src/commands/index.ts`:
```typescript
import { myCommand } from './my-command.js';

// In createCommandRegistry():
registry.register(myCommand);
```

---

## 📦 Publishing & Distribution

### Publishing to npm

1. **Update package scope** — Change `@anthropic-ai/` to your own org in all `package.json` files:
   ```bash
   # Find all references
   grep -r "@anthropic-ai/" packages/*/package.json

   # Replace with your org (e.g., @myorg/)
   find packages -name "package.json" -exec sed -i '' 's/@anthropic-ai\//@myorg\//g' {} +
   ```

2. **Bump version:**
   ```bash
   # Manual bump in packages/cli/package.json
   # Or use changesets: npx changeset
   ```

3. **Login to npm:**
   ```bash
   npm login
   # Or for scoped packages:
   npm login --scope=@myorg
   ```

4. **Build and publish:**
   ```bash
   pnpm run build
   pnpm run publish:all
   ```

5. **Users can then install:**
   ```bash
   npm install -g @myorg/friday-cli
   friday --version
   ```

### Building a Standalone Binary

Create a single executable that doesn't require Node.js:

```bash
# Using the build script
node scripts/build-binary.mjs

# Or manually with pkg/Node.js SEA:
# See scripts/build-binary.mjs for implementation
```

The binary can be distributed directly — users don't need Node.js installed.

### Homebrew Formula

For macOS users, you can create a Homebrew tap:

1. Create a GitHub repo: `your-username/homebrew-tap`
2. Add a formula file `Formula/friday.rb`:

```ruby
class Friday < Formula
  desc "Open-source multi-provider AI coding agent for the terminal"
  homepage "https://github.com/your-username/friday-cli"
  url "https://registry.npmjs.org/friday-cli/-/friday-cli-0.1.0.tgz"
  sha256 "YOUR_SHA256_HASH"
  license "MIT"

  depends_on "node@20"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match "0.1.0", shell_output("#{bin}/friday --version")
  end
end
```

3. Users install with:
```bash
brew tap your-username/tap
brew install friday
```

---

## ❓ Troubleshooting

### "Raw mode is not supported"
This happens when running in a non-TTY environment (piped input, CI/CD). Use `--non-interactive`:
```bash
echo "hello" | friday --non-interactive -p ollama -m qwen3:thinking
```

### "Cannot connect to Ollama"
```bash
# Make sure Ollama is running:
ollama serve

# Check it's accessible:
curl http://localhost:11434/api/tags
```

### "ECONNREFUSED" or "fetch failed"
The provider's API is unreachable. Check:
- Your internet connection
- The API key is valid
- The base URL is correct (for self-hosted)

### "punycode module deprecated" warning
This is a harmless Node.js deprecation warning. You can suppress it:
```bash
node --no-deprecation packages/cli/dist/bin/friday.js
```

### Empty responses from thinking models
Models like `qwen3:thinking` use tokens for internal reasoning (`<think>` phase). If `maxTokens` is too low, all tokens are used for thinking with none left for the response. Increase it:
```json
{
  "maxTokens": 4000
}
```

### Agent not using tools
- **Check the mode:** `chat` and `review` modes have limited/no tool access. Use `code` or `debug`.
- **Check the provider:** Ollama models don't support tool calling. Use OpenAI, Anthropic, or Gemini for full agent capabilities.

---

## 🗺️ Roadmap

| Status | Feature |
|--------|---------|
| ✅ Done | 12 provider adapters |
| ✅ Done | 9 built-in tools |
| ✅ Done | 5 agent modes |
| ✅ Done | 12 slash commands |
| ✅ Done | MCP integration |
| ✅ Done | Session persistence |
| ✅ Done | Cost tracking |
| ✅ Done | Permission system |
| ✅ Done | Project rules (FRIDAY.md) |
| ✅ Done | TypeScript SDK |
| ✅ Done | i18n support |
| ✅ Done | Non-interactive pipe mode |
| 🔲 Next | VS Code extension |
| 🔲 Next | Documentation site (VitePress/Docusaurus) |
| 🔲 Next | Sub-agent delegation |
| 🔲 Next | Codebase indexing (embeddings) |
| 🔲 Next | Plugin marketplace |
| 🔲 Next | Telemetry dashboard |

---

## License

MIT — see [LICENSE](./LICENSE)

---

*Built with ❤️ by the Friday CLI community. Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).*
