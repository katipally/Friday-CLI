# 🗺️ Friday — Project Roadmap

> **Ship as ready.** No fixed dates — each phase ships when it's solid.

Friday is an open-source, multi-provider AI coding agent for the terminal. This roadmap outlines our incremental path from foundation fixes to a production-ready v1.0.

---

## Feature Matrix

| Area                                                     | Status     | Phase |
| -------------------------------------------------------- | ---------- | ----- |
| Multi-provider support (OpenAI, Anthropic, Google, etc.) | ✅ Done    | —     |
| Basic tool execution (file read/write, bash, grep)       | ✅ Done    | —     |
| Conversation memory & context                            | ✅ Done    | —     |
| Dynamic model fetching (all providers)                   | 🔲 Planned | 1     |
| Retry logic with exponential backoff                     | 🔲 Planned | 1     |
| Parallel tool execution                                  | 🔲 Planned | 1     |
| Accurate token counting (js-tiktoken)                    | 🔲 Planned | 1     |
| OpenRouter / xAI providers                               | 🔲 Planned | 1     |
| TUI redesign & theming                                   | 🔲 Planned | 2     |
| Code syntax highlighting                                 | 🔲 Planned | 2     |
| Diff viewer                                              | 🔲 Planned | 2     |
| web_fetch / browser tools                                | 🔲 Planned | 3     |
| Jupyter notebook support                                 | 🔲 Planned | 3     |
| Extended git operations                                  | 🔲 Planned | 3     |
| Sub-agent architecture                                   | 🔲 Planned | 4     |
| Plugin / skills ecosystem                                | 🔲 Planned | 5     |
| Git-based checkpoints & /rewind                          | 🔲 Planned | 6     |
| SQLite storage & code intelligence                       | 🔲 Planned | 7     |
| CI/CD & headless automation                              | 🔲 Planned | 8     |
| v1.0 release & binary distribution                       | 🔲 Planned | 9     |

---

## Phase 1: Foundation Fixes (`v0.2.x`)

**Focus:** Fix critical bugs and hardcoded limitations.

- **Dynamic model fetching for all providers**
  - OpenAI `/v1/models`
  - Anthropic `/v1/models`
  - Google `/v1beta/models`
  - Graceful fallback to a hardcoded list when the API is unreachable
- **Retry logic with exponential backoff + jitter** for every provider (rate-limits, transient 5xx errors)
- **Parallel tool execution** — replace the sequential `for` loop with `Promise.all` (with concurrency limits where needed)
- **Accurate token counting** — integrate `js-tiktoken` for precise prompt/completion token counts
- **Fix budget enforcement** — check the remaining budget _before_ making an LLM call, not after
- **Fix permission scope default** — default to restrictive permissions; require explicit opt-in for dangerous operations
- **Auto-trigger context summarization** at 80% of the context-window budget
- **Add OpenRouter meta-provider** — route to any model via a single API key
- **Add xAI / Grok provider**
- **Pre-commit hooks via Husky** — lint, typecheck, and test on every commit

---

## Phase 2: UI/UX Revolution (`v0.3.x`)

**Focus:** Complete TUI redesign with a rich, expressive interface.

- **New TUI component library** — evaluate `ink-ui`, `blessed`, or custom primitives built on top of Ink
- **Code syntax highlighting in output** — via `shiki` or `highlight.js`
- **Diff viewer** — inline and unified diff formats for file changes
- **Interactive menus** — arrow-key navigation for onboarding, model selection, and settings
- **Progress bars** for long-running operations (file indexing, large diffs, etc.)
- **Mascot character design** + ASCII art for the welcome screen
- **Friday AI persona** — inject personality and tone into agent responses
- **Multiple themes**
  - Dark (default)
  - Light
  - High-contrast
  - Synthwave
  - Dracula
- **Keyboard shortcuts system** — configurable hotkeys for common actions
- **Rich status bar** — live display of model, mode, tokens used, estimated cost, and speed
- **Tool execution display overhaul** — collapsible output blocks, color-coded by tool type, timestamped
- **Welcome screen redesign** with branding and quick-start tips

---

## Phase 3: New Tools & Extended Capabilities (`v0.4.x`)

**Focus:** Tool parity with Claude Code and beyond.

- **`web_fetch` tool** — HTTP GET/POST with automatic response parsing (HTML → text, JSON pretty-print)
- **`browser` tool** — headless Chrome via Puppeteer for web scraping, screenshot capture, and testing
- **`notebook_edit` tool** — read, write, and execute Jupyter notebook cells
- **Extended git operations**
  - `push`, `pull`, `checkout`, `reset`
  - `rebase`, `cherry-pick`, `stash pop`
  - Remote management
- **Multi-file batch editing tool** — apply a transformation across many files in one invocation
- **Image analysis tool** — send images to vision-capable models for description and analysis
- **Code search tool** — regex search plus semantic search via a local indexer
- **Doctor / diagnostics tool** — `/doctor` command to verify environment, dependencies, and configuration

---

## Phase 4: Sub-Agent Architecture (`v0.5.x`)

**Focus:** Multi-agent delegation system.

- **Main agent → sub-agent delegation protocol** — structured handoff of tasks with typed results
- **Agent types**
  - `code` — write and refactor code
  - `review` — review diffs and suggest improvements
  - `test` — generate and run tests
  - `debug` — diagnose failures and propose fixes
  - `research` — explore codebases and gather context
  - `plan` — break down complex tasks into steps
- **Parallel sub-agent execution** with result aggregation and conflict resolution
- **Agent-to-agent communication** — agents can query each other for information
- **Agent context isolation** — each agent maintains its own message history and token budget
- **Agent cost tracking** — per-agent budgets with rollup to the session total
- **`/agent` command** — list, inspect, and manage running agents
- **Agent configuration in `FRIDAY.md`** — define custom agent behaviors per project

---

## Phase 5: Plugin Ecosystem (`v0.6.x`)

**Focus:** Full extensibility platform.

- **Skills directory** — `.friday/skills/` containing custom tool definitions in YAML or JS
- **Plugin system with lifecycle management** — `install`, `enable`, `disable`, `update`
- **Hooks system**
  - `pre_tool` / `post_tool` — run logic before or after any tool execution
  - `pre_llm` / `post_llm` — intercept or transform LLM requests and responses
  - `session_start` / `session_end` — initialization and teardown
- **Custom agent definitions** — YAML-based agent personas with configurable system prompts
- **MCP improvements**
  - Config persistence across sessions
  - Health monitoring and diagnostics
  - Auto-reconnect on server failure
- **Plugin registry** — npm-based distribution, or a dedicated Friday registry
- **Extension API** for third-party developers with TypeScript typings and documentation

---

## Phase 6: Checkpoint & History (`v0.7.x`)

**Focus:** Safety net for code changes.

- **Git-based code checkpoints** — auto-stash or auto-commit before any tool writes to the filesystem
- **Session state snapshots** — serializable conversation state (messages, tool results, metadata)
- **`/rewind` command** — restore both code and conversation to a previous checkpoint
- **`/checkpoint` command** — manual checkpoint creation with optional label
- **Session branching** — fork a conversation to explore alternative approaches without losing the original
- **Checkpoint diff viewer** — compare any two checkpoints side by side
- **Session export / import** — share full conversations as portable files

---

## Phase 7: Storage & Intelligence (`v0.8.x`)

**Focus:** Smart storage and deep code understanding.

- **SQLite migration** — move sessions, search indices, and analytics to a local SQLite database
- **Full-text session search** via FTS5 — search across all past conversations
- **Local usage analytics** — `/stats` command showing tokens used, cost breakdown, tools invoked, provider distribution
- **Tree-sitter code indexing** — extract symbols, functions, classes, and types from the working tree
- **LSP client integration** — go-to-definition, find-references, hover info from running language servers
- **Call graph analysis** — visualize function call relationships
- **Import / dependency mapping** — understand module boundaries and dependency chains
- **Semantic code search** — natural-language queries over the indexed codebase

---

## Phase 8: CI/CD & Automation (`v0.9.x`)

**Focus:** Headless and automated workflows.

- **Enhanced non-interactive mode** — structured JSON output, exit codes, machine-readable logs
- **GitHub App integration** — auto-review pull requests, auto-fix issues, post comments
- **Webhook receiver** — trigger Friday from external events (GitHub webhooks, Slack, etc.)
- **Batch processing mode** — process multiple files or tasks in a single run
- **Pipeline integration**
  - GitHub Actions
  - GitLab CI
  - Jenkins
- **Scheduled tasks** — cron-like automation for recurring code maintenance

---

## Phase 9: Polish & v1.0 (`v1.0.0`)

**Focus:** Production-ready release.

- **Comprehensive test suite**
  - Unit tests
  - Integration tests
  - End-to-end tests
  - Snapshot tests
- **Full documentation site** — guides, tutorials, and examples
- **TypeDoc API reference** — auto-generated from source
- **Performance optimization** — startup time, memory footprint, streaming latency
- **Security audit** — dependency review, permission model hardening, secret scanning
- **Binary distribution**
  - macOS (Apple Silicon + Intel)
  - Linux (x64 + ARM)
  - Windows (x64)
- **Homebrew formula**
- **npm package publishing** with scoped package name
- **v1.0 announcement** — blog post, demo video, social media

---

## Ongoing

These activities run continuously across all phases:

- 🔄 **Provider updates** — new models, pricing changes, API revisions
- 🤝 **Community contributions** — triage issues, review PRs, mentor contributors
- 🐛 **Bug fixes and improvements** — stability and reliability
- 📖 **Documentation updates** — keep docs in sync with the codebase
- 📦 **Dependency updates** — security patches, major version upgrades

---

## Contributing

Want to help shape Friday's future? See [`CONTRIBUTING.md`](../CONTRIBUTING.md) for how to get involved. Feature proposals and phase feedback are welcome — open an issue or start a discussion.
