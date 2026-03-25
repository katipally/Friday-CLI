import React from 'react';
import { Box, Text } from 'ink';

interface ToolOutputProps {
  toolName: string;
  args?: Record<string, unknown>;
  output?: string;
  success?: boolean;
  isExecuting?: boolean;
}

const MAX_LINES = 50;

function getToolIcon(name: string): string {
  if (name.startsWith('file_') || name === 'directory_tree') return '📄';
  if (name === 'shell_exec') return '💻';
  if (name.startsWith('git')) return '🔀';
  if (name === 'grep' || name === 'glob') return '🔍';
  return '🔧';
}

function formatArgs(
  toolName: string,
  args: Record<string, unknown>,
): React.ReactNode {
  if (toolName === 'shell_exec' && args.command) {
    return (
      <Text>
        <Text color="yellow">$ </Text>
        <Text color="white">{String(args.command)}</Text>
      </Text>
    );
  }

  if (
    (toolName.startsWith('file_') || toolName === 'directory_tree') &&
    (args.path || args.file_path)
  ) {
    return <Text color="gray">{String(args.path ?? args.file_path)}</Text>;
  }

  const str = JSON.stringify(args);
  return (
    <Text color="gray" dimColor>
      {str.length > 80 ? str.substring(0, 80) + '…' : str}
    </Text>
  );
}

function renderOutput(
  output: string,
  success: boolean | undefined,
): React.ReactNode {
  const lines = output.split('\n');
  const truncated = lines.length > MAX_LINES;
  const displayText = truncated
    ? lines.slice(0, MAX_LINES).join('\n')
    : output;

  return (
    <>
      <Text color={success === false ? 'red' : 'gray'} wrap="wrap">
        {displayText}
      </Text>
      {truncated && (
        <Text color="gray" dimColor>
          [truncated, {lines.length - MAX_LINES} more lines]
        </Text>
      )}
    </>
  );
}

export const ToolOutput: React.FC<ToolOutputProps> = ({
  toolName,
  args,
  output,
  success,
  isExecuting = false,
}) => {
  const icon = isExecuting
    ? '⏳'
    : success
      ? '✅'
      : success === false
        ? '❌'
        : getToolIcon(toolName);

  return (
    <Box flexDirection="column" marginY={0} marginLeft={3}>
      <Box gap={1}>
        <Text>{icon}</Text>
        <Text color="yellow" bold>
          {toolName}
        </Text>
        {args && formatArgs(toolName, args)}
      </Box>
      {output && (
        <Box marginLeft={3} marginTop={0} flexDirection="column">
          {renderOutput(output, success)}
        </Box>
      )}
    </Box>
  );
};
