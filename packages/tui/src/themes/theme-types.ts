export interface FridayTheme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    error: string;
    warning: string;
    success: string;
    muted: string;
    border: string;
    userMessage: string;
    assistantMessage: string;
    toolOutput: string;
    codeBlock: string;
    diff: {
      added: string;
      removed: string;
    };
  };
  icons: {
    thinking: string;
    success: string;
    error: string;
    warning: string;
    tool: string;
    user: string;
    assistant: string;
    info: string;
  };
}
