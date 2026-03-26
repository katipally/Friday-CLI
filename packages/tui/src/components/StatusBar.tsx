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
  const parts: string[] = [`${provider}/${model}`];
  if (mode && mode !== 'code') parts.push(mode);
  const right = `${fmtTokens(inputTokens)}\u2191 ${fmtTokens(outputTokens)}\u2193${cost > 0 ? ` $${cost.toFixed(4)}` : ''}`;

  return (
    <Box justifyContent="space-between" width="100%">
      <Box gap={1}>
        {isThinking && <Text color="yellow">{'\u25CF'}</Text>}
        <Text dimColor>{parts.join(' \u00B7 ')}</Text>
      </Box>
      <Text dimColor>{right}</Text>
    </Box>
  );
};
