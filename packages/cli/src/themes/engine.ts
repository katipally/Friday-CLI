/**
 * Theme system for FridayCode CLI.
 */

export interface Theme {
  name: string;
  description: string;
  colors: {
    primary: string;       // Main brand color
    secondary: string;     // Accent color
    success: string;       // Success indicators
    error: string;         // Error text
    warning: string;       // Warning text
    info: string;          // Informational text
    muted: string;         // Dimmed/secondary text
    background: string;    // Background hint
    text: string;          // Primary text
    border: string;        // Border color
    user: string;          // User message color
    assistant: string;     // Assistant message color
    tool: string;          // Tool call color
    system: string;        // System message color
    highlight: string;     // Search highlight
  };
  ansi: {
    primary: number;
    secondary: number;
    success: number;
    error: number;
    warning: number;
    info: number;
    muted: number;
    text: number;
    border: number;
  };
  symbols: {
    prompt: string;
    arrow: string;
    dot: string;
    check: string;
    cross: string;
    spinner: string[];
    border: {
      topLeft: string;
      topRight: string;
      bottomLeft: string;
      bottomRight: string;
      horizontal: string;
      vertical: string;
    };
  };
}

const themes = new Map<string, Theme>();
let currentThemeName = 'dark';

/**
 * Register a theme.
 */
export function registerTheme(theme: Theme): void {
  themes.set(theme.name, theme);
}

/**
 * Set the active theme by name.
 */
export function setTheme(name: string): boolean {
  if (themes.has(name)) {
    currentThemeName = name;
    return true;
  }
  return false;
}

/**
 * Get the current active theme.
 */
export function getTheme(): Theme {
  return themes.get(currentThemeName) ?? themes.get('dark')!;
}

/**
 * List available theme names.
 */
export function listThemes(): string[] {
  return [...themes.keys()];
}

/**
 * ANSI 256-color foreground escape.
 */
export function fg(code: number): string {
  return `\x1b[38;5;${code}m`;
}

/**
 * ANSI reset.
 */
export function reset(): string {
  return '\x1b[0m';
}

/**
 * Apply ANSI color to text.
 */
export function colorize(text: string, ansiCode: number): string {
  return `${fg(ansiCode)}${text}${reset()}`;
}
