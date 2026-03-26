import type { Message } from '@fridaycode/shared';

export class MessageHistory {
  private messages: Message[] = [];

  add(message: Message): void {
    this.messages.push(message);
  }

  getAll(): Message[] {
    return [...this.messages];
  }

  getLast(n: number): Message[] {
    if (n <= 0) return [];
    return this.messages.slice(-n);
  }

  getByRole(role: Message['role']): Message[] {
    return this.messages.filter((m) => m.role === role);
  }

  clear(): void {
    this.messages = [];
  }

  size(): number {
    return this.messages.length;
  }

  /**
   * Get messages that fit within a token budget.
   * Uses approximate token counting (chars / 4).
   */
  getWithinBudget(
    maxTokens: number,
    options: {
      alwaysIncludeLast?: number;
      includeSystem?: boolean;
    } = {},
  ): Message[] {
    const { alwaysIncludeLast = 0, includeSystem = false } = options;

    if (this.messages.length === 0) return [];

    const mustInclude: Message[] = [];
    let mustIncludeTokens = 0;

    // Collect system messages if requested
    if (includeSystem) {
      for (const msg of this.messages) {
        if (msg.role === 'system') {
          mustInclude.push(msg);
          mustIncludeTokens += estimateMessageTokens(msg);
        }
      }
    }

    // Collect last N messages that must be included
    const lastMessages =
      alwaysIncludeLast > 0 ? this.messages.slice(-alwaysIncludeLast) : [];
    for (const msg of lastMessages) {
      if (!mustInclude.includes(msg)) {
        mustInclude.push(msg);
        mustIncludeTokens += estimateMessageTokens(msg);
      }
    }

    // If must-include messages already exceed budget, return them anyway
    if (mustIncludeTokens >= maxTokens) {
      return mustInclude;
    }

    let remainingBudget = maxTokens - mustIncludeTokens;

    // Fill remaining budget with messages from newest to oldest
    const candidateMessages = this.messages.filter(
      (m) => !mustInclude.includes(m),
    );
    const additionalMessages: Message[] = [];

    for (let i = candidateMessages.length - 1; i >= 0; i--) {
      const tokens = estimateMessageTokens(candidateMessages[i]!);
      if (tokens <= remainingBudget) {
        additionalMessages.unshift(candidateMessages[i]!);
        remainingBudget -= tokens;
      } else {
        break;
      }
    }

    // Merge: additional messages first (in order), then must-include messages
    // But we need to preserve original ordering
    const includedSet = new Set([...additionalMessages, ...mustInclude]);
    return this.messages.filter((m) => includedSet.has(m));
  }
}

function estimateMessageTokens(message: Message): number {
  let chars = message.content.length;
  if (message.name) chars += message.name.length;
  if (message.toolCallId) chars += message.toolCallId.length;
  if (message.toolCalls) {
    chars += JSON.stringify(message.toolCalls).length;
  }
  // ~4 chars per token approximation
  return Math.ceil(chars / 4);
}
