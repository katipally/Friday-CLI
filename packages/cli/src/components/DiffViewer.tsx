import React from 'react';
import { Box, Text } from 'ink';
import { COLORS } from '@fridaycode/shared';

interface DiffViewerProps {
  diff: string;
  onApprove?: () => void;
  onReject?: () => void;
}

export function DiffViewer({ diff }: DiffViewerProps) {
  const lines = diff.split('\n');

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={COLORS.midnightSlate} paddingX={1}>
      <Text color={COLORS.deepViolet} bold>
        Diff
      </Text>
      {lines.map((line, i) => (
        <DiffLine key={i} line={line} />
      ))}
    </Box>
  );
}

function DiffLine({ line }: { line: string }) {
  if (line.startsWith('+') && !line.startsWith('+++')) {
    return <Text color={COLORS.acidicPistachio}>{line}</Text>;
  }
  if (line.startsWith('-') && !line.startsWith('---')) {
    return <Text color={COLORS.starkRose}>{line}</Text>;
  }
  if (line.startsWith('@@')) {
    return <Text color={COLORS.deepViolet}>{line}</Text>;
  }
  if (line.startsWith('diff ') || line.startsWith('index ')) {
    return <Text color={COLORS.deepViolet} bold>{line}</Text>;
  }
  return <Text>{line}</Text>;
}
