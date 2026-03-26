import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { PluginManifest, Plugin, SkillDefinition, AgentDefinition, HookDefinition } from '@fridaycode/shared';
import { PLUGINS_DIR, getUserConfigDir } from '@fridaycode/shared';
import { parseSkillFile } from '../skills/loader.js';

const PLUGIN_DIR_NAME = '.friday-plugin';
const MANIFEST_FILE = 'plugin.json';

/**
 * Load a plugin manifest from a directory.
 */
export async function loadPluginManifest(pluginDir: string): Promise<PluginManifest> {
  const manifestPath = join(pluginDir, PLUGIN_DIR_NAME, MANIFEST_FILE);
  const content = await readFile(manifestPath, 'utf-8');
  return JSON.parse(content) as PluginManifest;
}

/**
 * Load a full plugin from a directory.
 */
export async function loadPlugin(pluginDir: string): Promise<Plugin> {
  const manifest = await loadPluginManifest(pluginDir);
  const pluginRoot = join(pluginDir, PLUGIN_DIR_NAME);

  const skills = new Map<string, SkillDefinition>();
  const agents = new Map<string, AgentDefinition>();
  const hooks: HookDefinition[] = [];

  // Load skills from plugin skills directory
  const skillsDir = join(pluginRoot, 'skills');
  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const skill = await parseSkillFile(join(skillsDir, entry.name));
          skills.set(`${manifest.name}:${skill.name}`, skill);
        } catch {
          // Skip malformed skill files
        }
      }
    }
  } catch {
    // No skills directory
  }

  // Load agents from plugin agents directory
  const agentsDir = join(pluginRoot, 'agents');
  try {
    const entries = await readdir(agentsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const content = await readFile(join(agentsDir, entry.name), 'utf-8');
          const { parseFrontmatter } = await import('@fridaycode/shared');
          const { data, content: body } = parseFrontmatter(content);

          const agent: AgentDefinition = {
            name: (data.name as string) ?? entry.name.replace('.md', ''),
            description: data.description as string | undefined,
            tools: data.tools as string[] | undefined,
            disallowedTools: data.disallowedTools as string[] | undefined,
            model: data.model as string | undefined,
            maxTurns: data.maxTurns as number | undefined,
            instructions: body,
          };
          agents.set(`${manifest.name}:${agent.name}`, agent);
        } catch {
          // Skip malformed agent files
        }
      }
    }
  } catch {
    // No agents directory
  }

  // Load hooks from manifest
  const hooksConfig = (manifest as unknown as Record<string, unknown>).hooks as HookDefinition[] | undefined;
  if (Array.isArray(hooksConfig)) {
    hooks.push(...hooksConfig);
  }

  return {
    manifest,
    path: pluginDir,
    skills,
    agents,
    hooks,
    enabled: true,
  };
}

/**
 * Discover plugins from project and user directories.
 */
export async function discoverPlugins(
  projectDir: string,
): Promise<Plugin[]> {
  const plugins: Plugin[] = [];

  // Directories to search
  const searchDirs = [
    join(projectDir, PLUGINS_DIR),
    join(getUserConfigDir(), PLUGINS_DIR),
  ];

  for (const dir of searchDirs) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const pluginDir = join(dir, entry.name);

        // Check if it has a .friday-plugin directory
        try {
          const pluginMeta = await stat(join(pluginDir, PLUGIN_DIR_NAME));
          if (pluginMeta.isDirectory()) {
            try {
              const plugin = await loadPlugin(pluginDir);
              plugins.push(plugin);
            } catch {
              // Skip malformed plugins
            }
          }
        } catch {
          // No plugin metadata
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  return plugins;
}
