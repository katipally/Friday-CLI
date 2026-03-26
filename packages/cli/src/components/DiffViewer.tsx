import React from 'react';
import { Box, Text } from 'ink';

interface DiffViewerProps {
  diff: string;
  onApprove?: () => void;
  onReject?: () => void;
}

export function DiffViewer({ diff }: DiffViewerProps) {
  const lines = diff.split('\n');
  let adds = 0;
  let dels = 0;
  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) adds++;
    if (line.startsWith('-') && !line.startsWith('---')) dels++;
  }

  return (
    <Box flexDirection="column" marginY={1} paddingLeft={2}>
      <Box gap={2}>
        <Text color="#8B5CF6" bold>Diff</Text>
        <Text color="#A3E635">+{adds}</Text>
        <Text color="#F43F5E">-{dels}</Text>
      </Box>
      <Box flexDirection="column" marginLeft={2}>
        {lines.map((line, i) => (
          <DiffLine key={i} line={line} lineNum={i + 1} />
        ))}
      </Box>
    </Box>
  );
}

function DiffLine({ line, lineNum }: { line: string; lineNum: number }) {
  const numStr = String(lineNum).padStart(4);

  if (line.startsWith('+') && !line.startsWith('+++')) {
    return (
      <Text>
        <Text color="#334155">{numStr} </Text>
        <Text color="#A3E635" bold>{'+'}</Text>
        <Text color="#A3E635">{line.slice(1)}</Text>
      </Text>
    );
  }
  if (line.startsWith('-') && !line.startsWith('---')) {
    return (
      <Text>
        <Text color="#334155">{numStr} </Text>
        <Text color="#F43F5E" bold>{'-'}</Text>
        <Text color="#F43F5E">{line.slice(1)}</Text>
      </Text>
    );
  }
  if (line.startsWith('@@')) {
    return (
      <Text>
        <Text color="#334155">{numStr} </Text>
        <Text color="#8B5CF6" bold>{line}</Text>
      </Text>
    );
  }
  if (line.startsWith('diff ') || line.startsWith('index ')) {
    return (
      <Text>
        <Text color="#334155">{numStr} </Text>
        <Text color="#22D3EE" bold>{line}</Text>
      </Text>
    );
  }
  return (
    <Text>
      <Text color="#334155">{numStr} </Text>
      <Text dimColor>{line}</Text>
    </Text>
  );
}
