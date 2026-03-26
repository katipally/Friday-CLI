import React from 'react';
import { Box, Text, useInput } from 'ink';
import { COLORS } from '@fridaycode/shared';

interface PermissionPromptProps {
  toolName: string;
  input: Record<string, unknown>;
  onAllow: () => void;
  onDeny: () => void;
  onAllowAlways: () => void;
}

export function PermissionPrompt({
  toolName,
  input,
  onAllow,
  onDeny,
  onAllowAlways,
}: PermissionPromptProps) {
  useInput((char, key) => {
    if (char === 'y' || char === 'Y') onAllow();
    if (char === 'n' || char === 'N') onDeny();
    if (char === 'a' || char === 'A') onAllowAlways();
    if (key.escape) onDeny();
  });

  // Summarize the input for display
  const inputSummary = Object.entries(input)
    .map(([k, v]) => {
      const val = typeof v === 'string' ? v.slice(0, 100) : JSON.stringify(v).slice(0, 100);
      return `  ${k}: ${val}`;
    })
    .join('\n');

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={COLORS.starkRose}
      paddingX={1}
      marginY={1}
    >
      <Text color={COLORS.starkRose} bold>
        ⚠ Permission Required
      </Text>
      <Box marginTop={1}>
        <Text>
          Tool{' '}
          <Text color={COLORS.deepViolet} bold>
            {toolName}
          </Text>{' '}
          wants to execute:
        </Text>
      </Box>
      <Box marginLeft={2} marginY={1}>
        <Text color={COLORS.icySlate}>{inputSummary}</Text>
      </Box>
      <Box gap={2}>
        <Text color={COLORS.acidicPistachio}>[y] Allow</Text>
        <Text color={COLORS.starkRose}>[n] Deny</Text>
        <Text color={COLORS.deepViolet}>[a] Always allow</Text>
        <Text color={COLORS.midnightSlate}>[Esc] Deny</Text>
      </Box>
    </Box>
  );
}
