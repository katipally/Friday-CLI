# Tool System Architecture

Design document for FridayCode's tool system. FridayCode is an AI coding agent CLI that gives LLMs access to tools — enabling them to read files, run commands, search code, and interact with the development environment.

---

## 1. Current Tools

All 9 tools are functional and ship with the core package. Each tool has JSON Schema parameter definitions and built-in validation.

### File Operations

| Tool         | Description                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------- |
| `file_read`  | Read file contents with optional line range. Path sandboxed to workspace root.                    |
| `file_write` | Write or overwrite file contents. Creates parent directories as needed.                           |
| `file_edit`  | Apply surgical string replacements to existing files. Matches exact substrings and replaces them. |

### Shell

| Tool   | Description                                                                                                     |
| ------ | --------------------------------------------------------------------------------------------------------------- |
| `bash` | Execute shell commands with configurable timeout and working directory. Captures stdout, stderr, and exit code. |

### Search

| Tool   | Description                                                                                           |
| ------ | ----------------------------------------------------------------------------------------------------- |
| `grep` | Pattern search in files using ripgrep. Supports regex, globs, context lines, and file type filters.   |
| `glob` | File pattern matching using glob syntax (`**/*.ts`, `src/**/*.test.js`). Returns matching file paths. |

### Directory

| Tool             | Description                                                                            |
| ---------------- | -------------------------------------------------------------------------------------- |
| `list_directory` | List directory contents with configurable depth. Returns file names, sizes, and types. |

### Git (Read-Only)

| Tool       | Description                                                                |
| ---------- | -------------------------------------------------------------------------- |
| `git_diff` | Show uncommitted changes or diff between refs. Supports file-scoped diffs. |
| `git_log`  | Show commit history with optional filters (author, date range, path).      |

---

## 2. New Tools to Add

### Web & Browser

#### `web_fetch`

HTTP GET/POST with response parsing.

- **GET**: Fetch a URL and return the response body.
- **POST**: Send JSON/form data to a URL.
- **Response parsing**: HTML→markdown conversion, JSON extraction via JSONPath, raw text.
- **Rate limiting**: Configurable requests-per-second per domain (default: 2/s).
- **URL allowlist/blocklist**: Restrict which domains the agent can access. Configured in project settings.

```typescript
parameters: {
  url: string;           // Required
  method?: "GET" | "POST";
  body?: string;
  headers?: Record<string, string>;
  parseAs?: "markdown" | "json" | "text" | "raw";
  maxLength?: number;    // Truncate response (default: 20000 chars)
}
```

#### `browser`

Headless Chrome automation via Puppeteer for testing web apps and scraping docs.

- **Navigate**: Go to URL, wait for page load or specific selector.
- **Screenshot**: Capture viewport or full page as PNG/JPEG.
- **Click**: Click elements by CSS selector or text content.
- **Fill forms**: Type into inputs, select dropdowns, check boxes.
- **Extract text**: Get text content or HTML from selectors.
- **JavaScript evaluation**: Run arbitrary JS in page context and return results.

```typescript
parameters: {
  action: "navigate" | "screenshot" | "click" | "fill" | "extract" | "evaluate";
  url?: string;
  selector?: string;
  value?: string;
  script?: string;
  waitFor?: string;      // Selector or timeout in ms
  fullPage?: boolean;
}
```

### Notebook

#### `notebook_edit`

Jupyter `.ipynb` file manipulation.

- **Add cell**: Insert a code or markdown cell at a position.
- **Edit cell**: Replace cell source content by index.
- **Delete cell**: Remove a cell by index.
- **Execute cell**: Run a cell and capture outputs (requires running kernel).
- **Read outputs**: Return cell outputs (text, images, errors).

```typescript
parameters: {
  path: string;
  action: "add" | "edit" | "delete" | "execute" | "read_outputs";
  cellIndex?: number;
  cellType?: "code" | "markdown";
  source?: string;
}
```

### Git (Write Operations)

#### `git_commit`

Stage files and create commits.

```typescript
parameters: {
  files?: string[];       // Files to stage (default: all modified)
  message: string;        // Commit message
  amend?: boolean;        // Amend previous commit
}
```

#### `git_push` / `git_pull`

Push to remote and pull changes.

- `git_push`: Push current branch to remote. Handles force-push with `--force-with-lease`.
- `git_pull`: Pull changes with rebase or merge strategy. Reports conflicts if any.

```typescript
// git_push
parameters: {
  remote?: string;       // Default: "origin"
  branch?: string;       // Default: current branch
  force?: boolean;       // Uses --force-with-lease
}

// git_pull
parameters: {
  remote?: string;
  branch?: string;
  strategy?: "rebase" | "merge";
}
```

#### `git_checkout`

Switch or create branches.

```typescript
parameters: {
  branch: string;
  create?: boolean;       // Create new branch (-b)
  startPoint?: string;    // Base ref for new branch
}
```

#### `git_reset`

Reset to a commit or unstage files.

```typescript
parameters: {
  ref?: string;           // Commit to reset to
  files?: string[];       // Specific files to unstage
  mode?: "soft" | "mixed" | "hard";
}
```

#### `git_stash`

Stash and pop changes.

```typescript
parameters: {
  action: "push" | "pop" | "list" | "drop";
  message?: string;       // For push
  index?: number;         // For pop/drop
}
```

#### `git_blame`

Show line-by-line authorship.

```typescript
parameters: {
  path: string;
  lineRange?: [number, number];  // Optional start/end lines
}
```

### Advanced Search

#### `semantic_search`

Search the codebase by meaning using vector embeddings. Requires the indexer to build and maintain an embedding index.

```typescript
parameters: {
  query: string;          // Natural language query
  maxResults?: number;    // Default: 10
  filePattern?: string;   // Filter by glob pattern
  threshold?: number;     // Minimum similarity score (0-1)
}
```

### Database

#### `sql_query`

Execute queries against project databases (SQLite, PostgreSQL).

```typescript
parameters: {
  query: string;          // SQL query
  database?: string;      // Connection name from project config
  params?: unknown[];     // Parameterized query values
  readOnly?: boolean;     // Default: true — prevents writes unless explicit
}
```

### Sub-Agent

#### `task_spawn`

Spawn a sub-agent to handle a sub-task in a separate context.

```typescript
parameters: {
  prompt: string;         // Task description for the sub-agent
  tools?: string[];       // Restrict available tools (default: inherit parent)
  timeout?: number;       // Max execution time in seconds
  context?: string;       // Additional context to inject
}
```

---

## 3. Tool Registration System

### ToolRegistry

Tools register via a central `ToolRegistry` that manages discovery, validation, and execution.

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;
  requiredPermissions: PermissionScope[];
  execute: (params: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}

class ToolRegistry {
  register(tool: ToolDefinition): void;
  unregister(name: string): void;
  get(name: string): ToolDefinition | undefined;
  list(): ToolDefinition[];
  listByGroup(group: string): ToolDefinition[];
}
```

### Runtime Registration

Plugins and skills can register new tools at runtime:

```typescript
// In a plugin's activate() function
registry.register({
  name: 'my_custom_tool',
  description: 'Does something specific to my workflow',
  parameters: {
    /* JSON Schema */
  },
  requiredPermissions: ['read'],
  execute: async (params, ctx) => {
    /* implementation */
  },
});
```

### Tool Discovery

The LLM receives the full tool list in the system prompt, formatted as function definitions with name, description, and parameter schemas. The list is regenerated when tools are registered or unregistered.

### Tool Groups

Tools are organized by category for display and filtering:

| Group      | Tools                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------ |
| `file`     | file_read, file_write, file_edit, list_directory                                                 |
| `search`   | grep, glob, semantic_search                                                                      |
| `shell`    | bash                                                                                             |
| `git`      | git_diff, git_log, git_commit, git_push, git_pull, git_checkout, git_reset, git_stash, git_blame |
| `web`      | web_fetch, browser                                                                               |
| `notebook` | notebook_edit                                                                                    |
| `database` | sql_query                                                                                        |
| `agent`    | task_spawn                                                                                       |

---

## 4. Permission System Integration

### Permission Scopes

Each tool declares the permission scopes it requires:

```typescript
type PermissionScope = 'read' | 'write' | 'execute' | 'network';
```

| Scope     | Description                    | Example Tools                         |
| --------- | ------------------------------ | ------------------------------------- |
| `read`    | Read files, list directories   | file_read, grep, glob, list_directory |
| `write`   | Create/modify/delete files     | file_write, file_edit, notebook_edit  |
| `execute` | Run shell commands, git writes | bash, git_commit, git_push            |
| `network` | Make HTTP requests             | web_fetch, browser                    |

### Permission Check Flow

1. LLM requests a tool call.
2. `PermissionSystem.check(tool, params)` is called before execution.
3. If the tool+params match a previously granted permission, execution proceeds.
4. Otherwise, the user is prompted with the tool name, parameters, and required scope.
5. User responds with one of:
   - **Once**: Grant for this single invocation.
   - **For session**: Grant for all invocations of this tool during the current session.
   - **Always**: Persist the grant across sessions (stored in global config).
   - **Never**: Deny and remember the denial.

### Auto-Approval and Dangerous Operations

- Read-only tools (`file_read`, `grep`, `glob`, `list_directory`, `git_diff`, `git_log`) are auto-approved by default.
- Dangerous operations (`bash`, `git_push`, `git_reset --hard`) **always** require explicit confirmation unless the user has opted into `--yolo` / auto-approve mode.
- The blocklist of always-confirm operations is not user-configurable to prevent accidental data loss.

---

## 5. Parallel Tool Execution

When the LLM requests multiple tool calls in a single response, FridayCode executes them in parallel for performance.

### Execution Strategy

```typescript
async function executeToolCalls(calls: ToolCall[]): Promise<ToolResult[]> {
  const { independent, dependent } = detectDependencies(calls);

  // Run independent calls in parallel
  const results = await Promise.all(independent.map((call) => executeWithConcurrencyLimit(call)));

  // Run dependent calls sequentially
  for (const call of dependent) {
    results.push(await executeTool(call));
  }

  return results;
}
```

### Dependency Detection

If tool B references a file path that tool A creates, they are marked as dependent and run sequentially. Heuristic-based detection covers common patterns:

- `file_write` → `file_read` on the same path
- `git_commit` → `git_push`
- `bash` commands that produce files consumed by other tools

### Concurrency Limit

Configurable via `tools.maxConcurrency` in project config (default: 5). Prevents resource exhaustion when many tools run simultaneously.

---

## 6. Tool Output Handling

### Structured Output Format

All tools return a consistent result shape:

```typescript
interface ToolResult {
  success: boolean;
  output: string; // Primary output (stdout, file contents, etc.)
  error?: string; // Error message if success is false
  metadata?: {
    duration: number; // Execution time in ms
    truncated: boolean; // Whether output was truncated
    bytesRead?: number;
    exitCode?: number; // For bash tool
  };
}
```

### Truncation

Large outputs are truncated to prevent context window overflow:

- Default max: 50,000 characters (configurable via `tools.maxOutputChars`).
- When truncated, `metadata.truncated` is set to `true` and a message is appended indicating how much was omitted.
- The LLM can request specific line ranges or use `grep` to narrow results.

### Streaming Output

Long-running tools (primarily `bash`) support streaming:

- Output is streamed to the TUI in real-time so the user can observe progress.
- The final `ToolResult` contains the complete output.
- If the tool times out, partial output is returned with `success: false`.

---

## 7. Safety & Sandboxing

### Path Sandboxing

All file-operating tools enforce workspace root sandboxing:

- Paths are resolved relative to the workspace root.
- Symlinks are resolved and checked — no escaping via symlink.
- Absolute paths outside the workspace are rejected.
- `..` traversal that escapes the workspace is rejected.

```typescript
function validatePath(inputPath: string, workspaceRoot: string): string {
  const resolved = path.resolve(workspaceRoot, inputPath);
  if (!resolved.startsWith(workspaceRoot + path.sep) && resolved !== workspaceRoot) {
    throw new ToolError(`Path escapes workspace: ${inputPath}`);
  }
  return resolved;
}
```

### Command Blocklist (bash)

The `bash` tool maintains a blocklist of dangerous command patterns:

- `rm -rf /` and variations
- `mkfs`, `dd` targeting devices
- `chmod 777` on sensitive paths
- `:(){:|:&};:` (fork bomb)
- Commands that modify the tool system itself

The blocklist is checked against the raw command string before execution.

### Network Access Control

- `web_fetch` and `browser` require `network` permission scope.
- URL allowlist/blocklist is configured per-project.
- DNS resolution is checked against blocklist to prevent SSRF to internal networks.
- Default: localhost and private IP ranges are blocked unless explicitly allowed.

### Timeout Enforcement

Every tool has a configurable timeout (default: 30 seconds for most tools, 120 seconds for `bash`). Exceeded timeouts result in:

- Process termination (for `bash`).
- Promise rejection with a timeout error.
- Partial output returned where available.

---

## 8. TypeScript Interfaces

```typescript
import { JSONSchema7 } from 'json-schema';

/** Permission scope required by a tool */
type PermissionScope = 'read' | 'write' | 'execute' | 'network';

/** Context provided to tool execution */
interface ToolContext {
  workspaceRoot: string;
  cwd: string;
  abortSignal: AbortSignal;
  permissions: PermissionSystem;
  config: ResolvedConfig;
  logger: Logger;
}

/** Result returned by every tool */
interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: {
    duration: number;
    truncated: boolean;
    bytesRead?: number;
    exitCode?: number;
    [key: string]: unknown;
  };
}

/** Definition of a tool that can be registered */
interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema7;
  requiredPermissions: PermissionScope[];
  group?: string;
  execute: (params: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}

/** Central registry for all available tools */
interface IToolRegistry {
  register(tool: ToolDefinition): void;
  unregister(name: string): void;
  get(name: string): ToolDefinition | undefined;
  list(): ToolDefinition[];
  listByGroup(group: string): ToolDefinition[];
  toFunctionDefinitions(): FunctionDefinition[];
}

/** Tool call as received from the LLM */
interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** Function definition sent to the LLM in the system prompt */
interface FunctionDefinition {
  name: string;
  description: string;
  parameters: JSONSchema7;
}
```
