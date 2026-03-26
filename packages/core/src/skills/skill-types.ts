export interface Skill {
  name: string;
  version: string;
  description: string;
  author?: string;

  tools?: SkillToolDefinition[];
  commands?: SkillCommandDefinition[];
  hooks?: HookDefinition[];
  prompts?: PromptTemplate[];
}

export interface SkillToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ParameterDef>;
  execute: (
    params: Record<string, unknown>,
    context: SkillContext,
  ) => Promise<string>;
}

export interface ParameterDef {
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  required?: boolean;
  default?: unknown;
}

export interface SkillCommandDefinition {
  name: string;
  description: string;
  execute: (args: string[], context: SkillContext) => Promise<string>;
}

export type HookPoint =
  | 'beforeMessage'
  | 'afterMessage'
  | 'beforeToolCall'
  | 'afterToolCall'
  | 'sessionStart'
  | 'sessionEnd'
  | 'beforeCommit'
  | 'afterCommit';

export interface HookDefinition {
  point: HookPoint;
  priority?: number;
  handler: (data: HookData) => Promise<HookData | void>;
}

export interface HookData {
  type: HookPoint;
  payload: Record<string, unknown>;
  metadata: { sessionId: string; timestamp: number };
}

export interface PromptTemplate {
  name: string;
  description: string;
  template: string;
  variables: string[];
}

export interface SkillContext {
  workingDirectory: string;
  sessionId: string;
  config: Record<string, unknown>;
}

export interface SkillManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  main: string;
  skills: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
