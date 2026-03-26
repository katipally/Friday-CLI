# FridayCode — All Decisions Log

## Decision Summary (from Q&A session)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Primary Language | **TypeScript (Node.js)** |
| 2 | TUI Framework | **Ink (React for terminal) + raw ANSI hybrid** |
| 3 | Model Providers | **Ollama, Anthropic, OpenAI, OpenAI-compatible** — no vendor lock, user picks via onboarding + slash commands |
| 4 | API Key Storage | **Config file** (~/.friday/config.json) |
| 5 | Tool Scope v1 | **Full parity with Claude Code** (all 25+ tools) |
| 6 | Permission System | **Simplified 3 modes**: default (ask), acceptAll (trust), plan (read-only) |
| 7 | Subagent System | **Full**: foreground + background + task system |
| 8 | Skills & Plugins | **Both** in v1 |
| 9 | Config Directory | **.friday/** (project) / **~/.friday/** (user) / **FRIDAY.md** (memory) |
| 10 | Spider Placement | **Large on welcome screen + small in prompt** |
| 11 | Spider Name | **Friday** |
| 12 | Vim Mode | **Yes, full vim mode** in v1 |
| 13 | v1 Feature Cuts | **Cut**: voice input, image paste, web UI mode |
| 14 | Git Integration | **Full**: worktrees, attribution, branch-aware sessions, PR review |
| 15 | Target Platforms | **macOS + Linux + Windows** |
| 16 | Distribution | **npm** (primary) — `npm install -g fridaycode` |
| 17 | License | **MIT** |
| 18 | Repo Structure | **Monorepo** (npm workspaces) |
| 19 | Build Approach | **Full build** — all features at once |
| 20 | Team Size | **Solo developer** |
| 21 | Conversation Features | **Full**: branching, rewind, compaction, export, session resume |
| 22 | Theming | **Dark + Light** themes |
| 23 | Testing & CI | **Full**: unit + integration + e2e, GitHub Actions, 80%+ coverage |
| 24 | Telemetry | **Opt-in** anonymous stats |
| 25 | CLI Command | **`friday`** |
| 26 | Top Differentiator | **All 4**: model agnosticism, mascot/personality, full-featured & free, extensibility |

## Color Palette
- Deep Violet: #8B5CF6 (primary)
- Stark Rose: #F43F5E (errors/warnings)
- Acidic Pistachio: #A3E635 (success)
- Icy Slate: #F8FAFC (text)
- Midnight Slate: #334155 (backgrounds)
