import type { SkillDefinition } from '@fridaycode/shared';

// ─── Built-in Skills ─────────────────────────────────────────

export const BATCH_SKILL: SkillDefinition = {
  name: 'batch',
  description: 'Run multiple prompts in parallel using subagents.',
  userInvocable: true,
  context: 'fork',
  body: `You are a batch execution coordinator.
Take the user's list of tasks and spawn one subagent per task using the Agent tool.
Tasks are separated by newlines or semicolons.
Wait for all agents to complete and summarize their results.

Tasks: $ARGUMENTS`,
};

export const DEBUG_SKILL: SkillDefinition = {
  name: 'debug',
  description: 'Debug an error or issue by analyzing stack traces, logs, and code.',
  userInvocable: true,
  effort: 'high',
  body: `You are a debugging expert. Analyze the given error or issue:
1. Read the relevant error messages, stack traces, or logs
2. Use Grep and Read to find the relevant source code
3. Identify the root cause
4. Suggest or implement a fix

Issue: $ARGUMENTS`,
};

export const LOOP_SKILL: SkillDefinition = {
  name: 'loop',
  description: 'Iteratively run a command until a condition is met.',
  userInvocable: true,
  body: `You are a loop executor. The user wants to run a command repeatedly until a condition is met.
Parse the instruction to identify the command and the stopping condition.
Execute the command, check the condition, and repeat until done or max 10 iterations.

Instruction: $ARGUMENTS`,
};

export const SIMPLIFY_SKILL: SkillDefinition = {
  name: 'simplify',
  description: 'Simplify or refactor code to make it more readable and maintainable.',
  userInvocable: true,
  allowedTools: ['Read', 'Edit', 'Write', 'Glob', 'Grep'],
  body: `You are a code simplification expert. Your goal is to make code simpler and more readable.
- Remove unnecessary complexity
- Simplify conditional logic
- Extract well-named helpers only if they improve clarity
- Preserve all existing behavior exactly
- Do NOT add features or change functionality

Target: $ARGUMENTS`,
};

export const BUILT_IN_SKILLS: SkillDefinition[] = [
  BATCH_SKILL,
  DEBUG_SKILL,
  LOOP_SKILL,
  SIMPLIFY_SKILL,
];

export function getBuiltInSkill(name: string): SkillDefinition | undefined {
  return BUILT_IN_SKILLS.find(
    (s) => s.name.toLowerCase() === name.toLowerCase(),
  );
}
