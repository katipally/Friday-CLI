import type { SkillDefinition, ToolContext } from '@fridaycode/shared';

/**
 * Execute a skill by substituting $ARGUMENTS and running it as a prompt.
 */
export async function executeSkill(
  skill: SkillDefinition,
  args: string | undefined,
  runPrompt: (prompt: string, context: ToolContext) => Promise<string>,
  context: ToolContext,
): Promise<string> {
  // Substitute $ARGUMENTS in the skill body
  let prompt = skill.body;
  if (args) {
    prompt = prompt.replace(/\$ARGUMENTS/g, args);
  } else {
    prompt = prompt.replace(/\$ARGUMENTS/g, '');
  }

  // Trim the prompt
  prompt = prompt.trim();

  if (!prompt) {
    return 'Skill has no content to execute.';
  }

  return runPrompt(prompt, context);
}

/**
 * Get the display string for a skill (for /skills list).
 */
export function formatSkillInfo(skill: SkillDefinition): string {
  const parts = [`/${skill.name}`];

  if (skill.description) {
    parts.push(`  ${skill.description}`);
  }

  const flags: string[] = [];
  if (skill.model) flags.push(`model: ${skill.model}`);
  if (skill.effort) flags.push(`effort: ${skill.effort}`);
  if (skill.context) flags.push(`context: ${skill.context}`);
  if (skill.allowedTools) flags.push(`tools: ${skill.allowedTools.join(', ')}`);

  if (flags.length > 0) {
    parts.push(`  [${flags.join(' | ')}]`);
  }

  return parts.join('\n');
}
