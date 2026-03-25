# Friday CLI — Research Summary

## Competitive Landscape Analysis

### Tools Studied

| Tool | Language | TUI | Open Source | Key Strength |
|------|----------|-----|-------------|--------------|
| Claude Code | TypeScript | Ink | ❌ (Proprietary) | Best planning, CLAUDE.md rules |
| Gemini CLI | TypeScript | Ink | ✅ | 1M token context, Google ecosystem |
| GitHub Copilot CLI | TypeScript | Ink | ❌ (Proprietary) | GitHub integration, sub-agents |
| OpenCode | Go | Bubble Tea | ✅ | 75+ providers, modular |
| Aider | Python | Raw terminal | ✅ | Repo map, safety, git-native |
| Goose | Rust | Ratatui | ✅ | Performance, modular core |
| Cline | TypeScript | VS Code | ✅ | IDE integration, enterprise |
| Cursor | TypeScript | Electron | ❌ (Proprietary) | Full IDE experience |

### Key Insights from Research

#### 1. Architecture Patterns
- **Every major CLI agent uses a 3-layer architecture:**
  1. Foundation Model Layer (LLM)
  2. Agentic Scaffolding / Orchestration Layer
  3. User Interface Layer (CLI/TUI)
- **ReAct loop is the universal pattern** for agent execution
- **MCP is becoming the standard** for plugin/tool extensibility

#### 2. Why TypeScript + Ink Dominates
- Claude Code, Gemini CLI, and Copilot CLI all chose TypeScript + Ink
- React component model maps perfectly to terminal UI needs
- Streaming LLM responses are naturally async (Node.js event loop)
- npm ecosystem has the most LLM SDKs
- Source: https://www.youtube.com/watch?v=qSZwx5_EmSA

#### 3. Provider Abstraction is Critical
- Users want to switch between providers without friction
- Factory + Adapter pattern is the proven approach
- Must normalize: message format, streaming, tool calling, error handling
- Key libraries: llm-proxy (npm), AISuite (Python concept)
- Source: https://hub.agentdock.ai/docs/architecture/provider-agnostic-api

#### 4. MCP (Model Context Protocol) Design
- Client–server architecture with STDIO and HTTP/SSE transports
- Tool discovery via JSON-RPC: servers expose tool schemas
- Community plugins are just MCP servers
- SDKs available in TypeScript, Python, Rust, Go
- Source: https://modelcontextprotocol.io/docs/learn/architecture

#### 5. Security is Non-Negotiable
- Permission prompts alone are insufficient (prompt injection risk)
- Workspace scoping (only access project directory) is the minimum
- Container sandboxing (Docker) is the gold standard but requires Docker
- OS-level sandboxing (macOS Seatbelt, Linux Landlock) for defense in depth
- Claude Code uses Seatbelt profiles on macOS
- Source: https://cursor.com/blog/agent-sandboxing

#### 6. Context Management Strategies
- **Tree-sitter** for semantic code chunking (functions, classes, not raw lines)
- **Repo maps** (Aider's approach) give LLMs structural overview
- Smart summarization of older messages saves tokens
- Token budget allocation: system prompt → rules → repo context → history → response
- Source: https://aider.chat/2023/10/22/repomap.html

---

## References & Sources

### Architecture
- [CLI Agent Architecture Patterns](https://vivekhaldar.com/articles/cli-agent-architecture/)
- [Comparative Analysis of AI Coding Assistants](https://zjuer.net/2025/08/08/a-comparative-analysis-of-ai-coding-assistants/)
- [Every CLI Coding Agent Compared](https://michaellivs.com/blog/cli-coding-agents-compared/)
- [Awesome CLI Coding Agents List](https://github.com/bradAGI/awesome-cli-coding-agents)
- [How Coding Agents Work: OpenCode Deep Dive](https://cefboud.com/posts/coding-agents-internals-opencode-deepdive/)

### TUI Frameworks
- [Ink (React for Terminal)](https://www.npmjs.com/package/ink)
- [Why AI Tools Use Ink](https://www.youtube.com/watch?v=qSZwx5_EmSA)
- [TUI Library Comparison](https://blog.logrocket.com/7-tui-libraries-interactive-terminal-apps/)
- [Bubble Tea (Go)](https://github.com/charmbracelet/bubbletea)
- [Ratatui (Rust)](https://github.com/ratatui-org/ratatui)

### Provider Integration
- [LLM Proxy (npm)](https://www.npmjs.com/package/llm-proxy)
- [AgentDock Provider-Agnostic API](https://hub.agentdock.ai/docs/architecture/provider-agnostic-api)
- [AISuite Multi-LLM Library](https://dev.to/codemaker2015/aisuite-simplifying-genai-integration-across-multiple-llm-providers-4hmm)
- [OpenCode CLI Guide](https://yuv.ai/learn/opencode-cli)

### MCP (Model Context Protocol)
- [MCP Architecture Overview](https://modelcontextprotocol.io/docs/learn/architecture)
- [MCP as Plugin System](https://debugg.ai/resources/mcp-new-plugin-system-ide-cli-cloud-apis-2025)
- [Code Execution with MCP (Anthropic)](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [MCP Architecture Patterns (IBM)](https://developer.ibm.com/articles/mcp-architecture-patterns-ai-systems/)
- [How MCP Works (Lucidworks)](https://lucidworks.com/blog/how-the-model-context-protocol-works-a-technical-deep-dive)

### Agent Patterns
- [ReAct Pattern Design](https://agentic-design.ai/patterns/reasoning-techniques/react)
- [Agentic Design Patterns Guide](https://ragyfied.com/articles/agentic-design-patterns)
- [Agentic State Machines](https://github.com/adamterlson/AgenticStateMachines)
- [Temporal Agentic Loop](https://docs.temporal.io/ai-cookbook/agentic-loop-tool-call-openai-python)
- [7 Agentic AI Design Patterns](https://machinelearningmastery.com/7-must-know-agentic-ai-design-patterns/)

### Security
- [NVIDIA Agent Sandboxing Guide](https://developer.nvidia.com/blog/practical-security-guidance-for-sandboxing-agentic-workflows-and-managing-execution-risk/)
- [Cursor Agent Sandboxing](https://cursor.com/blog/agent-sandboxing)
- [Docker Sandboxes for Agents](https://www.docker.com/blog/docker-sandboxes-a-new-approach-for-coding-agent-safety/)
- [Claude Code Sandboxing](https://code.claude.com/docs/en/sandboxing)
- [AI Agent Containment](https://stateofsurveillance.org/articles/ai/ai-agent-containment-sandboxing/)

### Codebase Indexing
- [Real-Time Codebase Indexing (CocoIndex)](https://dev.to/cocoindex/build-real-time-codebase-indexing-for-ai-coding-agents-5eb2)
- [Aider Repo Map with Tree-sitter](https://aider.chat/2023/10/22/repomap.html)
- [Code AST MCP (70% Token Savings)](https://www.indiehackers.com/post/i-built-a-code-ast-mcp-that-saves-70-tokens-and-speed-up-coding-agent-that-went-viral-90k-views-on-x-436939a5b9)
- [Context Indexing and Packing](https://deepwiki.com/automata/aicodeguide/6.2-context-indexing-and-packing)
- [Tabby ML Repository Context](https://www.tabbyml.com/blog/repository-context-for-code-completion)

### Open Source CLI Agents (Code References)
- [Gemini CLI Source](https://github.com/google-gemini/gemini-cli)
- [OpenCode](https://github.com/opencode-ai/opencode)
- [Aider](https://github.com/paul-gauthier/aider)
- [Cline](https://cline.bot/)
- [LLM CLI (Simon Willison)](https://simonwillison.net/2025/May/27/llm-tools/)
