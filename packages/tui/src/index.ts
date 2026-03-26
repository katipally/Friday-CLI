export { App } from './app.js';
export { MessageBubble } from './components/MessageBubble.js';
export { InputBox } from './components/InputBox.js';
export { StatusBar } from './components/StatusBar.js';
export { Spinner } from './components/Spinner.js';
export { ToolOutput } from './components/ToolOutput.js';
export { WelcomeBanner } from './components/WelcomeBanner.js';
export { PermissionPrompt } from './components/PermissionPrompt.js';

// Theme system
export { getTheme, setTheme, getThemeNames, THEMES } from './theme.js';
export type { FridayTheme } from './theme.js';

// Keyboard shortcuts
export {
  createShortcutManager,
  formatKeyForDisplay,
  DEFAULT_SHORTCUTS,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
} from './keyboard/index.js';
export type { KeyBinding, ShortcutManager } from './keyboard/index.js';

