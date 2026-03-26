# fridaycode Project Rules

## Code Style
- TypeScript strict mode everywhere
- Use named exports, not default exports
- Prefer functional patterns over classes where practical
- Use ESM imports with .js extensions

## Testing
- Write unit tests for every new module
- Use Vitest for testing
- Tests go in __tests__/ directories next to source
- Aim for 80%+ coverage on core modules

## Git
- Use conventional commits (feat:, fix:, chore:, docs:, test:, refactor:)
- Never commit directly to main
- Keep commits atomic and well-described

## Architecture
- Packages communicate through well-defined interfaces
- Provider adapters implement LLMProvider interface
- Tools implement the Tool interface
- All file paths resolved relative to workspace root

## Dependencies
- Prefer workspace dependencies (workspace:*)
- Keep external dependencies minimal
- Use tsup for building packages
