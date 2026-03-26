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
    if (key === 'y') onRespond('allow_once');
    else if (key === 'n') onRespond('deny');
    else if (key === 'a') onRespond('allow_always');
  });

  const argsStr = JSON.stringify(args, null, 2);
  const truncated = argsStr.length > 150 ? argsStr.slice(0, 150) + '\u2026' : argsStr;

  return (
    <Box flexDirection="column" marginLeft={2} marginY={1}>
      <Box gap={1}>
        <Text color="yellow" bold>{'\u26A0'}</Text>
        <Text bold>{toolName}</Text>
        <Text dimColor>{reason}</Text>
      </Box>
      <Box marginLeft={4}>
        <Text dimColor>{truncated}</Text>
      </Box>
      <Box marginLeft={4} gap={2}>
        <Text color="green" bold>[y]es</Text>
        <Text color="red" bold>[n]o</Text>
        <Text color="cyan" bold>[a]lways</Text>
      </Box>
    </Box>
  );
};
