# Skills System Architecture

## Overview
Skills are reusable prompt-based capabilities stored as Markdown files with YAML frontmatter. They can manage workflows, expose commands, or provide context documents.

---

## SKILL.md File Structure

```yaml
---
name: my-skill            # Display name (defaults to filename)
description: |            # Shown to users and model
  Brief description of what this skill does
disable-model-invocation: false  # If true, model can't auto-invoke
user-invocable: true      # If true, user can invoke via /skill-name
allowed-tools:            # Restrict which tools the skill can use
  - Bash
  - Read
  - Write
model: sonnet             # Override model for this skill
effort: high              # Override effort level
context: fork             # fork = isolated context window
agent: my-agent           # Run inside a specific agent
hooks:                    # Event hooks for the skill
  PreToolUse:
    - matcher: Bash
      command: "echo validation"
paths:                    # Path-based scoping
  - "src/**/*.ts"
  - "!node_modules/**"
shell: bash               # Shell for hook commands
---

# Skill instructions body (Markdown)

The model receives this Markdown content as instructions.
$ARGUMENTS is replaced with whatever the user typed after the command.
```

---

## Skill Locations (Load Order / Priority)

1. **CLI flag**: `claude --skill path/to/SKILL.md`
2. **Project**: `.claude/skills/` in project root
3. **User**: `~/.claude/skills/` in home directory
4. **Plugin**: `<plugin>/.claude-plugin/skills/`

---

## Bundled Skills

### /batch
- Orchestrates large-scale parallel changes across codebase
- Creates multiple subagents for parallel execution
- Tracks progress via task list

### /claude-api
- Loads Claude API reference documentation
- Context-only skill (provides knowledge)

### /debug
- Enables debug logging for troubleshooting
- Shows internal tool calls and decisions

### /loop
- Runs a prompt repeatedly on an interval
- Useful for monitoring or iterative tasks

### /simplify
- Reviews changed files for code quality
- Suggests and applies simplifications

---

## Key Behaviors
- Skills with `context: fork` run in an isolated context window (subagent)
- `$ARGUMENTS` in the body is replaced with user's input after the command
- Skills can specify `allowed-tools` to restrict tool access
- Skills can override model and effort level
- Plugin skills are namespaced: `plugin-name:skill-name`
- Skills can reference other files via `@path/to/file` import syntax
- Skills inherit project's CLAUDE.md context unless forked

---

## Custom Skill Examples

### Workflow Skill (PR Review)
```yaml
---
name: review-pr
description: Review current PR for issues
allowed-tools: [Bash, Read, Grep, Glob]
context: fork
---
Review the current PR. Run `git diff main...HEAD` to see changes.
Check for: security issues, performance problems, code style.
Format findings as a checklist.
```

### Context Skill (API Reference)
```yaml
---
name: api-docs
description: Load API documentation
disable-model-invocation: true
user-invocable: true
---
@docs/api-reference.md
@docs/authentication.md
```

### Agent-Delegated Skill
```yaml
---
name: deploy
description: Deploy to staging
agent: deploy-agent
---
Deploy the current branch to staging environment.
$ARGUMENTS
```
