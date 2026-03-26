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

  // Colored grid visualization (like Claude Code context viewer)
  const gridCols = 40;
  const gridRows = 3;
  const totalCells = gridCols * gridRows;
  const filledCells = Math.round((usagePercent / 100) * totalCells);

  const barColor =
    usagePercent > 90 ? '#F43F5E'
    : usagePercent > 70 ? '#FBBF24'
    : usagePercent > 50 ? '#FB923C'
    : '#A3E635';

  const dimColor = '#1E293B';

  return (
    <Box flexDirection="column" marginY={1} paddingLeft={2}>
      <Text color="#8B5CF6" bold>{'⌽ Context Usage'}</Text>

      {/* Grid visualization */}
      <Box flexDirection="column" marginLeft={2} marginTop={0}>
        {Array.from({ length: gridRows }).map((_, row) => (
          <Box key={row}>
            {Array.from({ length: gridCols }).map((_, col) => {
              const idx = row * gridCols + col;
              const isFilled = idx < filledCells;
              // Gradient within filled area
              const cellColor = isFilled
                ? (idx / totalCells > 0.9 ? '#F43F5E'
                  : idx / totalCells > 0.7 ? '#FBBF24'
                  : idx / totalCells > 0.5 ? '#FB923C'
                  : '#A3E635')
                : dimColor;
              return <Text key={col} color={cellColor}>{isFilled ? '█' : '░'}</Text>;
            })}
          </Box>
        ))}
      </Box>

      {/* Stats row */}
      <Box gap={3} marginLeft={2} marginTop={0}>
        <Text>
          <Text color={barColor} bold>{usagePercent.toFixed(1)}%</Text>
          <Text dimColor> used</Text>
        </Text>
        <Text>
          <Text color="#8B5CF6">{formatCount(inputTokens)}</Text>
          <Text dimColor> in</Text>
        </Text>
        <Text>
          <Text color="#22D3EE">{formatCount(outputTokens)}</Text>
          <Text dimColor> out</Text>
        </Text>
        <Text>
          <Text color="#64748B">{messageCount}</Text>
          <Text dimColor> msgs</Text>
        </Text>
      </Box>

      {/* Warning if high usage */}
      {usagePercent > 80 && (
        <Box marginLeft={2} marginTop={0}>
          <Text color="#F43F5E" italic>
            {'  ⚠ Context nearly full — consider /compact'}
          </Text>
        </Box>
      )}
    </Box>
  );
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
