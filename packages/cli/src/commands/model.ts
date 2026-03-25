import type { SlashCommand, CommandContext, CommandResult } from './types.js';

const KNOWN_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-haiku-3-5-20241022', 'claude-opus-4-20250514'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  groq: ['llama-3.1-70b-versatile'],
  deepseek: ['deepseek-chat', 'deepseek-coder'],
  ollama: [],
};

export const modelCommand: SlashCommand = {
  name: 'model',
  aliases: ['m'],
  description: 'Show, switch, or list available models',
  usage: '/model [list | <model-name>]',

  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    if (args.length === 0) {
      return {
        output: `Current model: ${context.currentModel} (provider: ${context.currentProvider})`,
        type: 'info',
      };
    }

    if (args[0] === 'list') {
      const models = KNOWN_MODELS[context.currentProvider];
      if (!models || models.length === 0) {
        return {
          output: `No pre-configured model list for provider "${context.currentProvider}". You can still set any model with /model <name>.`,
          type: 'info',
        };
      }

      const lines = models.map(m =>
        m === context.currentModel ? `  * ${m} (current)` : `    ${m}`,
      );

      return {
        output: [`Models for ${context.currentProvider}:`, '', ...lines].join('\n'),
        type: 'table',
      };
    }

    const modelName = args.join(' ');
    context.setModel(modelName);
    return {
      output: `Switched to model: ${modelName}`,
      type: 'success',
    };
  },
};
