import React from 'react';
import { Box, Text } from 'ink';
import { getTheme } from '../theme.js';

interface ToolOutputProps {
  toolName: string;
  args?: Record<string, unknown>;
  output?: string;
  success?: boolean;
  isExecuting?: boolean;
}

const MAX_LINES = 25;

function formatHeader(toolName: string, args: Record<string, unknown>): string {
  if (toolName === 'shell_exec' && args.command) return `$ ${String(args.command)}`;
  if ((toolName.startsWith('file_') || toolName === 'directory_tree') && (args.path || args.file_path)) {
    return String(args.path ?? args.file_path);
  }
  if ((toolName === 'grep' || toolName === 'glob') && args.pattern) return String(args.pattern);
  if (toolName === 'git' && args.subcommand) return `git ${String(args.subcommand)}`;
  const s = JSON.stringify(args);
  return s.length > 60 ? s.slice(0, 60) + '…' : s;
}

export const ToolOutput: React.FC<ToolOutputProps> = ({
  toolName,
  args,
  output,
  success,
  isExecuting = false,
}) => {
  const t = getTheme();
  const icon = isExecuting ? '⟳' : success === false ? '✘' : '✔';
  const iconColor = isExecuting ? t.colors.warning : success === false ? t.colors.error : t.colors.success;
  const header = args ? formatHeader(toolName, args) : '';

  const lines = output ? output.split('\n') : [];
  const truncated = lines.length > MAX_LINES;
  const displayLines = truncated ? lines.slice(0, MAX_LINES) : lines;

  return (
    <Box flexDirection="column" marginLeft={2} marginBottom={0}>
      <Box gap={1}>
        <Text color={iconColor}>{icon}</Text>
        <Text bold color={t.colors.toolCall}>{toolName}</Text>
        {header && <Text color={t.colors.muted}>{header}</Text>}
      </Box>
      {output && (
        <Box marginLeft={4} flexDirection="column">
          <Text color={success === false ? t.colors.error : t.colors.muted} wrap="wrap">
            {displayLines.join('\n')}
          </Text>
          {truncated && <Text color={t.colors.muted}>[+{lines.length - MAX_LINES} more lines]</Text>}
        </Box>
      )}
    </Box>
  );
};
