import React from 'react';
import { Box, Text } from 'ink';
import { getTheme } from '../theme.js';
import { type KeyBinding, formatKeyForDisplay } from '../keyboard/shortcuts.js';

export interface ShortcutBarProps {
  bindings: KeyBinding[];
  mode?: 'minimal' | 'full';
}

const MINIMAL_ACTIONS = new Set([
  'cancel-exit',
  'clear-screen',
  'new-session',
  'show-shortcuts',
]);

export const ShortcutBar: React.FC<ShortcutBarProps> = ({
  bindings,
  mode = 'minimal',
}) => {
  const theme = getTheme();
  const visible =
    mode === 'minimal'
      ? bindings.filter((b) => b.enabled !== false && MINIMAL_ACTIONS.has(b.action))
      : bindings.filter((b) => b.enabled !== false);

  if (visible.length === 0) return null;

  return (
    <Box
      flexDirection="row"
      paddingX={1}
      gap={1}
      borderStyle="single"
      borderColor={theme.colors.border}
      borderTop
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
    >
      {visible.map((binding) => (
        <Box key={binding.action} marginRight={1}>
          <Text bold color={theme.colors.accent}>
            {formatKeyForDisplay(binding.key)}
          </Text>
          <Text color={theme.colors.textDim}>{' '}{binding.description}</Text>
        </Box>
      ))}
    </Box>
  );
};
