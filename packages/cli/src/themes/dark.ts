import { Theme, registerTheme } from './engine.js';

/**
 * Dark theme — default FridayCode theme.
 * Uses the FridayCode brand palette.
 */
export const darkTheme: Theme = {
  name: 'dark',
  description: 'Default dark theme with FridayCode brand palette',
  colors: {
    primary: '#8B5CF6',     // Deep Violet
    secondary: '#F43F5E',   // Stark Rose
    success: '#A3E635',     // Acidic Pistachio
    error: '#F43F5E',       // Stark Rose
    warning: '#FBBF24',     // Amber
    info: '#38BDF8',        // Sky blue
    muted: '#64748B',       // Slate-500
    background: '#0F172A',  // Slate-900
    text: '#F8FAFC',        // Icy Slate
    border: '#334155',      // Midnight Slate
    user: '#8B5CF6',        // Deep Violet
    assistant: '#A3E635',   // Acidic Pistachio
    tool: '#64748B',        // Muted
    system: '#F43F5E',      // Stark Rose
    highlight: '#FBBF24',   // Amber
  },
  ansi: {
    primary: 99,    // Deep Violet
    secondary: 204, // Stark Rose
    success: 149,   // Acidic Pistachio
    error: 204,     // Stark Rose
    warning: 214,   // Amber
    info: 75,       // Sky blue
    muted: 244,     // Gray
    text: 255,      // White
    border: 237,    // Midnight Slate
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

registerTheme(darkTheme);
