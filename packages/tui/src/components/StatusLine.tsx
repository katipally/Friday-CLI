import React from 'react';
import { Box, Text } from 'ink';
import { getTheme } from '../theme.js';

export interface StatusLineProps {
  provider: string;
  model: string;
  tokensUsed: number;
  cost: number;
  sessionDuration?: number;
  mode?: 'normal' | 'compact' | 'agent';
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m${secs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h${remainMins}m` : `${hrs}h`;
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

const SEPARATOR = ' │ ';

export const StatusLine: React.FC<StatusLineProps> = ({
  provider,
  model,
  tokensUsed,
  cost,
  sessionDuration,
  mode = 'normal',
}) => {
  const theme = getTheme();
  const sep = <Text color={theme.colors.border}>{SEPARATOR}</Text>;

  if (mode === 'compact') {
    return (
      <Box>
        <Text color={theme.colors.primary}>
          {provider}/{model}
        </Text>
        {sep}
        <Text color={theme.colors.textDim}>{formatTokens(tokensUsed)}</Text>
        {sep}
        <Text color={theme.colors.success}>{formatCost(cost)}</Text>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="single"
      borderColor={theme.colors.border}
      borderTop
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      paddingX={1}
    >
      <Text>
        <Text color={theme.colors.textDim}>{theme.icons.model} </Text>
        <Text color={theme.colors.primary}>
          {provider}/{model}
        </Text>
      </Text>
      {sep}
      <Text>
        <Text color={theme.colors.textDim}>{theme.icons.tokens} </Text>
        <Text color={theme.colors.info}>{formatTokens(tokensUsed)} tokens</Text>
      </Text>
      {sep}
      <Text>
        <Text color={theme.colors.textDim}>{theme.icons.cost} </Text>
        <Text color={theme.colors.success}>{formatCost(cost)}</Text>
      </Text>
      {sessionDuration !== undefined && (
        <>
          {sep}
          <Text color={theme.colors.textDim}>{formatDuration(sessionDuration)}</Text>
        </>
      )}
      {mode === 'agent' && (
        <>
          {sep}
          <Text color={theme.colors.warning} bold>agent</Text>
        </>
      )}
    </Box>
  );
};
