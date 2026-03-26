# CI/CD Agent Mode & GitHub App

Design document for FridayCode's automation capabilities — running headless in CI pipelines, integrating with GitHub as a first-class App, and providing a GitHub Action for workflow automation.

---

## 1. Agent Mode (Headless CI/CD)

Agent mode enables FridayCode to run non-interactively in CI pipelines, scripts, and automation workflows.

### Invocation

```bash
friday --agent [options]
friday --headless [options]   # alias
```

### Input Methods

| Method               | Example                                               |
| -------------------- | ----------------------------------------------------- |
| `--prompt` flag      | `friday --agent --prompt "Fix all TypeScript errors"` |
| `--prompt-file` flag | `friday --agent --prompt-file instructions.md`        |
| stdin                | `echo "Fix all TypeScript errors" \| friday --agent`  |
| stdin (pipe)         | `cat review-prompt.md \| friday --agent`              |

If no prompt is provided, FridayCode reads from stdin. If stdin is also empty, it exits with code 1.

### Output Modes

| Flag             | Description                                        |
| ---------------- | -------------------------------------------------- |
| `--output json`  | Structured JSON output (for machine consumption)   |
| `--output text`  | Human-readable output (default for non-agent mode) |
| `--output quiet` | Minimal output — only the final result or error    |

#### JSON Output Structure

```json
{
  "status": "success",
  "summary": "Fixed 3 TypeScript errors across 2 files",
  "files_changed": ["src/auth.ts", "src/utils.ts"],
  "cost": 0.0042,
  "tokens": { "in": 12400, "out": 3200 },
  "duration_ms": 8400,
  "tool_calls": 7
}
```

### Exit Codes

| Code | Meaning                                                                   |
| ---- | ------------------------------------------------------------------------- |
| `0`  | Success — task completed                                                  |
| `1`  | Error — task failed or invalid input                                      |
| `2`  | Permission denied — tool or action requires approval that was not granted |
| `3`  | Budget exceeded — `--max-cost` limit reached                              |
| `4`  | Timeout — `--timeout` limit reached                                       |

### Progress Events

When running in agent mode, progress events are emitted on **stderr** as JSON lines. This allows stdout to remain clean for structured output while still providing real-time feedback.

```jsonl
{"type":"start","message":"Starting agent mode","timestamp":"2025-01-15T10:30:00Z"}
{"type":"tool_call","message":"Reading file src/auth.ts","timestamp":"2025-01-15T10:30:01Z"}
{"type":"tool_call","message":"Editing src/auth.ts","timestamp":"2025-01-15T10:30:02Z"}
{"type":"complete","message":"Task completed successfully","timestamp":"2025-01-15T10:30:05Z"}
```

### Flags

| Flag         | Default           | Description                                                                   |
| ------------ | ----------------- | ----------------------------------------------------------------------------- |
| `--timeout`  | `5m` (agent mode) | Maximum execution time. Accepts durations like `30s`, `5m`, `1h`.             |
| `--max-cost` | none              | Maximum cost in USD. Agent stops if this limit is reached.                    |
| `--yes`      | `false`           | Auto-approve all permission prompts. **Use only in trusted CI environments.** |
| `--model`    | config default    | Override the model for this run.                                              |
| `--provider` | config default    | Override the provider for this run.                                           |

### Example Usage

```bash
# Fix TypeScript errors, auto-approve, structured output
echo "Fix all TypeScript errors" | friday --agent --yes --output json

# Generate docs with budget cap
friday --agent --prompt "Add JSDoc to all exported functions in src/api/" --max-cost 0.50

# Run from a prompt file with timeout
friday --agent --prompt-file .friday/prompts/review.md --timeout 10m --output text
```

---

## 2. GitHub App Integration

FridayCode can operate as a GitHub App that automatically responds to repository events.

### Supported Events

| Event                           | Trigger                           | Action                                                |
| ------------------------------- | --------------------------------- | ----------------------------------------------------- |
| `pull_request.opened`           | PR is opened                      | Auto-review the PR, post findings as a review comment |
| `issue.labeled`                 | Issue receives `friday-fix` label | Attempt to fix the issue, create a PR with the fix    |
| `pull_request_review.submitted` | Review comments are posted        | Auto-address review comments with code changes        |
| `issue_comment.created`         | Comment mentions `@friday`        | Respond to the question or execute the request        |

### Architecture

```
GitHub Event
    │
    ▼
GitHub Webhooks
    │
    ▼
Serverless Function (AWS Lambda / Vercel / Cloudflare Worker)
    │
    ▼
FridayCode Agent Mode (--agent --yes --output json)
    │
    ▼
GitHub API (post comment, create PR, push branch)
```

### Event Processing Flow

1. **Webhook received**: Serverless function validates the webhook signature.
2. **Event parsed**: Extract repository, PR/issue number, and relevant context.
3. **Agent invoked**: Spawn FridayCode in agent mode with the appropriate prompt.
4. **Result posted**: Agent output is formatted and posted back to GitHub via the API.

### Configuration

The GitHub App respects a `.friday/config.json` file in the repository root:

```json
{
  "github_app": {
    "enabled": true,
    "auto_review": true,
    "auto_fix_labels": ["friday-fix"],
    "allowed_tools": ["read_file", "edit_file", "bash"],
    "model": "claude-sonnet-4-20250514",
    "provider": "anthropic",
    "max_cost_per_event": 0.25,
    "protected_branches": ["main", "release/*"]
  }
}
```

### Security

- The App only acts on repositories where it is explicitly installed.
- Repository-level `.friday/config.json` controls what the App can do.
- The App never pushes directly to protected branches.
- All actions are attributed to the `friday[bot]` user for auditability.

---

## 3. GitHub Actions Integration

### Official Action

The official GitHub Action wraps FridayCode's agent mode for seamless CI integration.

```yaml
- uses: friday/fridaycode-action@v1
  with:
    prompt: 'Review this PR for security issues'
    provider: anthropic
    model: claude-sonnet-4-20250514
    output: json
    max-cost: '0.50'
    timeout: '10m'
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Action Inputs

| Input          | Required | Default          | Description                                     |
| -------------- | -------- | ---------------- | ----------------------------------------------- |
| `prompt`       | Yes\*    | —                | The task prompt                                 |
| `prompt-file`  | Yes\*    | —                | Path to a prompt file (alternative to `prompt`) |
| `provider`     | No       | `anthropic`      | LLM provider                                    |
| `model`        | No       | provider default | Model to use                                    |
| `output`       | No       | `json`           | Output format (`json`, `text`, `quiet`)         |
| `max-cost`     | No       | `1.00`           | Maximum cost in USD                             |
| `timeout`      | No       | `10m`            | Execution timeout                               |
| `auto-approve` | No       | `true`           | Auto-approve tool permission prompts            |

\*One of `prompt` or `prompt-file` is required.

### Action Outputs

| Output          | Description                             |
| --------------- | --------------------------------------- |
| `summary`       | Human-readable summary of what was done |
| `files_changed` | JSON array of files that were modified  |
| `exit_code`     | Agent exit code (0–4)                   |
| `cost`          | Actual cost incurred (USD)              |

### Example Workflows

#### PR Security Review

```yaml
name: Friday Security Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  security-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: friday/fridaycode-action@v1
        id: review
        with:
          prompt: |
            Review the changes in this PR for security vulnerabilities.
            Focus on: injection attacks, auth bypasses, secret leaks, unsafe deserialization.
            Post findings as a summary.
          provider: anthropic
          model: claude-sonnet-4-20250514
          max-cost: '0.50'
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Comment on PR
        if: steps.review.outputs.exit_code == '0'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: `## 🔒 Security Review\n\n${{ steps.review.outputs.summary }}`
            });
```

#### Auto-Fix on Issue Label

```yaml
name: Friday Auto-Fix
on:
  issues:
    types: [labeled]

jobs:
  auto-fix:
    if: github.event.label.name == 'friday-fix'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: friday/fridaycode-action@v1
        id: fix
        with:
          prompt: |
            Fix the issue described below. Create the necessary code changes.
            Issue #${{ github.event.issue.number }}: ${{ github.event.issue.title }}
            ${{ github.event.issue.body }}
          max-cost: '1.00'
          timeout: '15m'
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Create PR
        if: steps.fix.outputs.exit_code == '0'
        run: |
          git checkout -b friday/fix-${{ github.event.issue.number }}
          git add -A
          git commit -m "fix: address issue #${{ github.event.issue.number }}

          ${{ steps.fix.outputs.summary }}

          Closes #${{ github.event.issue.number }}"
          git push origin friday/fix-${{ github.event.issue.number }}
          gh pr create \
            --title "fix: ${{ github.event.issue.title }}" \
            --body "Automated fix for #${{ github.event.issue.number }}\n\n${{ steps.fix.outputs.summary }}" \
            --base main
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 4. Webhook Server

FridayCode includes an optional built-in webhook server for self-hosted deployments.

### Starting the Server

```bash
friday serve --port 3000
friday serve --port 3000 --host 0.0.0.0  # bind to all interfaces
```

### Features

- **Webhook validation**: Verifies GitHub webhook signatures using the configured secret.
- **Event routing**: Dispatches events to the appropriate handler based on event type.
- **Queue system**: Processes events sequentially via an in-memory queue to prevent resource contention.
- **Health endpoint**: `GET /health` returns server status and queue depth.

### Configuration

```bash
# Set the webhook secret
export FRIDAY_WEBHOOK_SECRET="whsec_..."

# Set API keys for the LLM provider
export ANTHROPIC_API_KEY="sk-..."
```

### Endpoints

| Method | Path       | Description                    |
| ------ | ---------- | ------------------------------ |
| `POST` | `/webhook` | Receives GitHub webhook events |
| `GET`  | `/health`  | Health check and queue status  |

### Queue Behavior

Events are processed one at a time in FIFO order. If the server receives multiple events while one is being processed, they are queued and handled in order. The queue has a configurable maximum depth (default: 50) — events beyond this limit are rejected with a 429 status.

---

## 5. Pipeline Integration Examples

### Pre-Commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit

# Check staged files for security issues before committing
friday --agent --prompt "Check for security issues in staged files. Only report critical problems." --yes --output quiet --timeout 30s

if [ $? -ne 0 ]; then
  echo "❌ Security issues detected. Review above and fix before committing."
  exit 1
fi
```

### PR Review via GitHub Action

Triggered automatically on every PR open or update (see Section 3 example workflows).

### Auto-Fix via Issue Label

Apply the `friday-fix` label to an issue, and a GitHub Action creates a PR with the fix attempt (see Section 3 example workflows).

### Release Notes Generation

```bash
# Generate release notes from commits since the last tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
PROMPT="Generate release notes from the following commits. Group by category (features, fixes, chores). Use conventional commit format."

if [ -n "$LAST_TAG" ]; then
  COMMITS=$(git log "${LAST_TAG}..HEAD" --oneline)
else
  COMMITS=$(git log --oneline -50)
fi

echo "${PROMPT}\n\n${COMMITS}" | friday --agent --yes --output text > RELEASE_NOTES.md
```

### Scheduled Code Quality Check

```yaml
name: Weekly Code Quality
on:
  schedule:
    - cron: '0 9 * * 1' # Every Monday at 9am

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: friday/fridaycode-action@v1
        with:
          prompt: |
            Analyze this codebase for code quality issues:
            - Dead code and unused exports
            - Functions that are too long or complex
            - Missing error handling
            - Type safety improvements
            Create an issue summarizing the top 5 findings.
          max-cost: '2.00'
          timeout: '20m'
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

---

## 6. Security Considerations

### Branch Protection

- FridayCode in CI mode **never** pushes directly to `main`, `master`, or any branch matching patterns in `protected_branches`.
- All automated changes go through pull requests for human review.
- Force-push is never used by the agent.

### Cost Controls

- `--max-cost` flag enforces a hard spending limit per invocation.
- The GitHub App config enforces `max_cost_per_event`.
- If the budget is exceeded, the agent stops immediately with exit code 3.
- Cost tracking is logged for every CI run.

### Secrets Management

- API keys are provided **exclusively** via environment variables.
- Keys are never logged, printed, or stored in output.
- The agent refuses to read or echo environment variables starting with common secret prefixes (`API_KEY`, `SECRET`, `TOKEN`, `PASSWORD`).
- GitHub Actions secrets are injected via the `env` block as usual.

### Permission Model

- Without `--yes`, the agent pauses at every permission-requiring tool call and exits with code 2 (in CI, this effectively means the operation is denied).
- With `--yes`, all tools are auto-approved. **This flag should only be used in trusted CI environments.**
- The `.friday/config.json` `allowed_tools` array restricts which tools the agent may use, even with `--yes`.

### Audit Log

All CI agent actions are logged to a structured audit trail:

```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "event": "tool_call",
  "tool": "edit_file",
  "parameters": { "path": "src/auth.ts" },
  "result": "success",
  "run_id": "abc123",
  "repository": "owner/repo",
  "triggered_by": "pull_request.opened"
}
```

---

## 7. Monitoring & Observability

### Structured Logging

All CI operations emit structured JSON logs on stderr:

```json
{
  "level": "info",
  "message": "Agent completed task",
  "timestamp": "2025-01-15T10:30:05Z",
  "run_id": "abc123",
  "duration_ms": 8400,
  "cost": 0.0042,
  "tool_calls": 7,
  "exit_code": 0
}
```

### OpenTelemetry Traces

Agent execution is instrumented with OpenTelemetry for distributed tracing:

- **Root span**: `friday.agent.run` — the entire agent execution.
- **Child spans**: One per tool call (`friday.tool.edit_file`, `friday.tool.bash`, etc.).
- **Attributes**: `model`, `provider`, `cost`, `tokens`, `exit_code`.
- Export to any OTLP-compatible backend (Jaeger, Honeycomb, Datadog, etc.).

Enable with:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT="https://otel.example.com"
friday --agent --prompt "..." --yes
```

### Metrics

Key metrics exposed for monitoring:

| Metric                         | Type    | Description                            |
| ------------------------------ | ------- | -------------------------------------- |
| `friday.agent.success_rate`    | Gauge   | Percentage of successful agent runs    |
| `friday.agent.avg_cost`        | Gauge   | Average cost per agent run             |
| `friday.agent.avg_duration_ms` | Gauge   | Average execution time                 |
| `friday.agent.tool_usage`      | Counter | Tool call counts by tool name          |
| `friday.agent.budget_exceeded` | Counter | Number of runs that hit the cost limit |
| `friday.agent.timeout`         | Counter | Number of runs that timed out          |

---

## 8. Configuration for CI

### `.friday/ci-config.json`

Place this file in the repository root to configure FridayCode's behavior in CI:

```json
{
  "allowed_tools": ["read_file", "edit_file", "bash", "glob", "grep", "git_diff", "git_log"],
  "denied_tools": ["git_push", "npm_publish"],
  "model": "claude-sonnet-4-20250514",
  "provider": "anthropic",
  "budget": {
    "max_cost_per_run": 1.0,
    "max_cost_per_day": 10.0,
    "warn_at": 0.75
  },
  "timeout": "10m",
  "auto_approve_rules": [
    {
      "tool": "read_file",
      "approve": true
    },
    {
      "tool": "edit_file",
      "approve": true,
      "conditions": {
        "path_pattern": "src/**"
      }
    },
    {
      "tool": "bash",
      "approve": false
    }
  ],
  "protected_branches": ["main", "release/*"],
  "notifications": {
    "on_failure": true,
    "on_budget_exceeded": true
  }
}
```

### Configuration Precedence

1. CLI flags (highest priority)
2. Environment variables
3. `.friday/ci-config.json` in repository root
4. Global `~/.friday/config.json`
5. Built-in defaults (lowest priority)

### Environment Variables

| Variable                | Description                                           |
| ----------------------- | ----------------------------------------------------- |
| `FRIDAY_PROVIDER`       | LLM provider override                                 |
| `FRIDAY_MODEL`          | Model override                                        |
| `FRIDAY_MAX_COST`       | Cost limit override                                   |
| `FRIDAY_TIMEOUT`        | Timeout override                                      |
| `FRIDAY_AUTO_APPROVE`   | Set to `true` to auto-approve (equivalent to `--yes`) |
| `FRIDAY_LOG_LEVEL`      | Log verbosity: `debug`, `info`, `warn`, `error`       |
| `FRIDAY_WEBHOOK_SECRET` | Webhook signature validation secret                   |
| `ANTHROPIC_API_KEY`     | Anthropic API key                                     |
| `OPENAI_API_KEY`        | OpenAI API key                                        |
