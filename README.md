# 🤖 Friday CLI

**Open-source multi-provider AI coding agent for the terminal.**

Friday CLI is a powerful terminal-based AI assistant that supports 15+ LLM providers, features a beautiful React-based terminal UI, and includes a full ReAct agent loop with tool calling, sub-agent delegation, and MCP plugin support.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ✨ Features

- 🔌 **Multi-Provider** — OpenAI, Anthropic, Google Gemini, Ollama, Mistral, Groq, DeepSeek, AWS Bedrock, Azure, Cohere, and any OpenAI-compatible API
- 🖥️ **Beautiful TUI** — Ink-based React terminal UI with streaming markdown, syntax highlighting, and themes
- 🤖 **Agentic Loop** — ReAct state machine (Think → Act → Observe) with automatic tool calling
- 🔧 **Built-in Tools** — File read/write, shell execution, grep, glob, git operations, web fetch
- 🔌 **MCP Plugins** — Extend with community tools via Model Context Protocol
- 🧠 **Smart Context** — Tree-sitter codebase indexing, conversation summarization, persistent memory
- 🎭 **Agent Modes** — Code, Chat, Review, Plan, Debug — each with specialized behavior
- 💰 **Cost Tracking** — Real-time token usage and cost estimates per provider
- 📋 **Project Rules** — FRIDAY.md + .friday/rules/ for per-project conventions
- 🔒 **Permission System** — Workspace scoping, command blocklist, user confirmation prompts
- 🎨 **Themes** — Built-in dark/light themes + custom theme support
- 🌍 **i18n** — Internationalization with community translations
- ♿ **Accessible** — Screen reader support, high contrast, keyboard navigation

## 🚀 Quick Start

### Install

```bash
# npm
npm install -g friday-cli

# npx (no install)
npx friday-cli

# Homebrew
brew install friday-cli
```

### Setup

```bash
# Run Friday (guided setup on first run)
friday

# Or configure manually
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
friday
```

### Usage

```bash
# Start with default provider
friday

# Use specific provider and model
friday --provider anthropic --model claude-sonnet-4-20250514

# Use local Ollama model
friday --provider ollama --model llama3.1

# Different modes
friday --mode review    # Code review mode
friday --mode plan      # Planning mode
friday --mode chat      # Chat only (no file/command access)
friday --mode debug     # Debugging mode

# Non-interactive (CI/CD)
echo "Fix the auth bug" | friday --no-interactive
```

## ⚡ Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/model <name>` | Switch model mid-conversation |
| `/mode <mode>` | Switch agent mode |
| `/clear` | Clear conversation history |
| `/compact` | Summarize and compress context |
| `/cost` | Show token usage and cost |
| `/history` | Browse past sessions |
| `/init` | Create FRIDAY.md for current project |
| `/tools` | List available tools |
| `/mcp add <server>` | Add MCP server |
| `/exit` | Exit Friday CLI |

## 🔧 Configuration

Friday CLI uses a layered configuration system:

1. **CLI flags** (highest precedence)
2. **Environment variables** (`FRIDAY_*`, `OPENAI_API_KEY`, etc.)
3. **Project config** (`.friday/config.json`)
4. **Global config** (`~/.friday/config.json`)

### Example Config

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-20250514",
  "providers": {
    "openai": { "apiKey": "sk-..." },
    "anthropic": { "apiKey": "sk-ant-..." },
    "ollama": { "baseUrl": "http://localhost:11434" }
  },
  "theme": "dark",
  "maxIterations": 50,
  "costBudget": {
    "perSession": 5.00
  }
}
```

## 📋 Project Rules (FRIDAY.md)

Create a `FRIDAY.md` in your project root to set conventions:

```markdown
# Project Rules

- Use TypeScript strict mode
- Write tests for all new functions
- Use conventional commits
- Database queries go through the repository pattern
```

## 🏗️ Architecture

```
packages/
├── cli/        # CLI entry point, config, slash commands
├── core/       # Agent loop, modes, cost tracking
├── providers/  # LLM provider abstraction (15+ providers)
├── tools/      # Built-in tools (file, shell, grep, git)
├── tui/        # Ink-based terminal UI components
├── mcp/        # MCP client for community plugins
├── indexer/    # Tree-sitter codebase indexing
├── sdk/        # Programmatic SDK (@friday/sdk)
├── i18n/       # Internationalization
└── shared/     # Shared utilities, types, logger
```

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

```bash
# Clone and setup
git clone https://github.com/anthropic-ai/friday-cli.git
cd friday-cli
pnpm install
pnpm build

# Run in development
pnpm --filter friday-cli dev

# Run tests
pnpm test

# Lint
pnpm lint
```

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

**Built with ❤️ by the open-source community.**
