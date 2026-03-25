export interface ProjectRules {
  /** Raw content from FRIDAY.md */
  fridayMd: string | null;
  /** Contents from .friday/rules/*.md files */
  ruleFiles: Array<{ name: string; content: string }>;
  /** Combined rules text for system prompt injection */
  combined: string;
}

export interface RulesConfig {
  /** Root directory to search for rules */
  projectRoot: string;
  /** Max total token budget for rules (default: 2000) */
  maxTokens?: number;
}
