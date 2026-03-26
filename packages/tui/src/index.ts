export { App } from './app.js';
export { MessageBubble } from './components/MessageBubble.js';
export { InputBox } from './components/InputBox.js';
export { StatusBar } from './components/StatusBar.js';
export { Spinner } from './components/Spinner.js';
export { ToolOutput } from './components/ToolOutput.js';
export { WelcomeBanner } from './components/WelcomeBanner.js';
export { PermissionPrompt } from './components/PermissionPrompt.js';

// New components
export { Mascot } from './components/Mascot.js';
export type { MascotMood } from './components/Mascot.js';
export { WelcomeScreen } from './components/WelcomeScreen.js';
export { DiffViewer, parseDiff } from './components/DiffViewer.js';
export { ToolCallPanel } from './components/ToolCallPanel.js';
export { CodeBlock } from './components/CodeBlock.js';
export type { CodeBlockProps } from './components/CodeBlock.js';
export { MarkdownRenderer } from './components/MarkdownRenderer.js';
export type { MarkdownRendererProps } from './components/MarkdownRenderer.js';

// Theme system
export { getTheme, setTheme, getThemeNames, THEMES } from './theme.js';
export type { FridayTheme } from './theme.js';

// Legacy theme utilities
export { ThemeProvider, useTheme } from './themes/theme-context.js';
export { darkTheme } from './themes/dark.js';
export { lightTheme } from './themes/light.js';
export { highContrastTheme } from './themes/high-contrast.js';
export { listThemes, registerTheme } from './themes/index.js';

// Keyboard shortcuts
export {
  createShortcutManager,
  formatKeyForDisplay,
  DEFAULT_SHORTCUTS,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
} from './keyboard/index.js';
export type { KeyBinding, ShortcutManager } from './keyboard/index.js';

// Shortcut components
export { ShortcutBar } from './components/ShortcutBar.js';
export type { ShortcutBarProps } from './components/ShortcutBar.js';
export { ShortcutHelp } from './components/ShortcutHelp.js';
export type { ShortcutHelpProps } from './components/ShortcutHelp.js';

// Interactive menu components
export { SelectMenu } from './components/SelectMenu.js';
export type { SelectMenuProps, SelectItem } from './components/SelectMenu.js';
export { ConfirmDialog } from './components/ConfirmDialog.js';
export type { ConfirmDialogProps } from './components/ConfirmDialog.js';
export { ProgressBar } from './components/ProgressBar.js';
export type { ProgressBarProps } from './components/ProgressBar.js';
export { StatusLine } from './components/StatusLine.js';
export type { StatusLineProps } from './components/StatusLine.js';

// Command palette
export { CommandPalette } from './components/CommandPalette.js';
export type { CommandPaletteProps, PaletteItem } from './components/CommandPalette.js';
export { InputWithHistory } from './components/InputWithHistory.js';
export type { InputWithHistoryProps } from './components/InputWithHistory.js';
