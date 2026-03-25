import type { PermissionRule } from './types.js';

/** Default rules — safe reads are auto-allowed, writes/shell need prompting */
export const DEFAULT_RULES: PermissionRule[] = [
  // File reading within workspace — always allowed
  { tool: 'file_read', scope: 'workspace', action: 'allow' },
  { tool: 'directory_tree', scope: 'workspace', action: 'allow' },
  { tool: 'glob', scope: 'workspace', action: 'allow' },
  { tool: 'grep', scope: 'workspace', action: 'allow' },

  // File reading outside workspace — deny
  {
    tool: 'file_read',
    scope: 'global',
    action: 'deny',
    reason: 'Reading files outside workspace is not allowed',
  },

  // File writing — prompt user
  { tool: 'file_write', action: 'prompt' },
  { tool: 'file_edit', action: 'prompt' },

  // Shell — safe commands auto-allowed
  {
    tool: 'shell_exec',
    pattern: '^(ls|cat|head|tail|wc|grep|find|which|echo|pwd|date|git\\s)',
    action: 'allow',
  },
  // Dangerous shell commands — deny
  {
    tool: 'shell_exec',
    pattern: '^(rm\\s+-rf\\s+/|sudo|chmod\\s+777)',
    action: 'deny',
    reason: 'Dangerous command blocked',
  },
  // Other shell commands — prompt
  { tool: 'shell_exec', action: 'prompt' },

  // Git operations — mostly allowed
  { tool: 'git', action: 'allow' },

  // Ask user — always allowed (it's asking, not doing)
  { tool: 'ask_user', action: 'allow' },
];
