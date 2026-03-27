import * as path from 'node:path';
import type { Settings, SettingsScope } from '@fridaycode/shared';
import {
  readJsonFile,
  writeJsonFile,
  deepMerge,
  getUserConfigDir,
  getProjectConfigDir,
  PROVIDER_DEFAULTS,
} from '@fridaycode/shared';
import { settingsSchema } from './schema.js';
import type { SettingsInput } from './schema.js';

const DEFAULT_SETTINGS: SettingsInput = {
  providers: {
    ollama: {
      type: 'ollama',
      enabled: true,
      baseUrl: PROVIDER_DEFAULTS.ollama.baseUrl,
    },
    anthropic: {
      type: 'anthropic',
      enabled: false,
      baseUrl: PROVIDER_DEFAULTS.anthropic.baseUrl,
    },
    openai: {
      type: 'openai',
      enabled: false,
      baseUrl: PROVIDER_DEFAULTS.openai.baseUrl,
    },
  },
  activeProvider: 'ollama',
  activeModel: '',
  permissionMode: 'default',
  permissions: { allow: [], deny: [] },
  effort: 'high',
  maxTokens: 8192,
  disableAutoMemory: false,
  disableAutoCompact: false,
  compactMessageThreshold: 50,
  theme: 'dark',
  vimMode: false,
  prefersReducedMotion: false,
  statusLine: true,
  hooks: {},
  mcpServers: {},
  telemetryOptIn: false,
  gitAttribution: true,
};

/**
 * Load settings with 4-scope merge: managed > local > project > user.
 */
export function loadSettings(projectPath?: string): Settings {
  const userDir = getUserConfigDir();
  const userFile = path.join(userDir, 'settings.json');
  const userSettings = readJsonFile<Partial<SettingsInput>>(userFile) ?? {};

  let projectSettings: Partial<SettingsInput> = {};
  let localSettings: Partial<SettingsInput> = {};

  if (projectPath) {
    const projDir = getProjectConfigDir(projectPath);
    projectSettings = readJsonFile<Partial<SettingsInput>>(path.join(projDir, 'settings.json')) ?? {};
    localSettings = readJsonFile<Partial<SettingsInput>>(path.join(projDir, 'local-settings.json')) ?? {};
  }

  // Managed settings would come from MDM/API — stub for now
  const managedSettings: Partial<SettingsInput> = {};

  // Merge: defaults < user < project < local < managed
  const merged = deepMerge(
    DEFAULT_SETTINGS as Record<string, unknown>,
    userSettings as Record<string, unknown>,
    projectSettings as Record<string, unknown>,
    localSettings as Record<string, unknown>,
    managedSettings as Record<string, unknown>,
  );

  const parsed = settingsSchema.safeParse(merged);
  if (!parsed.success) {
    // Fallback to defaults on validation failure instead of crashing
    console.error('Warning: settings validation failed, using defaults:', parsed.error.message);
    return settingsSchema.parse(DEFAULT_SETTINGS) as unknown as Settings;
  }
  return parsed.data as unknown as Settings;
}

/**
 * Save settings to a specific scope.
 */
export function saveSettings(
  settings: Partial<SettingsInput>,
  scope: SettingsScope,
  projectPath?: string,
): void {
  let filePath: string;

  switch (scope) {
    case 'user':
      filePath = path.join(getUserConfigDir(), 'settings.json');
      break;
    case 'project':
      if (!projectPath) throw new Error('projectPath required for project scope');
      filePath = path.join(getProjectConfigDir(projectPath), 'settings.json');
      break;
    case 'local':
      if (!projectPath) throw new Error('projectPath required for local scope');
      filePath = path.join(getProjectConfigDir(projectPath), 'local-settings.json');
      break;
    case 'managed':
      throw new Error('Cannot write managed settings');
    default:
      throw new Error(`Unknown scope: ${scope}`);
  }

  // Merge with existing file
  const existing = readJsonFile<Partial<SettingsInput>>(filePath) ?? {};
  const merged = deepMerge(existing as Record<string, unknown>, settings as Record<string, unknown>);
  writeJsonFile(filePath, merged);
}

export { settingsSchema } from './schema.js';
