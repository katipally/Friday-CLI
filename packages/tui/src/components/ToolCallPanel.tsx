import React from 'react';
import { Text, Box } from 'ink';
import Spinner from 'ink-spinner';
import { getTheme } from '../theme.js';

interface ToolExecution {
  id: string;
  name: string;
  status: 'running' | 'success' | 'error';
  duration?: number;
  output?: string;
}

interface ToolCallPanelProps {
  tools: ToolExecution[];
  collapsed?: boolean;
}

export const ToolCallPanel: React.FC<ToolCallPanelProps> = ({ tools, collapsed = false }) => {
  const theme = getTheme();

  if (tools.length === 0) return null;

  const running = tools.filter((t) => t.status === 'running').length;
  const done = tools.filter((t) => t.status !== 'running').length;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.colors.toolCall} marginY={1} paddingX={1}>
      <Box justifyContent="space-between">
        <Text color={theme.colors.toolCall} bold>
          {theme.icons.tool} Tools
        </Text>
        <Text color={theme.colors.textDim}>
          {running > 0 && <Text color={theme.colors.warning}>{running} running</Text>}
          {running > 0 && done > 0 && <Text> • </Text>}
          {done > 0 && <Text color={theme.colors.success}>{done} done</Text>}
        </Text>
      </Box>

      {!collapsed && tools.map((tool) => (
        <Box key={tool.id} paddingLeft={1}>
          {tool.status === 'running' ? (
            <Text color={theme.colors.spinner}><Spinner type="dots" /> </Text>
          ) : tool.status === 'success' ? (
            <Text color={theme.colors.success}>{theme.icons.success} </Text>
          ) : (
            <Text color={theme.colors.error}>{theme.icons.error} </Text>
          )}
          <Text color={theme.colors.text}>{tool.name}</Text>
          {tool.duration !== undefined && (
            <Text color={theme.colors.textDim}> ({tool.duration}ms)</Text>
          )}
        </Box>
      ))}
    </Box>
  );
};
