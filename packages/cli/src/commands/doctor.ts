import type { SlashCommand, CommandContext, CommandResult } from './types.js';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

function check(label: string, fn: () => boolean): string {
  try {
    return fn() ? `  ✔ ${label}` : `  ✘ ${label}`;
  } catch {
    return `  ✘ ${label}`;
  }
}

function version(cmd: string): string {
  try {
    return execSync(`${cmd} --version`, { encoding: 'utf8', timeout: 5000 }).trim().split('\n')[0];
  } catch {
    return 'not found';
  }
}

export const doctorCommand: SlashCommand = {
  name: 'doctor',
  aliases: ['diag'],
  description: 'Check environment, provider connectivity, and tools',

  async execute(_args: string[], context: CommandContext): Promise<CommandResult> {
    const lines: string[] = ['Environment Diagnostics', ''];

    // System
    lines.push('System:');
    lines.push(`  Node.js: ${version('node')}`);
    lines.push(`  Git:     ${version('git')}`);
    lines.push(`  OS:      ${process.platform} ${process.arch}`);
    lines.push('');

    // Project
    lines.push('Project:');
    lines.push(check('Working directory exists', () => existsSync(context.workspacePath)));
    lines.push(check('Git repository', () => existsSync(join(context.workspacePath, '.git'))));
    lines.push(check('FRIDAY.md found', () => existsSync(join(context.workspacePath, 'FRIDAY.md'))));
    lines.push(check('package.json found', () => existsSync(join(context.workspacePath, 'package.json'))));
    lines.push('');

    // Provider
    lines.push('Provider:');
    lines.push(`  Active: ${context.currentProvider}/${context.currentModel}`);
    if (context.listModels) {
      try {
        const models = await context.listModels();
        lines.push(`  ✔ API connected (${models.length} models available)`);
      } catch (err) {
        lines.push(`  ✘ API connection failed: ${(err as Error).message}`);
      }
    }
    lines.push('');

    // Tools
    if (context.toolRegistry) {
      const tools = context.toolRegistry.getToolDefinitions();
      lines.push(`Tools: ${tools.length} registered`);
      for (const t of tools.slice(0, 10)) {
        lines.push(`  • ${t.name}`);
      }
      if (tools.length > 10) lines.push(`  … and ${tools.length - 10} more`);
    }
    lines.push('');

    // MCP
    if (context.mcpManager) {
      const client = context.mcpManager.getClient();
      const servers = client.listServers();
      lines.push(`MCP Servers: ${servers.length}`);
      for (const s of servers) {
        const connected = client.isConnected(s);
        lines.push(`  ${connected ? '✔' : '✘'} ${s}`);
      }
    }

    return { output: lines.join('\n'), type: 'info' };
  },
};
