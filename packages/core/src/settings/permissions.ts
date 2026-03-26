import type { PermissionMode, PermissionRule, PermissionDecision, PermissionManager } from '@fridaycode/shared';
import { matchToolPattern } from '@fridaycode/shared';

export class PermissionEngine implements PermissionManager {
  mode: PermissionMode;
  rules: PermissionRule[];

  private askHandler?: (toolName: string, input?: Record<string, unknown>) => Promise<boolean>;

  constructor(mode: PermissionMode, rules: PermissionRule[]) {
    this.mode = mode;
    this.rules = rules;
  }

  setAskHandler(handler: (toolName: string, input?: Record<string, unknown>) => Promise<boolean>): void {
    this.askHandler = handler;
  }

  async check(toolName: string, input?: Record<string, unknown>): Promise<PermissionDecision> {
    // Plan mode: deny all write operations
    if (this.mode === 'plan') {
      const readOnlyTools = ['Read', 'Glob', 'Grep', 'LSP', 'ToolSearch', 'AskUserQuestion', 'TodoWrite'];
      return readOnlyTools.includes(toolName) ? 'allow' : 'deny';
    }

    // AcceptAll mode: allow everything
    if (this.mode === 'acceptAll') {
      return 'allow';
    }

    // Default mode: check rules, then ask
    const command = input?.['command'] as string | undefined;

    // Check deny rules first
    for (const rule of this.rules) {
      if (rule.action === 'deny' && matchToolPattern(rule.tool, toolName, command)) {
        return 'deny';
      }
    }

    // Check allow rules
    for (const rule of this.rules) {
      if (rule.action === 'allow' && matchToolPattern(rule.tool, toolName, command)) {
        return 'allow';
      }
    }

    // Read-only tools are always allowed
    const safeTools = ['Read', 'Glob', 'Grep', 'LSP', 'ToolSearch', 'AskUserQuestion', 'TodoWrite', 'Agent'];
    if (safeTools.includes(toolName)) {
      return 'allow';
    }

    // Otherwise, ask the user
    return 'ask';
  }
}
