import type { SlashCommand, CommandContext, CommandResult } from './types.js';

export const contextCommand: SlashCommand = {
  name: 'context',
  aliases: ['ctx'],
  description: 'Show context window usage breakdown',

  async execute(_args: string[], context: CommandContext): Promise<CommandResult> {
    const history = context.getHistory();
    const cost = context.getCostSummary();

    // Approximate token counts per role
    const breakdown: Record<string, { count: number; chars: number }> = {};
    for (const msg of history) {
      if (!breakdown[msg.role]) breakdown[msg.role] = { count: 0, chars: 0 };
      breakdown[msg.role].count++;
      breakdown[msg.role].chars += msg.content.length;
    }

    const totalChars = history.reduce((sum, m) => sum + m.content.length, 0);
    const approxTokens = Math.round(totalChars / 4);

    const lines = [
      'Context Window Usage',
      '',
    ];

    for (const [role, data] of Object.entries(breakdown)) {
      const tokens = Math.round(data.chars / 4);
      const pct = totalChars > 0 ? ((data.chars / totalChars) * 100).toFixed(1) : '0';
      lines.push(`  ${role.padEnd(12)} ${data.count.toString().padStart(4)} msgs  ~${tokens.toLocaleString().padStart(8)} tokens  ${pct.padStart(5)}%`);
    }

    lines.push('');
    lines.push(`  Total:     ${history.length.toString().padStart(4)} msgs  ~${approxTokens.toLocaleString().padStart(8)} tokens`);
    lines.push(`  API usage: ${cost.inputTokens.toLocaleString()} in / ${cost.outputTokens.toLocaleString()} out`);
    lines.push('');
    lines.push('Tip: Use /compact to summarize and free context space.');

    return { output: lines.join('\n'), type: 'info' };
  },
};
