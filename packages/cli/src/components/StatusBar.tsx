import React from 'react';
import { Box, Text } from 'ink';
import { COLORS, APP_NAME } from '@fridaycode/shared';

interface StatusBarProps {
  model: string;
  provider: string;
  tokenCount: { input: number; output: number };
  state: string;
}

export function StatusBar({ model, provider, tokenCount, state }: StatusBarProps) {
  const stateIndicator = getStateIndicator(state);
  const totalTokens = tokenCount.input + tokenCount.output;

  return (
    <Box
      borderStyle="single"
      borderColor={COLORS.midnightSlate}
      paddingX={1}
      justifyContent="space-between"
    >
      <Box gap={2}>
        <Text color={COLORS.deepViolet} bold>
          {APP_NAME}
        </Text>
        <Text color={COLORS.icySlate}>
          {provider}/{model}
        </Text>
      </Box>

      <Box gap={2}>
        <Text color={COLORS.midnightSlate}>
          {totalTokens > 0 ? `${totalTokens.toLocaleString()} tokens` : ''}
        </Text>
        <Text color={stateIndicator.color}>{stateIndicator.text}</Text>
      </Box>
    </Box>
  );
}

function getStateIndicator(state: string): { text: string; color: string } {
  switch (state) {
    case 'streaming':
      return { text: '● Streaming', color: COLORS.acidicPistachio };
    case 'tool-running':
      return { text: '⟳ Tool Running', color: COLORS.starkRose };
    case 'loading':
      return { text: '● Loading', color: COLORS.deepViolet };
    case 'permission':
      return { text: '? Permission', color: COLORS.starkRose };
    case 'idle':
      return { text: '● Ready', color: COLORS.acidicPistachio };
    case 'welcome':
      return { text: '● Welcome', color: COLORS.deepViolet };
    default:
      return { text: '', color: COLORS.midnightSlate };
  }
}
