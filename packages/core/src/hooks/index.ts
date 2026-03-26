import type { HookDefinition, HookEvent, HookPayload, HookEngine } from '@fridaycode/shared';
import { DEFAULT_HOOK_TIMEOUT_MS } from '@fridaycode/shared';
import { execSync } from 'node:child_process';

export class HookEngineImpl implements HookEngine {
  private hooks: HookDefinition[] = [];

  register(hook: HookDefinition): void {
    this.hooks.push(hook);
  }

  registerMany(hooks: HookDefinition[]): void {
    this.hooks.push(...hooks);
  }

  clear(): void {
    this.hooks = [];
  }

  async dispatch(payload: HookPayload): Promise<void> {
    const matching = this.hooks.filter((h) => {
      if (h.event !== payload.event) return false;
      if (h.matcher && payload.toolName && !this.matchTool(h.matcher, payload.toolName)) {
        return false;
      }
      return true;
    });

    for (const hook of matching) {
      try {
        if (hook.command) {
          await this.executeCommand(hook.command, payload, hook.timeout);
        } else if (hook.url) {
          await this.executeHttp(hook.url, payload, hook.timeout);
        }
      } catch (err) {
        // Hook failures are non-fatal — log and continue
        console.error(`Hook failed (${hook.event}): ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  getHooksForEvent(event: HookEvent): HookDefinition[] {
    return this.hooks.filter((h) => h.event === event);
  }

  private matchTool(matcher: string, toolName: string): boolean {
    if (matcher === toolName) return true;
    const regex = new RegExp('^' + matcher.replace(/\*/g, '.*') + '$');
    return regex.test(toolName);
  }

  private async executeCommand(
    command: string,
    payload: HookPayload,
    timeout?: number,
  ): Promise<void> {
    const env = {
      ...process.env,
      FRIDAY_HOOK_EVENT: payload.event,
      FRIDAY_TOOL_NAME: payload.toolName ?? '',
      FRIDAY_SESSION_ID: payload.sessionId ?? '',
      FRIDAY_AGENT_ID: payload.agentId ?? '',
    };

    if (payload.toolInput) {
      (env as Record<string, string>).FRIDAY_TOOL_INPUT = JSON.stringify(payload.toolInput);
    }

    execSync(command, {
      env,
      timeout: timeout ?? DEFAULT_HOOK_TIMEOUT_MS,
      stdio: 'pipe',
    });
  }

  private async executeHttp(
    url: string,
    payload: HookPayload,
    timeout?: number,
  ): Promise<void> {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeout ?? DEFAULT_HOOK_TIMEOUT_MS),
    });
  }
}
