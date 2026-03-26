# Plugin System Architecture

## Overview
Plugins bundle skills, agents, hooks, MCP servers, LSP servers, and settings into a distributable package. They extend Claude Code's capabilities without modifying the core.

---

## Plugin Directory Structure

```
my-plugin/
├── .claude-plugin/
│   ├── plugin.json          # Plugin manifest
│   ├── settings.json        # Default settings
│   ├── .mcp.json            # MCP server definitions
│   └── .lsp.json            # LSP server definitions
├── commands/                # Slash commands
│   └── my-command.md
├── agents/                  # Custom agents
│   └── my-agent.md
├── skills/                  # Custom skills
│   └── my-skill/
│       └── SKILL.md
├── hooks/                   # Hook scripts
│   └── pre-commit.sh
├── README.md
└── LICENSE
```

---

## Plugin Manifest (plugin.json)

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "What this plugin does",
  "author": "Author Name",
  "license": "MIT",
  "homepage": "https://github.com/...",
  "repository": "https://github.com/...",
  "keywords": ["claude-code", "plugin"],
  "engines": {
    "claude-code": ">=2.0.0"
  },
  "main": ".claude-plugin/plugin.json",
  "dependencies": {}
}
```

---

## Key Plugin Features

### Namespacing
- All plugin resources are namespaced: `plugin-name:skill-name`
- Prevents conflicts between plugins
- Users invoke with namespace: `/plugin-name:my-skill`

### MCP Servers
- Plugins can ship MCP servers for external integrations
- Defined in `.mcp.json` within plugin directory
- Server processes managed by plugin lifecycle

### LSP Servers
- Plugins can provide language server protocol support
- Code intelligence: diagnostics, completions, hover info
- Defined in `.lsp.json`

### Settings
- Plugins can provide default settings
- User can override via project/user settings
- Managed settings can restrict plugin behavior

### Distribution
- Marketplace (Anthropic plugin marketplace)
- Direct installation from git repos
- Local development via symlinks

---

## Plugin Lifecycle

1. **Discovery**: Claude Code scans plugin directories
2. **Loading**: Plugin manifest parsed, resources registered
3. **Activation**: MCP/LSP servers started, hooks registered
4. **Runtime**: Skills/agents available for invocation
5. **Deactivation**: Servers stopped, hooks unregistered
6. **Reload**: `/reload-plugins` command refreshes all plugins

---

## FridayCode Plugin System Considerations

### Must Have
- Plugin manifest format (JSON or YAML)
- Skills, agents, hooks bundling
- Namespaced resources to avoid conflicts
- Local development mode
- Plugin enable/disable per project

### Nice to Have
- Package registry (like npm)
- Version resolution and dependency management
- Plugin marketplace UI in terminal
- Auto-update mechanism
- Plugin templates/scaffolding command

### Architecture Decisions Needed
- Package format: npm-style, pip-style, or custom?
- Registry: self-hosted, GitHub-based, or custom?
- Isolation: sandboxed execution or trusted?
- Dependencies: allow inter-plugin dependencies?
