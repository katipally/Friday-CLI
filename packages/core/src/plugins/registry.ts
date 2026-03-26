import type {
  Plugin,
  SkillDefinition,
  AgentDefinition,
  HookDefinition,
} from '@fridaycode/shared';

/**
 * Registry for all loaded plugins with namespaced resources.
 */
export class PluginRegistry {
  private plugins = new Map<string, Plugin>();

  register(plugin: Plugin): void {
    this.plugins.set(plugin.manifest.name, plugin);
  }

  unregister(name: string): void {
    this.plugins.delete(name);
  }

  get(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  getAll(): Plugin[] {
    return [...this.plugins.values()];
  }

  getEnabled(): Plugin[] {
    return [...this.plugins.values()].filter((p) => p.enabled);
  }

  /**
   * Resolve a namespaced resource: "plugin-name:resource-name"
   */
  resolveSkill(qualifiedName: string): SkillDefinition | undefined {
    for (const plugin of this.getEnabled()) {
      const skill = plugin.skills.get(qualifiedName);
      if (skill) return skill;
    }

    // Also try unqualified name
    for (const plugin of this.getEnabled()) {
      for (const [key, skill] of plugin.skills) {
        if (key.endsWith(`:${qualifiedName}`) || skill.name === qualifiedName) {
          return skill;
        }
      }
    }

    return undefined;
  }

  resolveAgent(qualifiedName: string): AgentDefinition | undefined {
    for (const plugin of this.getEnabled()) {
      const agent = plugin.agents.get(qualifiedName);
      if (agent) return agent;
    }

    // Also try unqualified name
    for (const plugin of this.getEnabled()) {
      for (const [key, agent] of plugin.agents) {
        if (key.endsWith(`:${qualifiedName}`) || agent.name === qualifiedName) {
          return agent;
        }
      }
    }

    return undefined;
  }

  /**
   * Get all hooks from loaded plugins.
   */
  getAllHooks(): HookDefinition[] {
    const hooks: HookDefinition[] = [];
    for (const plugin of this.getEnabled()) {
      hooks.push(...plugin.hooks);
    }
    return hooks;
  }

  /**
   * Get all skills across all plugins.
   */
  getAllSkills(): Map<string, SkillDefinition> {
    const skills = new Map<string, SkillDefinition>();
    for (const plugin of this.getEnabled()) {
      for (const [key, skill] of plugin.skills) {
        skills.set(key, skill);
      }
    }
    return skills;
  }

  /**
   * Get all agents across all plugins.
   */
  getAllAgents(): Map<string, AgentDefinition> {
    const agents = new Map<string, AgentDefinition>();
    for (const plugin of this.getEnabled()) {
      for (const [key, agent] of plugin.agents) {
        agents.set(key, agent);
      }
    }
    return agents;
  }

  /**
   * Enable or disable a plugin.
   */
  setEnabled(name: string, enabled: boolean): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    plugin.enabled = enabled;
    return true;
  }
}
