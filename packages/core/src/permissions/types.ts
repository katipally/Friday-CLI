export type PermissionAction = 'allow' | 'deny' | 'prompt';

export interface PermissionRule {
  /** Tool name or glob pattern (e.g., 'file_*', 'shell_exec') */
  tool: string;
  /** Scope — 'workspace' means within workspace, 'global' means anywhere */
  scope?: 'workspace' | 'global';
  /** Regex pattern for arguments (e.g., for shell_exec, match specific commands) */
  pattern?: string;
  /** Action to take */
  action: PermissionAction;
  /** Reason for the rule */
  reason?: string;
}

export interface PermissionDecision {
  allowed: boolean;
  rule?: PermissionRule;
  reason: string;
  /** If user was prompted, record their choice */
  userChoice?: 'allow_once' | 'allow_always' | 'deny';
}

export interface PermissionPromptCallback {
  (
    toolName: string,
    args: Record<string, unknown>,
    reason: string,
  ): Promise<'allow_once' | 'allow_always' | 'deny'>;
}
