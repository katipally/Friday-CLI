export type { FridayTheme } from './theme-types.js';
export { darkTheme } from './dark.js';
export { lightTheme } from './light.js';
export { highContrastTheme } from './high-contrast.js';
export { ThemeProvider, useTheme } from './theme-context.js';

import type { FridayTheme } from './theme-types.js';
import { darkTheme } from './dark.js';
import { lightTheme } from './light.js';
import { highContrastTheme } from './high-contrast.js';

const themes = new Map<string, FridayTheme>([
  ['dark', darkTheme],
  ['light', lightTheme],
  ['high-contrast', highContrastTheme],
]);

export function getTheme(name: string): FridayTheme {
  return themes.get(name) || darkTheme;
}

export function listThemes(): string[] {
  return Array.from(themes.keys());
}

export function registerTheme(theme: FridayTheme): void {
  themes.set(theme.name, theme);
}
