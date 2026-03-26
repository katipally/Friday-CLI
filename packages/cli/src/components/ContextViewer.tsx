import React from 'react';
import { Box, Text } from 'ink';

interface ContextViewerProps {
  inputTokens: number;
  outputTokens: number;
  contextLimit: number;
  messageCount: number;
}

export function ContextViewer({
  inputTokens,
  outputTokens,
  contextLimit,
  messageCount,
}: ContextViewerProps) {
  const totalTokens = inputTokens + outputTokens;
  const usagePercent = contextLimit > 0 ? (totalTokens / contextLimit) * 100 : 0;
  const barWidth = 30;
  const filledWidth = Math.round((usagePercent / 100) * barWidth);

  const barColor =
    usagePercent > 90 ? '#F43F5E'
    : usagePercent > 70 ? '#FBBF24'
    : '#A3E635';

  return (
    <Box flexDirection="column" marginY={1} paddingLeft={2}>
      <Text color="#8B5CF6" bold>Context Usage</Text>
      <Box gap={1} marginTop={0} marginLeft={2}>
        <Text color={barColor}>
          {'█'.repeat(filledWidth)}
          <Text dimColor>{'░'.repeat(barWidth - filledWidth)}</Text>
        </Text>
        <Text dimColor>{usagePercent.toFixed(1)}%</Text>
      </Box>
      <Box gap={2} marginLeft={2}>
        <Text dimColor>in: {inputTokens.toLocaleString()}</Text>
        <Text dimColor>out: {outputTokens.toLocaleString()}</Text>
        <Text dimColor>msgs: {messageCount}</Text>
      </Box>
    </Box>
  );
}
