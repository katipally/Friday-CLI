import type { Message } from '@anthropic-ai/friday-shared';

const PREVIEW_LENGTH = 200;

export class Summarizer {
  /**
   * Summarize a list of messages into a concise extractive summary.
   * Extracts key information without needing an LLM:
   * - User requests (what they asked for)
   * - Tool calls made (what actions were taken)
   * - Key decisions/results
   */
  static summarize(messages: Message[]): string {
    if (messages.length === 0) return '';

    const points: string[] = [];

    for (const message of messages) {
      switch (message.role) {
        case 'user':
          points.push(`• User: ${truncate(message.content)}`);
          break;

        case 'assistant': {
          if (message.toolCalls && message.toolCalls.length > 0) {
            for (const call of message.toolCalls) {
              const argsPreview = call.arguments
                ? truncate(
                    typeof call.arguments === 'string'
                      ? call.arguments
                      : JSON.stringify(call.arguments),
                    100,
                  )
                : '';
              points.push(`• Tool call: ${call.name}(${argsPreview})`);
            }
          }
          if (message.content.trim()) {
            points.push(`• Assistant: ${truncate(message.content)}`);
          }
          break;
        }

        case 'tool': {
          const toolName = message.name || 'unknown';
          points.push(
            `• Tool result [${toolName}]: ${truncate(message.content, 150)}`,
          );
          break;
        }

        case 'system':
          // System messages are typically not summarized
          break;
      }
    }

    if (points.length === 0) return '';

    return [
      '=== Conversation Summary ===',
      `Summarized ${messages.length} messages:`,
      '',
      ...points,
      '',
      '=== End Summary ===',
    ].join('\n');
  }
}

function truncate(text: string, maxLength: number = PREVIEW_LENGTH): string {
  const cleaned = text.replace(/\n+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength) + '...';
}
