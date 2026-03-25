import { writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { SlashCommand, CommandContext, CommandResult } from './types.js';

const FRIDAY_TEMPLATE = `# FRIDAY.md — Project Rules

## Project Overview
<!-- Describe what this project does and its purpose -->

## Tech Stack
<!-- List primary languages, frameworks, and tools -->

## Conventions
- Use consistent code style
- Write tests for new features
- Use conventional commits (feat:, fix:, chore:, docs:, test:, refactor:)
- Keep commits atomic and well-described

## Architecture
<!-- Describe folder structure, key modules, and how they interact -->

## Instructions for Friday
<!-- Special instructions for the AI agent when working in this repo -->
- Follow existing patterns in the codebase
- Run tests before committing changes
- Prefer small, focused changes over large refactors
`;

export const initCommand: SlashCommand = {
  name: 'init',
  aliases: ['initialize', 'setup'],
  description: 'Create a FRIDAY.md project rules file in the current directory',
  usage: '/init [--force]',

  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    const filePath = join(context.workspacePath, 'FRIDAY.md');
    const force = args.includes('--force');

    if (!force) {
      try {
        await access(filePath);
        return {
          output: [
            'FRIDAY.md already exists in this workspace.',
            'Use /init --force to overwrite it.',
          ].join('\n'),
          type: 'error',
        };
      } catch {
        // File doesn't exist — proceed
      }
    }

    try {
      await writeFile(filePath, FRIDAY_TEMPLATE, 'utf-8');
      return {
        output: [
          'Created FRIDAY.md in your workspace.',
          'Edit it to define project rules, conventions, and AI instructions.',
          `  ${filePath}`,
        ].join('\n'),
        type: 'success',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        output: `Failed to create FRIDAY.md: ${message}`,
        type: 'error',
      };
    }
  },
};
