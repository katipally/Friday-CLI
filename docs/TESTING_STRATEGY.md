# Comprehensive Testing Strategy

Testing strategy for the FridayCode monorepo. This document covers the testing pyramid, standards, tooling, and CI integration.

---

## 1. Current State

- **93 unit tests** passing across **20 test files**.
- Test runner: **Vitest** with **v8** coverage provider.
- Coverage is collected but not enforced.
- **No integration tests** — cross-package interactions are untested.
- **No E2E tests** — full CLI workflows have no automated coverage.

---

## 2. Testing Pyramid

```
        ┌──────────┐
        │   E2E    │  10% — Full CLI sessions
        │  Tests   │
        ├──────────┤
        │Integration│  20% — Cross-package pipelines
        │  Tests   │
        ├──────────┤
        │          │
        │  Unit    │  70% — Individual functions & classes
        │  Tests   │
        │          │
        └──────────┘
```

| Layer       | Proportion | Scope                                    | Speed               |
| ----------- | ---------- | ---------------------------------------- | ------------------- |
| Unit        | 70%        | Individual functions, classes, utilities | Fast (<5s total)    |
| Integration | 20%        | Cross-package data flow, real pipelines  | Medium (<30s total) |
| E2E         | 10%        | Full CLI sessions, user workflows        | Slow (<2min total)  |

---

## 3. Unit Testing Standards

### Coverage Target

- **80%+ code coverage** across all packages.
- Coverage enforcement via Vitest thresholds in `vitest.config.ts`:

```typescript
coverage: {
  provider: "v8",
  thresholds: {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80,
  },
}
```

### Requirements

- Every **public function and class** must have at least one test.
- Every module's **exported API surface** must be tested.
- Test file naming: `<module>.test.ts` co-located with source or in `__tests__/`.

### Edge Cases to Cover

All unit tests should consider:

- **Empty inputs**: empty strings, empty arrays, null/undefined where applicable.
- **Large inputs**: files >1MB, arrays with 10,000+ items, deeply nested objects.
- **Unicode**: multibyte characters, emoji, RTL text, zero-width characters.
- **Error conditions**: network failures, permission denied, file not found, malformed input.
- **Boundary values**: 0, -1, MAX_SAFE_INTEGER, empty objects.

### Provider Adapter Tests

Provider adapters (Anthropic, OpenAI, etc.) must:

- Mock all HTTP responses using msw (Mock Service Worker).
- Test request formatting (correct headers, body structure, API version).
- Test response parsing (message extraction, tool call parsing, streaming chunks).
- Test error handling (rate limits, auth failures, malformed responses, network timeouts).
- Test token counting accuracy against known inputs.

### Tool Tests

Each tool implementation must:

- Mock the filesystem using memfs for file operations.
- Test parameter validation against the JSON Schema.
- Test path sandboxing — verify paths outside workspace root are rejected.
- Test timeout behavior — verify tools respect timeout configuration.
- Test output truncation — verify large outputs are properly truncated.
- Test error cases — missing files, permission denied, invalid arguments.

### TUI Component Tests

React components (rendered via Ink) must:

- Use `@testing-library/react` with Ink's test renderer.
- Test rendering with various props combinations.
- Test user interaction (keyboard input, selection).
- Test theme application (colors, formatting).
- Snapshot the rendered output for regression detection.

---

## 4. Integration Tests

Integration tests verify that packages work together correctly. They use real implementations (not mocks) for internal code, but mock external boundaries (HTTP APIs, filesystem for certain scenarios).

### Agent Loop

Test the full agent loop with a mocked provider:

```
User prompt → Provider call → Tool execution → Response assembly → Output
```

- Send a prompt, verify the provider receives the correct messages.
- Return a tool call from the mock provider, verify the tool is executed.
- Feed tool results back, verify the provider receives updated context.
- Test multi-turn: verify conversation history accumulates correctly.
- Test token limit handling: verify context truncation when approaching limits.

### Permission Flow

```
Tool request → Permission check → User prompt → Grant/Deny → Execution
```

- Tool requiring `write` permission triggers a permission prompt.
- Granting "for session" allows subsequent calls without prompting.
- Denying prevents execution and returns appropriate error to the LLM.
- "Always" grants persist across test sessions (via config).

### Config Resolution

Test the full config resolution chain:

```
CLI flags → Environment variables → Project config → Global config → Defaults
```

- CLI flag `--model gpt-4` overrides all other sources.
- Environment variable `FRIDAY_MODEL=gpt-4` overrides config files.
- Project `.friday/config.json` overrides global config.
- Global `~/.friday/config.json` overrides defaults.
- Test each level individually and in combination.

### Session Management

```
Create session → Save to disk → Load from disk → Resume conversation
```

- Create a session with conversation history and metadata.
- Save session, verify the file is written correctly.
- Load session from file, verify all data is restored.
- Resume conversation, verify history is intact and new messages append correctly.

### MCP (Model Context Protocol)

```
Client → stdio transport → Server → Tool execution → Response
```

- Spawn an MCP server as a child process.
- Connect via stdio transport.
- List available tools, verify the expected set.
- Execute a tool call, verify the result.
- Test error handling for malformed requests.

---

## 5. E2E Tests

E2E tests exercise the full CLI from the user's perspective. They spawn the actual `friday` binary and interact with it programmatically.

### Full CLI Startup

- Run `friday` with `--help`, verify output contains expected commands.
- Run `friday` with no arguments, verify it enters interactive mode (or shows usage).
- Run `friday` with a prompt argument, verify it processes and exits.
- Measure startup time (see Performance Tests).

### Interactive Session with Mock Provider

- Start an interactive session with a mock provider backend.
- Send a user message, verify the response is displayed.
- Provider returns a tool call, verify the tool executes and result is shown.
- Send a follow-up message, verify conversation context is maintained.

### Slash Commands

Test each slash command in an interactive session:

| Command   | Verification                |
| --------- | --------------------------- |
| `/help`   | Displays available commands |
| `/clear`  | Clears conversation history |
| `/model`  | Lists or switches models    |
| `/config` | Shows current configuration |

### Multi-Turn Conversation

- Start a session, send 5+ messages.
- Verify each response incorporates prior context.
- Verify token usage stays within limits.
- Verify context window management (truncation/summarization) works.

### Provider-Specific E2E

- Scheduled tests (not on every PR) that run against real provider APIs.
- Use dedicated test accounts with spend limits.
- Verify real streaming responses render correctly.
- Verify real tool call round-trips work end-to-end.

---

## 6. TUI Snapshot Tests

Snapshot tests capture the rendered terminal output of TUI components and compare against stored baselines.

### Components to Snapshot

- `MessageBubble`: user message, assistant message, error message, tool result.
- `ToolCallView`: pending, executing, completed, failed states.
- `PermissionPrompt`: single permission, multiple permissions.
- `StatusBar`: connected, disconnected, loading states.
- `ConversationView`: empty, single message, multi-turn, with tool calls.

### Theme Testing

- Snapshot each component with both default and custom themes.
- Verify color codes are applied correctly.
- Verify fallback rendering when colors are unsupported.

### Responsive Layout

Test rendering at different terminal widths:

- **Narrow** (40 columns): verify wrapping and truncation.
- **Standard** (80 columns): baseline rendering.
- **Wide** (120+ columns): verify content fills appropriately.

### Snapshot Management

- Snapshots are stored in `__snapshots__/` directories next to test files.
- Update snapshots with `vitest --update` when intentional changes are made.
- PR reviews must include snapshot diff review for any changed snapshots.

---

## 7. Performance Tests

Performance tests establish baselines and detect regressions.

### Startup Time

- **Target**: < 500ms from invocation to ready-for-input.
- Measured by spawning the CLI and timing until the prompt appears.
- Tested on CI runner hardware for consistency.
- Regression threshold: 20% slower than baseline triggers a warning.

### Token Counting Accuracy

- Compare FridayCode's token counter against the `tiktoken` reference implementation.
- Test with a corpus of varied inputs (English, code, Unicode, mixed).
- **Target**: < 1% deviation from tiktoken counts.

### Large File Handling

- Read and process files of 1MB, 5MB, and 10MB.
- Verify no OOM errors and processing completes within timeout.
- Measure memory usage during processing.
- Verify output truncation works correctly for large results.

### Parallel Tool Execution

- Dispatch 10 concurrent tool calls (e.g., 10 file reads).
- Verify all complete successfully.
- Measure total wall-clock time vs sequential baseline.
- **Target**: parallel execution should be at least 3x faster than sequential for I/O-bound tools.

---

## 8. CI Integration

### Pull Request Pipeline

Every PR runs:

1. **Lint**: ESLint + Prettier check.
2. **Type check**: `tsc --noEmit` across all packages.
3. **Unit tests**: `vitest run` with coverage.
4. **Integration tests**: `vitest run --project integration`.
5. **Coverage upload**: Results sent to Codecov.
6. **Coverage gate**: PR blocked if coverage drops below thresholds.

### Merge to Main Pipeline

On merge to `main`, additionally runs:

1. **E2E tests**: Full CLI workflow tests.
2. **TUI snapshot tests**: Verify no unintentional UI changes.
3. **Performance benchmarks**: Compare against stored baselines.
4. **Performance gate**: Flag if startup time regresses >20%.

### Scheduled Pipeline (Nightly)

Runs nightly:

1. **Provider E2E tests**: Test against real provider APIs.
2. **Dependency audit**: Check for known vulnerabilities.
3. **Full coverage report**: Comprehensive coverage across all test types.

### Coverage Reporting

- Provider: **Codecov**.
- Coverage uploaded after every PR run.
- PR comments show coverage diff (lines added/removed vs covered).
- Dashboard tracks coverage trends over time.
- Minimum thresholds enforced (see Unit Testing Standards).

### Performance Regression Detection

- Benchmark results stored in CI artifacts.
- Each run compared against the rolling 7-day average.
- Alerts posted to PR if any metric regresses beyond threshold.
- Historical data retained for 90 days.

---

## 9. Testing Tools

| Tool                       | Purpose                                       | Package                  |
| -------------------------- | --------------------------------------------- | ------------------------ |
| **Vitest**                 | Test runner and assertion library             | `vitest`                 |
| **@testing-library/react** | TUI component testing (Ink)                   | `@testing-library/react` |
| **msw**                    | Mock Service Worker — intercept HTTP requests | `msw`                    |
| **memfs**                  | In-memory filesystem for file operation tests | `memfs`                  |
| **tiktoken**               | Reference token counter for accuracy tests    | `tiktoken`               |
| **execa**                  | Process spawning for E2E tests                | `execa`                  |

### Vitest Configuration

The monorepo uses a root `vitest.config.ts` with project-level overrides:

```typescript
// vitest.config.ts (root)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
    projects: ['packages/*/vitest.config.ts'],
  },
});
```

### msw Setup

Mock Service Worker intercepts HTTP at the network level:

```typescript
// test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('https://api.anthropic.com/v1/messages', () => {
    return HttpResponse.json({
      content: [{ type: 'text', text: 'Hello from mock' }],
    });
  }),
];
```

### memfs Setup

In-memory filesystem for isolated file operation tests:

```typescript
import { vol } from 'memfs';

beforeEach(() => {
  vol.reset();
  vol.fromJSON({
    '/workspace/src/index.ts': "export const hello = 'world';",
    '/workspace/package.json': '{"name": "test"}',
  });
});
```

---

## 10. Pre-commit Hooks

### Husky + lint-staged

Pre-commit hooks ensure code quality before commits reach CI.

#### Setup

```json
// package.json
{
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "vitest related --run"],
    "*.{json,md,yaml}": ["prettier --write"]
  }
}
```

#### Hook Behavior

1. **On commit**: lint-staged runs on staged files only.
2. **TypeScript files**: ESLint auto-fix + run tests related to changed files.
3. **Config/docs files**: Prettier formatting.
4. **If any check fails**: commit is blocked with error output.

#### Performance

- `vitest related` only runs tests that import changed files (via Vitest's module graph).
- Typical hook runtime: < 10 seconds for small changes.
- Developers can bypass with `--no-verify` for WIP commits (CI still enforces).

### CI vs Pre-commit Scope

| Check             | Pre-commit         | CI               |
| ----------------- | ------------------ | ---------------- |
| ESLint            | Staged files only  | All files        |
| Prettier          | Staged files only  | All files        |
| Unit tests        | Related to changes | All tests        |
| Type check        | No (too slow)      | Full project     |
| Integration tests | No                 | Full suite       |
| E2E tests         | No                 | On merge to main |
