import { SkillLoader } from './skill-loader.js';
import { HookRunner } from './hook-runner.js';
import type {
  Skill,
  SkillToolDefinition,
  SkillCommandDefinition,
  PromptTemplate,
  HookPoint,
  HookData,
} from './skill-types.js';

export interface SkillManagerOptions {
  skillDirs: string[];
}

export class SkillManager {
  private loader: SkillLoader;
  private hookRunner: HookRunner;
  private skills: Map<string, Skill> = new Map();

  constructor(options: SkillManagerOptions) {
    this.loader = new SkillLoader(options.skillDirs);
    this.hookRunner = new HookRunner();
  }

  async initialize(): Promise<void> {
    const loaded = await this.loader.loadAll();

    for (const skill of loaded) {
      this.skills.set(skill.name, skill);

      // Register all hooks from this skill
      if (skill.hooks) {
        for (const hook of skill.hooks) {
          this.hookRunner.registerHook(hook);
        }
      }
    }
  }

  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  listSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  getTools(): SkillToolDefinition[] {
    const tools: SkillToolDefinition[] = [];
    for (const skill of this.skills.values()) {
      if (skill.tools) {
        tools.push(...skill.tools);
      }
    }
    return tools;
  }

  getCommands(): SkillCommandDefinition[] {
    const commands: SkillCommandDefinition[] = [];
    for (const skill of this.skills.values()) {
      if (skill.commands) {
        commands.push(...skill.commands);
      }
    }
    return commands;
  }

  getPromptTemplates(): PromptTemplate[] {
    const templates: PromptTemplate[] = [];
    for (const skill of this.skills.values()) {
      if (skill.prompts) {
        templates.push(...skill.prompts);
      }
    }
    return templates;
  }

  async runHook(point: HookPoint, data: HookData): Promise<HookData> {
    return this.hookRunner.runHooks(point, data);
  }
}
