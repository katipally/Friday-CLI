import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { SkillDefinition } from '@fridaycode/shared';
import { parseFrontmatter, getUserConfigDir } from '@fridaycode/shared';
import { SKILLS_DIR } from '@fridaycode/shared';

/**
 * Load a SKILL.md file and parse it into a SkillDefinition.
 */
export async function parseSkillFile(filePath: string): Promise<SkillDefinition> {
  const content = await readFile(filePath, 'utf-8');
  const { data, content: body } = parseFrontmatter(content);

  return {
    name: (data.name as string) ?? filePath.split('/').pop()?.replace('.md', '') ?? 'unknown',
    description: data.description as string | undefined,
    disableModelInvocation: data.disableModelInvocation as boolean | undefined,
    userInvocable: data.userInvocable as boolean | undefined,
    allowedTools: data.allowedTools as string[] | undefined,
    model: data.model as string | undefined,
    effort: data.effort as SkillDefinition['effort'],
    context: data.context as 'fork' | 'inline' | undefined,
    agent: data.agent as string | undefined,
    hooks: data.hooks as SkillDefinition['hooks'],
    paths: data.paths as string[] | undefined,
    shell: data.shell as string | undefined,
    body,
  };
}

/**
 * Discover skills from all configured locations.
 * Priority: CLI flag > project .friday/skills/ > user ~/.friday/skills/ > plugin skills
 */
export async function discoverSkills(
  projectDir: string,
  extraDirs: string[] = [],
): Promise<SkillDefinition[]> {
  const skills: SkillDefinition[] = [];
  const seen = new Set<string>();

  // Directories to search (in priority order)
  const dirs = [
    ...extraDirs,
    join(projectDir, '.friday', SKILLS_DIR),
    join(getUserConfigDir(), SKILLS_DIR),
  ];

  for (const dir of dirs) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!entry.name.endsWith('.md') && !entry.name.endsWith('.MD')) continue;

        const filePath = join(dir, entry.name);
        try {
          const skill = await parseSkillFile(filePath);
          if (!seen.has(skill.name)) {
            seen.add(skill.name);
            skills.push(skill);
          }
        } catch {
          // Skip malformed skill files
        }
      }
    } catch {
      // Directory doesn't exist, skip
    }
  }

  return skills;
}
