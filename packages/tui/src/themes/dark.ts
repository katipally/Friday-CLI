import type { FridayTheme } from './theme-types.js';

export const darkTheme: FridayTheme = {
  name: 'dark',
  colors: {
    primary: '#6C63FF',
    secondary: '#2EC4B6',
    accent: '#FF6B6B',
    background: '#1A1A2E',
    text: '#E0E0E0',
    error: '#FF4444',
    warning: '#FFBB33',
    success: '#00C851',
    muted: '#666666',
    border: '#333333',
    userMessage: '#6C63FF',
    assistantMessage: '#2EC4B6',
    toolOutput: '#888888',
    codeBlock: '#2D2D2D',
    diff: {
      added: '#00C851',
      removed: '#FF4444',
    },
  },
  icons: {
    thinking: '🤔',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    tool: '🔧',
    user: '👤',
    assistant: '🤖',
    info: 'ℹ️',
  },
};
