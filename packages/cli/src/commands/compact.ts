import type { SlashCommand, CommandContext, CommandResult } from './types.js';

const COMPACT_PROMPT = `You are a conversation summarizer. Summarize the following conversation into a concise but comprehensive summary that preserves:
1. Key decisions and reasoning
2. Important code changes discussed or made
3. File paths and technical details mentioned
4. Current task context and next steps
5. Any constraints or requirements established

Output ONLY the summary, no preamble. Be concise but thorough — this summary replaces the full conversation history.

Conversation:
`;

export const compactCommand: SlashCommand = {
  name: 'compact',
  aliases: ['c!'],
  description: 'Summarize conversation to free context window',
  usage: '/compact [instructions]',

  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    const history = context.getHistory();
    if (history.length <= 2) {
      return { output: 'Not enough history to compact.', type: 'info' };
    }

    const userMsgs = history.filter((m) => m.role === 'user').length;
    const assistantMsgs = history.filter((m) => m.role === 'assistant').length;
    const totalChars = history.reduce((sum, m) => sum + m.content.length, 0);
    const approxTokens = Math.round(totalChars / 4);

    // Build conversation text for summarization
    const convoText = history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => `[${m.role}]: ${m.content.slice(0, 2000)}`)
      .join('\n\n');

    const customInstr = args.join(' ').trim();
    const prompt = COMPACT_PROMPT + convoText +
      (customInstr ? `\n\nAdditional focus: ${customInstr}` : '');

    // Attempt LLM-based summarization
    if (context.completionRequest) {
      try {
        const summary = await context.completionRequest(prompt);

        // Replace history with a single system summary message
        context.setHistory([
          { role: 'system', content: `[Conversation Summary]\n${summary}` },
        ]);

        return {
          output: [
            '✔ Conversation compacted with LLM summarization.',
            `  Condensed ${history.length} messages (${userMsgs} user, ${assistantMsgs} assistant)`,
            `  Freed ~${approxTokens} tokens → kept summary (~${Math.round(summary.length / 4)} tokens)`,
          ].join('\n'),
          type: 'success',
        };
      } catch {
        // Fall through to simple compact
      }
    }

    // Fallback: keep last 2 messages + basic stats
    const kept = history.slice(-2);
    context.setHistory([
      {
        role: 'system',
        content: `[Auto-compact] Previous conversation had ${userMsgs} user and ${assistantMsgs} assistant messages (~${approxTokens} tokens). History was truncated.`,
      },
      ...kept,
    ]);

    return {
      output: [
        'Conversation compacted (fallback — no LLM summary).',
        `  Removed ${history.length - 2} of ${history.length} messages`,
        `  Freed ~${approxTokens} tokens`,
      ].join('\n'),
      type: 'success',
    };
  },
};
