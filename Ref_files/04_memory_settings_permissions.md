# Memory, Settings & Permissions Architecture

## Memory System

### CLAUDE.md Files (User-Written)
- **Project level**: `CLAUDE.md` or `.claude/CLAUDE.md` in project root
- **User level**: `~/.claude/CLAUDE.md` (global preferences)
- **Organization level**: Organization-wide CLAUDE.md (enterprise)
- **Imported files**: `@path/to/file.md` syntax to include other docs
- Loaded at session start, always in context

### Auto Memory (AI-Written)
- Location: `~/.claude/projects/<project>/memory/MEMORY.md`
- AI autonomously records learnings during sessions
- Persistent across sessions for same project
- Not committed to repo (user-private)

### Rules System
- Location: `.claude/rules/` directory
- YAML frontmatter with `paths` for scoping
- Rules applied only when matching files are in context
- Example: `.claude/rules/typescript.md` with `paths: ["**/*.ts"]`

### Import System
- `@path/to/file` includes another file's content
- Works in CLAUDE.md, rules, skills, and agent definitions
- Relative paths resolved from file location
- Supports glob patterns for batch imports

---

## Settings Architecture

### 4 Scopes (Precedence: Managed > CLI > Local > Project > User)

| Scope | Location | Purpose |
|-------|----------|---------|
| **Managed** | MDM, API endpoint, or local file | Enterprise enforcement |
| **CLI** | Command-line flags | Session overrides |
| **Local** | `.claude/local-settings.json` | Per-developer, gitignored |
| **Project** | `.claude/settings.json` | Shared team settings |
| **User** | `~/.claude/settings.json` | Personal defaults |

### Key Settings Categories

#### Permissions
```json
{
  "permissions": {
    "allow": [
      "Bash(git log*)",
      "Bash(npm test*)",
      "Read",
      "Glob",
      "Grep"
    ],
    "deny": [
      "Bash(rm -rf*)",
      "Bash(curl*)"
    ]
  }
}
```

#### Model & Effort
```json
{
  "model": "claude-sonnet-4-20250514",
  "effort": "high",
  "fastModel": "claude-haiku-3-5-20241022"
}
```

#### Hooks
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "command": "echo validation",
        "timeout": 5000
      }
    ],
    "PostToolUse": [],
    "Stop": [],
    "SessionStart": [],
    "Notification": []
  }
}
```

#### MCP Servers
```json
{
  "mcpServers": {
    "my-server": {
      "command": "/path/to/server",
      "args": ["--flag"],
      "env": { "API_KEY": "..." }
    }
  }
}
```

#### Sandbox
```json
{
  "sandbox": {
    "enabled": true,
    "filesystem": {
      "writePaths": ["./src/**", "./test/**"],
      "readPaths": ["**"]
    },
    "network": {
      "allowedHosts": ["api.example.com"]
    }
  }
}
```

#### Other Important Settings
- `attribution`: Enable/disable git attribution
- `disableAutoMemory`: Turn off AI-written memories
- `disableAutoCompact`: Turn off auto-compaction
- `compactMessageThreshold`: When to auto-compact
- `prefersReducedMotion`: Accessibility
- `theme`: dark, light, light-daltonized, dark-daltonized
- `statusLine`: Configure status bar
- `permissionMode`: Global permission mode
- `apiKeyHelper`: External command for API keys
- `otel.isEnabled`: OpenTelemetry tracing

---

## Permission System

### Permission Modes
| Mode | Behavior |
|------|----------|
| `default` | Ask for dangerous operations |
| `acceptEdits` | Auto-approve file edits, ask for bash |
| `dontAsk` | Auto-approve everything in allowed list |
| `bypassPermissions` | Skip all permission checks |
| `plan` | Read-only, no modifications |
| `auto` | For CI/headless, uses sandboxing |

### Permission Rules
- **Tool-level**: Allow/deny specific tools by name
- **Pattern matching**: `Bash(git*)` allows git commands only
- **MCP tools**: `mcp__server__tool` naming pattern
- **Managed policies**: Enterprise can enforce minimum restrictions

### Security Model
- Default: conservative (ask for everything dangerous)
- Sandboxing: filesystem + network isolation
- Enterprise: managed settings override all
- Hooks: pre/post validation on tool use
- MCP: server-level allow/deny lists

---

## Hook Events

| Event | Trigger | Use Cases |
|-------|---------|-----------|
| PreToolUse | Before any tool executes | Validation, logging |
| PostToolUse | After tool completes | Audit, cleanup |
| Stop | Agent stops/completes | Notifications, summary |
| SubagentStart | Subagent spawns | Resource tracking |
| SubagentStop | Subagent completes | Cleanup |
| SessionStart | Session begins | Setup, environment check |
| Notification | User notification sent | External alerts |
| InstructionsLoaded | Context loaded | Dynamic instruction modification |
| WorktreeCreate | Worktree created | Setup hooks |
| WorktreeRemove | Worktree removed | Cleanup hooks |

### Hook Types
1. **Command hooks**: Execute shell commands
2. **HTTP hooks**: Send HTTP requests to endpoints
