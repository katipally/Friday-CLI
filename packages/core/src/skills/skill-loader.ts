import { readdir, readFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Skill, SkillManifest, ValidationResult } from './skill-types.js';

const MANIFEST_FILE = 'skill.json';

export class SkillLoader {
  private skillDirs: string[];

  constructor(skillDirs: string[]) {
    this.skillDirs = skillDirs.map((d) => resolve(d));
  }

  async loadSkill(skillPath: string): Promise<Skill> {
    const resolvedPath = resolve(skillPath);
    const manifestPath = join(resolvedPath, MANIFEST_FILE);

    const raw = await readFile(manifestPath, 'utf-8');
    const manifest: SkillManifest = JSON.parse(raw) as SkillManifest;

    const entryPath = join(resolvedPath, manifest.main);
    const mod: Record<string, unknown> = (await import(entryPath)) as Record<
      string,
      unknown
    >;

    const skill = (mod['default'] ?? mod) as Skill;

    // Overlay manifest metadata onto the loaded skill
    const merged: Skill = {
      ...skill,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      ...(manifest.author ? { author: manifest.author } : {}),
    };

    const validation = this.validateSkill(merged);
    if (!validation.valid) {
      throw new Error(
        `Invalid skill "${manifest.name}": ${validation.errors.join(', ')}`,
      );
    }

    return merged;
  }

  async discoverSkills(): Promise<SkillManifest[]> {
    const manifests: SkillManifest[] = [];

    for (const dir of this.skillDirs) {
      const dirManifests = await this.scanDirectory(dir);
      manifests.push(...dirManifests);
    }

    return manifests;
  }

  async loadAll(): Promise<Skill[]> {
    const manifests = await this.discoverSkills();
    const skills: Skill[] = [];

    for (const manifest of manifests) {
      try {
        const skillDir = this.findSkillDir(manifest.name);
        if (skillDir) {
          const skill = await this.loadSkill(skillDir);
          skills.push(skill);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        console.warn(
          `[SkillLoader] Failed to load skill "${manifest.name}": ${message}`,
        );
      }
    }

    return skills;
  }

  validateSkill(skill: Skill): ValidationResult {
    const errors: string[] = [];

    if (!skill.name || typeof skill.name !== 'string') {
      errors.push('Skill must have a non-empty "name" string');
    }
    if (!skill.version || typeof skill.version !== 'string') {
      errors.push('Skill must have a non-empty "version" string');
    }
    if (!skill.description || typeof skill.description !== 'string') {
      errors.push('Skill must have a non-empty "description" string');
    }

    if (skill.tools) {
      for (const tool of skill.tools) {
        if (!tool.name) errors.push('Each tool must have a "name"');
        if (typeof tool.execute !== 'function')
          errors.push(`Tool "${tool.name ?? '<unnamed>'}" must have an "execute" function`);
      }
    }

    if (skill.commands) {
      for (const cmd of skill.commands) {
        if (!cmd.name) errors.push('Each command must have a "name"');
        if (typeof cmd.execute !== 'function')
          errors.push(`Command "${cmd.name ?? '<unnamed>'}" must have an "execute" function`);
      }
    }

    if (skill.hooks) {
      for (const hook of skill.hooks) {
        if (!hook.point) errors.push('Each hook must have a "point"');
        if (typeof hook.handler !== 'function')
          errors.push(`Hook at "${hook.point ?? '<unknown>'}" must have a "handler" function`);
      }
    }

    if (skill.prompts) {
      for (const prompt of skill.prompts) {
        if (!prompt.name) errors.push('Each prompt template must have a "name"');
        if (!prompt.template)
          errors.push(`Prompt "${prompt.name ?? '<unnamed>'}" must have a "template" string`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // --- private helpers ---

  private async scanDirectory(dir: string): Promise<SkillManifest[]> {
    const manifests: SkillManifest[] = [];

    try {
      await access(dir);
    } catch {
      // Directory doesn't exist — that's fine (e.g. ~/.friday/skills/ may not exist yet)
      return manifests;
    }

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const manifestPath = join(dir, entry.name, MANIFEST_FILE);
        try {
          const raw = await readFile(manifestPath, 'utf-8');
          const manifest = JSON.parse(raw) as SkillManifest;
          manifests.push(manifest);
        } catch {
          // No valid manifest in this subdirectory — skip silently
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[SkillLoader] Error scanning directory "${dir}": ${message}`,
      );
    }

    return manifests;
  }

  private findSkillDir(skillName: string): string | undefined {
    for (const dir of this.skillDirs) {
      const candidate = join(dir, skillName);
      return candidate;
    }
    return undefined;
  }
}
