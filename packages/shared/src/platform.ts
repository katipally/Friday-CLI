import os from 'node:os';
import path from 'node:path';

export type Platform = 'macos' | 'linux' | 'windows' | 'unknown';

export function getPlatform(): Platform {
  switch (os.platform()) {
    case 'darwin': return 'macos';
    case 'linux': return 'linux';
    case 'win32': return 'windows';
    default: return 'unknown';
  }
}

export function getConfigDir(): string {
  const platform = getPlatform();
  switch (platform) {
    case 'macos':
      return path.join(os.homedir(), '.friday');
    case 'linux':
      return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'friday');
    case 'windows':
      return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'friday');
    default:
      return path.join(os.homedir(), '.friday');
  }
}

export function getDataDir(): string {
  const platform = getPlatform();
  switch (platform) {
    case 'macos':
      return path.join(os.homedir(), '.friday', 'data');
    case 'linux':
      return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'friday');
    case 'windows':
      return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'friday');
    default:
      return path.join(os.homedir(), '.friday', 'data');
  }
}

export function getCacheDir(): string {
  const platform = getPlatform();
  switch (platform) {
    case 'macos':
      return path.join(os.homedir(), 'Library', 'Caches', 'friday');
    case 'linux':
      return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'friday');
    case 'windows':
      return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'friday', 'cache');
    default:
      return path.join(os.homedir(), '.friday', 'cache');
  }
}

export function getShell(): string {
  return process.env.SHELL || (getPlatform() === 'windows' ? 'cmd.exe' : '/bin/sh');
}

export function isCI(): boolean {
  return !!(process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI || process.env.JENKINS_URL);
}
