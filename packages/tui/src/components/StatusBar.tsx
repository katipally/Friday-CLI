import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  model: string;
  provider: string;
  mode: string;
  cost?: number;
  inputTokens?: number;
  outputTokens?: number;
  isThinking?: boolean;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
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
  const left = `${provider}/${model}${mode !== 'code' ? ' \u00B7 ' + mode : ''}`;
  const tokens = `${formatTokens(inputTokens)}\u2191 ${formatTokens(outputTokens)}\u2193`;
  const costStr = cost > 0 ? ` \u00B7 $${cost.toFixed(4)}` : '';

  return (
    <Box paddingX={1} justifyContent="space-between" width="100%">
      <Box gap={1}>
        {isThinking && <Text color="yellow">{'\u25CF'}</Text>}
        <Text color="gray" dimColor>{left}</Text>
      </Box>
      <Text color="gray" dimColor>
        {tokens}{costStr}
      </Text>
    </Box>
  );
};
