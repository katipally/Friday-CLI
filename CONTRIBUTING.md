# Contributing to Friday CLI

Thank you for your interest in contributing to Friday CLI! This guide will help you get started.

## Development Setup

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (`npm install -g pnpm`)
- **Git**

### Getting Started

```bash
# Clone the repo
git clone https://github.com/katipally/Friday-CLI.git
cd Friday-CLI

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run in development mode (watch)
pnpm dev
```

## Project Structure

```
packages/
├── shared/      # Shared utilities, types, logger
├── providers/   # LLM provider adapters
├── core/        # Agent loop, permissions, context, rules
├── tools/       # Built-in tools (file, shell, grep, git)
├── tui/         # Ink-based terminal UI
├── mcp/         # MCP client for external tools
├── cli/         # CLI entry point and commands
├── sdk/         # Programmatic SDK
├── indexer/     # Tree-sitter codebase indexing
└── i18n/        # Internationalization
```

## How to Contribute

### Adding a New Provider

1. Create a new file in `packages/providers/src/adapters/`
2. Implement the `LLMProvider` interface from `../types.js`
3. Self-register with `registerProvider('name', factory)` from `../registry.js`
4. Add the import to `packages/providers/src/index.ts`
5. Add any required SDK to `packages/providers/package.json`
6. Write tests in `packages/providers/src/__tests__/`

### Adding a New Tool

1. Create a new file in `packages/tools/src/built-in/`
2. Export a `Tool` object with `name`, `description`, `parameters`, and `execute()`
3. Register it in `packages/tools/src/built-in/index.ts`
4. Add it to the default registry in `packages/tools/src/index.ts`

### Adding a Slash Command

1. Create a new file in `packages/cli/src/commands/`
2. Export a `SlashCommand` object
3. Register it in `packages/cli/src/commands/index.ts`

## Coding Standards

- **TypeScript strict mode** — no `any` types unless absolutely necessary
- **Named exports** — no default exports
- **ESM imports** — use `.js` extensions in import paths
- **Functional patterns** — prefer functions over classes where practical
- **Logging** — use `createLogger('namespace')` from `@fridaycode/shared`

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation changes
- `test:` — Adding or updating tests
- `chore:` — Maintenance, dependencies, CI
- `refactor:` — Code changes that don't add features or fix bugs

## Testing

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @fridaycode/core test

# Run tests in watch mode
pnpm --filter @fridaycode/core test -- --watch
```

## Pull Request Process

1. Fork the repository and create a feature branch
2. Make your changes with tests
3. Ensure all tests pass (`pnpm test`)
4. Ensure the build succeeds (`pnpm build`)
5. Submit a PR with a clear description of your changes
6. Wait for review — maintainers will provide feedback

## Code of Conduct

Please be respectful and constructive. See [CODE_OF_CONDUCT.md](.github/CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
