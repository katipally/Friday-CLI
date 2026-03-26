# FridayCode — Development Guide

This guide covers everything you need to develop, test, debug, and run FridayCode locally.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Initial Setup](#initial-setup)
- [Development Workflow](#development-workflow)
- [Running Locally](#running-locally)
- [Testing](#testing)
- [Debugging](#debugging)
- [Code Architecture](#code-architecture)
- [Adding a New Tool](#adding-a-new-tool)
- [Adding a New Provider](#adding-a-new-provider)
- [Adding a Slash Command](#adding-a-slash-command)
- [Adding a Theme](#adding-a-theme)
- [Common Issues](#common-issues)

---

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| **Node.js** | ≥ 20.0.0 | `node --version` |
| **npm** | ≥ 9.0.0 | `npm --version` |
| **TypeScript** | ≥ 5.x (installed via devDeps) | `npx tsc --version` |
| **Git** | any recent version | `git --version` |

Optional (for local AI):
| Tool | Version | Check |
|------|---------|-------|
| **Ollama** | latest | `ollama --version` |

---

## Project Structure

```
fridaycode/
├── package.json                    # Root workspace config
├── tsconfig.base.json              # Shared TS compiler options
├── tsconfig.json                   # Root project references
├── vitest.config.ts                # Test configuration
├── .eslintrc.js                    # Linting rules
├── .prettierrc                     # Formatting rules
├── .github/workflows/ci.yml       # CI pipeline
│
├── packages/
│   ├── shared/                     # @fridaycode/shared
│   │   └── src/
│   │       ├── types.ts            # ALL TypeScript interfaces
│   │       ├── constants.ts        # Colors, limits, defaults
│   │       ├── utils.ts            # Utility functions
│   │       └── index.ts            # Barrel export
│   │
│   ├── core/                       # @fridaycode/core
│   │   └── src/
│   │       ├── providers/          # AI model providers
│   │       │   ├── base.ts         # Abstract BaseProvider
│   │       │   ├── ollama.ts       # Ollama (local)
│   │       │   ├── anthropic.ts    # Anthropic (Claude)
│   │       │   ├── openai.ts       # OpenAI (GPT)
│   │       │   ├── openai-compat.ts # OpenAI-compatible APIs
│   │       │   └── index.ts        # Factory + Registry
│   │       ├── tools/              # 25+ built-in tools
│   │       │   ├── registry.ts     # Tool registry with permission checks
│   │       │   ├── bash.ts         # Shell execution
│   │       │   ├── read.ts         # File reading
│   │       │   ├── write.ts        # File writing
│   │       │   ├── edit.ts         # String replacement editing
│   │       │   ├── glob.ts         # File pattern matching
│   │       │   ├── grep.ts         # Text/regex search
│   │       │   ├── list-dir.ts     # Directory listing
│   │       │   ├── web-fetch.ts    # URL fetching
│   │       │   ├── web-search.ts   # DuckDuckGo search
│   │       │   ├── ask-user.ts     # Interactive prompts
│   │       │   ├── todo-write.ts   # Task checklist
│   │       │   ├── cron.ts         # Scheduled tasks
│   │       │   ├── tasks.ts        # Background tasks
│   │       │   ├── agent.ts        # Subagent spawning
│   │       │   ├── skill.ts        # Skill invocation
│   │       │   ├── advanced.ts     # Notebook, LSP, MCP tools
│   │       │   └── index.ts        # Barrel + createDefaultToolRegistry()
│   │       ├── agents/             # Agent engine
│   │       │   ├── engine.ts       # AgentEngine + AgentRuntime
│   │       │   ├── context.ts      # Context compaction
│   │       │   ├── built-in.ts     # Explore, Plan, General agents
│   │       │   └── index.ts
│   │       ├── settings/           # Configuration
│   │       │   ├── schema.ts       # Zod validation schema
│   │       │   ├── loader.ts       # 4-scope settings merge
│   │       │   ├── permissions.ts  # PermissionEngine
│   │       │   └── index.ts
│   │       ├── memory/             # FRIDAY.md + auto-memory
│   │       ├── session/            # Session CRUD + JSONL transcripts
│   │       ├── hooks/              # Event hooks (command + HTTP)
│   │       ├── git/                # Git integration
│   │       │   ├── worktree.ts     # Git worktrees
│   │       │   ├── attribution.ts  # AI commit tagging
│   │       │   ├── branch.ts       # Branch operations
│   │       │   └── pr.ts           # PR diff analysis
│   │       ├── skills/             # Skill system
│   │       │   ├── loader.ts       # SKILL.md parser
│   │       │   ├── runner.ts       # $ARGUMENTS substitution
│   │       │   └── built-in.ts     # batch, debug, loop, simplify
│   │       ├── plugins/            # Plugin system
│   │       │   ├── loader.ts       # Plugin discovery
│   │       │   ├── registry.ts     # Namespaced resolution
│   │       │   └── lifecycle.ts    # Init, activate, deactivate
│   │       ├── telemetry/          # Opt-in anonymous stats
│   │       └── index.ts            # Master barrel file
│   │
│   └── cli/                        # fridaycode-cli
│       ├── bin/friday.ts           # Entry point (shebang)
│       └── src/
│           ├── index.ts            # Commander.js CLI + pipe mode
│           ├── app.tsx             # Root Ink App (agentic loop)
│           ├── components/         # Ink UI components
│           │   ├── Output.tsx      # Message renderer
│           │   ├── Prompt.tsx      # Input with history
│           │   ├── StatusBar.tsx   # Model/token/state display
│           │   ├── TaskList.tsx    # Background task panel
│           │   ├── DiffViewer.tsx  # Git diff display
│           │   ├── ModelSwitcher.tsx # Model selection UI
│           │   ├── PermissionPrompt.tsx # Allow/deny dialog
│           │   └── ContextViewer.tsx   # Token usage bar
│           ├── mascot/             # Friday the Spider 🕷️
│           │   ├── expressions.ts  # 7 eye states
│           │   ├── renderer.ts     # ASCII art (small + large)
│           │   ├── animations.ts   # Blink, thinking, crawling
│           │   ├── welcome.tsx     # Welcome screen component
│           │   └── prompt-spider.tsx # Prompt area spider
│           ├── input/              # Input system
│           │   ├── vim-mode.ts     # Vi keybindings
│           │   ├── history.ts      # Persistent command history
│           │   └── completion.ts   # Tab completion engine
│           ├── themes/             # Theming system
│           │   ├── engine.ts       # Theme registry + helpers
│           │   ├── dark.ts         # Default dark theme
│           │   └── light.ts        # Light theme
│           ├── commands/           # Slash commands
│           │   ├── router.ts       # Command parser + dispatch
│           │   └── handlers.ts     # 20+ command handlers
│           └── onboarding/         # First-run wizard
│               └── wizard.ts       # Provider detection + setup
```

---

## Initial Setup

```bash
# 1. Clone the repo
git clone https://github.com/<your-username>/fridaycode.git
cd fridaycode

# 2. Install all dependencies (npm workspaces will link packages)
npm install

# 3. Build all packages (shared → core → cli)
npm run build

# 4. Verify the build
npx tsc --build   # Should produce no output (= no errors)

# 5. Run tests
npm test          # Should show 28 passing tests
```

### Verify everything works:

```bash
# Direct execution via tsx (no build needed)
npx tsx packages/cli/src/index.ts --help

# Or with the built version
node packages/cli/dist/index.js --help
```

---

## Development Workflow

### Daily Development Loop

```bash
# 1. Start with a clean build
npm run build

# 2. Make your changes in any package

# 3. Rebuild (incremental — only changed files)
npm run build

# 4. Type check without emitting (faster)
npm run typecheck

# 5. Test your changes
npm test

# 6. Lint + format
npm run lint:fix
npm run format
```

### Watch Mode

For active development, you can watch for changes:

```bash
# Watch shared + core for changes (two terminals)
cd packages/shared && npx tsc --build --watch
cd packages/core && npx tsc --build --watch

# Run CLI in dev mode (uses tsx for instant TypeScript execution)
npm run dev
# This runs: npx tsx packages/cli/src/index.ts
```

### Quick Iteration

Since the CLI is the most-changed package, you can skip building and run directly:

```bash
# Run without building (tsx transpiles on-the-fly)
npx tsx packages/cli/bin/friday.ts

# With arguments
npx tsx packages/cli/bin/friday.ts "explain this codebase"

# Pipe mode
echo "hello world" | npx tsx packages/cli/bin/friday.ts -p "translate to spanish"
```

---

## Running Locally

### Interactive Mode

```bash
# Using tsx (development)
npx tsx packages/cli/bin/friday.ts

# Using built version
node packages/cli/dist/index.js
```

### With a Specific Provider

```bash
# Ollama (requires: ollama serve running locally)
npx tsx packages/cli/bin/friday.ts --provider ollama --model llama3.1:8b

# Anthropic (requires: ANTHROPIC_API_KEY env var)
ANTHROPIC_API_KEY=sk-ant-xxx npx tsx packages/cli/bin/friday.ts --provider anthropic --model claude-sonnet-4-20250514

# OpenAI (requires: OPENAI_API_KEY env var)
OPENAI_API_KEY=sk-xxx npx tsx packages/cli/bin/friday.ts --provider openai --model gpt-4o
```

### Pipe Mode (Non-Interactive)

```bash
# Simple prompt
echo "explain recursion" | npx tsx packages/cli/bin/friday.ts -p

# With JSON output
cat src/file.ts | npx tsx packages/cli/bin/friday.ts -p "review this code" --json

# Accept all tools automatically
npx tsx packages/cli/bin/friday.ts -y "create a hello world express server"
```

### Configuration

Settings are loaded from these paths (in priority order):

```
~/.friday/managed-settings.json    # 1. Managed (highest priority)
.friday/settings.local.json        # 2. Local (gitignored)
.friday/settings.json              # 3. Project (committed)
~/.friday/settings.json            # 4. User (lowest priority)
```

Example `~/.friday/settings.json`:

```json
{
  "activeProvider": "ollama",
  "activeModel": "llama3.1:8b",
  "providers": {
    "ollama": {
      "type": "ollama",
      "enabled": true,
      "baseUrl": "http://localhost:11434"
    },
    "anthropic": {
      "type": "anthropic",
      "enabled": true,
      "baseUrl": "https://api.anthropic.com",
      "apiKey": "${ANTHROPIC_API_KEY}"
    }
  },
  "permissionMode": "default",
  "theme": "dark",
  "vimMode": false
}
```

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file change)
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run a specific test file
npx vitest run packages/shared/src/utils.test.ts

# Run tests matching a pattern
npx vitest run -t "vim"
```

### Test File Locations

Test files live next to their source files with `.test.ts` suffix:

```
packages/shared/src/utils.test.ts          # Shared utilities
packages/core/src/tools/registry.test.ts   # Tool registry
packages/cli/src/input/vim-mode.test.ts     # Vim mode
```

### Writing Tests

Tests use [Vitest](https://vitest.dev/) with globals enabled:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { myFunction } from './my-module.js';

describe('myFunction', () => {
  it('should do something', () => {
    expect(myFunction('input')).toBe('expected');
  });
});
```

### Coverage Thresholds

The project enforces 80% coverage thresholds (configured in `vitest.config.ts`):
- Statements: 80%
- Branches: 80%
- Functions: 80%
- Lines: 80%

CLI `.tsx` components are excluded from coverage since they require ink-testing-library.

---

## Debugging

### TypeScript Errors

```bash
# Full type check with detailed errors
npx tsc --build --verbose

# Clean build (wipes incremental cache)
npm run clean && npm run build

# Check a single package
cd packages/core && npx tsc --build
```

### Runtime Debugging

```bash
# Run with Node.js inspector
node --inspect packages/cli/dist/index.js

# Or with tsx
node --import tsx --inspect packages/cli/bin/friday.ts

# Enable verbose output
npx tsx packages/cli/bin/friday.ts -v "test prompt"
```

### Common Debug Scenarios

**"Module not found" errors:**
```bash
# Ensure shared is built before core, core before cli
npm run clean && npm run build
```

**"Cannot import ESM" errors:**
```bash
# All packages use "type": "module" — ensure .js extensions in imports
# TypeScript files must import with .js extension:
import { foo } from './bar.js';  // ✅ correct
import { foo } from './bar';     // ❌ wrong
```

**Provider connection issues:**
```bash
# Test Ollama connectivity
curl http://localhost:11434/api/tags

# Test Anthropic API key
curl -H "x-api-key: $ANTHROPIC_API_KEY" https://api.anthropic.com/v1/models
```

---

## Code Architecture

### Data Flow

```
User Input → CLI (commander.js) → App.tsx (Ink)
  → Provider.chat() → Streaming Response
  → Tool Calls → ToolRegistry.execute() → Tool Results
  → Loop back to Provider.chat() until no more tool calls
  → Display final response
```

### Package Dependencies

```
@fridaycode/shared ← (no dependencies, pure types + utils)
@fridaycode/core   ← depends on shared
fridaycode-cli     ← depends on shared + core
```

### Key Design Patterns

1. **Streaming**: All providers use `AsyncIterable<StreamChunk>` for streaming
2. **Tool Registry**: Tools register once, are resolved by name at runtime
3. **Context Injection**: Tools that need CLI features (askUser, runAgent) receive them via context casting
4. **4-Scope Settings**: Managed > Local > Project > User merge order
5. **Permission Engine**: 3 modes (default=ask, acceptAll=auto, plan=read-only)

---

## Adding a New Tool

1. Create `packages/core/src/tools/my-tool.ts`:

```typescript
import type { Tool, ToolContext, ToolResult } from '@fridaycode/shared';

interface MyToolInput {
  param: string;
}

export const myTool: Tool = {
  definition: {
    name: 'MyTool',
    description: 'What this tool does',
    inputSchema: {
      type: 'object',
      properties: {
        param: { type: 'string', description: 'Parameter description' },
      },
      required: ['param'],
    },
    requiresPermission: false,
    isReadOnly: true,
  },
  async execute(raw: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = raw as unknown as MyToolInput;
    return { toolCallId: '', content: `Result: ${input.param}`, isError: false };
  },
};
```

2. Export from `packages/core/src/tools/index.ts`:

```typescript
export { myTool } from './my-tool.js';
// And add to createDefaultToolRegistry():
registry.register(myTool);
```

3. Export from `packages/core/src/index.ts`:

```typescript
export { myTool } from './tools/index.js';
```

---

## Adding a New Provider

1. Create `packages/core/src/providers/my-provider.ts` extending `BaseProvider`
2. Implement: `fetchModels()`, `chat()`, `supportsToolUse()`, etc.
3. Add to `createProvider()` factory in `packages/core/src/providers/index.ts`
4. Add provider type to `ProviderType` union in `packages/shared/src/types.ts`

---

## Adding a Slash Command

Add to `packages/cli/src/commands/handlers.ts`:

```typescript
registerCommand({
  name: '/mycommand',
  aliases: ['/mc'],
  description: 'Description of my command',
  usage: '/mycommand <arg>',
  handler(args, ctx) {
    ctx.print(`You said: ${args}`);
  },
});
```

The command is automatically available — no other wiring needed.

---

## Adding a Theme

Create `packages/cli/src/themes/my-theme.ts`:

```typescript
import { Theme, registerTheme } from './engine.js';

export const myTheme: Theme = {
  name: 'my-theme',
  description: 'My custom theme',
  colors: { /* ... */ },
  ansi: { /* ... */ },
  symbols: { /* ... */ },
};

registerTheme(myTheme);
```

Then import it in `packages/cli/src/themes/index.ts`.

---

## Common Issues

| Problem | Solution |
|---------|----------|
| `ERR_MODULE_NOT_FOUND` | Run `npm run build` — all packages need to compile |
| `Cannot find module '@fridaycode/shared'` | Run `npm install` — workspace linking may be broken |
| Tests fail after file changes | Run `npm run build` before `npm test` |
| Ink rendering issues | Ensure terminal supports 256 colors |
| Ollama not connecting | Verify `ollama serve` is running on port 11434 |
| API key not found | Set `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` env var |
| `tsc` doesn't see new files | Delete `*.tsbuildinfo` files: `rm packages/*/*.tsbuildinfo` |
