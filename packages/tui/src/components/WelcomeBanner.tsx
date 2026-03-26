import React from 'react';
import { Box, Text } from 'ink';
import { getTheme } from '../theme.js';

interface WelcomeBannerProps {
  version: string;
  model: string;
  provider: string;
  mode?: string;
  projectType?: string;
}

const MASCOT = `
    ╭─────╮
    │ ◉ ◉ │
    │  ▽  │
    ╰──┬──╯
   ╭───┴───╮
   │ FRIDAY │
   ╰───────╯`;

export const WelcomeBanner: React.FC<WelcomeBannerProps> = ({
  version,
  model,
  provider,
  mode,
  projectType,
}) => {
  const t = getTheme();
  const modeLabel = mode && mode !== 'agent' ? ` · ${mode}` : '';
  const projLabel = projectType ? ` · ${projectType}` : '';

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="row" gap={2}>
        <Box flexDirection="column">
          {MASCOT.split('\n').filter(Boolean).map((line, i) => (
            <Text key={i} color={t.colors.primary}>{line}</Text>
          ))}
        </Box>
        <Box flexDirection="column" justifyContent="center">
          <Box gap={1}>
            <Text color={t.colors.primary} bold>FridayCode</Text>
            <Text dimColor>v{version}</Text>
          </Box>
          <Text dimColor>{provider}/{model}{modeLabel}{projLabel}</Text>
          <Text dimColor></Text>
          <Box gap={2}>
            <Text color={t.colors.muted}>/help</Text>
            <Text color={t.colors.muted}>/model</Text>
            <Text color={t.colors.muted}>/mode</Text>
            <Text color={t.colors.muted}>Ctrl+C exit</Text>
          </Box>
        </Box>
      </Box>
      <Text color={t.colors.muted}>{'─'.repeat(60)}</Text>
    </Box>
  );
};
