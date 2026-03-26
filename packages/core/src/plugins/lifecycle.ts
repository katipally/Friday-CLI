import type { Plugin, HookEngine } from '@fridaycode/shared';
import { PluginRegistry } from './registry.js';
import { discoverPlugins, loadPlugin } from './loader.js';

/**
 * Plugin lifecycle manager.
 */
export class PluginLifecycle {
  private registry: PluginRegistry;
  private hookEngine: HookEngine;

  constructor(registry: PluginRegistry, hookEngine: HookEngine) {
    this.registry = registry;
    this.hookEngine = hookEngine;
  }

  /**
   * Discover and load all plugins.
   */
  async initialize(projectDir: string): Promise<void> {
    const plugins = await discoverPlugins(projectDir);

    for (const plugin of plugins) {
      await this.activate(plugin);
    }
  }

  /**
   * Activate a plugin — register it and its hooks.
   */
  async activate(plugin: Plugin): Promise<void> {
    this.registry.register(plugin);

    // Register plugin hooks
    for (const hook of plugin.hooks) {
      this.hookEngine.register(hook);
    }
  }

  /**
   * Deactivate a plugin.
   */
  async deactivate(name: string): Promise<void> {
    this.registry.unregister(name);
    // Hooks are referenced by the plugin; removing the plugin effectively disables them
    // A more thorough implementation would track and remove individual hooks
  }

  /**
   * Reload a specific plugin by name.
   */
  async reload(name: string, pluginDir: string): Promise<void> {
    await this.deactivate(name);
    const plugin = await loadPlugin(pluginDir);
    await this.activate(plugin);
  }

  /**
   * Reload all plugins.
   */
  async reloadAll(projectDir: string): Promise<void> {
    // Deactivate all
    for (const plugin of this.registry.getAll()) {
      await this.deactivate(plugin.manifest.name);
    }

    // Rediscover and activate
    await this.initialize(projectDir);
  }
}
