import { AgentLoop } from '@anthropic-ai/friday-core';
import { createProvider } from '@anthropic-ai/friday-providers';
import { createDefaultRegistry } from '@anthropic-ai/friday-tools';
import type { AgentEvent, AgentConfig } from '@anthropic-ai/friday-core';
import type { ProviderConfig } from '@anthropic-ai/friday-providers';

export interface FridayOptions {
  provider: ProviderConfig;
  agent?: Partial<AgentConfig>;
  workspaceRoot?: string;
  /** Enable built-in tools (default: true) */
  tools?: boolean;
}

export class Friday {
  private agentLoop: AgentLoop;
  private options: FridayOptions;

  constructor(options: FridayOptions) {
    this.options = options;
    const provider = createProvider(options.provider);

    const toolRegistry =
      options.tools !== false
        ? createDefaultRegistry({
            workspaceRoot: options.workspaceRoot || process.cwd(),
            cwd: options.workspaceRoot || process.cwd(),
          })
        : null;

    this.agentLoop = new AgentLoop(provider, {
      provider: options.provider.provider,
      model: options.provider.model || 'gpt-4o',
      mode: options.agent?.mode || 'code',
      maxIterations: options.agent?.maxIterations || 50,
      ...options.agent,
    }, toolRegistry);
  }

  /** Send a message and get streaming events */
  async *chat(message: string): AsyncGenerator<AgentEvent> {
    yield* this.agentLoop.run(message);
  }

  /** Send a message and get just the final response text */
  async ask(message: string): Promise<string> {
    let response = '';
    for await (const event of this.agentLoop.run(message)) {
      if (event.type === 'response') {
        response = event.content;
      } else if (event.type === 'text_delta') {
        response += event.content;
      }
    }
    return response;
  }

  /** Reset conversation history */
  reset(): void {
    this.agentLoop.reset();
  }
}
