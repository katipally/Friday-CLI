import React from 'react';
import { Box, Text } from 'ink';

interface DiffViewerProps {
  diff: string;
  onApprove?: () => void;
  onReject?: () => void;
}

export function DiffViewer({ diff }: DiffViewerProps) {
  const lines = diff.split('\n');

  return (
    <Box flexDirection="column" marginY={1} paddingLeft={2}>
      <Text color="#8B5CF6" bold>Diff</Text>
      <Box flexDirection="column" marginLeft={2}>
        {lines.map((line, i) => (
          <DiffLine key={i} line={line} />
        ))}
      </Box>
    </Box>
  );
}

function DiffLine({ line }: { line: string }) {
  if (line.startsWith('+') && !line.startsWith('+++')) {
    return <Text color="#A3E635">{line}</Text>;
  }
  if (line.startsWith('-') && !line.startsWith('---')) {
    return <Text color="#F43F5E">{line}</Text>;
  }
  if (line.startsWith('@@')) {
    return <Text color="#8B5CF6">{line}</Text>;
  }
  if (line.startsWith('diff ') || line.startsWith('index ')) {
    return <Text color="#22D3EE" bold>{line}</Text>;
  }
  return <Text dimColor>{line}</Text>;
}
