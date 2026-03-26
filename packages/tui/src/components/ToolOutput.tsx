import React from 'react';
import { Box, Text } from 'ink';

interface ToolOutputProps {
  toolName: string;
  args?: Record<string, unknown>;
  output?: string;
  success?: boolean;
  isExecuting?: boolean;
}

const MAX_LINES = 20;

function formatHeader(toolName: string, args: Record<string, unknown>): string {
  if (toolName === 'shell_exec' && args.command) return `$ ${String(args.command)}`;
  if ((toolName.startsWith('file_') || toolName === 'directory_tree') && (args.path || args.file_path)) {
    return String(args.path ?? args.file_path);
  }
  if ((toolName === 'grep' || toolName === 'glob') && args.pattern) return String(args.pattern);
  const s = JSON.stringify(args);
  return s.length > 50 ? s.slice(0, 50) + '\u2026' : s;
}

export const ToolOutput: React.FC<ToolOutputProps> = ({
  toolName,
  args,
  output,
  success,
  isExecuting = false,
}) => {
  const icon = isExecuting ? '\u25CB' : success === false ? '\u2718' : '\u25CF';
  const iconColor = isExecuting ? 'yellow' : success === false ? 'red' : 'green';
  const header = args ? formatHeader(toolName, args) : '';

  const lines = output ? output.split('\n') : [];
  const truncated = lines.length > MAX_LINES;
  const displayLines = truncated ? lines.slice(0, MAX_LINES) : lines;

  return (
    <Box flexDirection="column" marginLeft={2} marginBottom={0}>
      <Box gap={1}>
        <Text color={iconColor as 'yellow' | 'red' | 'green'}>{icon}</Text>
        <Text bold>{toolName}</Text>
        {header && <Text dimColor>{header}</Text>}
      </Box>
      {output && (
        <Box marginLeft={4} flexDirection="column">
          <Text color={success === false ? 'red' : undefined} dimColor={success !== false} wrap="wrap">
            {displayLines.join('\n')}
          </Text>
          {truncated && <Text dimColor>[{lines.length - MAX_LINES} more lines]</Text>}
        </Box>
      )}
    </Box>
  );
};
