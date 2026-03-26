# FridayCode TUI Redesign Specification

> **Status**: Draft  
> **Target**: v2.0  
> **Stack**: React + Ink (terminal rendering)

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Mascot & Branding](#mascot--branding)
3. [Component Library](#component-library)
4. [Theme System](#theme-system)
5. [Layout & Spacing](#layout--spacing)
6. [Keyboard Shortcuts](#keyboard-shortcuts)
7. [Animations](#animations)
8. [Accessibility](#accessibility)
9. [Responsive Design](#responsive-design)

---

## Design Philosophy

FridayCode's TUI should feel **colorful, expressive, and full of personality**. The terminal is not a limitation — it's a canvas. We draw inspiration from the polish of Claude Code's TUI but push further with a playful, opinionated aesthetic.

### Core Principles

| Principle               | Description                                                           |
| ----------------------- | --------------------------------------------------------------------- |
| **Rich & Colorful**     | Use the full 256-color / truecolor palette. No monochrome minimalism. |
| **Expressive**          | Emoji, ASCII art, and dynamic feedback make the tool feel alive.      |
| **Playful Personality** | Friday has a voice — friendly, encouraging, occasionally witty.       |
| **Information Dense**   | Every pixel of terminal real estate earns its place.                  |
| **Fast & Responsive**   | Animations never block interaction. Perceived performance matters.    |

### Guiding Aesthetic

```
┌─────────────────────────────────────────────────────┐
│  Think: "What if your favorite IDE's terminal       │
│  had the personality of a Pixar character?"         │
│                                                     │
│  ✅ Warm, inviting, fun                             │
│  ✅ Dense with information but never cluttered      │
│  ✅ Smooth transitions and micro-interactions       │
│  ❌ Cold, sterile, "enterprise"                     │
│  ❌ Bare-bones, no feedback                         │
│  ❌ Walls of unformatted text                       │
└─────────────────────────────────────────────────────┘
```

---

## Mascot & Branding

### Friday — The Mascot

Friday is a friendly robot/AI assistant character that appears throughout the interface. Friday has **multiple expressions** that reflect the current state of the application.

### Brand Colors

| Role              | Color | Hex       | Usage                                         |
| ----------------- | ----- | --------- | --------------------------------------------- |
| **Primary Blue**  | 🔵    | `#4A90D9` | Headings, active elements, AI message borders |
| **Accent Green**  | 🟢    | `#50C878` | Success states, diff additions, confirmations |
| **Warning Amber** | 🟡    | `#FFB347` | Warnings, cost alerts, permission prompts     |
| **Error Red**     | 🔴    | `#FF6B6B` | Errors, diff removals, destructive actions    |
| **Muted Gray**    | ⚪    | `#8899AA` | Secondary text, timestamps, borders           |
| **Background**    | ⬛    | `#1A1B2E` | Default dark theme background                 |

### Mascot Expressions

#### 😊 Happy (Default)

```
    ╭─────────╮
    │  ◉   ◉  │
    │    ▽    │
    │  ╰───╯  │
    ╰────┬────╯
         │
    ╭────┴────╮
    │ ░░░░░░░ │
    │ ░FRIDAY░ │
    │ ░░░░░░░ │
    ╰─────────╯
   ╱╱         ╲╲
  ╱╱           ╲╲
```

> Used for: Welcome screen, normal conversation, greetings.

#### 🤔 Thinking (Processing)

```
    ╭─────────╮
    │  ◑   ◑  │
    │    ▽    │    ● ● ●
    │  ╰~~~╯  │
    ╰────┬────╯
         │
    ╭────┴────╮
    │ ░░░░░░░ │
    │ ░FRIDAY░ │
    │ ░░░░░░░ │
    ╰─────────╯
   ╱╱         ╲╲
  ╱╱           ╲╲
```

> Used for: While waiting for LLM response, running tools, processing.

#### 🎉 Celebrating (Task Complete)

```
  ✨            ✨
    ╭─────────╮
    │  ◉   ◉  │
    │    ▽    │
    │  ╰▽▽▽╯  │
    ╰────┬────╯
       ╱ │ ╲
    ╭─╱──┴──╲─╮
    │ ░░░░░░░ │  🎉
    │ ░FRIDAY░ │
    │ ░░░░░░░ │
    ╰─────────╯
   ╱╱         ╲╲
  ╱╱           ╲╲
```

> Used for: Task completion, successful builds, tests passing.

#### 😵 Confused (Error)

```
    ╭─────────╮
    │  ✖   ✖  │
    │    ▽    │    ?!
    │  ╰═══╯  │
    ╰────┬────╯
         │
    ╭────┴────╮
    │ ░░░░░░░ │
    │ ░FRIDAY░ │
    │ ░░░░░░░ │
    ╰─────────╯
   ╱╱         ╲╲
  ╱╱           ╲╲
```

> Used for: Errors, unrecoverable failures, malformed input.

#### 😴 Sleeping (Idle)

```
    ╭─────────╮
    │  ━   ━  │
    │    ▽    │   z Z Z
    │  ╰───╯  │
    ╰────┬────╯
         │
    ╭────┴────╮
    │ ░░░░░░░ │
    │ ░FRIDAY░ │
    │ ░░░░░░░ │
    ╰─────────╯
   ╱╱         ╲╲
  ╱╱           ╲╲
```

> Used for: Idle timeout, session paused, waiting for user input for a long time.

### Mascot Placement

| Context             | Behavior                                  |
| ------------------- | ----------------------------------------- |
| **Welcome Screen**  | Full-size happy mascot with greeting      |
| **Error States**    | Confused mascot inline with error message |
| **Help Text**       | Small mascot icon next to tips            |
| **Session Summary** | Celebrating mascot with stats             |
| **Idle (>5 min)**   | Sleeping mascot replaces status bar       |

---

## Component Library

All components are built as React/Ink components. Each component is self-contained, themeable, and composable.

### 3.1 MessageBubble

Renders conversation messages with distinct styles for user vs. AI.

```
┌─ Props ──────────────────────────────────────────────┐
│  role: 'user' | 'assistant'                          │
│  content: string (markdown supported)                │
│  timestamp?: Date                                    │
│  tokens?: number                                     │
│  model?: string                                      │
└──────────────────────────────────────────────────────┘
```

**User Message** (right-aligned, cyan border):

```
                            ┌──────────────────────────┐
                            │ Can you fix the auth bug? │
                            └──────────────────────────┘
                                              12:34 PM ▸
```

**AI Message** (left-aligned, gradient blue border):

````
┌──────────────────────────────────────────────────────┐
│ ◈ Friday                                     gpt-4o │
├──────────────────────────────────────────────────────┤
│ I found the issue in `src/auth.ts`. The token        │
│ validation was checking expiry with `<` instead       │
│ of `<=`. Here's the fix:                              │
│                                                       │
│ ```ts                                                 │
│ if (token.exp <= Date.now() / 1000) {                │
│   throw new TokenExpiredError();                      │
│ }                                                     │
│ ```                                                   │
├──────────────────────────────────────────────────────┤
│ 📊 247 tokens · $0.002                      12:34 PM │
└──────────────────────────────────────────────────────┘
````

**Implementation Notes**:

- Markdown is rendered inline using a terminal markdown renderer
- Code blocks within messages delegate to the `CodeBlock` component
- Long messages are paginated with "Show more" / "Show less"
- Supports streaming: characters appear progressively during generation

---

### 3.2 CodeBlock

Syntax-highlighted code display with full IDE-like features.

```
┌─ Props ──────────────────────────────────────────────┐
│  code: string                                        │
│  language: string                                    │
│  filename?: string                                   │
│  showLineNumbers?: boolean (default: true)           │
│  highlightLines?: number[]                           │
│  maxHeight?: number (lines before scroll)            │
│  highlighter: 'shiki' | 'starry-night'              │
└──────────────────────────────────────────────────────┘
```

**Rendered Example**:

```
╭─ typescript ─── src/auth.ts ──────────── 📋 Copy ──╮
│  1 │ import { verify } from 'jsonwebtoken';         │
│  2 │                                                │
│  3 │ export function validateToken(token: string) {  │
│  4 │   const decoded = verify(token, SECRET);        │
│  5 │   if (decoded.exp <= Date.now() / 1000) {       │  ← highlighted
│  6 │     throw new TokenExpiredError();               │  ← highlighted
│  7 │   }                                             │
│  8 │   return decoded;                               │
│  9 │ }                                               │
╰─────────────────────────────────────── 9 lines ─────╯
```

**Implementation Notes**:

- Use **shiki** (preferred) or **starry-night** for syntax highlighting
- Language auto-detection as fallback
- "Copy" indicator shows `✓ Copied!` for 2 seconds after copy action
- Line numbers are dimmed (muted gray)
- Highlighted lines get a subtle background color tint

---

### 3.3 DiffViewer

Unified diff display for file changes.

```
┌─ Props ──────────────────────────────────────────────┐
│  diff: string (unified diff format)                  │
│  filename: string                                    │
│  collapsed?: boolean (default: false)                │
│  showLineNumbers?: boolean (default: true)           │
│  onApply?: () => void                                │
│  onReject?: () => void                               │
└──────────────────────────────────────────────────────┘
```

**Rendered Example**:

```
╭─ 📄 src/auth.ts ─────────────── +2 / -1 ── ▸ Apply ─╮
│  12   │   const decoded = verify(token, SECRET);      │
│  13 - │   if (decoded.exp < Date.now() / 1000) {      │ (red bg)
│  13 + │   if (decoded.exp <= Date.now() / 1000) {     │ (green bg)
│  14   │     throw new TokenExpiredError();             │
│  15 + │     logger.warn('Token expired', { token });   │ (green bg)
│  16   │   }                                           │
╰───────────────────────────────────────────────────────╯
```

**Implementation Notes**:

- Red background (`#FF6B6B` at 20% opacity) for removed lines
- Green background (`#50C878` at 20% opacity) for added lines
- Collapsible: click header or press `c` to collapse/expand
- Apply/Reject buttons for interactive approval workflows
- Shows `+N / -M` summary in header

---

### 3.4 StatusBar

Persistent bottom bar showing session information.

```
╭──────────────────────────────────────────────────────────────────╮
│ 🤖 gpt-4o │ 📊 12,847 tokens │ 💰 $0.14 │ ⏱ 23m │ 🔧 3 tools │
╰──────────────────────────────────────────────────────────────────╯
```

**Segments**:

| Segment  | Content                    | Updates             |
| -------- | -------------------------- | ------------------- |
| Model    | Current model name         | On model switch     |
| Tokens   | Cumulative token count     | After each response |
| Cost     | Session cost estimate      | After each response |
| Duration | Session elapsed time       | Every minute        |
| Tools    | Count of active tool calls | Real-time           |

**Implementation Notes**:

- Fixed at terminal bottom (Ink's `<Box position="fixed">` or equivalent)
- Truncates gracefully at narrow widths (drops segments right-to-left)
- Clickable segments where supported (model → switch model, cost → cost breakdown)

---

### 3.5 InputBox

Multi-line input with rich editing features.

```
┌─ Props ──────────────────────────────────────────────┐
│  placeholder?: string                                │
│  history: string[]                                   │
│  onSubmit: (value: string) => void                   │
│  completions?: CompletionProvider[]                   │
│  multiline?: boolean (default: true)                 │
└──────────────────────────────────────────────────────┘
```

**Rendered Example**:

```
╭─ Friday ▸ ─────────────────────────────────────────────╮
│ Can you refactor the auth module to use              │
│ the new JWT library? Also update the tests.█          │
│                                                       │
│                         Shift+Enter: new line │ Enter: send │
╰───────────────────────────────────────────────────────╯
```

**Features**:

- **History navigation**: Up/Down arrows cycle through past inputs
- **Tab completion**: `/` prefix triggers command completion, paths trigger file completion
- **Ctrl+R**: Reverse incremental search through history
- **Multi-line**: Shift+Enter for new line, Enter to submit
- **Syntax hints**: `/commands` are highlighted in blue, `file paths` in green
- **Character counter**: Shows remaining characters when approaching model context limits

---

### 3.6 ToolCallPanel

Collapsible panel showing active and recent tool executions.

**Expanded**:

```
╭─ 🔧 Tool Calls ──────────────────── [Ctrl+T to hide] ─╮
│                                                         │
│  ⠋ bash: npm run test                    running 12s   │
│    ├─ stdout: 47 tests passed                           │
│    └─ stdout: 2 tests failing...                        │
│                                                         │
│  ✅ readFile: src/auth.ts                 done 0.3s     │
│  ✅ grep: "validateToken"                 done 1.2s     │
│                                                         │
╰─────────────────────────────────────────────────────────╯
```

**Collapsed** (single line in status area):

```
🔧 bash: npm run test ⠋ (12s) │ 2 completed
```

**Implementation Notes**:

- Live output streaming for running tools
- Spinner animation for in-progress tools
- Green checkmark for completed, red X for failed
- Auto-collapse after all tools complete (configurable delay)
- Maximum 5 recent completed tools shown (scrollable)

---

### 3.7 ProgressBar

Animated progress indicator for long operations.

**Determinate**:

```
  Installing dependencies  ████████████░░░░░░░░  62%  (31/50 packages)
```

**Indeterminate**:

```
  Analyzing codebase  ░░░████░░░░░░░░░░░░░░  thinking...
```

**Implementation Notes**:

- Smooth animation at 60fps (or terminal refresh rate)
- Color transitions from blue → green as progress increases
- ETA calculation for determinate progress
- Multiple concurrent progress bars supported (stacked)

---

### 3.8 InteractiveMenu

Arrow-key navigable selection menus.

```
╭─ Select Model ──────────────────────────────────────────╮
│                                                         │
│    gpt-4o              128K ctx · $2.50/M out          │
│  ▸ claude-sonnet-4     200K ctx · $3.00/M out    ★     │
│    gemini-2.0-flash    1M ctx   · $0.30/M out          │
│    deepseek-chat       64K ctx  · $0.14/M out          │
│                                                         │
│  ↑↓ Navigate  Enter Select  / Filter  Esc Cancel       │
╰─────────────────────────────────────────────────────────╯
```

**Features**:

- Arrow key navigation with visual indicator (`▸`)
- Type-ahead filtering with `/` prefix
- Grouped items with category headers
- Star (★) for favorited/recommended items
- Description text for each option
- Scrollable when list exceeds terminal height

---

### 3.9 Toast / Notification

Ephemeral messages that auto-dismiss.

```
  ╭─ ✅ ──────────────────────────────────────────╮
  │  Settings saved successfully                  │
  ╰───────────────────────────────────────── 3s ──╯
```

**Variants**:

| Type    | Icon | Color | Duration                |
| ------- | ---- | ----- | ----------------------- |
| Success | ✅   | Green | 3s                      |
| Warning | ⚠️   | Amber | 5s                      |
| Error   | ❌   | Red   | 8s (or until dismissed) |
| Info    | ℹ️   | Blue  | 3s                      |

**Implementation Notes**:

- Appears at top-right of terminal
- Stacks vertically if multiple active
- Fade-out animation on dismiss
- Keyboard dismissible with `Esc`

---

### 3.10 PermissionPrompt

Styled yes/no/always prompt for tool execution permissions.

```
╭─ 🔐 Permission Required ─────────────────────────────────╮
│                                                           │
│  Friday wants to execute a bash command:                  │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ $ rm -rf node_modules && npm install                │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  This will delete and reinstall all dependencies.         │
│                                                           │
│  [Y] Yes   [N] No   [A] Always allow   [?] Explain       │
│                                                           │
╰───────────────────────────────────────────────────────────╯
```

**Implementation Notes**:

- Color-coded risk levels: green (safe), amber (moderate), red (destructive)
- Command preview with syntax highlighting
- "Always allow" remembers per-tool or per-command-pattern
- "Explain" option shows what the tool will do
- Auto-deny after configurable timeout (default: 30s)

---

### 3.11 WelcomeScreen

First thing users see when starting FridayCode.

```
╭──────────────────────────────────────────────────────────────────────╮
│                                                                      │
│      ╭─────────╮                                                     │
│      │  ◉   ◉  │     ███████╗██████╗ ██╗██████╗  █████╗ ██╗   ██╗  │
│      │    ▽    │     ██╔════╝██╔══██╗██║██╔══██╗██╔══██╗╚██╗ ██╔╝  │
│      │  ╰───╯  │     █████╗  ██████╔╝██║██║  ██║███████║ ╚████╔╝   │
│      ╰────┬────╯     ██╔══╝  ██╔══██╗██║██║  ██║██╔══██║  ╚██╔╝    │
│           │          ██║     ██║  ██║██║██████╔╝██║  ██║   ██║      │
│      ╭────┴────╮     ╚═╝     ╚═╝  ╚═╝╚═╝╚═════╝ ╚═╝  ╚═╝   ╚═╝   │
│      │ ░FRIDAY░ │                                                    │
│      ╰─────────╯     Your AI coding companion  v2.0.0               │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────   │
│                                                                      │
│  📂 Project: fridaycode (TypeScript)                                 │
│  🤖 Model:   claude-sonnet-4 (Anthropic)                            │
│  💰 Budget:  $5.00 remaining today                                   │
│                                                                      │
│  💡 Tips:                                                            │
│     • Type naturally — Friday understands context                    │
│     • Use /help for all commands                                     │
│     • Press Ctrl+T to toggle the tool panel                          │
│     • Use /theme to change the look                                  │
│                                                                      │
│  📜 Recent Sessions:                                                 │
│     1. "Fix auth bug" — 2 hours ago (saved)                         │
│     2. "Refactor API routes" — yesterday (saved)                     │
│     3. "Add unit tests for utils" — 3 days ago                      │
│                                                                      │
╰──────────────────────────────────────────────────────────────────────╯
```

---

### 3.12 SessionSummary

Displayed when ending a session (exit, Ctrl+C, /bye).

```
╭──────────────────────────────────────────────────────────────────────╮
│                                                                      │
│  ✨           ╭─────────╮           ✨                               │
│               │  ◉   ◉  │                                           │
│               │  ╰▽▽▽╯  │      Great session! 🎉                    │
│               ╰────┬────╯                                            │
│                    │                                                 │
│                                                                      │
│  ─────────────── Session Summary ────────────────────                │
│                                                                      │
│  ⏱  Duration:      23 minutes                                       │
│  💬 Messages:      14 exchanges                                      │
│  📊 Tokens:        28,491 (in: 21,200 / out: 7,291)                │
│  💰 Cost:          $0.34                                             │
│  🤖 Model:         claude-sonnet-4                                  │
│                                                                      │
│  📁 Files Modified:                                                  │
│     ✏️  src/auth.ts                                                  │
│     ✏️  src/auth.test.ts                                             │
│     ➕  src/middleware/rateLimit.ts (new)                             │
│                                                                      │
│  🔧 Tools Used:                                                     │
│     bash ×12  │  readFile ×8  │  writeFile ×3  │  grep ×5           │
│                                                                      │
│  Session saved. Resume with: friday --resume                         │
│                                                                      │
╰──────────────────────────────────────────────────────────────────────╯
```

---

## Theme System

### Built-in Themes

FridayCode ships with 7 built-in themes:

| Theme              | Description                            | Background | Foreground |
| ------------------ | -------------------------------------- | ---------- | ---------- |
| **Default (Dark)** | Rich dark theme with vibrant accents   | `#1A1B2E`  | `#E8E8E8`  |
| **Light**          | Clean light theme for bright terminals | `#FAFAFA`  | `#2D2D2D`  |
| **Monokai**        | Classic Monokai color scheme           | `#272822`  | `#F8F8F2`  |
| **Dracula**        | Popular dark purple theme              | `#282A36`  | `#F8F8F2`  |
| **Nord**           | Arctic blue-gray palette               | `#2E3440`  | `#ECEFF4`  |
| **Solarized**      | Ethan Schoonover's precision colors    | `#002B36`  | `#839496`  |
| **High Contrast**  | Maximum readability                    | `#000000`  | `#FFFFFF`  |

### Theme Configuration Schema

Each theme defines colors for every semantic element:

```yaml
# ~/.friday/themes/custom-theme.yaml
name: 'My Custom Theme'
author: 'username'
version: '1.0.0'

colors:
  # Base
  background: '#1A1B2E'
  foreground: '#E8E8E8'
  muted: '#8899AA'
  border: '#3A3B4E'

  # Messages
  user:
    text: '#FFFFFF'
    border: '#00CED1' # Cyan
    background: '#1A2A3A'
  assistant:
    text: '#E8E8E8'
    border: '#4A90D9' # Primary blue
    background: '#1A1B2E'
    accent: '#50C878' # Accent green

  # Code
  code:
    background: '#0D1117'
    border: '#30363D'
    lineNumbers: '#6E7681'
    keyword: '#FF7B72'
    string: '#A5D6FF'
    comment: '#8B949E'
    function: '#D2A8FF'
    variable: '#FFA657'

  # Diff
  diff:
    added: '#50C878'
    addedBackground: '#0D2818'
    removed: '#FF6B6B'
    removedBackground: '#2D0A0A'
    header: '#4A90D9'

  # Status
  error: '#FF6B6B'
  warning: '#FFB347'
  success: '#50C878'
  info: '#4A90D9'

  # UI elements
  statusBar:
    background: '#0D1117'
    foreground: '#8899AA'
    active: '#4A90D9'
  input:
    background: '#1A1B2E'
    border: '#3A3B4E'
    borderFocused: '#4A90D9'
    placeholder: '#555566'
  menu:
    background: '#1A1B2E'
    selected: '#2A2B4E'
    highlight: '#4A90D9'
```

### Theme Commands

| Command                 | Description                      |
| ----------------------- | -------------------------------- |
| `/theme`                | List available themes            |
| `/theme <name>`         | Switch to a theme                |
| `/theme preview <name>` | Preview a theme without applying |
| `/theme create`         | Launch interactive theme creator |
| `/theme export`         | Export current theme to YAML     |

### Custom Themes

Users can create custom themes by placing YAML files in `~/.friday/themes/`:

```
~/.friday/themes/
├── my-custom-theme.yaml
├── company-brand.yaml
└── seasonal-holiday.yaml
```

Themes are hot-reloadable — editing the YAML file applies changes immediately.

---

## Layout & Spacing

### Visual Hierarchy

```
┌──────────────────────────────────────────────────────────────────┐
│  [WelcomeScreen / Header]                                        │  ← 1 line after startup
│                                                                  │
│  [Message History - Scrollable]                                   │  ← Main content area
│  │  MessageBubble (user)                                         │
│  │  MessageBubble (assistant)                                    │
│  │    └─ CodeBlock                                               │
│  │    └─ DiffViewer                                              │
│  │  MessageBubble (user)                                         │
│  │  ...                                                          │
│                                                                  │
│  [ToolCallPanel - Collapsible]                                   │  ← Above input
│                                                                  │
│  [InputBox]                                                      │  ← Fixed at bottom
│  [StatusBar]                                                     │  ← Fixed at very bottom
│                                                                  │
│  [Toast/Notification Stack]                         (top-right)  │  ← Overlay
│  [PermissionPrompt]                                 (centered)   │  ← Modal overlay
│  [InteractiveMenu]                                  (centered)   │  ← Modal overlay
└──────────────────────────────────────────────────────────────────┘
```

### Spacing Rules

| Element       | Padding                       | Margin                        |
| ------------- | ----------------------------- | ----------------------------- |
| MessageBubble | 1 char horizontal, 0 vertical | 1 line between messages       |
| CodeBlock     | 1 char all sides              | 0 (inline in message)         |
| DiffViewer    | 1 char all sides              | 1 line above/below            |
| StatusBar     | 1 char horizontal             | 0                             |
| InputBox      | 1 char horizontal             | 1 line above                  |
| ToolCallPanel | 1 char all sides              | 1 line above                  |
| Toast         | 1 char all sides              | 1 line between stacked toasts |

### Box Drawing Characters

Use Unicode box-drawing characters consistently:

| Use                     | Characters    |
| ----------------------- | ------------- |
| Rounded corners         | `╭ ╮ ╰ ╯`     |
| Straight lines          | `│ ─`         |
| T-junctions             | `├ ┤ ┬ ┴`     |
| Cross                   | `┼`           |
| Double lines (emphasis) | `║ ═ ╔ ╗ ╚ ╝` |

---

## Keyboard Shortcuts

### Global Shortcuts

| Shortcut    | Action                                  | Context       |
| ----------- | --------------------------------------- | ------------- |
| `Ctrl+C`    | Cancel current operation / Exit if idle | Always        |
| `Ctrl+L`    | Clear screen                            | Always        |
| `Ctrl+R`    | Reverse search through input history    | Input focused |
| `Tab`       | Auto-complete (commands, file paths)    | Input focused |
| `Shift+Tab` | Reverse auto-complete cycle             | Input focused |
| `Esc`       | Cancel current input / Close modal      | Always        |
| `Ctrl+T`    | Toggle tool call panel                  | Always        |
| `Ctrl+K`    | Open command palette                    | Always        |
| `Ctrl+S`    | Save current session                    | Always        |
| `Ctrl+N`    | New session                             | Always        |

### Input Shortcuts

| Shortcut        | Action                       |
| --------------- | ---------------------------- |
| `Enter`         | Submit message               |
| `Shift+Enter`   | New line in input            |
| `Up / Down`     | Navigate input history       |
| `Ctrl+A`        | Move cursor to start of line |
| `Ctrl+E`        | Move cursor to end of line   |
| `Ctrl+W`        | Delete word backward         |
| `Ctrl+U`        | Delete to start of line      |
| `Alt+Backspace` | Delete word backward         |

### Navigation Shortcuts

| Shortcut         | Action                          |
| ---------------- | ------------------------------- |
| `Page Up / Down` | Scroll message history          |
| `Home / End`     | Jump to top / bottom of history |
| `Ctrl+Up / Down` | Scroll one message at a time    |

---

## Animations

### Typing Indicator

When the AI is generating a response:

```
Frame 1:  Friday is typing ●○○
Frame 2:  Friday is typing ○●○
Frame 3:  Friday is typing ○○●
Frame 4:  Friday is typing ●○○
(cycle every 300ms)
```

### Spinner Variants

Available spinner styles for different contexts:

| Name     | Frames                | Use Case                 |
| -------- | --------------------- | ------------------------ |
| `dots`   | `⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏` | Tool execution (default) |
| `line`   | `- \ \| /`            | Simple progress          |
| `circle` | `◐ ◓ ◑ ◒`             | Model loading            |
| `bounce` | `⠁ ⠂ ⠄ ⠂`             | Waiting for API          |
| `pulse`  | `░ ▒ ▓ █ ▓ ▒`         | Processing               |

### Progress Bar Animation

```
Frame 1:  ████████░░░░░░░░░░░░  42%
Frame 2:  █████████░░░░░░░░░░░  45%
Frame 3:  ██████████░░░░░░░░░░  48%
(smooth interpolation, not jumpy)
```

### Fade Transitions

- Messages fade in when appearing (opacity 0 → 1 over 200ms)
- Toasts fade out when dismissing (opacity 1 → 0 over 300ms)
- Tool panel slides up/down when toggling (150ms)

**Note**: All animations respect the `reducedMotion` accessibility setting. When enabled, transitions are instant.

---

## Accessibility

### High Contrast Mode

When enabled via `/theme high-contrast` or `--high-contrast` flag:

- All colors meet WCAG AAA contrast ratio (7:1)
- No color-only indicators (always paired with icons/text)
- Borders are thicker/more visible
- Background colors are pure black (`#000000`)

### Screen Reader Support

- All UI elements include appropriate ARIA-like labels (where terminal screen readers support them)
- Status changes are announced (tool started, tool completed, error occurred)
- Focus order follows visual layout: header → messages → tool panel → input → status bar
- Interactive elements have clear focus indicators

### Reduced Motion

When enabled via `--reduced-motion` or config:

```json
{
  "accessibility": {
    "reducedMotion": true
  }
}
```

- All animations are disabled
- Spinners show static indicators instead
- Progress bars update without smooth interpolation
- No fade/slide transitions

### Additional Accessibility Features

| Feature                  | Description                                     |
| ------------------------ | ----------------------------------------------- |
| **Font size**            | Respects terminal font size settings            |
| **Key repeat**           | All shortcuts work with key repeat              |
| **No flashing**          | No content flashes faster than 3Hz              |
| **Error identification** | Errors include text description, not just color |
| **Timeout extension**    | Permission prompts can be extended              |

---

## Responsive Design

FridayCode adapts to terminal dimensions:

### Width Breakpoints

| Width            | Behavior                                                         |
| ---------------- | ---------------------------------------------------------------- |
| **< 60 cols**    | Warning displayed; minimal layout (no borders, compact messages) |
| **60–80 cols**   | Compact layout: abbreviated status bar, single-line tool panel   |
| **80–120 cols**  | Standard layout: full borders, side-by-side where possible       |
| **120–200 cols** | Wide layout: message metadata inline, expanded tool panel        |
| **> 200 cols**   | Capped at 200 cols content width, centered                       |

### Height Behavior

- Minimum usable height: 24 lines
- Message history gets all available space minus input (3 lines) and status bar (1 line)
- Tool panel is collapsible to reclaim vertical space
- Long code blocks are scrollable, not truncated

### Resize Handling

- Terminal resize events (`SIGWINCH`) trigger immediate re-layout
- No content loss on resize — scroll position preserved
- Animations pause during resize, resume after

---

## File Structure

All new UI components live under `packages/friday-tui/`:

```
packages/friday-tui/
├── src/
│   ├── components/
│   │   ├── MessageBubble.tsx
│   │   ├── CodeBlock.tsx
│   │   ├── DiffViewer.tsx
│   │   ├── StatusBar.tsx
│   │   ├── InputBox.tsx
│   │   ├── ToolCallPanel.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── InteractiveMenu.tsx
│   │   ├── Toast.tsx
│   │   ├── PermissionPrompt.tsx
│   │   ├── WelcomeScreen.tsx
│   │   ├── SessionSummary.tsx
│   │   └── Mascot.tsx
│   ├── themes/
│   │   ├── ThemeProvider.tsx
│   │   ├── useTheme.ts
│   │   ├── default.yaml
│   │   ├── light.yaml
│   │   ├── monokai.yaml
│   │   ├── dracula.yaml
│   │   ├── nord.yaml
│   │   ├── solarized.yaml
│   │   └── high-contrast.yaml
│   ├── hooks/
│   │   ├── useKeyboard.ts
│   │   ├── useAnimation.ts
│   │   ├── useResponsive.ts
│   │   └── useAccessibility.ts
│   ├── layouts/
│   │   ├── MainLayout.tsx
│   │   ├── CompactLayout.tsx
│   │   └── WideLayout.tsx
│   └── App.tsx
├── assets/
│   └── mascot/
│       ├── happy.txt
│       ├── thinking.txt
│       ├── celebrating.txt
│       ├── confused.txt
│       └── sleeping.txt
└── package.json
```

---

## Implementation Priority

| Phase                  | Components                                    | Effort    |
| ---------------------- | --------------------------------------------- | --------- |
| **P0 — Core**          | MessageBubble, CodeBlock, InputBox, StatusBar | 2 weeks   |
| **P1 — Enhanced**      | DiffViewer, ToolCallPanel, PermissionPrompt   | 1.5 weeks |
| **P2 — Polish**        | Theme system, WelcomeScreen, SessionSummary   | 1.5 weeks |
| **P3 — Delight**       | Animations, Mascot, Toast, InteractiveMenu    | 1 week    |
| **P4 — Accessibility** | High contrast, reduced motion, screen reader  | 1 week    |

**Total estimated effort: ~7 weeks**
