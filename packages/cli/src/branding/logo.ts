/**
 * FridayCode ASCII art logo and brand identity.
 * Block-letter FRIDAYCODE in violet→lime gradient.
 */

const ESC = '\x1b[';
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;

function rgb(r: number, g: number, b: number): string {
  return `${ESC}38;2;${r};${g};${b}m`;
}

// Gradient stops: violet → violet-light → cyan → lime
const GRADIENT = [
  rgb(139, 92, 246),   // #8B5CF6 deep violet
  rgb(139, 92, 246),   // #8B5CF6
  rgb(167, 139, 250),  // #A78BFA violet-light
  rgb(167, 139, 250),  // #A78BFA
  rgb(34, 211, 238),   // #22D3EE cyan
  rgb(34, 211, 238),   // #22D3EE
  rgb(45, 212, 191),   // #2DD4BF teal
  rgb(163, 230, 53),   // #A3E635 lime
  rgb(163, 230, 53),   // #A3E635
  rgb(163, 230, 53),   // #A3E635
];

function gradientChar(char: string, position: number, total: number): string {
  if (char === ' ') return char;
  const idx = Math.floor((position / total) * (GRADIENT.length - 1));
  return `${GRADIENT[idx]}${BOLD}${char}${RESET}`;
}

function gradientLine(line: string): string {
  const chars = [...line];
  const total = chars.length;
  return chars.map((c, i) => gradientChar(c, i, total)).join('');
}

// Block-letter FRIDAYCODE (figlet "small" style, 4 lines tall)
const LOGO_LINES = [
  '  _____ ____  ___ ____    _ __   __  ____ ___  ____  _____ ',
  ' |  ___|  _ \\|_ _|  _ \\  / \\\\ \\ / / / ___/ _ \\|  _ \\| ____|',
  ' | |_  | |_) || || | | |/ _ \\\\ V / | |  | | | | | | |  _|  ',
  ' |  _| |  _ < | || |_| / ___ \\| |  | |__| |_| | |_| | |___ ',
  ' |_|   |_| \\_\\___|____/_/   \\_\\_|   \\____\\___/|____/|_____|',
];

export function renderLogo(): string {
  return LOGO_LINES.map(line => gradientLine(line)).join('\n');
}

export function renderCompactLogo(): string {
  const V = rgb(139, 92, 246);
  const L = rgb(163, 230, 53);
  return `${V}${BOLD}◆ ${L}FridayCode${RESET}`;
}

export const BRAND_ICON = '◆';
export const BRAND_COLOR_PRIMARY = '#8B5CF6';
export const BRAND_COLOR_SECONDARY = '#A3E635';
