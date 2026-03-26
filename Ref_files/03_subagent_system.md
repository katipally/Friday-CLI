# Subagent System Architecture

## Overview
Subagents are independent AI instances with their own context windows. They can be spawned for parallel work, background tasks, or specialized roles. Claude Code supports both built-in and custom agents.

---

## Built-in Agents

| Agent | Model | Purpose | Mode |
|-------|-------|---------|------|
| Explore | Haiku (fast) | Read-only codebase exploration | Foreground |
| Plan | Configurable | Design approach before coding | Foreground |
| General-purpose | Configurable | Default delegated tasks | Foreground |

---

## Custom Agent Definition

Custom agents are defined as Markdown files with YAML frontmatter:

```yaml
---
name: my-agent
description: |
  What this agent does and when to use it
tools:                    # Whitelist of allowed tools
  - Bash
  - Read
  - Write
  - Edit
disallowedTools:          # Blacklist (alternative to whitelist)
  - WebFetch
model: sonnet             # Model override
permissionMode: default   # default|acceptEdits|dontAsk|bypassPermissions|plan|auto
maxTurns: 50              # Maximum conversation turns
skills:                   # Skills available to this agent
  - my-skill
mcpServers:               # MCP servers available
  - server-name
hooks:                    # Event hooks
  PreToolUse:
    - matcher: Bash
      command: "echo check"
memory:                   # Memory file paths
  - path/to/context.md
background: false         # Run in background (non-blocking)
effort: high              # Effort level
isolation: worktree       # Git worktree isolation
initialPrompt: |          # System-level instructions
  You are a specialized agent for...
---

# Agent Instructions (Markdown body)

Detailed instructions the agent follows.
```

---

## Agent Locations (Priority Order)

1. **CLI flag**: `claude --agent path/to/agent.md`
2. **Project**: `.claude/agents/` in project root
3. **User**: `~/.claude/agents/` in home directory
4. **Plugin**: `<plugin>/.claude-plugin/agents/`

---

## Execution Modes

### Foreground (Blocking)
- Parent waits for completion
- Used for tasks that need sequential execution
- Agent tool spawns foreground agents

### Background (Non-blocking)
- Parent continues while agent works
- Managed via TaskCreate/TaskGet/TaskList/TaskUpdate/TaskStop tools
- Resume with SendMessage tool
- Persistent transcripts in ~/.claude/projects/{project}/{session}/subagents/

---

## Agent Teams Pattern
Multiple agents can collaborate:
- **Coordinator agent**: Delegates to specialized agents
- **Worker agents**: Each handles specific domain
- Example: Frontend Agent + Backend Agent + Test Agent coordinated by Lead Agent

---

## Key Behaviors

### Context Management
- Each subagent has its own context window (independent from parent)
- Auto-compaction at ~95% capacity
- Can inherit parent's CLAUDE.md context
- Can load additional memory files

### Isolation
- `isolation: worktree` creates a git worktree per agent
- Prevents file conflicts between parallel agents
- EnterWorktree/ExitWorktree tools manage worktree lifecycle

### Communication
- Parent → Child: Initial prompt + SendMessage
- Child → Parent: Final result message
- No direct child-to-child communication
- Background agents can be polled via TaskGet

### Nesting
- Agents can spawn sub-agents (recursive)
- Each level has its own context window
- maxTurns prevents infinite loops

### Transcripts
- All subagent conversations are persisted
- Location: ~/.claude/projects/{project}/{sessionId}/subagents/
- Can be reviewed for debugging/auditing

---

## Agent Patterns for FridayCode

### Pattern 1: Explore Agent (Read-Only)
- Fast model, read-only tools only
- Quick codebase exploration and Q&A
- No file modifications

### Pattern 2: Worker Agent (Task-Specific)
- Full tool access within scope
- Worktree isolation for safety
- maxTurns limit for cost control

### Pattern 3: Background Monitor
- Runs continuously in background
- Watches for events or conditions
- Reports back via task system

### Pattern 4: Specialized Domain Agent
- Deep expertise in specific area (security, testing, docs)
- Custom tools and MCP servers
- Pre-loaded context documents
