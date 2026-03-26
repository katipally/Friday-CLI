import React from 'react';
import { Box, Text } from 'ink';
import { COLORS } from '@fridaycode/shared';

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
  const barWidth = 40;
  const filledWidth = Math.round((usagePercent / 100) * barWidth);

  const barColor =
    usagePercent > 90
      ? COLORS.starkRose
      : usagePercent > 70
        ? COLORS.deepViolet
        : COLORS.acidicPistachio;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={COLORS.midnightSlate}
      paddingX={1}
    >
      <Text color={COLORS.deepViolet} bold>
        Context Usage
      </Text>
      <Box gap={1} marginTop={1}>
        <Text color={barColor}>
          {'█'.repeat(filledWidth)}
          {'░'.repeat(barWidth - filledWidth)}
        </Text>
        <Text color={COLORS.icySlate}>{usagePercent.toFixed(1)}%</Text>
      </Box>
      <Box gap={2} marginTop={1}>
        <Text>
          <Text color={COLORS.midnightSlate}>Input: </Text>
          <Text>{inputTokens.toLocaleString()}</Text>
        </Text>
        <Text>
          <Text color={COLORS.midnightSlate}>Output: </Text>
          <Text>{outputTokens.toLocaleString()}</Text>
        </Text>
        <Text>
          <Text color={COLORS.midnightSlate}>Messages: </Text>
          <Text>{messageCount}</Text>
        </Text>
      </Box>
    </Box>
  );
}
