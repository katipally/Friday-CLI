import type { FridayTheme } from './theme-types.js';

export const highContrastTheme: FridayTheme = {
  name: 'high-contrast',
  colors: {
    primary: '#FFFFFF',
    secondary: '#00FFFF',
    accent: '#FF0000',
    background: '#000000',
    text: '#FFFFFF',
    error: '#FF0000',
    warning: '#FFFF00',
    success: '#00FF00',
    muted: '#AAAAAA',
    border: '#FFFFFF',
    userMessage: '#FFFFFF',
    assistantMessage: '#00FFFF',
    toolOutput: '#AAAAAA',
    codeBlock: '#1A1A1A',
    diff: {
      added: '#00FF00',
      removed: '#FF0000',
    },
  },
  icons: {
    thinking: '⏳',
    success: '✓',
    error: '✗',
    warning: '⚠',
    tool: '⚙',
    user: '▶',
    assistant: '◀',
    info: 'ℹ',
  },
};
