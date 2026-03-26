import React from 'react';
import { Box, Text } from 'ink';

interface ToolOutputProps {
  toolName: string;
  args?: Record<string, unknown>;
  output?: string;
  success?: boolean;
  isExecuting?: boolean;
}

const MAX_LINES = 30;

function formatToolHeader(
  toolName: string,
  args: Record<string, unknown>,
): string {
  if (toolName === 'shell_exec' && args.command) {
    return `$ ${String(args.command)}`;
  }
  if (
    (toolName.startsWith('file_') || toolName === 'directory_tree') &&
    (args.path || args.file_path)
  ) {
    return String(args.path ?? args.file_path);
  }
  if ((toolName === 'grep' || toolName === 'glob') && args.pattern) {
    return String(args.pattern);
  }
  const str = JSON.stringify(args);
  return str.length > 60 ? str.substring(0, 60) + '\u2026' : str;
}

function truncateOutput(output: string): { text: string; truncated: number } {
  const lines = output.split('\n');
  if (lines.length <= MAX_LINES) return { text: output, truncated: 0 };
  return {
    text: lines.slice(0, MAX_LINES).join('\n'),
    truncated: lines.length - MAX_LINES,
  };
}

export const ToolOutput: React.FC<ToolOutputProps> = ({
  toolName,
  args,
  output,
  success,
  isExecuting = false,
}) => {
  const statusIcon = isExecuting
    ? '\u25B7'
    : success === false
      ? '\u2717'
      : '\u25B6';

  const statusColor = isExecuting
    ? 'yellow'
    : success === false
      ? 'red'
      : 'green';

  const header = args ? formatToolHeader(toolName, args) : '';

  return (
    <Box flexDirection="column" marginLeft={1} marginBottom={0}>
      <Box gap={1}>
        <Text color={statusColor as 'yellow' | 'red' | 'green'}>{statusIcon}</Text>
        <Text color="white" bold>
          {toolName}
        </Text>
        {header && (
          <Text color="gray" dimColor>
            {header}
          </Text>
        )}
      </Box>
      {output && (
        <Box marginLeft={3} flexDirection="column">
          {(() => {
            const { text, truncated } = truncateOutput(output);
            return (
              <>
                <Text color={success === false ? 'red' : 'gray'} dimColor wrap="wrap">
                  {text}
                </Text>
                {truncated > 0 && (
                  <Text color="gray" dimColor>
                    [{truncated} more lines]
                  </Text>
                )}
              </>
            );
          })()}
        </Box>
      )}
    </Box>
  );
};
