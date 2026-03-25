import React from 'react';
import { Box, Text } from 'ink';

interface ToolOutputProps {
  toolName: string;
  args?: Record<string, unknown>;
  output?: string;
  success?: boolean;
  isExecuting?: boolean;
}

export const ToolOutput: React.FC<ToolOutputProps> = ({
  toolName,
  args,
  output,
  success,
  isExecuting = false,
}) => {
  const statusIcon = isExecuting ? '⏳' : success ? '✅' : success === false ? '❌' : '🔧';

  return (
    <Box flexDirection="column" marginY={0} marginLeft={3}>
      <Box gap={1}>
        <Text>{statusIcon}</Text>
        <Text color="yellow" bold>
          {toolName}
        </Text>
        {args && (
          <Text color="gray" dimColor>
            {JSON.stringify(args).substring(0, 80)}
            {JSON.stringify(args).length > 80 ? '...' : ''}
          </Text>
        )}
      </Box>
      {output && (
        <Box marginLeft={3} marginTop={0}>
          <Text color={success === false ? 'red' : 'gray'} wrap="wrap">
            {output.length > 500 ? output.substring(0, 500) + '\n...(truncated)' : output}
          </Text>
        </Box>
      )}
    </Box>
  );
};
