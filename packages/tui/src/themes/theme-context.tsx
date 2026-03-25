import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { FridayTheme } from './theme-types.js';
import { darkTheme } from './dark.js';
import { lightTheme } from './light.js';
import { highContrastTheme } from './high-contrast.js';

const builtInThemes: Record<string, FridayTheme> = {
  dark: darkTheme,
  light: lightTheme,
  'high-contrast': highContrastTheme,
};

interface ThemeContextValue {
  theme: FridayTheme;
  themeName: string;
  setTheme: (name: string) => void;
  availableThemes: string[];
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: darkTheme,
  themeName: 'dark',
  setTheme: () => {},
  availableThemes: Object.keys(builtInThemes),
});

export const useTheme = (): ThemeContextValue => useContext(ThemeContext);

interface ThemeProviderProps {
  initialTheme?: string;
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  initialTheme = 'dark',
  children,
}) => {
  const [themeName, setThemeName] = useState(initialTheme);

  const setTheme = useCallback((name: string) => {
    if (builtInThemes[name]) {
      setThemeName(name);
    }
  }, []);

  const theme = useMemo(
    () => builtInThemes[themeName] ?? darkTheme,
    [themeName],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      themeName,
      setTheme,
      availableThemes: Object.keys(builtInThemes),
    }),
    [theme, themeName, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};
