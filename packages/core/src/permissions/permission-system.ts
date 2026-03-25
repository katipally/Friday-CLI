import path from 'node:path';
import { createLogger } from '@anthropic-ai/friday-shared';
import { DEFAULT_RULES } from './default-rules.js';
import type {
  PermissionRule,
  PermissionDecision,
  PermissionPromptCallback,
} from './types.js';

const logger = createLogger('permissions');

export class PermissionSystem {
  private rules: PermissionRule[];
  private alwaysAllowed: Set<string> = new Set();
  private promptCallback: PermissionPromptCallback | null = null;
  private workspaceRoot: string;

  constructor(workspaceRoot: string, customRules?: PermissionRule[]) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.rules = customRules
      ? [...customRules, ...DEFAULT_RULES]
      : [...DEFAULT_RULES];
  }

  /** Set the callback for prompting the user (TUI provides this) */
  setPromptCallback(callback: PermissionPromptCallback): void {
    this.promptCallback = callback;
  }

  /** Check if a tool call is permitted */
  async check(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<PermissionDecision> {
    const argKey = this.buildArgKey(toolName, args);

    // 1. Check if this exact tool+args combo was previously always-allowed
    if (this.alwaysAllowed.has(argKey)) {
      logger.debug(`Always-allowed hit for ${argKey}`);
      return {
        allowed: true,
        reason: 'Previously allowed by user (always)',
        userChoice: 'allow_always',
      };
    }

    // 2. Find matching rule (first match wins)
    const rule = this.findMatchingRule(toolName, args);

    if (!rule) {
      // No rule matches — prompt (default to safe)
      logger.debug(`No rule matched for tool "${toolName}", prompting`);
      return this.handlePrompt(toolName, args, 'No permission rule matched');
    }

    // 3. Act on the rule
    switch (rule.action) {
      case 'allow':
        logger.debug(`Allowed: tool="${toolName}" via rule tool="${rule.tool}"`);
        return { allowed: true, rule, reason: 'Allowed by rule' };

      case 'deny':
        logger.debug(`Denied: tool="${toolName}" — ${rule.reason ?? 'Denied by rule'}`);
        return {
          allowed: false,
          rule,
          reason: rule.reason ?? 'Denied by rule',
        };

      case 'prompt':
        return this.handlePrompt(
          toolName,
          args,
          rule.reason ?? `Tool "${toolName}" requires permission`,
          rule,
        );
    }
  }

  /** Add a custom rule (prepended so it takes priority) */
  addRule(rule: PermissionRule): void {
    this.rules.unshift(rule);
  }

  /** Reset session-specific always-allow decisions */
  resetSessionPermissions(): void {
    this.alwaysAllowed.clear();
    logger.debug('Session permissions reset');
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async handlePrompt(
    toolName: string,
    args: Record<string, unknown>,
    reason: string,
    rule?: PermissionRule,
  ): Promise<PermissionDecision> {
    if (!this.promptCallback) {
      logger.debug('No prompt callback set, denying by default');
      return {
        allowed: false,
        rule,
        reason: 'No prompt callback configured — denied by default',
      };
    }

    const userChoice = await this.promptCallback(toolName, args, reason);

    switch (userChoice) {
      case 'allow_once':
        logger.debug(`User allowed once: tool="${toolName}"`);
        return { allowed: true, rule, reason: 'Allowed by user (once)', userChoice };

      case 'allow_always': {
        const argKey = this.buildArgKey(toolName, args);
        this.alwaysAllowed.add(argKey);
        logger.debug(`User allowed always: tool="${toolName}" key="${argKey}"`);
        return { allowed: true, rule, reason: 'Allowed by user (always)', userChoice };
      }

      case 'deny':
        logger.debug(`User denied: tool="${toolName}"`);
        return { allowed: false, rule, reason: 'Denied by user', userChoice };
    }
  }

  private findMatchingRule(
    toolName: string,
    args: Record<string, unknown>,
  ): PermissionRule | null {
    const inferredScope = this.inferScope(toolName, args);

    for (const rule of this.rules) {
      // Match tool name (supports simple glob: trailing '*')
      if (!this.matchToolName(rule.tool, toolName)) {
        continue;
      }

      // If rule has scope, it must match the inferred scope
      if (rule.scope && rule.scope !== inferredScope) {
        continue;
      }

      // If rule has pattern, match against the relevant argument
      if (rule.pattern) {
        const target = this.getPatternTarget(toolName, args);
        if (target === null || !new RegExp(rule.pattern).test(target)) {
          continue;
        }
      }

      return rule;
    }

    return null;
  }

  private matchToolName(ruleToolName: string, actualToolName: string): boolean {
    if (ruleToolName === actualToolName) {
      return true;
    }
    // Simple glob: 'file_*' matches 'file_read', 'file_write', etc.
    if (ruleToolName.endsWith('*')) {
      const prefix = ruleToolName.slice(0, -1);
      return actualToolName.startsWith(prefix);
    }
    return false;
  }

  private isInWorkspace(filePath: string): boolean {
    const resolved = path.resolve(this.workspaceRoot, filePath);
    const normalized = path.normalize(resolved);
    return normalized.startsWith(this.workspaceRoot + path.sep) || normalized === this.workspaceRoot;
  }

  private inferScope(
    toolName: string,
    args: Record<string, unknown>,
  ): 'workspace' | 'global' {
    // Extract a file path from common arg names
    const filePath =
      (args['path'] as string | undefined) ??
      (args['file'] as string | undefined) ??
      (args['file_path'] as string | undefined) ??
      (args['directory'] as string | undefined);

    if (typeof filePath === 'string') {
      return this.isInWorkspace(filePath) ? 'workspace' : 'global';
    }

    // For shell_exec, check the working directory if provided
    const cwd = args['cwd'] as string | undefined;
    if (typeof cwd === 'string') {
      return this.isInWorkspace(cwd) ? 'workspace' : 'global';
    }

    // Default to workspace scope when we can't determine
    return 'workspace';
  }

  /** Get the string value to match a rule's pattern against */
  private getPatternTarget(
    toolName: string,
    args: Record<string, unknown>,
  ): string | null {
    if (toolName === 'shell_exec') {
      return (args['command'] as string | undefined) ?? null;
    }
    // For other tools, try the first string arg
    const firstStringArg = Object.values(args).find(
      (v): v is string => typeof v === 'string',
    );
    return firstStringArg ?? null;
  }

  /** Build a stable key for the always-allowed set */
  private buildArgKey(
    toolName: string,
    args: Record<string, unknown>,
  ): string {
    const sortedArgs = JSON.stringify(args, Object.keys(args).sort());
    return `${toolName}:${sortedArgs}`;
  }
}
