import React from 'react';
import { Box, Text } from 'ink';
import InkSpinner from 'ink-spinner';
import { getTheme } from '../theme.js';

interface SpinnerProps {
  label?: string;
  color?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ label = 'Thinking...', color }) => {
  const t = getTheme();
  const spinnerColor = color || t.colors.primary;
  return (
    <Box gap={1} marginLeft={2}>
      <Text color={spinnerColor}>
        <InkSpinner type="dots" />
      </Text>
      <Text color={t.colors.muted}>{label}</Text>
    </Box>
  );
};
