import React from 'react';
import { Box, Text, useInput } from 'ink';

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

  const inputSummary = Object.entries(input)
    .slice(0, 4)
    .map(([k, v]) => {
      const val = typeof v === 'string' ? v.slice(0, 80) : JSON.stringify(v).slice(0, 80);
      return `    ${k}: ${val}`;
    })
    .join('\n');

  return (
    <Box flexDirection="column" marginY={1} paddingLeft={2}>
      <Text color="#F43F5E" bold>
        ⚠  Permission required
      </Text>
      <Box marginTop={0} marginLeft={3}>
        <Text>
          <Text color="#22D3EE" bold>{toolName}</Text>
          <Text dimColor> wants to execute:</Text>
        </Text>
      </Box>
      <Box marginLeft={3} marginTop={0}>
        <Text dimColor>{inputSummary}</Text>
      </Box>
      <Box marginLeft={3} marginTop={1} gap={2}>
        <Text color="#A3E635" bold>[y] Allow</Text>
        <Text color="#F43F5E" bold>[n] Deny</Text>
        <Text color="#8B5CF6">[a] Always</Text>
        <Text dimColor>[esc] Cancel</Text>
      </Box>
    </Box>
  );
}
