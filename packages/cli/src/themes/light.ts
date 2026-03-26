import { Theme, registerTheme } from './engine.js';

/**
 * Light theme for FridayCode.
 * Adjusted for readability on light terminal backgrounds.
 */
export const lightTheme: Theme = {
  name: 'light',
  description: 'Light theme for light terminal backgrounds',
  colors: {
    primary: '#7C3AED',     // Violet-600 (darker for contrast)
    secondary: '#E11D48',   // Rose-600
    success: '#65A30D',     // Lime-600
    error: '#E11D48',       // Rose-600
    warning: '#D97706',     // Amber-600
    info: '#0284C7',        // Sky-600
    muted: '#94A3B8',       // Slate-400
    background: '#FFFFFF',  // White
    text: '#0F172A',        // Slate-900
    border: '#CBD5E1',      // Slate-300
    user: '#7C3AED',        // Violet-600
    assistant: '#65A30D',   // Lime-600
    tool: '#94A3B8',        // Muted
    system: '#E11D48',      // Rose-600
    highlight: '#D97706',   // Amber-600
  },
  ansi: {
    primary: 92,    // Purple
    secondary: 161, // Red/Rose
    success: 64,    // Green
    error: 161,     // Red/Rose
    warning: 172,   // Orange
    info: 32,       // Blue
    muted: 247,     // Light gray
    text: 16,       // Black
    border: 250,    // Light border
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

registerTheme(lightTheme);
