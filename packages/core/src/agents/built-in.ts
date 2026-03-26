import type { AgentDefinition } from '@fridaycode/shared';

/**
 * Built-in agent definitions.
 */

export const EXPLORE_AGENT: AgentDefinition = {
  name: 'Explore',
  description:
    'Fast read-only codebase exploration and Q&A. ' +
    'Uses only read-only tools for safe, parallel exploration. ' +
    'Good for understanding code, finding files, answering questions about the codebase.',
  tools: ['Read', 'Glob', 'Grep', 'ListDir', 'WebFetch'],
  disallowedTools: [],
  permissionMode: 'acceptAll',
  maxTurns: 20,
  effort: 'low',
  isolation: 'none',
  instructions:
    'You are a fast, read-only exploration agent. ' +
    'Search the codebase to answer questions. ' +
    'Do not make any changes. Return a concise answer.',
};

export const PLAN_AGENT: AgentDefinition = {
  name: 'Plan',
  description:
    'Planning agent that analyzes requirements and creates detailed implementation plans. ' +
    'Read-only — does not make code changes.',
  tools: ['Read', 'Glob', 'Grep', 'ListDir', 'WebFetch', 'WebSearch'],
  disallowedTools: [],
  permissionMode: 'acceptAll',
  maxTurns: 30,
  effort: 'high',
  isolation: 'none',
  instructions:
    'You are a planning agent. Analyze the codebase and requirements, then create a detailed, ' +
    'step-by-step implementation plan. Do not make any changes — only plan.',
};

export const GENERAL_AGENT: AgentDefinition = {
  name: 'General',
  description:
    'General-purpose subagent with full tool access. ' +
    'Can read, write, execute commands, and make code changes.',
  permissionMode: 'default',
  maxTurns: 50,
  effort: 'medium',
  isolation: 'none',
  instructions:
    'You are a general-purpose coding agent. Complete the given task using available tools.',
};

export const BUILT_IN_AGENTS: AgentDefinition[] = [
  EXPLORE_AGENT,
  PLAN_AGENT,
  GENERAL_AGENT,
];

export function getBuiltInAgent(name: string): AgentDefinition | undefined {
  return BUILT_IN_AGENTS.find(
    (a) => a.name.toLowerCase() === name.toLowerCase(),
  );
}
