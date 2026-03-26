import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SlashCommand, CommandContext, CommandResult } from './types.js';

async function getLocalVersion(): Promise<string> {
  try {
    // Walk up from this file to find the CLI package.json
    const currentDir = dirname(fileURLToPath(import.meta.url));
    // From dist/commands/ or src/commands/ -> package root
    const pkgPath = join(currentDir, '..', '..', 'package.json');
    const raw = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as { version: string };
    return pkg.version;
  } catch {
    return 'unknown';
  }
}

async function getLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch('https://registry.npmjs.org/fridaycode/latest');
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

function compareVersions(current: string, latest: string): number {
  const parse = (v: string) => v.split('.').map(Number);
  const a = parse(current);
  const b = parse(latest);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export const updateCommand: SlashCommand = {
  name: 'update',
  aliases: ['version', 'ver'],
  description: 'Check for updates or show current version',
  usage: '/update',

  async execute(_args: string[], _context: CommandContext): Promise<CommandResult> {
    const currentVersion = await getLocalVersion();

    const lines = [`fridaycode v${currentVersion}`];

    const latestVersion = await getLatestVersion();

    if (latestVersion === null) {
      lines.push('', 'Could not reach npm registry to check for updates.');
      return { output: lines.join('\n'), type: 'info' };
    }

    if (currentVersion === 'unknown') {
      lines.push('', `Latest version: ${latestVersion}`);
      lines.push('Run to update: npm install -g fridaycode@latest');
      return { output: lines.join('\n'), type: 'info' };
    }

    const cmp = compareVersions(currentVersion, latestVersion);

    if (cmp >= 0) {
      lines.push('You are on the latest version.');
    } else {
      lines.push(
        '',
        `Update available: ${currentVersion} → ${latestVersion}`,
        '',
        'Run to update:',
        '  npm install -g fridaycode@latest',
      );
    }

    return {
      output: lines.join('\n'),
      type: cmp >= 0 ? 'success' : 'info',
    };
  },
};
