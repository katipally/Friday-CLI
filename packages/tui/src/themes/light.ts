import type { FridayTheme } from './theme-types.js';

export const lightTheme: FridayTheme = {
  name: 'light',
  colors: {
    primary: '#4A45B0',
    secondary: '#1A9E8F',
    accent: '#E05555',
    background: '#FFFFFF',
    text: '#1A1A1A',
    error: '#CC0000',
    warning: '#CC8800',
    success: '#008838',
    muted: '#999999',
    border: '#CCCCCC',
    userMessage: '#4A45B0',
    assistantMessage: '#1A9E8F',
    toolOutput: '#666666',
    codeBlock: '#F5F5F5',
    diff: {
      added: '#008838',
      removed: '#CC0000',
    },
  },
  icons: {
    thinking: '🤔',
    success: '✓',
    error: '✗',
    warning: '!',
    tool: '⚙',
    user: '▶',
    assistant: '◀',
    info: 'i',
  },
};
