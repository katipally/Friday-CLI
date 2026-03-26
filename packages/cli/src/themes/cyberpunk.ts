import { Theme, registerTheme } from './engine.js';

export const cyberpunkTheme: Theme = {
  name: 'cyberpunk',
  description: 'Neon cyberpunk theme with electric colors',
  colors: {
    primary: '#FF00FF',
    secondary: '#00FFFF',
    success: '#39FF14',
    error: '#FF073A',
    warning: '#FFD300',
    info: '#00BFFF',
    muted: '#808080',
    background: '#0D0221',
    text: '#E0E0E0',
    border: '#2A0845',
    user: '#FF00FF',
    assistant: '#39FF14',
    tool: '#808080',
    system: '#FF073A',
    highlight: '#FFD300',
  },
  ansi: {
    primary: 201,
    secondary: 51,
    success: 82,
    error: 196,
    warning: 220,
    info: 39,
    muted: 244,
    text: 254,
    border: 53,
  },
  symbols: {
    prompt: '▸',
    arrow: '→',
    dot: '◈',
    check: '✦',
    cross: '✘',
    spinner: ['◐', '◓', '◑', '◒'],
    border: {
      topLeft: '╔',
      topRight: '╗',
      bottomLeft: '╚',
      bottomRight: '╝',
      horizontal: '═',
      vertical: '║',
    },
  },
};

registerTheme(cyberpunkTheme);
