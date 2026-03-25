import React from 'react';
import { Box, Text, useInput } from 'ink';

interface PermissionPromptProps {
  toolName: string;
  args: Record<string, unknown>;
  reason: string;
  onRespond: (choice: 'allow_once' | 'allow_always' | 'deny') => void;
}

export const PermissionPrompt: React.FC<PermissionPromptProps> = ({
  toolName,
  args,
  reason,
  onRespond,
}) => {
  useInput((input) => {
    const key = input.toLowerCase();
    if (key === 'y') {
      onRespond('allow_once');
    } else if (key === 'n') {
      onRespond('deny');
    } else if (key === 'a') {
      onRespond('allow_always');
    }
  });

  const argsStr = JSON.stringify(args, null, 2);
  const truncatedArgs =
    argsStr.length > 200 ? argsStr.substring(0, 200) + '…' : argsStr;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      marginY={1}
    >
      <Box gap={1}>
        <Text color="yellow">🔒</Text>
        <Text color="yellow" bold>
          Permission Required
        </Text>
      </Box>
      <Box marginLeft={3} flexDirection="column">
        <Text>
          <Text bold>{toolName}</Text>
          <Text color="gray"> — {reason}</Text>
        </Text>
        <Text color="gray" dimColor>
          {truncatedArgs}
        </Text>
      </Box>
      <Box marginTop={1} marginLeft={3} gap={2}>
        <Text color="green" bold>
          [y]es
        </Text>
        <Text color="red" bold>
          [n]o
        </Text>
        <Text color="cyan" bold>
          [a]lways allow
        </Text>
      </Box>
    </Box>
  );
};
