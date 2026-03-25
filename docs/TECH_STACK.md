# Friday CLI — Technology Stack & Dependencies

## Core Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Language | TypeScript | 5.x | Primary language |
| Runtime | Node.js | 22 LTS | Execution environment |
| Package Manager | pnpm | 9.x | Monorepo management |
| Build Orchestrator | Turborepo | latest | Monorepo build pipeline |
| Bundler | tsup | latest | Fast TypeScript bundling |

## Presentation Layer

| Package | Purpose | Used By |
|---------|---------|--------|
| `ink` | React-based terminal UI framework | Claude Code, Gemini CLI |
| `react` | Component model for Ink | — |
| `ink-text-input` | Text input component | — |
| `ink-spinner` | Loading spinners | — |
| `ink-select-input` | Selection menus | — |
| `marked` | Markdown parsing | — |
| `marked-terminal` | Markdown → terminal rendering | — |
| `shiki` | Syntax highlighting for code blocks | — |
| `terminal-image` | Sixel/Kitty image rendering | — |
| `cli-table3` | Table rendering | — |
| `chalk` | Terminal colors (used within Ink) | — |
| `figures` | Unicode symbols for terminals | — |

## CLI Framework

| Package | Purpose |
|---------|---------|
| `commander` | CLI argument parsing, subcommands |
| `ora` | Standalone spinners (non-Ink contexts) |
| `update-notifier` | Auto-update notifications |

## LLM Provider SDKs

| Package | Provider |
|---------|----------|
| `openai` | OpenAI, Azure OpenAI, OpenAI-compatible APIs |
| `@anthropic-ai/sdk` | Anthropic (Claude) |
| `@google/generative-ai` | Google Gemini |
| `ollama` | Ollama (local models) |
| `@mistralai/mistralai` | Mistral AI |
| `@aws-sdk/client-bedrock-runtime` | AWS Bedrock |
| `groq-sdk` | Groq |
| `cohere-ai` | Cohere |

## Agent Infrastructure

| Package | Purpose |
|---------|---------|
| `tiktoken` | OpenAI token counting |
| `@anthropic-ai/tokenizer` | Anthropic token counting |
| `zod` | Schema validation (config, API responses) |
| `eventsource-parser` | SSE stream parsing |
| `p-queue` | Concurrency control for sub-agents |
| `p-retry` | Retry logic for API calls |

## Data & Storage

| Package | Purpose |
|---------|---------|
| `better-sqlite3` | Session persistence, memory store |
| `keytar` | OS keychain for API key storage |
| `conf` | Simple config file management |

## Codebase Indexing

| Package | Purpose |
|---------|---------|
| `tree-sitter` | AST parsing for code analysis |
| `tree-sitter-typescript` | TypeScript grammar |
| `tree-sitter-javascript` | JavaScript grammar |
| `tree-sitter-python` | Python grammar |
| `tree-sitter-rust` | Rust grammar |
| `tree-sitter-go` | Go grammar |
| `tree-sitter-java` | Java grammar |
| `tree-sitter-c` | C grammar |
| `tree-sitter-cpp` | C++ grammar |
| Additional grammars | Ruby, PHP, Swift, Kotlin, etc. |

## File Operations & Search

| Package | Purpose |
|---------|---------|
| `@vscode/ripgrep` or `@vscode-ripgrep` | Fast code search |
| `glob` / `fast-glob` | File pattern matching |
| `simple-git` | Git operations |
| `chokidar` | File watching (for incremental indexing) |
| `diff` | Text diffing for file edits |

## MCP (Model Context Protocol)

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | Official MCP SDK |
| JSON-RPC implementation | MCP communication |

## Internationalization

| Package | Purpose |
|---------|---------|
| `i18next` | i18n framework |
| `i18next-fs-backend` | File-based locale loading |

## Testing

| Package | Purpose |
|---------|---------|
| `vitest` | Test framework |
| `@vitest/coverage-v8` | Code coverage |
| `msw` (Mock Service Worker) | HTTP mocking for provider tests |
| `@testing-library/react` | Ink component testing |

## Code Quality

| Package | Purpose |
|---------|---------|
| `eslint` | Linting |
| `prettier` | Code formatting |
| `@typescript-eslint/parser` | TypeScript ESLint support |
| `@typescript-eslint/eslint-plugin` | TypeScript ESLint rules |
| `husky` | Git hooks |
| `lint-staged` | Run linters on staged files |
| `commitlint` | Conventional commit enforcement |

## CI/CD & Distribution

| Tool | Purpose |
|------|---------|
| GitHub Actions | CI/CD pipeline |
| `pkg` or Node.js SEA | Standalone binary generation |
| Homebrew formula | macOS/Linux package distribution |
| `changeset` | Version management & changelogs |
| `semantic-release` | Automated npm publishing |

## Documentation

| Tool | Purpose |
|------|---------|
| Docusaurus or VitePress | Documentation website |
| `typedoc` | API reference generation from TypeScript |

## VS Code Extension

| Package | Purpose |
|---------|---------|
| `vscode` (API) | Extension development |
| `@vscode/vsce` | Extension packaging |

---

## Node.js Version Requirements

- **Minimum:** Node.js 20 LTS
- **Recommended:** Node.js 22 LTS
- **Reason:** Native fetch, SEA support, modern ES features, performance

## TypeScript Configuration

```jsonc
// Base tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
```

## Estimated Package Count

- **Production dependencies:** ~45-55 packages
- **Dev dependencies:** ~25-30 packages
- **Total:** ~70-85 packages (lean for a tool of this scope)
