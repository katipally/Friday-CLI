import type { SlashCommand, CommandContext, CommandResult } from './types.js';

export const modelCommand: SlashCommand = {
  name: 'model',
  aliases: ['m'],
  description: 'Switch model or provider, or list available models',
  usage: '/model [list | <provider>/<model> | <model>]',

  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    if (args.length === 0) {
      return {
        output: `${context.currentProvider}/${context.currentModel}`,
        type: 'info',
      };
    }

    if (args[0] === 'list') {
      // Try to fetch live models from provider
      if (context.listModels) {
        try {
          const models = await context.listModels();
          if (models.length > 0) {
            const lines = models.map(m =>
              m === context.currentModel ? `  ● ${m} (active)` : `    ${m}`,
            );
            return {
              output: [`Models for ${context.currentProvider}:`, ...lines].join('\n'),
              type: 'table',
            };
          }
        } catch {
          // Fall through
        }
      }
      return {
        output: `Could not fetch models for "${context.currentProvider}". Set any model with /model <name>.`,
        type: 'info',
      };
    }

    const input = args.join(' ');

    // Support provider/model syntax (e.g. "openai/gpt-4o", "ollama/llama3.2")
    if (input.includes('/')) {
      const [newProvider, ...modelParts] = input.split('/');
      const newModel = modelParts.join('/');
      context.setProvider(newProvider);
      context.setModel(newModel);
      return {
        output: `Switched to ${newProvider}/${newModel}`,
        type: 'success',
        stateChange: { provider: newProvider, model: newModel },
      };
    }

    // Model only
    context.setModel(input);
    return {
      output: `Switched to ${context.currentProvider}/${input}`,
      type: 'success',
      stateChange: { model: input },
    };
  },
};
