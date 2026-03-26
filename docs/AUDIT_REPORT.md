# FridayCode Codebase Audit Report

> **Date:** June 2025
> **Scope:** Full monorepo deep audit — architecture, packages, testing, CI/CD, competitive gap analysis
> **Auditor:** Automated deep analysis

---

## Executive Summary

FridayCode is an open-source, multi-provider AI coding agent for the terminal. It is approximately **75% production-ready**. The project is a well-structured TypeScript monorepo comprising **10 packages** built on modern tooling (Turbo, Vitest, pnpm, tsup). The foundations are strong — clean architecture, strict TypeScript, consistent patterns — but significant gaps remain versus industry leaders (Claude Code, Copilot CLI).

**Overall Score: 6.8 / 10**

| Dimension            | Score | Notes                                      |
| -------------------- | ----- | ------------------------------------------ |
| Architecture         | 8/10  | Clean monorepo, clear boundaries           |
| Core Agent Loop      | 7/10  | Functional ReAct loop, lacks parallelism   |
| Provider Coverage    | 6/10  | 12 providers, but hardcoded & no retries   |
| Tool Ecosystem       | 7/10  | 9 solid tools, missing key ones            |
| TUI / UX             | 6/10  | Functional but lacking polish              |
| CLI / Config         | 7/10  | Good layered config, some dead features    |
| Testing              | 5/10  | Unit tests only, no integration / E2E      |
| CI/CD                | 5/10  | Multi-platform but no coverage or releases |
| Production Readiness | 6/10  | Works, but fragile under real-world load   |
| Competitive Parity   | 5/10  | Major feature gaps vs Claude Code          |

---

## Package-by-Package Audit

### 1. `packages/core` — 75% Complete (~900 LOC)

The heart of the agent. Contains the ReAct loop, permissions, sessions, cost tracking, and context management.

#### AgentLoop — 90%

| Aspect                  | Status     | Detail                                                     |
| ----------------------- | ---------- | ---------------------------------------------------------- |
| ReAct loop              | ✅         | Proper observe → think → act cycle with streaming          |
| Multi-turn              | ✅         | Conversation state maintained across turns                 |
| Cost tracking           | ✅         | Per-token calculation integrated into loop                 |
| Parallel tool execution | 🔴 Missing | Sequential `for` loop — 5 independent tools run one-by-one |
| Retry logic             | 🔴 Missing | Single failure aborts the entire agent turn                |
| Tool timeout handling   | 🔴 Missing | A hung tool blocks the loop indefinitely                   |

#### PermissionSystem — 75%

| Aspect                 | Status        | Detail                                                |
| ---------------------- | ------------- | ----------------------------------------------------- |
| Rule-based matching    | ✅            | Glob and regex pattern support                        |
| Scope inference        | ✅            | Workspace vs. global scope detection                  |
| Session caching        | ✅            | Approved permissions cached for session               |
| Default scope          | 🟡 Permissive | Defaults to allow — should default-deny in production |
| Role-based permissions | 🔴 Missing    | No user/admin/readonly roles                          |
| Audit logging          | 🔴 Missing    | No record of what was permitted or denied             |
| Rate limiting          | 🔴 Missing    | No throttle on tool invocations                       |

#### SessionManager — 70%

| Aspect             | Status     | Detail                                             |
| ------------------ | ---------- | -------------------------------------------------- |
| Persistence        | ✅         | JSON file storage at `~/.friday/sessions/`         |
| CRUD operations    | ✅         | Create, read, update, delete, list                 |
| TTL cleanup        | ✅         | Expired sessions pruned                            |
| Full-text search   | 🔴 Missing | Cannot search across session content               |
| Session branching  | 🔴 Missing | No fork/branch for exploratory paths               |
| Encryption at rest | 🟡 Missing | Sessions stored as plain JSON                      |
| Scalability        | 🟡 Concern | File-per-session approach won't scale to thousands |

#### CostTracker — 65%

| Aspect                | Status      | Detail                                                       |
| --------------------- | ----------- | ------------------------------------------------------------ |
| Model pricing         | ✅          | ~50 hardcoded model prices                                   |
| Per-token calculation | ✅          | Input/output token cost computation                          |
| Budget enforcement    | 🟡 Partial  | Budget check happens **after** LLM call, not before          |
| Price staleness       | 🔴 Critical | Hardcoded prices go stale within weeks of new model releases |
| Provider overrides    | 🔴 Missing  | No per-provider pricing configuration                        |

#### ContextManager — 70%

| Aspect                | Status        | Detail                                               |
| --------------------- | ------------- | ---------------------------------------------------- |
| Message history       | ✅            | Maintains conversation with budget awareness         |
| Summarization         | ✅            | Extractive summarization to reduce context           |
| Token counting        | 🔴 Inaccurate | Uses `text.length / 4` (~30% inaccuracy vs tiktoken) |
| Auto-trigger          | 🟡 Missing    | Summarization must be triggered manually             |
| Must-include overflow | 🟡 Bug        | Must-include messages can exceed the context budget  |

---

### 2. `packages/providers` — 62% (6.2/10)

12 providers implemented. Coverage matrix:

| Provider          | Streaming | Tool Calling      | Vision | Models      |
| ----------------- | --------- | ----------------- | ------ | ----------- |
| OpenAI            | ✅        | ✅                | ✅     | Hardcoded   |
| Anthropic         | ✅        | ✅                | ✅     | Hardcoded   |
| Google Gemini     | ✅        | ✅                | ✅     | Hardcoded   |
| Mistral           | ✅        | ✅                | ❌     | Hardcoded   |
| Groq              | ✅        | ✅                | ❌     | Hardcoded   |
| DeepSeek          | ✅        | ✅                | ❌     | Hardcoded   |
| xAI (Grok)        | ✅        | ✅                | ✅     | Hardcoded   |
| Cohere            | ✅        | ✅                | ❌     | Hardcoded   |
| Together AI       | ✅        | ✅                | ❌     | Hardcoded   |
| Perplexity        | ✅        | ❌                | ❌     | Hardcoded   |
| Ollama            | ✅        | ⚠️ Stubbed        | ✅     | **Dynamic** |
| OpenAI-Compatible | ✅        | ⚠️ False positive | ✅     | **Dynamic** |

**Critical Issues:**

- 🔴 **Hardcoded models in 10/12 providers.** Only Ollama and OpenAI-Compatible fetch model lists dynamically. Every new model release requires a code change and redeployment.
- 🔴 **Zero retry logic.** A single transient network failure results in complete failure. No exponential backoff, no circuit breakers.
- 🔴 **Zero token counting.** Providers do not count tokens pre-flight; budget cannot be enforced proactively.
- 🔴 **Zero rate limiting.** No client-side throttle to respect provider rate limits.
- 🟡 **Ollama tool calling stubbed.** Tool-calling methods exist but simply forward to non-tool methods — tools silently don't work.
- 🟡 **Google Gemini client-side tool call IDs.** Non-deterministic ID generation can break tool call/result correlation.
- 🟡 **OpenAI-Compatible claims `toolCalling: true` for ALL endpoints** regardless of whether the downstream model actually supports tool use.

---

### 3. `packages/tools` — 73% (vs Claude Code baseline)

#### Implemented Tools (9/12 target)

| Tool             | Validation | Sandboxing | Error Handling | Notes                                            |
| ---------------- | ---------- | ---------- | -------------- | ------------------------------------------------ |
| `file_read`      | ✅         | ✅         | ✅             | 🟡 No output size limit — can OOM on large files |
| `file_write`     | ✅         | ✅         | ✅             | —                                                |
| `file_edit`      | ✅         | ✅         | ✅             | —                                                |
| `shell_exec`     | ✅         | ✅         | ✅             | —                                                |
| `grep`           | ✅         | ✅         | ✅             | —                                                |
| `glob`           | ✅         | ✅         | ✅             | —                                                |
| `git`            | ✅         | ✅         | ✅             | Limited subcommands                              |
| `directory_tree` | ✅         | ✅         | ✅             | —                                                |
| `ask_user`       | ✅         | N/A        | ✅             | —                                                |

#### Missing Tools

| Tool            | Severity    | Impact                          |
| --------------- | ----------- | ------------------------------- |
| `web_fetch`     | 🔴 Critical | Cannot read URLs, docs, or APIs |
| `browser`       | 🟡 Medium   | No visual web interaction       |
| `notebook_edit` | 🟢 Low      | No Jupyter support              |

#### Notable Issues

- **Git is limited:** Only `status`, `diff`, `log`, `branch`, `add`, `commit`, `stash`. Missing `push`, `pull`, `checkout`, `reset`, `rebase`.
- **`file_read` unbounded:** No maximum file size check — reading a multi-GB file would exhaust memory.
- **`checkPermission` unused:** The `ToolContext` interface defines a `checkPermission` callback, but **no tool calls it**. Permissions are effectively unenforced at the tool level.

---

### 4. `packages/tui` — 6.7/10

8 React/Ink components providing the terminal UI.

| Component          | Status | Notes                                 |
| ------------------ | ------ | ------------------------------------- |
| `App`              | ✅     | Root layout and state orchestration   |
| `MessageBubble`    | ✅     | Role-based rendering with emoji icons |
| `InputBox`         | ✅     | Multi-line input with history         |
| `StatusBar`        | ✅     | Model, cost, token display            |
| `Spinner`          | ✅     | Loading indicator                     |
| `ToolOutput`       | ✅     | Tool result rendering                 |
| `PermissionPrompt` | ✅     | Interactive allow/deny dialog         |
| `WelcomeBanner`    | ✅     | ASCII FRIDAY logo                     |

**Present:** ASCII art logo, emoji role icons, chunk-based streaming, theme system (3 themes defined).

| Missing Feature          | Severity    | Impact                                                      |
| ------------------------ | ----------- | ----------------------------------------------------------- |
| Code syntax highlighting | 🔴 Critical | Code rendered as plain green text — unreadable for real use |
| Diff viewer              | 🔴 Critical | File changes shown as raw text, no +/- coloring             |
| File browser             | 🟡 Medium   | No interactive file navigation                              |
| Progress bars            | 🟡 Medium   | Long operations have no progress feedback                   |
| Interactive menus        | 🟡 Medium   | No arrow-key selection menus                                |

🔴 **Theme system defined but NOT USED.** Three themes are declared in code, but all components use hardcoded Ink color values. The theme definitions are dead code.

---

### 5. `packages/cli` — 7.1/10

#### Slash Commands (12)

| Command    | Status | Notes                    |
| ---------- | ------ | ------------------------ |
| `/help`    | ✅     | —                        |
| `/clear`   | ✅     | —                        |
| `/model`   | ✅     | Switch model mid-session |
| `/mode`    | ✅     | Toggle agent modes       |
| `/cost`    | ✅     | Display session cost     |
| `/history` | ✅     | Session history          |
| `/exit`    | ✅     | —                        |
| `/compact` | ✅     | Context compaction       |
| `/init`    | ✅     | Project initialization   |
| `/tools`   | ✅     | List available tools     |
| `/mcp`     | ✅     | MCP server management    |
| `/update`  | ✅     | Check for updates        |

#### Configuration

- **Layered resolution:** Global → Project → Environment Variables → CLI Flags
- **Validation:** Zod schema validation at every layer
- **Graceful degradation:** Missing config files handled without crashes

#### Onboarding Wizard

- Text-based (not interactive menus)
- Supports 11 providers
- Auto-detects existing environment variables

#### Issues

| Issue                                                      | Severity    |
| ---------------------------------------------------------- | ----------- |
| No auto-update check on startup                            | 🟡 Medium   |
| No `/config` command for runtime config editing            | 🟡 Medium   |
| Cost budget feature defined in schema but **NOT ENFORCED** | 🔴 Critical |

---

### 6. `packages/mcp` — Fully Implemented ✅

The MCP (Model Context Protocol) package is the most complete in the project.

| Feature                                   | Status |
| ----------------------------------------- | ------ |
| stdio transport                           | ✅     |
| HTTP/SSE transport                        | ✅     |
| JSON-RPC 2.0 compliance                   | ✅     |
| Tool discovery                            | ✅     |
| Tool execution                            | ✅     |
| Lifecycle management                      | ✅     |
| SSE exponential backoff                   | ✅     |
| Tool namespacing (`serverName__toolName`) | ✅     |

#### Gaps

| Gap                                                                       | Severity    |
| ------------------------------------------------------------------------- | ----------- |
| Config not persisted to disk                                              | 🟡 Medium   |
| No heartbeat / keep-alive                                                 | 🟡 Medium   |
| SSE race condition: messages can be sent before connection is established | 🔴 Critical |

---

### 7. `packages/shared` — 100% ✅

Solid utility package. No issues found.

| Component                                  | Status |
| ------------------------------------------ | ------ |
| Logger (structured, levels, JSON mode)     | ✅     |
| Error hierarchy (6 typed error classes)    | ✅     |
| Platform utils (cross-platform path/shell) | ✅     |

---

### 8. `packages/i18n` — 40%

| Aspect             | Status                                                   |
| ------------------ | -------------------------------------------------------- |
| Framework          | ✅ Exists                                                |
| English locale     | ✅ 23 keys                                               |
| Other languages    | 🔴 None                                                  |
| UI/CLI integration | 🔴 Not used — output strings are hardcoded in components |

The i18n package is effectively dead code. The framework is in place but never wired into the actual UI or CLI output.

---

### 9. `packages/indexer` — Misleading Name

**This is NOT a code indexer.** Despite the name, this package only provides:

- Project type detection (Node, Python, Rust, Go, Java, Ruby)
- Directory tree generation

| Expected Feature        | Status     |
| ----------------------- | ---------- |
| AST parsing             | 🔴 Missing |
| Symbol extraction       | 🔴 Missing |
| Tree-sitter integration | 🔴 Missing |
| Code intelligence       | 🔴 Missing |
| Semantic search         | 🔴 Missing |

This package should be renamed to `project-detector` or expanded to be a true indexer.

---

### 10. `packages/sdk` — 100% (but minimal)

69 lines of code. Thin wrapper exposing:

- `Friday` class
- `chat()` method
- `ask()` method
- `reset()` method

**No documentation.** No usage examples. No TypeDoc/JSDoc beyond basic types.

---

### 11. `extensions/vscode` — 0%

**Completely empty directory.** No code, no configuration, no scaffold. This is a placeholder only.

---

## Testing Audit — 50–60% Effective

| Metric              | Value   | Assessment                                   |
| ------------------- | ------- | -------------------------------------------- |
| Total tests         | 93      | —                                            |
| Passing             | 93      | ✅                                           |
| Unit tests          | Good    | Core logic well-covered                      |
| Integration tests   | ~0      | 🔴 Critical gap                              |
| E2E tests           | ~0      | 🔴 Only conditional Ollama test              |
| TUI snapshot tests  | 0       | 🔴 No visual regression coverage             |
| Provider mock tests | Partial | Some providers tested with mocks             |
| Pre-commit hooks    | ❌      | Husky installed but hooks directory is empty |

### Key Testing Gaps

1. 🔴 **No integration tests** — packages are tested in isolation but never together
2. 🔴 **No E2E tests against real providers** — only a conditional Ollama test exists
3. 🔴 **No TUI snapshot tests** — Ink supports snapshots but none are written
4. 🟡 **No pre-commit hooks** — Husky is installed and configured but the hooks directory contains no actual hooks
5. 🟡 **No mutation testing** — test quality itself is unverified

---

## CI/CD Audit

| Feature               | Status                    |
| --------------------- | ------------------------- |
| Multi-platform matrix | ✅ Ubuntu, macOS, Windows |
| Node version matrix   | ✅ Node 20, 22            |
| Automated tests in CI | ✅                        |
| Coverage tracking     | 🔴 Missing                |
| Binary build script   | ✅ Exists                 |
| Binary build in CI    | 🔴 Not integrated         |
| Changelog automation  | 🔴 Missing                |
| Release automation    | 🔴 Missing                |
| Dependency update bot | 🟡 Not configured         |

---

## Critical Issues — Ranked by Severity

| #   | Issue                                | Severity    | Package     | Impact                                                      |
| --- | ------------------------------------ | ----------- | ----------- | ----------------------------------------------------------- |
| 1   | Models hardcoded in 10/12 providers  | 🔴 Critical | `providers` | Stale within weeks of new model releases                    |
| 2   | No retry/backoff on provider calls   | 🔴 Critical | `providers` | Single network hiccup = complete failure                    |
| 3   | No parallel tool execution           | 🔴 Critical | `core`      | 5 independent tools run sequentially; massive latency       |
| 4   | Token counting ~30% inaccurate       | 🔴 Critical | `core`      | Context budget under/over-estimated; truncation or overflow |
| 5   | No syntax highlighting in TUI        | 🔴 Critical | `tui`       | Code is unreadable green text                               |
| 6   | No diff viewer                       | 🔴 Critical | `tui`       | File changes shown as raw text                              |
| 7   | Budget enforcement after overage     | 🟡 Medium   | `core`      | Budget exceeded before check runs                           |
| 8   | Permission scope defaults permissive | 🟡 Medium   | `core`      | Security risk in untrusted environments                     |
| 9   | Missing tools (web_fetch, browser)   | 🟡 Medium   | `tools`     | Cannot interact with web resources                          |
| 10  | No sub-agent delegation              | 🟡 Medium   | `core`      | Cannot decompose complex tasks                              |

---

## Strengths

| Strength                       | Detail                                                                 |
| ------------------------------ | ---------------------------------------------------------------------- |
| ✅ Clean monorepo architecture | Clear package boundaries, single responsibility per package            |
| ✅ TypeScript strict mode      | Enabled everywhere, no `any` escape hatches in core paths              |
| ✅ Error hierarchy             | 6 typed error classes with proper inheritance and context              |
| ✅ MCP fully implemented       | Both stdio and HTTP/SSE transports, JSON-RPC 2.0 compliant             |
| ✅ 12 providers                | Consistent streaming interface across all providers                    |
| ✅ Session persistence         | Resume capability with TTL-based cleanup                               |
| ✅ Permission system           | Scope inference with glob/regex pattern matching                       |
| ✅ Modern tooling              | Turbo for builds, Vitest for tests, tsup for bundling, pnpm workspaces |
| ✅ Open source                 | Full transparency and community contribution potential                 |
| ✅ Multi-provider support      | Unique advantage over single-provider competitors                      |

---

## Competitive Gap Analysis: FridayCode vs Claude Code

| Feature             | FridayCode          | Claude Code           | Gap Severity            |
| ------------------- | ------------------- | --------------------- | ----------------------- |
| Sub-agents          | ❌                  | ✅                    | 🔴 Critical             |
| Checkpoint / Rewind | ❌                  | ✅                    | 🔴 Critical             |
| Skills / Plugins    | ❌                  | ✅                    | 🟡 Medium               |
| Hooks system        | ❌                  | ✅                    | 🟡 Medium               |
| Dynamic model lists | ❌ (hardcoded)      | ✅                    | 🔴 Critical             |
| Syntax highlighting | ❌                  | ✅                    | 🔴 Critical             |
| Diff viewer         | ❌                  | ✅                    | 🔴 Critical             |
| Browser tool        | ❌                  | ✅                    | 🟡 Medium               |
| Web fetch tool      | ❌                  | ✅                    | 🟡 Medium               |
| CI/CD mode          | Basic               | ✅ Full               | 🟡 Medium               |
| Code intelligence   | ❌                  | ✅                    | 🔴 Critical             |
| **Multi-provider**  | **✅ 12 providers** | **❌ Anthropic only** | ✅ FridayCode advantage |
| **Open source**     | **✅**              | **❌**                | ✅ FridayCode advantage |
| **MCP support**     | **✅**              | **✅**                | — Parity                |

---

## Final Scoring Summary

| Package              | Score      | Status                                |
| -------------------- | ---------- | ------------------------------------- |
| `packages/core`      | 7.5/10     | 🟡 Functional, needs hardening        |
| `packages/providers` | 6.2/10     | 🔴 Hardcoded models, no resilience    |
| `packages/tools`     | 7.3/10     | 🟡 Good foundation, missing key tools |
| `packages/tui`       | 6.7/10     | 🟡 Functional, lacks polish           |
| `packages/cli`       | 7.1/10     | 🟡 Solid config, dead features        |
| `packages/mcp`       | 9.0/10     | ✅ Fully implemented                  |
| `packages/shared`    | 10/10      | ✅ Complete                           |
| `packages/i18n`      | 4.0/10     | 🔴 Framework only, unused             |
| `packages/indexer`   | 3.0/10     | 🔴 Misleading, not a real indexer     |
| `packages/sdk`       | 5.0/10     | 🟡 Minimal, undocumented              |
| `extensions/vscode`  | 0/10       | 🔴 Empty                              |
| **Testing**          | 5.5/10     | 🔴 No integration or E2E              |
| **CI/CD**            | 5.0/10     | 🔴 No coverage, no releases           |
| **Overall**          | **6.8/10** | **~75% production-ready**             |

---

_End of audit report._
