# TUI Framework Analysis

## Candidates Evaluated

---

## 1. Ratatui (Rust)

**Version**: 0.30.0 | **Stars**: 19.3k | **Contributors**: 277 | **License**: MIT

### Architecture
- **Immediate-mode rendering**: Redraw entire UI each frame
- **Backend-agnostic**: Supports crossterm, termion, termwiz
- **No built-in widgets overhead**: You compose what you need
- **Event-driven**: Handles keyboard, mouse, resize events

### Strengths
- Extremely fast rendering (Rust performance)
- Low memory footprint
- Rich widget ecosystem (charts, tables, lists, gauges, etc.)
- Active community with frequent releases
- Great for complex, responsive TUIs
- Battle-tested (used by gitui, bottom, diskonaut, etc.)
- Cross-platform (Linux, macOS, Windows)

### Weaknesses
- Rust learning curve
- More boilerplate for simple UIs
- Must manage application state manually
- No CSS-like styling (programmatic only)
- Plugin system would need custom implementation

### Notable Projects Using Ratatui
- gitui (Git TUI)
- bottom (system monitor)
- spotify-tui
- taskwarrior-tui

---

## 2. Textual (Python)

**Version**: 8.1.1 | **Stars**: 35.1k | **Contributors**: 190 | **License**: MIT

### Architecture
- **Component-based**: Widget tree with composition
- **CSS-like styling**: TCSS (Textual CSS) for theming
- **Async-first**: Built on Python asyncio
- **Message passing**: Event system between widgets
- **Web serving**: Can serve TUI apps as web pages

### Strengths
- Python ecosystem (easy integration with AI libraries)
- CSS-like styling makes theming easy
- Rich built-in widgets (DataTable, Tree, Markdown viewer, etc.)
- Web deployment via textual-web
- Rapid prototyping
- Strong documentation
- Built-in devtools

### Weaknesses
- Python performance overhead
- Higher memory usage than Rust/Go alternatives
- Startup time slower than compiled languages
- Less suitable for system-level operations
- GIL limitations for true parallelism

### Notable Projects Using Textual
- posting (API client)
- dolphie (MySQL monitor)
- trogon (CLI auto-discovery)
- toolong (log file viewer)

---

## 3. Other Frameworks Considered

### Bubble Tea (Go)
- **Stars**: 28k+ | **Language**: Go
- Elm-inspired architecture (Model-View-Update)
- Used by: charm tools, soft-serve, glow
- Good balance of performance and dev experience
- Strong for building production CLIs

### Ink (TypeScript/React)
- **Stars**: 27k+ | **Language**: TypeScript
- React for CLI - familiar component model
- JSX syntax for terminal rendering
- Used by: Gatsby CLI, Prisma, Twilio
- Same mental model as React web apps

### Blessed/Neo-blessed (Node.js)
- Older but proven
- ncurses-like API
- Heavy, less maintained

---

## Comparison Matrix

| Factor | Ratatui (Rust) | Textual (Python) | Bubble Tea (Go) | Ink (TypeScript) |
|--------|---------------|-------------------|-----------------|------------------|
| Performance | ★★★★★ | ★★★ | ★★★★ | ★★★ |
| Dev Speed | ★★★ | ★★★★★ | ★★★★ | ★★★★★ |
| AI Integration | ★★★ | ★★★★★ | ★★★ | ★★★★ |
| Theming | ★★★ | ★★★★★ | ★★★ | ★★★★ |
| Cross-platform | ★★★★★ | ★★★★ | ★★★★★ | ★★★★ |
| Community | ★★★★ | ★★★★★ | ★★★★ | ★★★★ |
| Binary Size | ★★★★★ | ★★ | ★★★★★ | ★★ |
| Plugin Ecosystem | ★★★ | ★★★★ | ★★★ | ★★★★ |
| Startup Time | ★★★★★ | ★★★ | ★★★★★ | ★★★ |
| Distribution | ★★★★★ | ★★★ | ★★★★★ | ★★★ |

---

## Recommendation Analysis

### For FridayCode specifically:
- **If prioritizing speed/binary**: Rust (Ratatui) or Go (Bubble Tea)
- **If prioritizing dev speed/AI libs**: Python (Textual) or TypeScript (Ink)
- **If prioritizing React-like DX**: TypeScript (Ink)
- **Claude Code's approach**: Shell 47%, Python 29.3%, TypeScript 17.7% (multi-language)

### Key Question: What's the primary language?
This is the single most important architectural decision for FridayCode.

| Approach | Pros | Cons |
|----------|------|------|
| **Python + Textual** | Fastest to build, best AI library support, CSS theming | Slower startup, larger distribution |
| **Rust + Ratatui** | Fastest runtime, single binary, smallest memory | Slowest to build, harder AI integration |
| **Go + Bubble Tea** | Good balance, single binary, fast enough | Smaller AI ecosystem |
| **TypeScript + Ink** | Familiar React DX, good AI libs, npm distribution | Node.js dependency, slower |
| **Hybrid (Rust core + Python plugins)** | Best of both worlds | Complex build, FFI overhead |
