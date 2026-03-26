import React from 'react';
import { Box, Text } from 'ink';
import { getTheme } from '../theme.js';

interface StatusBarProps {
  model: string;
  provider: string;
  mode: string;
  cost?: number;
  inputTokens?: number;
  outputTokens?: number;
  isThinking?: boolean;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

export const StatusBar: React.FC<StatusBarProps> = ({
  model,
  provider,
  mode,
  cost = 0,
  inputTokens = 0,
  outputTokens = 0,
  isThinking = false,
}) => {
  const t = getTheme();
  const modeLabel = mode && mode !== 'agent' ? ` · ${mode}` : '';

  return (
    <Box justifyContent="space-between" width="100%">
      <Box gap={1}>
        {isThinking && <Text color={t.colors.warning}>◉</Text>}
        <Text color={t.colors.muted}>{provider}/{model}{modeLabel}</Text>
      </Box>
      <Box gap={1}>
        <Text color={t.colors.muted}>{fmtTokens(inputTokens)}↑ {fmtTokens(outputTokens)}↓</Text>
        {cost > 0 && <Text color={t.colors.accent}>${cost.toFixed(4)}</Text>}
      </Box>
    </Box>
  );
};
