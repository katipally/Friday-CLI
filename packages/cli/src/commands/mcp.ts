import type { SlashCommand, CommandContext, CommandResult } from './types.js';

export const mcpCommand: SlashCommand = {
  name: 'mcp',
  aliases: ['plugins', 'extensions'],
  description: 'Manage MCP server connections',
  usage: '/mcp [list | status | reload]',

  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    if (!context.mcpManager) {
      return {
        output: 'MCP is not configured for this session. Add MCP servers to your friday.json config.',
        type: 'info',
      };
    }

    const subcommand = args[0]?.toLowerCase() ?? 'list';
    const client = context.mcpManager.getClient();

    switch (subcommand) {
      case 'list': {
        const servers = client.listServers();
        if (servers.length === 0) {
          return { output: 'No MCP servers configured.', type: 'info' };
        }

        const maxLen = Math.max(...servers.map(s => s.length));
        const rows = servers.map(name => {
          const padded = name.padEnd(maxLen + 2);
          const status = client.isConnected(name) ? '● connected' : '○ disconnected';
          return `  ${padded}${status}`;
        });

        return {
          output: ['MCP Servers:', '', ...rows].join('\n'),
          type: 'table',
        };
      }

      case 'status': {
        const tools = client.listTools();
        if (tools.length === 0) {
          return {
            output: 'No MCP tools available. Check server connections with /mcp list.',
            type: 'info',
          };
        }

        const grouped = new Map<string, string[]>();
        for (const { server, tool } of tools) {
          const list = grouped.get(server) ?? [];
          list.push(tool.name);
          grouped.set(server, list);
        }

        const lines: string[] = [`MCP Tools (${tools.length} total):`, ''];
        for (const [server, toolNames] of grouped) {
          lines.push(`  ${server}:`);
          for (const name of toolNames) {
            lines.push(`    - ${name}`);
          }
        }

        return { output: lines.join('\n'), type: 'table' };
      }

      case 'reload': {
        try {
          await client.disconnectAll();
          return {
            output: 'MCP servers reloaded. Reconnecting on next tool call.',
            type: 'success',
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            output: `Failed to reload MCP servers: ${message}`,
            type: 'error',
          };
        }
      }

      default:
        return {
          output: `Unknown subcommand: "${subcommand}". Usage: /mcp [list | status | reload]`,
          type: 'error',
        };
    }
  },
};
