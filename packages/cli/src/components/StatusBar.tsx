import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  model: string;
  provider: string;
  tokenCount: { input: number; output: number };
  state: string;
}

export function StatusBar({ model, provider, tokenCount, state }: StatusBarProps) {
  const totalTokens = tokenCount.input + tokenCount.output;

  return (
    <Box paddingX={0} marginTop={0}>
      <Text dimColor>
        {'─'.repeat(60)}
      </Text>
    </Box>
  );
}

// Compact inline status shown above prompt
export function StatusLine({ model, provider, tokenCount, state }: StatusBarProps) {
  const totalTokens = tokenCount.input + tokenCount.output;
  const stateIcon = state === 'streaming' ? '●'
    : state === 'tool-running' ? '⟳'
    : state === 'loading' ? '◌'
    : '●';
  const stateColor = state === 'streaming' ? '#A3E635'
    : state === 'tool-running' ? '#22D3EE'
    : state === 'loading' ? '#8B5CF6'
    : '#64748B';

  return (
    <Box paddingX={0} gap={1} marginBottom={0}>
      <Text color={stateColor}>{stateIcon}</Text>
      <Text dimColor>{provider}/{model || 'auto'}</Text>
      {totalTokens > 0 && (
        <Text dimColor>· {totalTokens.toLocaleString()} tokens</Text>
      )}
    </Box>
  );
}
