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

export const StatusBar: React.FC<StatusBarProps> = ({
  model,
  provider,
  mode,
  cost = 0,
  inputTokens = 0,
  outputTokens = 0,
  isThinking = false,
}) => {
  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
      width="100%"
    >
      <Box gap={2}>
        <Text color="cyan">
          {provider}/{model}
        </Text>
        <Text color="magenta">mode:{mode}</Text>
      </Box>
      <Box gap={2}>
        {isThinking && <Text color="yellow">⏳ thinking…</Text>}
        <Text color="gray">
          📊 {inputTokens.toLocaleString()}↑ {outputTokens.toLocaleString()}↓
        </Text>
        <Text color="green">💰 ${cost.toFixed(4)}</Text>
      </Box>
    </Box>
  );
};
