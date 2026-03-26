# FridayCode — Complete Guide

> Everything you need to use, develop, publish, maintain, and grow FridayCode as an open-source project.

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Using FridayCode](#2-using-fridaycode)
3. [Configuration](#3-configuration)
4. [Slash Commands](#4-slash-commands)
5. [Tools Reference](#5-tools-reference)
6. [Providers & Models](#6-providers--models)
7. [Sub-Agents](#7-sub-agents)
8. [Skills & Plugins](#8-skills--plugins)
9. [CI/CD Mode](#9-cicd-mode)
10. [Development Setup](#10-development-setup)
11. [Architecture Overview](#11-architecture-overview)
12. [Testing](#12-testing)
13. [Versioning & Changelogs](#13-versioning--changelogs)
14. [Publishing to npm](#14-publishing-to-npm)
15. [Publishing to Homebrew](#15-publishing-to-homebrew)
16. [GitHub Releases](#16-github-releases)
17. [Sending Updates](#17-sending-updates)
18. [Maintaining Open Source](#18-maintaining-open-source)
19. [Troubleshooting](#19-troubleshooting)

---

## 1. Quick Start

### Install from npm (once published)

```bash
npm install -g fridaycode
# or
pnpm add -g fridaycode
# or
brew install fridaycode   # once Homebrew formula exists
```

### Run from source (development)

```bash
git clone https://github.com/katipally/fridaycode.git
cd fridaycode
pnpm install
pnpm run build

# Run directly
node packages/cli/dist/bin/friday.js

# Or link globally
cd packages/cli && pnpm link --global
friday   # now available everywhere
```

### Set up a provider

```bash
# Pick any provider — set its API key
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GOOGLE_API_KEY="AI..."
export GROQ_API_KEY="gsk_..."
export DEEPSEEK_API_KEY="sk-..."
export MISTRAL_API_KEY="..."
export TOGETHER_API_KEY="..."
export COHERE_API_KEY="..."
export OPENROUTER_API_KEY="sk-or-..."
export XAI_API_KEY="xai-..."

# FridayCode auto-detects available providers
friday
```

### First conversation

```bash
# Default mode (code assistant)
friday

# Specify provider and model
friday -p anthropic -m claude-sonnet-4-20250514

# Chat mode
friday --mode chat

# Code review mode
friday --mode review

# Non-interactive (pipe mode)
echo "Explain this error" | friday --non-interactive
```

---

## 2. Using FridayCode

### Modes

| Mode     | Purpose                           | Example                |
| -------- | --------------------------------- | ---------------------- |
| `code`   | Write, edit, debug code (default) | `friday --mode code`   |
| `chat`   | General conversation              | `friday --mode chat`   |
| `review` | Code review with suggestions      | `friday --mode review` |
| `plan`   | Architecture and planning         | `friday --mode plan`   |
| `debug`  | Debug errors and issues           | `friday --mode debug`  |

### Sessions

```bash
# Resume last session
friday --resume

# Resume specific session
friday --session-id abc123
```

### Themes

```bash
# Available: dark (default), light, monokai
friday --theme monokai
```

### Keyboard Shortcuts

| Shortcut  | Action                   |
| --------- | ------------------------ |
| `Ctrl+C`  | Cancel / Exit            |
| `Ctrl+L`  | Clear screen             |
| `Ctrl+N`  | New session              |
| `Ctrl+R`  | Rewind last change       |
| `Escape`  | Cancel current operation |
| `Tab`     | Autocomplete             |
| `Ctrl+K`  | Toggle compact mode      |
| `Ctrl+T`  | Cycle theme              |
| `Ctrl+/`  | Show all shortcuts       |
| `Up/Down` | Navigate history         |

---

## 3. Configuration

### Config file locations (layered, later overrides earlier)

```
~/.friday/config.json       # Global config
.friday/config.json         # Project-local config
Environment variables       # Override any config
CLI flags                   # Highest priority
```

### Example `~/.friday/config.json`

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "theme": "dark",
  "maxIterations": 50,
  "permissions": {
    "autoApprove": ["file_read", "grep", "glob", "directory_tree"],
    "requireApproval": ["file_write", "file_edit", "shell_exec", "git_commit"]
  },
  "budget": {
    "maxCostPerSession": 5.0,
    "warningThreshold": 0.8
  }
}
```

### Environment Variables

| Variable                       | Purpose                           |
| ------------------------------ | --------------------------------- |
| `FRIDAY_PROVIDER`              | Default provider                  |
| `FRIDAY_MODEL`                 | Default model                     |
| `FRIDAY_THEME`                 | UI theme                          |
| `FRIDAY_MAX_ITERATIONS`        | Max agent turns                   |
| `FRIDAY_BUDGET`                | Max cost per session ($)          |
| `CHROME_PATH`                  | Chrome path for browser tool      |
| `FRIDAY_CUSTOM_PROVIDER_*_URL` | Custom OpenAI-compatible endpoint |
| `FRIDAY_CUSTOM_PROVIDER_*_KEY` | API key for custom provider       |

---

## 4. Slash Commands

Type `/` followed by the command name during a conversation:

| Command         | Description                                |
| --------------- | ------------------------------------------ |
| `/help`         | Show all available commands                |
| `/clear`        | Clear conversation history                 |
| `/compact`      | Toggle compact output mode                 |
| `/model <name>` | Switch model mid-conversation              |
| `/models`       | List available models for current provider |
| `/config`       | Show current configuration                 |
| `/cost`         | Show session cost breakdown                |
| `/stats`        | Show usage analytics                       |
| `/checkpoint`   | Create a named checkpoint                  |
| `/rewind`       | Rewind to last checkpoint                  |
| `/theme <name>` | Switch theme                               |
| `/doctor`       | Diagnose environment issues                |
| `/version`      | Show version info                          |

---

## 5. Tools Reference

FridayCode has 16 built-in tools the AI agent can use:

### File Operations

| Tool            | What it does                                 |
| --------------- | -------------------------------------------- |
| `file_read`     | Read file contents (with line range support) |
| `file_write`    | Create or overwrite files                    |
| `file_edit`     | Surgical find-and-replace edits              |
| `notebook_edit` | Read/edit Jupyter notebooks (.ipynb)         |

### Search & Navigation

| Tool             | What it does                              |
| ---------------- | ----------------------------------------- |
| `grep`           | Regex search across files (ripgrep-style) |
| `glob`           | Find files by pattern                     |
| `directory_tree` | Show directory structure                  |

### Execution

| Tool         | What it does                                           |
| ------------ | ------------------------------------------------------ |
| `shell_exec` | Run shell commands                                     |
| `browser`    | Headless browser automation (navigate, click, extract) |

### Git

| Tool           | What it does                   |
| -------------- | ------------------------------ |
| `git`          | General git operations         |
| `git_commit`   | Stage and commit changes       |
| `git_stash`    | Push, pop, list stashes        |
| `git_checkout` | Switch branches, restore files |
| `git_status`   | Show repo status               |

### Network & Interaction

| Tool        | What it does                               |
| ----------- | ------------------------------------------ |
| `web_fetch` | HTTP requests with HTML-to-text conversion |
| `ask_user`  | Ask the user a question                    |

---

## 6. Providers & Models

### Supported Providers (14)

| Provider      | Env Variable               | Models                                |
| ------------- | -------------------------- | ------------------------------------- |
| Anthropic     | `ANTHROPIC_API_KEY`        | claude-sonnet-4, claude-opus-4, haiku |
| OpenAI        | `OPENAI_API_KEY`           | gpt-4o, gpt-4-turbo, o1, o3           |
| Google Gemini | `GOOGLE_API_KEY`           | gemini-2.5-pro, gemini-2.5-flash      |
| Mistral       | `MISTRAL_API_KEY`          | mistral-large, codestral              |
| Groq          | `GROQ_API_KEY`             | llama-3.3-70b, mixtral                |
| DeepSeek      | `DEEPSEEK_API_KEY`         | deepseek-chat, deepseek-coder         |
| Together      | `TOGETHER_API_KEY`         | 100+ open-source models               |
| Cohere        | `COHERE_API_KEY`           | command-r-plus                        |
| OpenRouter    | `OPENROUTER_API_KEY`       | 200+ models, unified API              |
| xAI           | `XAI_API_KEY`              | grok-2, grok-3                        |
| Ollama        | (auto-detect local)        | Any local model                       |
| AWS Bedrock   | AWS credentials            | Claude, Llama on AWS                  |
| Azure OpenAI  | Azure credentials          | GPT models on Azure                   |
| Custom        | `FRIDAY_CUSTOM_PROVIDER_*` | Any OpenAI-compatible API             |

### Auto-Detection Priority

When no provider is specified, FridayCode auto-detects from environment:
**Anthropic → OpenAI → Google → DeepSeek → Mistral → Groq → Together → Cohere → OpenRouter → xAI → Ollama**

### Dynamic Model Fetching

All providers fetch available models from their APIs at runtime (cached for 1 hour). No hardcoded model lists — you always get the latest models.

### Custom OpenAI-Compatible Provider

```bash
# Set up a custom provider (e.g., local vLLM, LiteLLM, etc.)
export FRIDAY_CUSTOM_PROVIDER_MYLLM_URL="http://localhost:8000/v1"
export FRIDAY_CUSTOM_PROVIDER_MYLLM_KEY="your-key"
export FRIDAY_CUSTOM_PROVIDER_MYLLM_MODEL="my-model"

friday -p myllm
```

---

## 7. Sub-Agents

FridayCode can delegate tasks to specialized sub-agents:

### Built-in Presets

| Role       | Specialization          | Available Tools                              |
| ---------- | ----------------------- | -------------------------------------------- |
| `code`     | Write & edit code       | file_edit, file_write, shell_exec, file_read |
| `review`   | Code review (read-only) | file_read, grep, glob                        |
| `test`     | Write tests             | file_edit, file_write, shell_exec, file_read |
| `debug`    | Debug issues            | file_read, shell_exec, grep                  |
| `research` | Research & explore      | web_fetch, grep, glob, file_read             |
| `refactor` | Refactoring             | file_edit, file_read, grep                   |

### How It Works

The main agent can delegate tasks to sub-agents that:

- Run with their own token budget and turn limits
- Can use different providers/models (e.g., cheap model for research)
- Execute in parallel or sequential pipelines
- Return structured results to the parent agent

---

## 8. Skills & Plugins

### Skill Directories

```
~/.friday/skills/       # Global skills (available everywhere)
.friday/skills/         # Project-local skills
```

### Skill Structure

```
~/.friday/skills/my-skill/
  skill.json           # Manifest
  index.js             # Entry point
```

### skill.json Manifest

```json
{
  "name": "my-skill",
  "version": "1.0.0",
  "description": "My custom skill",
  "author": "you",
  "main": "index.js",
  "skills": ["my-skill"]
}
```

### What Skills Can Provide

- **Custom Tools** — new tools the agent can use
- **Slash Commands** — new `/commands`
- **Hooks** — lifecycle callbacks (beforeMessage, afterToolCall, etc.)
- **Prompt Templates** — reusable prompt snippets

### Hook Points

`beforeMessage` · `afterMessage` · `beforeToolCall` · `afterToolCall` · `sessionStart` · `sessionEnd` · `beforeCommit` · `afterCommit`

---

## 9. CI/CD Mode

Run FridayCode headlessly in CI/CD pipelines:

```bash
# Basic usage
friday ci --instruction "Fix all TypeScript errors" --provider openai --model gpt-4o

# With budget and timeout
friday ci -i "Write tests for src/auth.ts" --timeout 300 --max-cost 1.00

# JSON output for parsing
friday ci -i "Review for security issues" --output json

# Restrict tools
friday ci -i "Only read and analyze" --allowed-tools file_read,grep,glob
```

### Exit Codes

| Code | Meaning         |
| ---- | --------------- |
| 0    | Success         |
| 1    | Error           |
| 2    | Timeout         |
| 3    | Budget exceeded |

### GitHub Actions Example

```yaml
name: FridayCode Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install -g fridaycode
      - run: friday ci -i "Review this PR for bugs and security issues" --output markdown
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

---

## 10. Development Setup

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (`npm install -g pnpm`)
- **Git**

### Clone & Install

```bash
git clone https://github.com/katipally/fridaycode.git
cd fridaycode
pnpm install
```

### Build

```bash
pnpm run build         # Build all 10 packages (uses Turbo)
pnpm run build --filter=@fridaycode/core   # Build one package
```

### Dev Mode (hot reload)

```bash
cd packages/cli
pnpm run dev           # Uses tsx — no build needed, auto-reloads
```

### Key Commands

```bash
pnpm run build         # Build all packages
pnpm test              # Run all tests
pnpm run lint          # Lint all code
pnpm run lint:fix      # Auto-fix lint issues
pnpm run format        # Format with Prettier
pnpm run typecheck     # TypeScript type checking
pnpm run clean         # Remove all dist/ and node_modules/
```

---

## 11. Architecture Overview

### Monorepo Structure

```
fridaycode/
├── packages/
│   ├── shared/        @fridaycode/shared     — Logger, errors, types, retry, SQLite
│   ├── providers/     @fridaycode/providers   — 14 LLM provider adapters
│   ├── core/          @fridaycode/core        — Agent loop, commands, cost, permissions
│   ├── tools/         @fridaycode/tools       — 16 built-in tools
│   ├── tui/           @fridaycode/tui         — Terminal UI (Ink/React, 20 components)
│   ├── mcp/           @fridaycode/mcp         — Model Context Protocol server
│   ├── cli/           fridaycode              — CLI entry point (binary)
│   ├── sdk/           @fridaycode/sdk         — Programmatic SDK
│   ├── indexer/       @fridaycode/indexer      — Code indexing (tree-sitter, LSP)
│   └── i18n/          @fridaycode/i18n         — Internationalization
├── docs/              — Design documents
├── scripts/           — Build scripts
└── extensions/        — IDE extensions (future)
```

### Dependency Graph

```
CLI → Core → Shared
   → TUI  → Shared, Core
   → Tools → Shared, Core
   → MCP  → Shared
   → Providers → Shared

SDK → Shared, Providers, Core, Tools
Indexer → (standalone)
i18n → (standalone)
```

### Tech Stack

| Layer           | Technology                              |
| --------------- | --------------------------------------- |
| Runtime         | Node.js ≥ 20, ESM throughout            |
| Language        | TypeScript (strict mode)                |
| Build           | tsup (esbuild), Turbo for orchestration |
| Package Manager | pnpm workspaces                         |
| CLI Framework   | Commander.js                            |
| TUI             | Ink (React for terminal)                |
| Database        | better-sqlite3 with FTS5                |
| Testing         | Vitest                                  |
| Linting         | ESLint + Prettier                       |
| Git Hooks       | Husky + lint-staged                     |

---

## 12. Testing

### Run All Tests

```bash
pnpm test                                    # All packages
pnpm test --filter=@fridaycode/core          # One package
pnpm test --filter=@fridaycode/core -- --watch  # Watch mode
```

### Test Structure

```
packages/*/src/__tests__/              # Unit tests
packages/*/src/__tests__/integration/  # Integration tests
```

### Current Test Coverage

| Package   | Tests    |
| --------- | -------- |
| shared    | 75       |
| core      | 125      |
| tools     | 41       |
| providers | 22       |
| cli (e2e) | 93       |
| indexer   | 13       |
| i18n      | 21       |
| sdk       | 10       |
| **Total** | **400+** |

### Writing Tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MyModule } from '../my-module.js'; // Always .js extension (ESM)

describe('MyModule', () => {
  it('should do something', () => {
    const result = MyModule.doSomething();
    expect(result).toBe(expected);
  });
});
```

---

## 13. Versioning & Changelogs

### Semantic Versioning (SemVer)

```
MAJOR.MINOR.PATCH
  │      │      └── Bug fixes, no API changes
  │      └───────── New features, backward compatible
  └──────────────── Breaking changes
```

**Current version: `0.1.0`** (pre-1.0 = breaking changes expected)

### Commit Convention (Conventional Commits)

```bash
feat: add new browser tool            # → Minor version bump
fix: resolve timeout in web_fetch     # → Patch version bump
feat!: redesign provider interface    # → Major version bump (breaking)
docs: update GUIDE.md                 # → No version bump
test: add integration tests           # → No version bump
chore: update dependencies            # → No version bump
refactor: simplify agent loop         # → No version bump
```

### Version Bumping

```bash
# Bump all packages in sync (recommended for monorepos)
pnpm -r exec -- npm version patch    # 0.1.0 → 0.1.1
pnpm -r exec -- npm version minor    # 0.1.1 → 0.2.0
pnpm -r exec -- npm version major    # 0.2.0 → 1.0.0

# Or use changeset for more control (recommended)
npx changeset                         # Interactive — pick packages + bump type
npx changeset version                 # Apply version bumps
npx changeset publish                 # Publish changed packages
```

### Setting Up Changesets (Recommended)

```bash
pnpm add -D @changesets/cli
npx changeset init

# Before each PR, create a changeset:
npx changeset
# Select packages changed, describe changes, pick bump type
# This creates .changeset/some-name.md

# On release:
npx changeset version    # Updates package.json versions + CHANGELOG.md
npx changeset publish    # Publishes to npm
```

### Changelog

Keep a `CHANGELOG.md` in the root:

```markdown
# Changelog

## [0.2.0] - 2026-04-01

### Added

- Browser automation tool
- Sub-agent delegation system
- SQLite storage with full-text search

### Fixed

- Provider auto-detection priority
- ESM import for LSP module

### Changed

- All providers now fetch models dynamically
```

---

## 14. Publishing to npm

### Prerequisites

```bash
# Log in to npm
npm login

# Verify you're logged in
npm whoami
```

### First-Time Setup

```bash
# Ensure all packages have correct metadata in package.json:
# - "name": "@fridaycode/core" (scoped) or "fridaycode" (CLI)
# - "version": "0.1.0"
# - "license": "MIT"
# - "repository": { "type": "git", "url": "..." }
# - "publishConfig": { "access": "public" }  ← Required for scoped packages

# Create the npm org (one-time)
# Go to https://www.npmjs.com/org/create → create "fridaycode" org
```

### Add `publishConfig` to Each Scoped Package

```json
{
  "name": "@fridaycode/core",
  "publishConfig": {
    "access": "public"
  }
}
```

### Publishing

```bash
# 1. Build everything
pnpm run build

# 2. Run tests
pnpm test

# 3. Bump versions
pnpm -r exec -- npm version patch

# 4. Publish all packages
pnpm -r publish --access public

# Or use the built-in script:
pnpm run publish:all
```

### Publishing Order (respects dependencies)

pnpm handles this automatically, but the order is:

1. `@fridaycode/shared` (no internal deps)
2. `@fridaycode/i18n` (no internal deps)
3. `@fridaycode/indexer` (no internal deps)
4. `@fridaycode/providers` (→ shared)
5. `@fridaycode/core` (→ shared, providers)
6. `@fridaycode/tools` (→ shared, core)
7. `@fridaycode/tui` (→ shared, core)
8. `@fridaycode/mcp` (→ shared)
9. `@fridaycode/sdk` (→ shared, providers, core, tools)
10. `fridaycode` CLI (→ everything)

### npm Package Files

Add `.npmignore` or use `files` field in package.json to control what gets published:

```json
{
  "files": ["dist/", "README.md", "LICENSE"]
}
```

### Verify Before Publishing

```bash
# Dry run — see what would be published
pnpm -r exec -- npm pack --dry-run

# Check package size
pnpm -r exec -- npm pack
ls -lh packages/*/*.tgz
```

---

## 15. Publishing to Homebrew

### Option A: Homebrew Tap (Recommended for new projects)

A "tap" is a custom Homebrew repository. Easiest way to distribute.

#### 1. Create the tap repository

Create a GitHub repo named `homebrew-tap` under your org:
`github.com/katipally/homebrew-tap`

#### 2. Create the Formula

Create `Formula/fridaycode.rb` in that repo:

```ruby
class Fridaycode < Formula
  desc "Open-source multi-provider AI coding agent for the terminal"
  homepage "https://github.com/katipally/fridaycode"
  url "https://registry.npmjs.org/fridaycode/-/fridaycode-0.1.0.tgz"
  sha256 "REPLACE_WITH_ACTUAL_SHA256"
  license "MIT"

  depends_on "node@20"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec/"bin/friday"
    bin.install_symlink libexec/"bin/fridaycode"
  end

  test do
    assert_match "fridaycode", shell_output("#{bin}/friday --version")
  end
end
```

#### 3. Get the SHA256

```bash
curl -sL https://registry.npmjs.org/fridaycode/-/fridaycode-0.1.0.tgz | shasum -a 256
```

#### 4. Users Install Via

```bash
brew tap katipally/tap
brew install fridaycode
```

### Option B: Standalone Binary (Advanced)

Build a standalone Node.js binary using `pkg` or `bun build --compile`:

```bash
# Using the existing build:binary script
pnpm run build:binary

# This creates platform-specific binaries in dist/
# Upload these to GitHub Releases, then reference in Homebrew formula
```

### Option C: Official Homebrew Core (After Popularity)

Once the project has significant adoption, submit to `homebrew/homebrew-core`:

1. Must meet [Homebrew's acceptability criteria](https://docs.brew.sh/Acceptable-Formulae)
2. Needs 50+ GitHub stars, active maintenance
3. Submit PR to `homebrew/homebrew-core` with the formula

---

## 16. GitHub Releases

### Existing CI/CD Workflows

The repo already has workflows in `.github/workflows/`:

| Workflow      | Trigger        | Action                                                   |
| ------------- | -------------- | -------------------------------------------------------- |
| `ci.yml`      | Push/PR        | Lint, typecheck, test (Node 20/22, ubuntu/macos/windows) |
| `publish.yml` | Release/manual | Publish to npm                                           |
| `release.yml` | Tag `v*`       | Publish + create GitHub Release                          |

### Creating a Release

```bash
# 1. Bump versions
pnpm -r exec -- npm version minor

# 2. Commit the version bump
git add -A
git commit -m "chore: release v0.2.0"

# 3. Create a git tag
git tag v0.2.0

# 4. Push with tags
git push origin main --tags
# → Triggers release.yml → publishes to npm + creates GitHub Release
```

### Manual Release

```bash
# Create release on GitHub with notes
gh release create v0.2.0 \
  --title "v0.2.0 — Sub-Agents & Browser Tools" \
  --notes "## What's New
- Sub-agent delegation system
- Browser automation tool
- SQLite storage with full-text search
- 14 providers with dynamic model fetching

## Breaking Changes
None

## Full Changelog
https://github.com/katipally/fridaycode/compare/v0.1.0...v0.2.0"
```

---

## 17. Sending Updates

### The Full Release Cycle

```
Code → Test → Version Bump → Changelog → Tag → Push → CI/CD → npm + GitHub Release
```

### Step-by-Step Update Process

```bash
# 1. Make your changes on a feature branch
git checkout -b feat/new-feature
# ... make changes ...
git add -A
git commit -m "feat: add new feature"

# 2. Open PR, get reviews, merge to main
gh pr create --fill
# After merge:
git checkout main && git pull

# 3. Bump version
pnpm -r exec -- npm version minor   # or patch/major

# 4. Update CHANGELOG.md
# Add new section at top with changes

# 5. Commit and tag
git add -A
git commit -m "chore: release v0.2.0"
git tag v0.2.0
git push origin main --tags

# 6. CI/CD handles the rest:
#    - publish.yml publishes to npm
#    - release.yml creates GitHub Release
```

### Hotfix Process

```bash
# For urgent fixes:
git checkout -b fix/critical-bug
# ... fix the bug ...
git commit -m "fix: critical security patch"
# Merge to main, then:
pnpm -r exec -- npm version patch    # 0.2.0 → 0.2.1
git add -A && git commit -m "chore: release v0.2.1"
git tag v0.2.1
git push origin main --tags
```

### Update Homebrew Tap

After npm publish, update the Homebrew formula:

```bash
# In homebrew-tap repo:
# Update url version and sha256 in Formula/fridaycode.rb
# Commit and push
```

Or automate with a GitHub Action in your main repo that updates the tap on release.

---

## 18. Maintaining Open Source

### Repository Health Checklist

- [ ] **README.md** — Clear description, install instructions, badges
- [ ] **LICENSE** — MIT (already set ✓)
- [ ] **CONTRIBUTING.md** — How to contribute (already exists ✓)
- [ ] **CODE_OF_CONDUCT.md** — Create one (use Contributor Covenant)
- [ ] **SECURITY.md** — How to report vulnerabilities
- [ ] **Issue templates** — Bug report + feature request (already exist ✓)
- [ ] **PR template** — Checklist for contributors
- [ ] **CI/CD** — Automated tests on every PR (already exists ✓)

### Create CODE_OF_CONDUCT.md

```bash
# Use GitHub's built-in generator or Contributor Covenant:
# https://www.contributor-covenant.org/version/2/1/code_of_conduct/
```

### Create SECURITY.md

```markdown
# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities by emailing security@fridaycode.dev.
Do NOT open a public issue for security vulnerabilities.

We will respond within 48 hours and provide a fix within 7 days.
```

### Issue Management

```bash
# Label system (create these in GitHub Settings → Labels)
bug              # Something isn't working
enhancement      # New feature request
good first issue # Good for newcomers
help wanted      # Extra attention needed
documentation    # Documentation improvements
priority: high   # Urgent
priority: low    # Nice to have
wontfix          # Not planned
duplicate        # Already exists
```

### Community Building

1. **Star the repo yourself** and ask early users to star it
2. **Write a launch blog post** on Dev.to, Hashnode, or Medium
3. **Post on Reddit** — r/programming, r/commandline, r/node
4. **Tweet/post** on X, Bluesky, Mastodon with a demo GIF
5. **Submit to** Product Hunt, Hacker News (Show HN)
6. **Add badges** to README: npm version, downloads, CI status, license
7. **Create a Discord/Discussions** for community Q&A
8. **Tag issues** with `good first issue` to attract contributors

### README Badges

```markdown
[![npm version](https://img.shields.io/npm/v/fridaycode)](https://www.npmjs.com/package/fridaycode)
[![CI](https://github.com/katipally/fridaycode/actions/workflows/ci.yml/badge.svg)](https://github.com/katipally/fridaycode/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Downloads](https://img.shields.io/npm/dm/fridaycode)](https://www.npmjs.com/package/fridaycode)
```

### Dependency Updates

```bash
# Check for outdated dependencies
pnpm outdated

# Update all dependencies
pnpm update

# Update to latest major versions (careful!)
pnpm update --latest

# Use Renovate or Dependabot for automated PRs
# Add .github/dependabot.yml:
```

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
    groups:
      production:
        patterns: ['*']
```

### Maintaining Quality

1. **Never merge without CI passing** — enforce branch protection
2. **Require PR reviews** — at least 1 approval
3. **Keep tests green** — fix flaky tests immediately
4. **Respond to issues** within 48 hours (even if just "acknowledged")
5. **Tag releases** consistently using SemVer
6. **Write migration guides** for breaking changes
7. **Deprecate before removing** — warn for 1-2 minor versions first

---

## 19. Troubleshooting

### Common Issues

#### "Provider not found"

```bash
# Check which providers are available:
node -e "
  const keys = ['OPENAI_API_KEY','ANTHROPIC_API_KEY','GOOGLE_API_KEY','GROQ_API_KEY'];
  keys.forEach(k => console.log(k + ':', process.env[k] ? '✓ set' : '✗ missing'));
"
```

#### "Cannot find module" errors

```bash
pnpm run clean && pnpm install && pnpm run build
```

#### Build failures

```bash
# Check TypeScript errors
pnpm run typecheck

# Build one package at a time to isolate
pnpm run build --filter=@fridaycode/shared
pnpm run build --filter=@fridaycode/providers
pnpm run build --filter=@fridaycode/core
# ... etc
```

#### Browser tool not working

```bash
# Ensure Chrome is installed
# Set path explicitly if needed:
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

#### SQLite errors

```bash
# Rebuild native module
cd packages/shared && pnpm rebuild better-sqlite3
```

#### "punycode" deprecation warning

This is a harmless Node.js warning. Suppress with:

```bash
NODE_OPTIONS="--no-deprecation" friday
```

### Debug Mode

```bash
# Verbose logging
DEBUG=friday:* friday

# Check environment
friday --mode chat
# Then type: /doctor
```

### Getting Help

- **GitHub Issues:** https://github.com/katipally/fridaycode/issues
- **Discussions:** https://github.com/katipally/fridaycode/discussions
- **Run diagnostics:** `/doctor` command inside FridayCode

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│                    FridayCode CLI                        │
├─────────────────────────────────────────────────────────┤
│ Install:    npm i -g fridaycode                         │
│ Run:        friday                                      │
│ With model: friday -p anthropic -m claude-sonnet-4-20250514    │
│ CI mode:    friday ci -i "Fix bugs" --output json       │
│ Dev mode:   cd packages/cli && pnpm run dev             │
│ Build:      pnpm run build                              │
│ Test:       pnpm test                                   │
│ Publish:    pnpm run publish:all                        │
│ Release:    git tag v0.2.0 && git push --tags           │
├─────────────────────────────────────────────────────────┤
│ Config:     ~/.friday/config.json                       │
│ Skills:     ~/.friday/skills/                           │
│ Database:   ~/.friday/friday.db                         │
├─────────────────────────────────────────────────────────┤
│ 14 providers │ 16 tools │ 13 commands │ 6 sub-agents   │
│ 3 themes     │ 11 shortcuts │ 20 TUI components        │
└─────────────────────────────────────────────────────────┘
```
