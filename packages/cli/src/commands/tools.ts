import type { SlashCommand, CommandContext, CommandResult } from './types.js';

export const toolsCommand: SlashCommand = {
  name: 'tools',
  aliases: ['tool', 'capabilities'],
  description: 'List available tools or show details for a specific tool',
  usage: '/tools [tool-name]',

  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    if (!context.toolRegistry) {
      return {
        output: 'Tool registry is not available in this session.',
        type: 'error',
      };
    }

    const definitions = context.toolRegistry.getToolDefinitions();

    if (args.length > 0) {
      const query = args.join(' ').toLowerCase();
      const match = definitions.find(t => t.name.toLowerCase() === query);

      if (!match) {
        return {
          output: `Unknown tool: "${args.join(' ')}". Use /tools to list all available tools.`,
          type: 'error',
        };
      }

      const lines = [
        `Tool: ${match.name}`,
        `Description: ${match.description}`,
      ];

      if (match.parameters && typeof match.parameters === 'object') {
        const params = match.parameters as Record<string, unknown>;
        const props = (params.properties ?? {}) as Record<string, { type?: string; description?: string }>;
        const required = (params.required ?? []) as string[];
        const paramEntries = Object.entries(props);

        if (paramEntries.length > 0) {
          lines.push('', 'Parameters:');
          for (const [name, schema] of paramEntries) {
            const req = required.includes(name) ? ' (required)' : '';
            const desc = schema.description ? ` — ${schema.description}` : '';
            lines.push(`  ${name}: ${schema.type ?? 'any'}${req}${desc}`);
          }
        }
      }

      return { output: lines.join('\n'), type: 'info' };
    }

    // List all tools
    if (definitions.length === 0) {
      return { output: 'No tools are registered.', type: 'info' };
    }

    const maxLen = Math.max(...definitions.map(t => t.name.length));
    const rows = definitions.map(t => {
      const name = t.name.padEnd(maxLen + 2);
      return `  ${name}${t.description}`;
    });

    return {
      output: [
        `Available tools (${definitions.length}):`,
        '',
        ...rows,
        '',
        'Use /tools <name> for detailed info about a specific tool.',
      ].join('\n'),
      type: 'table',
    };
  },
};
