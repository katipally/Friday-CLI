export interface FridayTheme {
  name: string;
  colors: {
    // Brand
    primary: string;
    secondary: string;
    accent: string;
    
    // Semantic
    success: string;
    warning: string;
    error: string;
    info: string;
    muted: string;
    
    // Chat
    userBubble: string;
    assistantBubble: string;
    systemMessage: string;
    toolCall: string;
    toolResult: string;
    
    // Diff
    diffAdd: string;
    diffRemove: string;
    diffContext: string;
    diffHeader: string;
    
    // Code
    codeBackground: string;
    codeBorder: string;
    codeKeyword: string;
    codeString: string;
    codeComment: string;
    codeFunction: string;
    
    // UI
    border: string;
    borderFocused: string;
    text: string;
    textDim: string;
    background: string;
    statusBar: string;
    statusBarText: string;
    inputBorder: string;
    inputText: string;
    spinner: string;
    
    // Permission
    permissionPrompt: string;
    permissionAllow: string;
    permissionDeny: string;
  };
  icons: {
    user: string;
    assistant: string;
    tool: string;
    success: string;
    error: string;
    warning: string;
    info: string;
    thinking: string;
    running: string;
    permission: string;
    cost: string;
    tokens: string;
    model: string;
  };
}

const darkTheme: FridayTheme = {
  name: 'dark',
  colors: {
    primary: '#4A90D9',
    secondary: '#7B68EE',
    accent: '#50C878',
    success: '#50C878',
    warning: '#FFB347',
    error: '#FF6B6B',
    info: '#4A90D9',
    muted: '#6B7280',
    userBubble: '#3B82F6',
    assistantBubble: '#8B5CF6',
    systemMessage: '#6B7280',
    toolCall: '#F59E0B',
    toolResult: '#10B981',
    diffAdd: '#22C55E',
    diffRemove: '#EF4444',
    diffContext: '#6B7280',
    diffHeader: '#3B82F6',
    codeBackground: '#1E1E2E',
    codeBorder: '#313244',
    codeKeyword: '#CBA6F7',
    codeString: '#A6E3A1',
    codeComment: '#6C7086',
    codeFunction: '#89B4FA',
    border: '#313244',
    borderFocused: '#4A90D9',
    text: '#CDD6F4',
    textDim: '#6C7086',
    background: '#1E1E2E',
    statusBar: '#181825',
    statusBarText: '#BAC2DE',
    inputBorder: '#45475A',
    inputText: '#CDD6F4',
    spinner: '#4A90D9',
    permissionPrompt: '#F59E0B',
    permissionAllow: '#22C55E',
    permissionDeny: '#EF4444',
  },
  icons: {
    user: '👤',
    assistant: '🤖',
    tool: '🔧',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    thinking: '💭',
    running: '⚡',
    permission: '🔐',
    cost: '💰',
    tokens: '📊',
    model: '🧠',
  },
};

const lightTheme: FridayTheme = {
  name: 'light',
  colors: {
    primary: '#2563EB',
    secondary: '#7C3AED',
    accent: '#059669',
    success: '#059669',
    warning: '#D97706',
    error: '#DC2626',
    info: '#2563EB',
    muted: '#9CA3AF',
    userBubble: '#2563EB',
    assistantBubble: '#7C3AED',
    systemMessage: '#9CA3AF',
    toolCall: '#D97706',
    toolResult: '#059669',
    diffAdd: '#16A34A',
    diffRemove: '#DC2626',
    diffContext: '#9CA3AF',
    diffHeader: '#2563EB',
    codeBackground: '#F8FAFC',
    codeBorder: '#E2E8F0',
    codeKeyword: '#7C3AED',
    codeString: '#059669',
    codeComment: '#94A3B8',
    codeFunction: '#2563EB',
    border: '#E2E8F0',
    borderFocused: '#2563EB',
    text: '#1E293B',
    textDim: '#94A3B8',
    background: '#FFFFFF',
    statusBar: '#F1F5F9',
    statusBarText: '#475569',
    inputBorder: '#CBD5E1',
    inputText: '#1E293B',
    spinner: '#2563EB',
    permissionPrompt: '#D97706',
    permissionAllow: '#16A34A',
    permissionDeny: '#DC2626',
  },
  icons: {
    user: '👤',
    assistant: '🤖',
    tool: '🔧',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    thinking: '💭',
    running: '⚡',
    permission: '🔐',
    cost: '💰',
    tokens: '📊',
    model: '🧠',
  },
};

const monokaiTheme: FridayTheme = {
  name: 'monokai',
  colors: {
    primary: '#66D9EF',
    secondary: '#AE81FF',
    accent: '#A6E22E',
    success: '#A6E22E',
    warning: '#FD971F',
    error: '#F92672',
    info: '#66D9EF',
    muted: '#75715E',
    userBubble: '#66D9EF',
    assistantBubble: '#AE81FF',
    systemMessage: '#75715E',
    toolCall: '#FD971F',
    toolResult: '#A6E22E',
    diffAdd: '#A6E22E',
    diffRemove: '#F92672',
    diffContext: '#75715E',
    diffHeader: '#66D9EF',
    codeBackground: '#272822',
    codeBorder: '#3E3D32',
    codeKeyword: '#F92672',
    codeString: '#E6DB74',
    codeComment: '#75715E',
    codeFunction: '#A6E22E',
    border: '#3E3D32',
    borderFocused: '#66D9EF',
    text: '#F8F8F2',
    textDim: '#75715E',
    background: '#272822',
    statusBar: '#1E1F1C',
    statusBarText: '#F8F8F2',
    inputBorder: '#3E3D32',
    inputText: '#F8F8F2',
    spinner: '#66D9EF',
    permissionPrompt: '#FD971F',
    permissionAllow: '#A6E22E',
    permissionDeny: '#F92672',
  },
  icons: {
    user: '👤',
    assistant: '🤖',
    tool: '🔧',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    thinking: '💭',
    running: '⚡',
    permission: '🔐',
    cost: '💰',
    tokens: '📊',
    model: '🧠',
  },
};

export const THEMES: Record<string, FridayTheme> = {
  dark: darkTheme,
  light: lightTheme,
  monokai: monokaiTheme,
};

let currentTheme: FridayTheme = darkTheme;

export function getTheme(): FridayTheme {
  return currentTheme;
}

export function setTheme(name: string): FridayTheme {
  const theme = THEMES[name];
  if (!theme) {
    throw new Error(`Unknown theme: "${name}". Available: ${Object.keys(THEMES).join(', ')}`);
  }
  currentTheme = theme;
  return currentTheme;
}

export function getThemeNames(): string[] {
  return Object.keys(THEMES);
}
