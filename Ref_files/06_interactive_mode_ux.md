# Interactive Mode & UX Features

## Terminal UI Components

### Prompt Bar
- Colored indicator bar (customizable via /color)
- Shows current model, effort level, permission mode
- Status line with configurable segments

### Status Line
- Configurable via /statusline
- Shows: model, tokens used, cost, session name, git branch
- Auto-hides when not needed

### Task List
- Toggle with Ctrl+T
- Shows all tasks (background agents, cron jobs)
- Status indicators: running, completed, failed
- Click to view task details

### Diff Viewer
- Interactive diff display via /diff
- Shows pending changes before commit
- Inline approve/reject per hunk

### Context Viewer
- /context command shows context window usage
- Visual breakdown of what's consuming context
- Helps user manage context budget

---

## Input Modes

### Standard Input
- Multi-line input with Enter for newline
- Submit with Ctrl+Enter or configurable key
- Tab completion for commands and file paths
- History navigation with Up/Down arrows

### Vim Mode
- Toggle with /vim
- Full vi keybindings for input editing
- Normal mode, Insert mode, Visual mode
- :w to submit, :q to exit

### Voice Input
- /voice toggles push-to-talk
- Hold key to dictate, release to submit
- Real-time transcription display

### Bash Mode
- Prefix with ! to run shell commands directly
- `!ls -la` runs immediately without AI
- Output captured and optionally fed to AI

---

## Keyboard Shortcuts

### Navigation & Control
| Key | Action |
|-----|--------|
| Ctrl+C | Cancel current operation / clear input |
| Ctrl+D | Exit (EOF) |
| Ctrl+L | Clear screen |
| Ctrl+R | Reverse search through history |
| Escape+Escape | Interrupt AI generation |

### Session Management
| Key | Action |
|-----|--------|
| Ctrl+G | Show session info |
| Ctrl+O | Open file picker |
| Ctrl+T | Toggle task list |
| Ctrl+B | Send current bash to background |
| Ctrl+V | Paste (including images) |

### Model & Mode
| Key | Action |
|-----|--------|
| Option+P | Cycle permission modes |
| Option+T | Toggle fast mode |
| Option+O | Cycle models |
| Shift+Tab | Cycle permission levels for current request |

### Editing
| Key | Action |
|-----|--------|
| Tab | Autocomplete |
| Up/Down | Navigate history |
| Ctrl+A/E | Start/End of line |
| Ctrl+W | Delete word backward |
| Ctrl+U | Delete to start of line |
| Ctrl+K | Delete to end of line |

---

## Conversation Features

### Side Questions (/btw)
- Quick ephemeral questions
- No tool access, no context pollution
- Great for clarifications mid-task

### Conversation Branching (/branch or /fork)
- Create a branch of the conversation
- Explore alternative approaches
- Can return to original branch

### Rewind (/rewind or /checkpoint)
- Undo conversation turns
- Optionally revert file changes too
- Checkpoint system for safe exploration

### Compaction (/compact)
- Summarize conversation to free context
- Optional focus topic to preserve specific context
- Auto-compaction at configurable threshold

### Export (/export)
- Export conversation as plain text
- Copy last response (/copy)
- Useful for documentation

---

## Visual Features

### Themes
- Built-in: dark, light, light-daltonized, dark-daltonized
- Custom themes via /theme
- Color customization per element
- Accessibility-friendly options

### Prompt Suggestions
- AI suggests next actions after completion
- Clickable/selectable suggestions
- Context-aware recommendations

### Progress Indicators
- Spinner during AI thinking
- Token counter during generation
- Tool execution progress
- Background task progress in task list

### Image Support
- Paste images with Ctrl+V
- Images sent to model for analysis
- Screenshot integration via /chrome

---

## FridayCode UX Priorities

### Must Reproduce
- Vim mode
- Keyboard shortcuts (comprehensive set)
- /btw side questions
- Task list with background agents
- History and reverse search
- Multi-line input
- Tab completion
- Conversation branching/rewind
- Auto-compaction
- Theming system

### Unique to FridayCode
- Geometric spider mascot with expressions
- Custom color palette (Deep Violet, Stark Rose, Acidic Pistachio, Icy Slate, Midnight Slate)
- Spider reacts to: thinking (spinning web animation), error (scared face), success (happy dance), waiting (sleeping), working (building)
- Enhanced progress visualization
- Model provider switching UI (Ollama/Anthropic/OpenAI)
