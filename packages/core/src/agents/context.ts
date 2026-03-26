import type { Message } from '@fridaycode/shared';

/**
 * Context management for agent conversations.
 * Handles compaction (summarization) and context window tracking.
 */

export interface CompactionOptions {
  focusTopic?: string;
  preserveRecent?: number;
}

/**
 * Compact a message history by summarizing older messages.
 * This is a local compaction — the actual summarization call
 * is done via the model (injected by the caller).
 */
export function prepareCompactionPrompt(
  messages: Message[],
  options: CompactionOptions = {},
): { keepMessages: Message[]; summaryInput: string } {
  const preserveRecent = options.preserveRecent ?? 4;

  if (messages.length <= preserveRecent + 1) {
    return { keepMessages: messages, summaryInput: '' };
  }

  // Split messages: summarize the old ones, keep recent ones
  const toSummarize = messages.slice(0, messages.length - preserveRecent);
  const keepMessages = messages.slice(messages.length - preserveRecent);

  // Build summary prompt from old messages
  const summaryParts: string[] = [];
  for (const msg of toSummarize) {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    const prefix = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'Tool';
    summaryParts.push(`[${prefix}]: ${content.slice(0, 1000)}`);
  }

  const focusClause = options.focusTopic
    ? ` Focus on information relevant to: ${options.focusTopic}`
    : '';

  const summaryInput =
    `Summarize the following conversation history concisely, preserving key decisions, code changes, and important context.${focusClause}\n\n` +
    summaryParts.join('\n');

  return { keepMessages, summaryInput };
}

/**
 * Apply a compaction summary to the message history.
 */
export function applyCompaction(
  summary: string,
  keepMessages: Message[],
): Message[] {
  const summaryMessage: Message = {
    role: 'system',
    content: `[Context Summary] ${summary}`,
    timestamp: Date.now(),
  };

  return [summaryMessage, ...keepMessages];
}

/**
 * Estimate token count from messages (rough heuristic: ~4 chars per token).
 */
export function estimateTokenCount(messages: Message[]): number {
  let totalChars = 0;
  for (const msg of messages) {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    totalChars += content.length;
    if (msg.toolCalls) {
      totalChars += JSON.stringify(msg.toolCalls).length;
    }
  }
  return Math.ceil(totalChars / 4);
}
