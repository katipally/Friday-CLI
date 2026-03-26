import React from 'react';
import { Box, Text, useInput } from 'ink';
import { getTheme } from '../theme.js';

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
  const t = getTheme();

  useInput((input) => {
    const key = input.toLowerCase();
    if (key === 'y') onRespond('allow_once');
    else if (key === 'n') onRespond('deny');
    else if (key === 'a') onRespond('allow_always');
  });

  const argsStr = JSON.stringify(args, null, 2);
  const truncated = argsStr.length > 200 ? argsStr.slice(0, 200) + '…' : argsStr;

  return (
    <Box flexDirection="column" marginLeft={2} marginY={1}>
      <Box gap={1}>
        <Text color={t.colors.warning} bold>⚠</Text>
        <Text bold>Permission required:</Text>
        <Text color={t.colors.toolCall} bold>{toolName}</Text>
      </Box>
      {reason && (
        <Box marginLeft={4}>
          <Text color={t.colors.muted}>{reason}</Text>
        </Box>
      )}
      <Box marginLeft={4}>
        <Text color={t.colors.muted}>{truncated}</Text>
      </Box>
      <Box marginLeft={4} gap={2} marginTop={0}>
        <Text color={t.colors.permissionAllow} bold>[y]es</Text>
        <Text color={t.colors.permissionDeny} bold>[n]o</Text>
        <Text color={t.colors.primary} bold>[a]lways</Text>
      </Box>
    </Box>
  );
};
