import { Theme, registerTheme } from './engine.js';

export const draculaTheme: Theme = {
  name: 'dracula',
  description: 'Dracula-inspired dark theme',
  colors: {
    primary: '#BD93F9',
    secondary: '#FF79C6',
    success: '#50FA7B',
    error: '#FF5555',
    warning: '#F1FA8C',
    info: '#8BE9FD',
    muted: '#6272A4',
    background: '#282A36',
    text: '#F8F8F2',
    border: '#44475A',
    user: '#BD93F9',
    assistant: '#50FA7B',
    tool: '#6272A4',
    system: '#FF79C6',
    highlight: '#F1FA8C',
  },
  ansi: {
    primary: 141,
    secondary: 212,
    success: 84,
    error: 203,
    warning: 228,
    info: 117,
    muted: 61,
    text: 255,
    border: 59,
  },
  symbols: {
    prompt: '❯',
    arrow: '→',
    dot: '●',
    check: '✓',
    cross: '✗',
    spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    border: {
      topLeft: '╭',
      topRight: '╮',
      bottomLeft: '╰',
      bottomRight: '╯',
      horizontal: '─',
      vertical: '│',
    },
  },
};

registerTheme(draculaTheme);
